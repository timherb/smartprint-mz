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
// Event emission
// ---------------------------------------------------------------------------

/**
 * Send a printer-related event to all renderer windows.
 */
export function emitPrinterEvent(type: string, data: Record<string, unknown>): void {
  const event: PrinterEvent = { type, data, timestamp: Date.now() }
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    try {
      win.webContents.send('printer:event', event)
    } catch {
      // Window may have been destroyed
    }
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Perform a single health check: re-discover printers and compare statuses.
 */
export async function checkHealth(): Promise<QueueHealth> {
  try {
    const printers = await discoverPrinters(true)
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

  // Run an initial check immediately
  await checkHealth()

  healthCheckInterval = setInterval(async () => {
    try {
      await checkHealth()
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
