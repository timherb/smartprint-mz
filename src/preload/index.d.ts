import { ElectronAPI } from '@electron-toolkit/preload'

// ---------------------------------------------------------------------------
// Cloud API types
// ---------------------------------------------------------------------------

interface CloudPhotoReadyPayload {
  filePath: string
  filename: string
}

interface CloudErrorPayload {
  error: string
}

interface CloudConnectionStatusPayload {
  connected: boolean
}

interface CloudAPI {
  register: (key: string) => Promise<{ success: boolean; error?: string }>
  start: () => Promise<{ success: boolean }>
  stop: () => Promise<{ success: boolean }>
  confirmPrint: (filename: string) => Promise<{ success: boolean; error?: string }>
  health: () => Promise<{ status: 'ok' } | null>
  status: () => Promise<{
    registered: boolean
    polling: boolean
    connected: boolean
    lastPollTime: number | null
    lastHealthCheckTime: number | null
  }>
  onPhotoReady: (callback: (payload: CloudPhotoReadyPayload) => void) => () => void
  onError: (callback: (payload: CloudErrorPayload) => void) => () => void
  onConnectionStatus: (callback: (payload: CloudConnectionStatusPayload) => void) => () => void
}

// ---------------------------------------------------------------------------
// Watcher (Local Mode) API types
// ---------------------------------------------------------------------------

interface WatcherPhotoReadyPayload {
  filepath: string
  filename: string
  sizeBytes: number
}

interface WatcherPhotoPrintedPayload {
  filename: string
  destination: string
}

interface WatcherErrorPayload {
  error: string
  filepath?: string
}

interface WatcherAPI {
  start: (directory: string) => Promise<{ success: boolean; directory: string }>
  stop: () => Promise<{ success: boolean }>
  moveToProcessed: (filepath: string) => Promise<{ success: boolean }>
  status: () => Promise<{ running: boolean; directory: string | null }>
  scanPending: (directory: string) => Promise<{
    success: boolean
    files: Array<{ filename: string; filepath: string; sizeBytes: number }>
  }>
  onPhotoReady: (callback: (payload: WatcherPhotoReadyPayload) => void) => () => void
  onPhotoPrinted: (callback: (payload: WatcherPhotoPrintedPayload) => void) => () => void
  onError: (callback: (payload: WatcherErrorPayload) => void) => () => void
}

interface GalleryPhotoDTO {
  filename: string
  filepath: string
  sizeBytes: number
  printedAt: number
}

interface GalleryAPI {
  scanPrintedFolder: (directory: string) => Promise<{
    success: boolean
    photos: GalleryPhotoDTO[]
  }>
}

// ---------------------------------------------------------------------------
// Printer API types (F002)
// ---------------------------------------------------------------------------

interface PaperSizeDTO {
  name: string
  width: number
  height: number
}

interface PrinterCapabilitiesDTO {
  paperSizes: PaperSizeDTO[]
  paperTypes: string[]
  color: boolean
  duplex: boolean
}

interface PrinterInfoDTO {
  name: string
  displayName: string
  description: string
  driver: string
  status: string
  isDefault: boolean
  capabilities: PrinterCapabilitiesDTO
  lastSeen: number
}

interface PrintJobOptionsDTO {
  printerName?: string
  copies?: number
  color?: boolean
  paperSize?: string
  landscape?: boolean
  silent?: boolean
}

interface PrintJobDTO {
  id: string
  filename: string
  filepath: string
  printerName: string
  status: string
  options: PrintJobOptionsDTO
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  error: string | null
  retries: number
}

interface SubmitJobResultDTO {
  jobId: string
  printerName: string
  status: string
}

interface QueueSnapshotDTO {
  pending: number
  printing: number
  completed: number
  failed: number
  total: number
  jobs: PrintJobDTO[]
}

interface PrinterHealthStatusDTO {
  name: string
  displayName: string
  status: string
  lastSeen: number
}

interface QueueHealthDTO {
  printersOnline: number
  printersOffline: number
  printers: PrinterHealthStatusDTO[]
  lastCheck: number
}

interface PrinterEventDTO {
  type: string
  data: Record<string, unknown>
  timestamp: number
}

interface PrinterAPI {
  discover: (forceRefresh?: boolean) => Promise<PrinterInfoDTO[]>
  list: () => Promise<PrinterInfoDTO[]>
  get: (name: string) => Promise<PrinterInfoDTO | null>
  setPool: (names: string[]) => Promise<{ pool: string[] }>
  getPool: () => Promise<string[]>
  clearCache: () => Promise<{ success: boolean }>
  mediaSizes: (printerName: string) => Promise<PaperSizeDTO[]>
  submitJob: (filename: string, filepath: string, options?: PrintJobOptionsDTO) => Promise<SubmitJobResultDTO>
  getJob: (jobId: string) => Promise<PrintJobDTO | null>
  cancelJob: (jobId: string) => Promise<PrintJobDTO | null>
  queueSnapshot: () => Promise<QueueSnapshotDTO>
  clearFinished: () => Promise<{ cleared: number }>
  health: () => Promise<QueueHealthDTO>
  startMonitor: () => Promise<{ success: boolean }>
  stopMonitor: () => Promise<{ success: boolean }>
  onEvent: (callback: (payload: PrinterEventDTO) => void) => () => void
}

// ---------------------------------------------------------------------------
// Combined API
// ---------------------------------------------------------------------------

interface SmartPrintAPI {
  ping: () => Promise<string>
  setWindowTitle: (title: string) => void
  openDirectory: () => Promise<{ canceled: boolean; path: string }>
  readImageAsDataUrl: (filepath: string) => Promise<string | null>
  settings: {
    get: () => Promise<Record<string, unknown>>
    set: (data: Record<string, unknown>) => Promise<{ success: boolean }>
  }
  gallery: GalleryAPI
  cloud: CloudAPI
  watcher: WatcherAPI
  printer: PrinterAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: SmartPrintAPI
  }
}
