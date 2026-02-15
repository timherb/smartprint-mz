/**
 * F002 - Printer Integration Module: Printer Discovery & Caching
 *
 * Discovers available printers via Electron's webContents.getPrintersAsync(),
 * caches printer capabilities in electron-store, and supports multi-printer
 * load balancing (up to 4 printers).
 */

import { BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
import ElectronStoreModule from 'electron-store'
// Handle ESM/CJS interop - electron-store v11 is ESM-only
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ElectronStore = ((ElectronStoreModule as any).default || ElectronStoreModule) as typeof ElectronStoreModule
import winston from 'winston'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PrinterStatus = 'ready' | 'busy' | 'paused' | 'offline' | 'error' | 'unknown'

export interface PaperSize {
  name: string
  width: number // millimetres
  height: number // millimetres
}

export interface PrinterCapabilities {
  paperSizes: PaperSize[]
  paperTypes: string[]
  color: boolean
  duplex: boolean
}

export interface PrinterInfo {
  name: string
  displayName: string
  description: string
  driver: string
  status: PrinterStatus
  isDefault: boolean
  capabilities: PrinterCapabilities
  lastSeen: number // epoch ms
}

export interface PrinterCacheSchema {
  printers: Record<string, PrinterInfo>
  lastDiscovery: number
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { module: 'printer-manager' },
  transports: [new winston.transports.Console({ format: winston.format.simple() })]
})

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const store = new ElectronStore<PrinterCacheSchema>({
  name: 'printer-cache',
  defaults: {
    printers: {},
    lastDiscovery: 0
  }
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of printers for load-balancing pool */
const MAX_POOL_PRINTERS = 4

/** How long (ms) before cached discovery data is considered stale */
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Standard paper sizes we expose by default when OS doesn't provide detail */
const DEFAULT_PAPER_SIZES: PaperSize[] = [
  { name: 'A4', width: 210, height: 297 },
  { name: 'A5', width: 148, height: 210 },
  { name: 'A6', width: 105, height: 148 },
  { name: 'Letter', width: 216, height: 279 },
  { name: '4x6', width: 102, height: 152 },
  { name: '5x7', width: 127, height: 178 }
]

const DEFAULT_PAPER_TYPES: string[] = ['Plain', 'Glossy', 'Matte', 'Photo']

// ---------------------------------------------------------------------------
// State (in-memory, complemented by persisted cache)
// ---------------------------------------------------------------------------

let discoveredPrinters: PrinterInfo[] = []
let discoveryPromise: Promise<PrinterInfo[]> | null = null
let printerPool: string[] = [] // names of printers in the active pool

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveStatus(electronStatus: number, options: Record<string, string>): PrinterStatus {
  // Electron's PrinterInfo.status is the OS-level printer status integer
  // On macOS/CUPS: 3=idle, 4=processing, 5=stopped
  // On Windows: bitmask from PRINTER_STATUS_* flags (0 = idle/ready)

  if (process.platform === 'win32') {
    // Windows: status is a bitmask. 0 means no flags set = idle/ready.
    if (electronStatus === 0) return 'ready'

    const PAUSED = 0x1
    const ERROR = 0x2
    const OFFLINE = 0x80
    const PAPER_JAM = 0x8
    const PAPER_OUT = 0x10
    const PRINTING = 0x400
    const PROCESSING = 0x4000

    if (electronStatus & OFFLINE) return 'offline'
    if (electronStatus & (ERROR | PAPER_JAM | PAPER_OUT)) return 'error'
    if (electronStatus & PAUSED) return 'paused'
    if (electronStatus & (PRINTING | PROCESSING)) return 'busy'

    return 'ready'
  }

  // macOS/Linux CUPS: 3=idle, 4=processing, 5=stopped
  if (electronStatus === 3) return 'ready'
  if (electronStatus === 4) return 'busy'
  if (electronStatus === 5) return 'offline'

  // Fallback: check CUPS options (macOS returns ep.status=0 for all printers)
  const reasons = (options['printer-state-reasons'] ?? '').toLowerCase()
  const stateStr = (options['printer-state'] ?? '').toLowerCase()

  // IMPORTANT: Check reasons FIRST — on macOS, printer-state can be "3" (idle)
  // even when the printer is offline. "offline-report" in reasons = truly offline.
  if (reasons.includes('offline')) return 'offline'
  if (reasons.includes('paused')) return 'paused'
  if (reasons.includes('stopped') || reasons.includes('shutdown')) return 'offline'
  if (reasons.includes('error') || reasons.includes('media-jam') || reasons.includes('toner-empty-error')) return 'error'

  // Now check printer-state (only trust it if reasons didn't say offline)
  if (stateStr === '3') return 'ready'
  if (stateStr === '4') return 'busy'
  if (stateStr === '5') return 'offline'

  logger.warn(`[PrinterManager] Unknown printer status: electronStatus=${electronStatus} state="${stateStr}" reasons="${reasons}"`)
  return 'unknown'
}

/** Parse CUPS media names into PaperSize objects */
function parsePaperSizes(opts: Record<string, string>): PaperSize[] {
  // CUPS provides media as e.g. "na_letter_8.5x11in" or media-supported as comma-separated list
  const mediaSupported = opts['media-supported'] ?? ''
  const media = opts['media'] ?? ''
  const mediaList = mediaSupported
    ? mediaSupported.split(',').map((s) => s.trim())
    : media
      ? [media]
      : []

  return mediaList
    .filter((m) => m.length > 0)
    .map((m) => {
      // Try to parse dimensions from CUPS media name like "na_letter_8.5x11in" or "custom_4x6in_4x6in"
      const dimMatch = m.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(in|mm|cm)/)
      let width = 0
      let height = 0
      if (dimMatch) {
        const [, w, h, unit] = dimMatch
        const scale = unit === 'in' ? 25.4 : unit === 'cm' ? 10 : 1
        width = Math.round(parseFloat(w) * scale)
        height = Math.round(parseFloat(h) * scale)
      }
      // Create a friendly name
      const friendlyName = m
        .replace(/^(na|iso|jis|oe|om|custom)_/, '')
        .replace(/_/g, ' ')
        .replace(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(in|mm|cm)/, '$1x$2"')
      return { name: friendlyName, width, height }
    })
}

/**
 * Deduplicate printers that represent the same physical device connected
 * via different protocols (USB vs AirPrint vs network).
 *
 * Uses device-uri serial/UUID to identify the same physical device.
 * Printers with different serials (e.g., "DNP DS40" and "DNP DS40(1)")
 * are treated as separate devices and kept.
 */
function deduplicatePrinters(printers: PrinterInfo[], allOpts: Map<string, Record<string, string>>): PrinterInfo[] {
  const seen = new Map<string, PrinterInfo>()
  const statusRank: Record<string, number> = { ready: 4, busy: 3, paused: 2, unknown: 1, offline: 0, error: 0 }

  for (const p of printers) {
    const opts = allOpts.get(p.name) ?? {}
    const deviceUri = opts['device-uri'] ?? ''

    // Extract a unique device identifier from the URI
    // USB: usb://Manufacturer/Model?serial=XXXX → serial
    // DNS-SD: dnssd://Name._ipp._tcp.local./?uuid=XXXX → uuid
    // IPP-USB: ippusb://Name._ipp._tcp.local./?uuid=XXXX → uuid
    const serialMatch = deviceUri.match(/[?&]serial=([^&]+)/)
    const uuidMatch = deviceUri.match(/[?&]uuid=([^&]+)/)
    const deviceId = serialMatch?.[1] ?? uuidMatch?.[1] ?? ''

    // If we have a device ID, use model+deviceId as key (same physical printer)
    // If no device ID, use the full CUPS queue name (can't deduplicate safely)
    const model = (opts['printer-make-and-model'] ?? p.displayName).toLowerCase()
    const key = deviceId ? `${model}::${deviceId}` : p.name

    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, p)
    } else {
      // Same physical device, different queue — keep the best one
      const existingRank = statusRank[existing.status] ?? 0
      const newRank = statusRank[p.status] ?? 0
      if (newRank > existingRank || (p.isDefault && !existing.isDefault)) {
        seen.set(key, p.isDefault ? p : existing.isDefault ? { ...p, isDefault: true } : p)
      }
    }
  }

  return Array.from(seen.values())
}

