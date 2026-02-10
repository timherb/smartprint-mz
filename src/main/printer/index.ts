/**
 * F002 - Printer Integration Module: Public API barrel export
 *
 * Re-exports all public types and functions from the printer sub-modules.
 */

// ---------------------------------------------------------------------------
// Manager — printer discovery, caching, pool
// ---------------------------------------------------------------------------
export {
  discoverPrinters,
  getPrinters,
  getPrinterByName,
  setPrinterPool,
  getPrinterPool,
  selectNextPrinter,
  clearPrinterCache,
  getMediaSizes
} from './manager'

export type {
  PrinterStatus,
  PaperSize,
  PrinterCapabilities,
  PrinterInfo,
  PrinterCacheSchema
} from './manager'

// ---------------------------------------------------------------------------
// Queue — job submission, tracking, management
// ---------------------------------------------------------------------------
export {
  submitPrintJob,
  getJob,
  cancelJob,
  getQueueSnapshot,
  clearFinishedJobs
} from './queue'

export type {
  JobStatus,
  PrintJobOptions,
  PrintJob,
  SubmitJobResult,
  QueueSnapshot
} from './queue'

// ---------------------------------------------------------------------------
// Health — monitoring, events
// ---------------------------------------------------------------------------
export {
  checkHealth,
  startHealthMonitor,
  stopHealthMonitor,
  isHealthMonitorRunning,
  emitPrinterEvent
} from './health'

export type {
  PrinterHealthStatus,
  QueueHealth,
  PrinterEvent
} from './health'
