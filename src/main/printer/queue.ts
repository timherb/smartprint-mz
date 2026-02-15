/**
 * F002 - Printer Integration Module: Print Job Queue
 *
 * Manages a print-job queue with per-job tracking, multi-printer load balancing,
 * and automatic fallback to the next healthy printer on failure.
 */

import { BrowserWindow } from 'electron'
import { readFile, writeFile, unlink, mkdtemp } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { tmpdir } from 'node:os'
import winston from 'winston'
import { selectNextPrinter, getPrinterByName, getPrinterPool } from './manager'
import type { PrinterInfo } from './manager'
import { emitPrinterEvent } from './health'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobStatus = 'pending' | 'printing' | 'completed' | 'failed' | 'cancelled'

export interface PrintJobOptions {
  /** OS printer name. When omitted the pool / default printer is used. */
  printerName?: string
  /** Number of copies (default 1) */
  copies?: number
  /** Print in color (default true) */
  color?: boolean
  /** Paper size name, e.g. "A4", "4x6" */
  paperSize?: string
  /** Landscape orientation (default false) */
  landscape?: boolean
  /** Print silently without dialog (default true) */
  silent?: boolean
}

export interface PrintJob {
  id: string
  filename: string
  filepath: string
  printerName: string
  status: JobStatus
  options: PrintJobOptions
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  error: string | null
  retries: number
}

export interface SubmitJobResult {
  jobId: string
  printerName: string
  status: JobStatus
}

export interface QueueSnapshot {
  pending: number
  printing: number
  completed: number
  failed: number
  total: number
  jobs: PrintJob[]
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { module: 'printer-queue' },
  transports: [new winston.transports.Console({ format: winston.format.simple() })]
})

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const jobs: Map<string, PrintJob> = new Map()
let jobCounter = 0
const MAX_RETRIES = 2

/** Optional callback invoked when a print job completes or is cancelled. */
let _onJobDone: ((job: PrintJob) => void) | null = null