function mapElectronPrinter(ep: Electron.PrinterInfo): PrinterInfo {
  const opts = (ep.options ?? {}) as Record<string, string>
  // Electron's runtime PrinterInfo has .status (number) and .isDefault (boolean)
  // but the TypeScript defs may not include them depending on version
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epAny = ep as any
  const electronStatus: number = epAny.status ?? 0
  const isDefault: boolean = epAny.isDefault ?? opts['isDefault'] === 'true'
  const status = deriveStatus(electronStatus, opts)

  logger.info(`[PrinterManager] Printer "${ep.name}": ep.status=${electronStatus}, derived=${status}, isDefault=${isDefault}, opts=${JSON.stringify(opts)}`)

  // Parse paper sizes from CUPS media-supported or media field
  const paperSizes = parsePaperSizes(opts)

  return {
    name: ep.name,
    displayName: opts['printer-info'] || ep.displayName,
    description: ep.description,
    driver: opts['printer-make-and-model'] ?? opts['driver'] ?? ep.description,
    status,
    isDefault,
    capabilities: {
      paperSizes: paperSizes.length > 0 ? paperSizes : DEFAULT_PAPER_SIZES,
      paperTypes: DEFAULT_PAPER_TYPES,
      color: true,
      duplex: opts['duplex'] !== 'none'
    },
    lastSeen: Date.now()
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover printers available on the system.
 *
 * Uses lazy loading: the first call triggers discovery, subsequent calls within
 * CACHE_TTL_MS return the cached result. Parallel callers share a single
 * in-flight promise.
 *
 * @param forceRefresh  bypass the cache and re-enumerate
 */
export async function discoverPrinters(forceRefresh = false): Promise<PrinterInfo[]> {
  // Return in-flight promise if one is already running
  if (discoveryPromise && !forceRefresh) {
    return discoveryPromise
  }

  // Return cached result when still fresh
  const lastDiscovery = store.get('lastDiscovery')
  if (!forceRefresh && Date.now() - lastDiscovery < CACHE_TTL_MS && discoveredPrinters.length > 0) {
    logger.info('Returning cached printer list', { count: discoveredPrinters.length })
    return discoveredPrinters
  }

  discoveryPromise = performDiscovery()

  try {
    const result = await discoveryPromise
    return result
  } finally {
    discoveryPromise = null
  }
}

async function performDiscovery(): Promise<PrinterInfo[]> {
  logger.info('Starting printer discovery...')

  try {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) {
      logger.warn('No BrowserWindow available for printer discovery, returning cached data')
      return loadCachedPrinters()
    }

    const electronPrinters = await win.webContents.getPrintersAsync()
    logger.info('Electron returned printers', { count: electronPrinters.length })

    // Build options map for deduplication (need device-uri from each printer)
    const optsMap = new Map<string, Record<string, string>>()
    const allPrinters = electronPrinters.map((ep) => {
      const mapped = mapElectronPrinter(ep)
      optsMap.set(mapped.name, (ep.options ?? {}) as Record<string, string>)
      return mapped
    })
    discoveredPrinters = deduplicatePrinters(allPrinters, optsMap)

    logger.info('After deduplication', { before: allPrinters.length, after: discoveredPrinters.length })

    // Persist to cache
    const printerMap: Record<string, PrinterInfo> = {}
    for (const p of discoveredPrinters) {
      printerMap[p.name] = p
    }
    store.set('printers', printerMap)
    store.set('lastDiscovery', Date.now())

    logger.info('Printer discovery complete', {
      count: discoveredPrinters.length,
      names: discoveredPrinters.map((p) => p.name)
    })

    return discoveredPrinters
  } catch (error) {
    logger.error('Printer discovery failed', { error: String(error) })
    return loadCachedPrinters()
  }
}

/**
 * Load printers from the persisted electron-store cache.
 */
function loadCachedPrinters(): PrinterInfo[] {
  const cached = store.get('printers')
  const list = Object.values(cached)
  // Mark all cached printers with unknown status since we couldn't verify
  discoveredPrinters = list.map((p) => ({ ...p, status: 'unknown' as PrinterStatus }))
  logger.info('Loaded printers from cache', { count: discoveredPrinters.length })
  return discoveredPrinters
}

/**
 * Return the currently known printer list (without triggering discovery).
 */
export async function getPrinters(): Promise<PrinterInfo[]> {
  if (discoveredPrinters.length === 0) {
    return discoverPrinters()
  }
  return discoveredPrinters
}

/**
 * Look up a single printer by its OS name.
 */
export async function getPrinterByName(name: string): Promise<PrinterInfo | null> {
  const printers = await getPrinters()
  return printers.find((p) => p.name === name) ?? null
}

// ---------------------------------------------------------------------------
// Multi-printer pool / load balancing
// ---------------------------------------------------------------------------

/**
 * Set the pool of printers used for load-balanced printing.
 *
 * @param names  printer OS names (max 4)
 */
export async function setPrinterPool(names: string[]): Promise<{ pool: string[] }> {
  const trimmed = names.slice(0, MAX_POOL_PRINTERS)
  const available = await getPrinters()
  const availableNames = new Set(available.map((p) => p.name))

  printerPool = trimmed.filter((n) => {
    if (!availableNames.has(n)) {
      logger.warn('Printer not available, excluded from pool', { printer: n })
      return false
    }
    return true
  })

  logger.info('Printer pool updated', { pool: printerPool })
  return { pool: printerPool }
}

/**
 * Get the current printer pool.
 */
export function getPrinterPool(): string[] {
  return [...printerPool]
}

/**
 * Select the next printer from the pool using round-robin.
 * Skips printers that are offline or in error state.
 *
 * Returns `null` when no healthy printer is available.
 */
let roundRobinIndex = 0

export async function selectNextPrinter(): Promise<PrinterInfo | null> {
  if (printerPool.length === 0) {
    // Fall back to default or first ready printer
    const all = await getPrinters()
    const defaultPrinter = all.find((p) => p.isDefault && p.status === 'ready')
    if (defaultPrinter) return defaultPrinter
    return all.find((p) => p.status === 'ready') ?? null
  }

  const all = await getPrinters()
  const poolMap = new Map(all.filter((p) => printerPool.includes(p.name)).map((p) => [p.name, p]))

  // Try each printer in the pool starting from the current index
  for (let i = 0; i < printerPool.length; i++) {
    const idx = (roundRobinIndex + i) % printerPool.length
    const name = printerPool[idx]
    const printer = poolMap.get(name)
    if (printer && printer.status !== 'offline' && printer.status !== 'error') {
      roundRobinIndex = (idx + 1) % printerPool.length
      return printer
    }
  }

  logger.warn('No healthy printer available in pool')
  return null
}

/**
 * Invalidate the cache and clear in-memory printers.
 */
export async function clearPrinterCache(): Promise<void> {
  store.set('printers', {})
  store.set('lastDiscovery', 0)
  discoveredPrinters = []
  logger.info('Printer cache cleared')
}

/**
 * Query the print driver for supported media sizes.
 * On macOS/Linux, uses `lpoptions -p <printer> -l` to read CUPS options.
 * On Windows, uses `wmic` or PowerShell to query printer capabilities.
 * Returns an array of paper size names (e.g., ["4x6", "5x7", "Letter"]).
 */
export async function getMediaSizes(printerName: string): Promise<PaperSize[]> {
  logger.info('Querying media sizes for printer', { printerName })

  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      return await getCupsMediaSizes(printerName)
    } else if (process.platform === 'win32') {
      return await getWindowsMediaSizes(printerName)
    }
    logger.warn('Unsupported platform for media query', { platform: process.platform })
    return DEFAULT_PAPER_SIZES
  } catch (err) {
    logger.error('Failed to query media sizes', { printerName, error: (err as Error).message })
    return DEFAULT_PAPER_SIZES
  }
}

