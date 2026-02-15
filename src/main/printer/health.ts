/**
 * F002 - Printer Integration Module: Health Monitoring
 *
 * Periodically checks printer health, emits status-change events via
 * Electron's IPC so the renderer can react, and exposes a queue health
 * summary.
 */

import { BrowserWindow } from 'electron'
import winston from 'winston'
import { discoverPrinters, getPrinters } from './manager'
import type { PrinterInfo, PrinterStatus } from './manager'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrinterHealthStatus {
  name: string
  displayName: string
  status: PrinterStatus
  lastSeen: number
}

export interface QueueHealth {
  printersOnline: number
  printersOffline: number
  printers: PrinterHealthStatus[]
  lastCheck: number
}

export interface PrinterEvent {
  type: string
  data: Record<string, unknown>
  timestamp: number
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  defaultMeta: { module: 'printer-health' },
  transports: [new winston.transports.Console({ format: winston.format.simple() })]
})

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let healthCheckInterval: ReturnType<typeof setInterval> | null = null
let lastKnownStatuses: Map<string, PrinterStatus> = new Map()
const HEALTH_CHECK_INTERVAL_MS = 30_000 // 30 seconds

// ---------------------------------------------------------------------------
// Main window reference
// ---------------------------------------------------------------------------

let mainWindowRef: BrowserWindow | null = null

/**
 * Set the main window reference for event emission.
 * Must be called once after creating the main BrowserWindow.
 */
export function setHealthMainWindowRef(win: BrowserWindow): void {
  mainWindowRef = win
}

// ---------------------------------------------------------------------------
// Event emission
// ---------------------------------------------------------------------------

/**
 * Send a printer-related event to the main renderer window.
 * Uses a stored window reference to avoid the getAllWindows() pitfall
 * where hidden print windows can intercept events.
 */
export function emitPrinterEvent(type: string, data: Record<string, unknown>): void {
  const event: PrinterEvent = { type, data, timestamp: Date.now() }
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    try {
      mainWindowRef.webContents.send('printer:event', event)
    } catch {
      // Window may have been destroyed between check and send
    }
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Perform a single health check: re-discover printers and compare statuses.
 *
 * Uses non-forced discovery by default so the 5-minute cache is respected.
 * This prevents hammering the OS printer API every 30 seconds which is
 * wasteful on low-end Windows laptops used at events.
 * The forceRefresh parameter can be used for explicit user-triggered checks.
 */
export async function checkHealth(forceRefresh = false): Promise<QueueHealth> {
  try {
    const printers = await discoverPrinters(forceRefresh)
    return buildHealthReport(printers)
  } catch (error) {
    logger.error('Health check failed', { error: String(error) })
    // Return a report based on whatever we had last
    const printers = await getPrinters()
    return buildHealthReport(printers)
  }
}

function buildHealthReport(printers: PrinterInfo[]): QueueHealth {
  const healthStatuses: PrinterHealthStatus[] = printers.map((p) => ({
    name: p.name,
    displayName: p.displayName,
    status: p.status,
    lastSeen: p.lastSeen
  }))

  // Detect status changes and emit events
  for (const printer of printers) {
    const prev = lastKnownStatuses.get(printer.name)
    if (prev !== undefined && prev !== printer.status) {
      logger.info('Printer status changed', {
        printer: printer.name,
        from: prev,
        to: printer.status
      })
      emitPrinterEvent('printer:statusChange', {
        printer: printer.name,
        displayName: printer.displayName,
        previousStatus: prev,
        currentStatus: printer.status
      })
    }
    lastKnownStatuses.set(printer.name, printer.status)
  }

  // Remove printers that vanished
  for (const [name] of lastKnownStatuses) {
    if (!printers.find((p) => p.name === name)) {
      const prev = lastKnownStatuses.get(name)
      lastKnownStatuses.delete(name)
      emitPrinterEvent('printer:statusChange', {
        printer: name,
        previousStatus: prev,
        currentStatus: 'offline'
      })
    }
  }

  const report: QueueHealth = {
    printersOnline: printers.filter((p) => p.status === 'ready' || p.status === 'busy').length,
    printersOffline: printers.filter(
      (p) => p.status === 'offline' || p.status === 'error' || p.status === 'unknown'
    ).length,
    printers: healthStatuses,
    lastCheck: Date.now()
  }

  return report
}

// ---------------------------------------------------------------------------
// Periodic monitoring
// ---------------------------------------------------------------------------

/**
 * Start periodic health monitoring.
 *
 * @param intervalMs  check interval in milliseconds (default 30 000)
 */
export async function startHealthMonitor(intervalMs: number = HEALTH_CHECK_INTERVAL_MS): Promise<void> {
  if (healthCheckInterval) {
    logger.warn('Health monitor is already running')
    return
  }

  logger.info('Starting printer health monitor', { intervalMs })

  // Run an initial check immediately (forced to get fresh data)
  await checkHealth(true)

  healthCheckInterval = setInterval(async () => {
    try {
      // Health monitor always forces refresh to detect status changes
      await checkHealth(true)
    } catch (error) {
      logger.error('Periodic health check error', { error: String(error) })
    }
  }, intervalMs)
}

/**
 * Stop periodic health monitoring.
 */
export async function stopHealthMonitor(): Promise<void> {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
    logger.info('Printer health monitor stopped')
  }
}

/**
 * Return whether the health monitor is currently running.
 */
export function isHealthMonitorRunning(): boolean {
  return healthCheckInterval !== null
}
