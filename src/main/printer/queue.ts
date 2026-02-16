/**
 * F002 - Printer Integration Module: Print Job Queue
 *
 * Manages a print-job queue with per-job tracking, multi-printer load balancing,
 * and automatic fallback to the next healthy printer on failure.
 */

import { exec } from 'node:child_process'
import { stat, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
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

/**
 * Maximum number of finished jobs to keep in memory.
 * When exceeded, the oldest completed/failed/cancelled jobs are evicted
 * automatically to prevent unbounded memory growth at events.
 */
const MAX_FINISHED_JOBS = 200

/** Optional callback invoked when a print job completes or is cancelled. */
let _onJobDone: ((job: PrintJob) => void) | null = null

/** Register a callback to run after a job completes (success/fail) or is cancelled. */
export function setOnJobDone(cb: (job: PrintJob) => void): void {
  _onJobDone = cb
}

/**
 * Evict the oldest finished jobs when the map exceeds the cap.
 * Keeps active (pending/printing) jobs and the most recent finished ones.
 */
function evictOldFinishedJobs(): void {
  const finished: PrintJob[] = []
  for (const job of jobs.values()) {
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      finished.push(job)
    }
  }
  if (finished.length <= MAX_FINISHED_JOBS) return

  // Sort oldest first by completedAt (or createdAt as fallback)
  finished.sort((a, b) => (a.completedAt ?? a.createdAt) - (b.completedAt ?? b.createdAt))
  const toRemove = finished.length - MAX_FINISHED_JOBS
  for (let i = 0; i < toRemove; i++) {
    jobs.delete(finished[i].id)
  }
  logger.info('Evicted old finished jobs', { evicted: toRemove, remaining: jobs.size })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateJobId(): string {
  jobCounter += 1
  return `pj-${Date.now()}-${jobCounter}`
}

// ---------------------------------------------------------------------------
// Core printing
// ---------------------------------------------------------------------------

async function executePrint(job: PrintJob): Promise<boolean> {
  // Verify file exists
  try {
    await stat(job.filepath)
  } catch {
    throw new Error(`Image file not found: ${job.filepath}`)
  }

  const copies = job.options.copies ?? 1

  if (process.platform === 'win32') {
    return executePrintWindows(job.filepath, job.printerName, copies, job.id)
  }

  // macOS/Linux: use lp command
  return executePrintUnix(job.filepath, job.printerName, copies, job.id)
}

/**
 * Print on Windows using PowerShell + .NET System.Drawing.
 * This bypasses Electron's broken webContents.print() and goes through
 * the standard Windows GDI print pipeline that all native apps use.
 *
 * The script is written to a temp .ps1 file to avoid command-line quoting
 * issues that silently break the script when passed inline via -Command.
 */
async function executePrintWindows(
  filepath: string,
  printerName: string,
  copies: number,
  jobId: string
): Promise<boolean> {
  // Escape single quotes for PowerShell string literals
  const psPath = filepath.replace(/'/g, "''")
  const psPrinter = printerName.replace(/'/g, "''")

  const script = `
Add-Type -AssemblyName System.Drawing
try {
  $bmp = [System.Drawing.Bitmap]::FromFile('${psPath}')
  $pd = New-Object System.Drawing.Printing.PrintDocument
  $pd.PrinterSettings.PrinterName = '${psPrinter}'
  $pd.PrinterSettings.Copies = ${copies}
  $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)

  # Portrait images need to be rotated 90° for 6x4 printers that feed landscape
  $isPortrait = $bmp.Height -gt $bmp.Width
  if ($isPortrait) {
    # Rotate portrait images 90° clockwise
    $bmp.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)
  }
  # Always print in landscape orientation (6x4)
  $pd.DefaultPageSettings.Landscape = $true

  $pd.add_PrintPage({
    param($sender, $e)
    $destRect = $e.MarginBounds
    $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $e.Graphics.DrawImage($bmp, $destRect)
  })
  $pd.Print()
  $bmp.Dispose()
  Write-Output "PRINT_OK"
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`

  // Write script to a temp file to avoid cmd.exe quoting mangling
  const scriptPath = join(tmpdir(), `smart-print-${Date.now()}-${jobId}.ps1`)
  await writeFile(scriptPath, script, 'utf-8')

  logger.info('Printing via Windows GDI', { jobId, printer: printerName, filepath, scriptPath })

  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { timeout: 30000 },
      (error, stdout, stderr) => {
        // Clean up temp script
        unlink(scriptPath).catch(() => {})

        const output = stdout?.trim() ?? ''
        const errOutput = stderr?.trim() ?? ''

        if (error || !output.includes('PRINT_OK')) {
          logger.error('Windows print failed', {
            jobId,
            printer: printerName,
            error: error?.message ?? 'No PRINT_OK in output',
            stdout: output,
            stderr: errOutput
          })
          resolve(false)
        } else {
          logger.info('Windows print succeeded', { jobId, printer: printerName, stdout: output })
          resolve(true)
        }
      }
    )
  })
}

/**
 * Print on macOS/Linux using the lp command.
 */
function executePrintUnix(
  filepath: string,
  printerName: string,
  copies: number,
  jobId: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const args = ['-d', printerName, '-n', String(copies), filepath]
    logger.info('Printing via lp', { jobId, printer: printerName, filepath })

    exec(
      `lp ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`,
      { timeout: 30000 },
      (error, _stdout, stderr) => {
        if (error) {
          logger.error('Unix print failed', {
            jobId,
            printer: printerName,
            error: error.message,
            stderr: stderr?.trim()
          })
          resolve(false)
        } else {
          logger.info('Unix print succeeded', { jobId, printer: printerName })
          resolve(true)
        }
      }
    )
  })
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
        evictOldFinishedJobs()
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
  evictOldFinishedJobs()
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