async function getCupsMediaSizes(printerName: string): Promise<PaperSize[]> {
  // lpoptions -p <name> -l returns all configurable options including PageSize/media
  const { stdout } = await execAsync(`lpoptions -p "${printerName}" -l 2>/dev/null`, { timeout: 5000 })

  // Look for PageSize or media option line, e.g.:
  // PageSize/Media Size: *Letter Legal 4x6 5x7 A4
  // or: media/Media Size: na_letter_8.5x11in iso_a4_210x297mm custom_4x6in_4x6in
  const sizes: PaperSize[] = []
  const lines = stdout.split('\n')

  for (const line of lines) {
    const match = line.match(/^(PageSize|media)\/.+?:\s*(.+)$/i)
    if (!match) continue

    const optionKey = match[1]
    const values = match[2].split(/\s+/).filter((v) => v.length > 0)

    for (const val of values) {
      // Strip leading * (marks the default)
      const clean = val.replace(/^\*/, '')

      if (optionKey.toLowerCase() === 'pagesize') {
        // PPD-style names: Letter, Legal, 4x6, 5x7.Fullbleed, etc.
        const friendly = clean.replace(/\.Fullbleed$/i, '').replace(/\.Borderless$/i, ' Borderless')
        const dims = ppdToDimensions(clean)
        sizes.push({ name: friendly, width: dims.width, height: dims.height })
      } else {
        // CUPS media names: na_letter_8.5x11in, custom_4x6in_4x6in
        const dimMatch = clean.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(in|mm)/)
        let width = 0, height = 0
        if (dimMatch) {
          const scale = dimMatch[3] === 'in' ? 25.4 : 1
          width = Math.round(parseFloat(dimMatch[1]) * scale)
          height = Math.round(parseFloat(dimMatch[2]) * scale)
        }
        const friendly = clean
          .replace(/^(na|iso|jis|oe|om|custom)_/, '')
          .replace(/_/g, ' ')
          .replace(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(in|mm)/, '$1x$2"')
        sizes.push({ name: friendly, width, height })
      }
    }
    break // Only need the first PageSize/media line
  }

  logger.info('CUPS media sizes found', { printerName, count: sizes.length, sizes: sizes.map((s) => s.name) })
  return sizes.length > 0 ? sizes : DEFAULT_PAPER_SIZES
}