/** Register a callback to run after a job completes (success/fail) or is cancelled. */
export function setOnJobDone(cb: (job: PrintJob) => void): void {
  _onJobDone = cb
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateJobId(): string {
  jobCounter += 1
  return `pj-${Date.now()}-${jobCounter}`
}

function resolvePageSize(
  sizeName?: string
): 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'Legal' | 'Letter' | 'Tabloid' | undefined {
  if (!sizeName) return undefined
  const map: Record<string, 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'Legal' | 'Letter' | 'Tabloid'> = {
    a0: 'A0',
    a1: 'A1',
    a2: 'A2',
    a3: 'A3',
    a4: 'A4',
    a5: 'A5',
    a6: 'A6',
    legal: 'Legal',
    letter: 'Letter',
    tabloid: 'Tabloid'
  }
  return map[sizeName.toLowerCase()] ?? undefined
}

// ---------------------------------------------------------------------------
// Core printing
// ---------------------------------------------------------------------------

async function executePrint(job: PrintJob): Promise<boolean> {
  // Read the image as base64 and write a temp HTML file that embeds it.
  // We use a temp file + loadFile() instead of a data: URL because
  // Chromium has a ~2MB limit on data URL navigation which large images exceed.
  let imageDataUrl: string
  try {
    const buf = await readFile(job.filepath)
    const ext = extname(job.filepath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg'
    imageDataUrl = `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    throw new Error(`Image file not found or not readable: ${job.filepath}`)
  }

  const pageSize = resolvePageSize(job.options.paperSize)

  const html = `<!DOCTYPE html>
<html><head><style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; background: #fff; }
  img { width: 100%; height: 100%; object-fit: cover; }
</style></head><body>
  <img id="photo" src="${imageDataUrl}" />
</body></html>`

  // Write to a temp file so loadFile() works without URL length limits
  const tempDir = await mkdtemp(join(tmpdir(), 'smart-print-'))
  const tempHtml = join(tempDir, 'print.html')
  await writeFile(tempHtml, html, 'utf-8')

  const printWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: { offscreen: false }
  })

  try {
    await printWindow.loadFile(tempHtml)

    // Wait for the image to finish loading and get its dimensions
    const dimensions: { w: number; h: number } = await printWindow.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const img = document.getElementById('photo');
        if (img.complete && img.naturalWidth > 0) {
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
        } else {
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error('Image failed to load in print window'));
        }
      })
    `)

    // Auto-detect landscape from image dimensions unless explicitly set
    const landscape = job.options.landscape ?? (dimensions.w > dimensions.h)

    return new Promise<boolean>((resolve) => {
      printWindow.webContents.print(
        {
          silent: job.options.silent ?? true,
          printBackground: true,
          deviceName: job.printerName,
          color: job.options.color ?? true,
          copies: job.options.copies ?? 1,
          landscape,
          ...(pageSize ? { pageSize } : {})
        },
        (success, failureReason) => {
          if (!success) {
            logger.error('Print failed', {
              jobId: job.id,
              printer: job.printerName,
              reason: failureReason
            })
          }
          resolve(success)
        }
      )
    })
  } catch (err) {
    logger.error('Failed to prepare print window', {
      jobId: job.id,
      filepath: job.filepath,
      error: String(err)
    })
    throw err
  } finally {
    printWindow.destroy()
    // Clean up temp file
    unlink(tempHtml).catch(() => {})
  }
}

/**
 * Try to print a job, falling back to the next pool printer on failure.
 */
async function printWithFallback(job: PrintJob): Promise<void> {
  const triedPrinters = new Set<string>()

  while (job.retries <= MAX_RETRIES) {
    try {
      job.status = 'printing'
      job.startedAt = Date.now()
      emitPrinterEvent('job:status', { jobId: job.id, status: job.status, printer: job.printerName })

      const success = await executePrint(job)

      if (success) {
        job.status = 'completed'
        job.completedAt = Date.now()
        job.error = null
        emitPrinterEvent('job:status', { jobId: job.id, status: job.status, printer: job.printerName })
        logger.info('Print job completed', { jobId: job.id, printer: job.printerName })
        _onJobDone?.(job)
        return
      }

      // Print call returned failure
      triedPrinters.add(job.printerName)
      job.retries += 1

      // Attempt fallback to next printer in pool
      const pool = getPrinterPool()
      if (pool.length > 1) {
        const fallback = await findFallbackPrinter(triedPrinters)
        if (fallback) {
          logger.warn('Falling back to next printer', {
            jobId: job.id,
            from: job.printerName,
            to: fallback.name
          })
          job.printerName = fallback.name
          continue
        }
      }
    } catch (err) {
      triedPrinters.add(job.printerName)
      job.retries += 1
      job.error = err instanceof Error ? err.message : String(err)
      logger.error('Print attempt threw error', { jobId: job.id, error: job.error })

      // Try fallback
      const fallback = await findFallbackPrinter(triedPrinters)
      if (fallback) {
        job.printerName = fallback.name
        continue
      }
    }

    // If we exhausted retries or no fallback available
    break
  }

  job.status = 'failed'
  job.completedAt = Date.now()
  job.error = job.error ?? 'Print failed after all retries'
  emitPrinterEvent('job:status', { jobId: job.id, status: job.status, error: job.error })
  logger.error('Print job failed permanently', { jobId: job.id, error: job.error })
}

async function findFallbackPrinter(exclude: Set<string>): Promise<PrinterInfo | null> {
  const pool = getPrinterPool()
  for (const name of pool) {
    if (exclude.has(name)) continue
    const info = await getPrinterByName(name)
    if (info && info.status !== 'offline' && info.status !== 'error') {
      return info
    }
  }
  // Last resort: ask selectNextPrinter
  const next = await selectNextPrinter()
  if (next && !exclude.has(next.name)) return next
  return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a print job to the queue.
 *
 * @param filename  Display name of the file
 * @param filepath  Absolute path to the image file on disk
 * @param options   Printing options
 */
export async function submitPrintJob(
  filename: string,
  filepath: string,
  options: PrintJobOptions = {}
): Promise<SubmitJobResult> {
  // Deduplicate: skip if this file already has a pending or printing job
  for (const existing of jobs.values()) {
    if (existing.filepath === filepath && (existing.status === 'pending' || existing.status === 'printing')) {
      logger.info('Skipping duplicate print job for file already in queue', { filename, filepath })
      return { jobId: existing.id, printerName: existing.printerName, status: existing.status }
    }
  }

  let printerName = options.printerName ?? ''

  if (!printerName) {
    const selected = await selectNextPrinter()
    if (!selected) {
      throw new Error('No printer available. Please check that at least one printer is connected.')
    }
    printerName = selected.name
  }

  const job: PrintJob = {
    id: generateJobId(),
    filename,
    filepath,
    printerName,
    status: 'pending',
    options,
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    error: null,
    retries: 0
  }

  jobs.set(job.id, job)
  logger.info('Print job submitted', { jobId: job.id, filename, printer: printerName })
  emitPrinterEvent('job:status', { jobId: job.id, status: 'pending', printer: printerName })

  // Fire and forget -- caller gets the job id immediately
  printWithFallback(job).catch((err) => {
    logger.error('Unexpected error in printWithFallback', { jobId: job.id, error: String(err) })
  })

  return { jobId: job.id, printerName, status: 'pending' }
}

/**
 * Get a single job by id.
 */
export async function getJob(jobId: string): Promise<PrintJob | null> {
  return jobs.get(jobId) ?? null
}

/**
 * Cancel a pending or printing job.
 */
export async function cancelJob(jobId: string): Promise<PrintJob | null> {
  const job = jobs.get(jobId)
  if (!job) return null

  if (job.status === 'pending' || job.status === 'printing') {
    job.status = 'cancelled'
    job.completedAt = Date.now()
    emitPrinterEvent('job:status', { jobId: job.id, status: 'cancelled' })
    logger.info('Print job cancelled', { jobId })
    _onJobDone?.(job)
  }

  return job
}

/**
 * Get a snapshot of the entire queue.
 */
export async function getQueueSnapshot(): Promise<QueueSnapshot> {
  const allJobs = Array.from(jobs.values())
  return {
    pending: allJobs.filter((j) => j.status === 'pending').length,
    printing: allJobs.filter((j) => j.status === 'printing').length,
    completed: allJobs.filter((j) => j.status === 'completed').length,
    failed: allJobs.filter((j) => j.status === 'failed').length,
    total: allJobs.length,
    jobs: allJobs
  }
}

/**
 * Clear completed and failed jobs from the queue.
 */
export async function clearFinishedJobs(): Promise<number> {
  let cleared = 0
  for (const [id, job] of jobs) {
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      jobs.delete(id)
      cleared += 1
    }
  }
  logger.info('Cleared finished jobs', { count: cleared })
  return cleared
}