/** Map common PPD PageSize names to mm dimensions */
function ppdToDimensions(name: string): { width: number; height: number } {
  const clean = name.replace(/\..*$/, '').toLowerCase()
  const known: Record<string, { width: number; height: number }> = {
    letter: { width: 216, height: 279 },
    legal: { width: 216, height: 356 },
    a4: { width: 210, height: 297 },
    a5: { width: 148, height: 210 },
    a6: { width: 105, height: 148 },
    '4x6': { width: 102, height: 152 },
    '5x7': { width: 127, height: 178 },
    '6x8': { width: 152, height: 203 },
    '8x10': { width: 203, height: 254 },
    '8x12': { width: 203, height: 305 },
    '3.5x5': { width: 89, height: 127 },
  }
  return known[clean] ?? { width: 0, height: 0 }
}

async function getWindowsMediaSizes(printerName: string): Promise<PaperSize[]> {
  // Use .NET System.Drawing.Printing.PrinterSettings.PaperSizes — same API
  // that C# apps use to enumerate driver-reported paper sizes.
  const psPrinter = printerName.replace(/'/g, "''")
  const cmd = `powershell -NoProfile -NonInteractive -Command "Add-Type -AssemblyName System.Drawing; $ps = New-Object System.Drawing.Printing.PrinterSettings; $ps.PrinterName = '${psPrinter}'; $ps.PaperSizes | ForEach-Object { $_.PaperName + '|' + [Math]::Round($_.Width / 100 * 25.4) + '|' + [Math]::Round($_.Height / 100 * 25.4) }"`
  try {
    const { stdout } = await execAsync(cmd, { timeout: 10000 })
    const lines = stdout.trim().split(/\r?\n/).filter((v) => v.length > 0)
    if (lines.length === 0) return DEFAULT_PAPER_SIZES

    const sizes: PaperSize[] = lines.map((line) => {
      const [name, w, h] = line.split('|')
      return {
        name: name?.trim() ?? 'Unknown',
        width: parseInt(w, 10) || 0,
        height: parseInt(h, 10) || 0
      }
    })

    logger.info('Windows paper sizes from driver', {
      printerName,
      count: sizes.length,
      sizes: sizes.map((s) => s.name)
    })

    return sizes.length > 0 ? sizes : DEFAULT_PAPER_SIZES
  } catch (err) {
    logger.warn('Failed to query Windows paper sizes', { printerName, error: (err as Error).message })
    return DEFAULT_PAPER_SIZES
  }
}
