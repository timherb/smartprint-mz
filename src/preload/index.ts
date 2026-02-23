import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type EventCallback<T> = (payload: T) => void

// Printer DTO types (mirror main process types for preload layer)
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

interface CloudEventDTO {
  id: number
  name: string
  externalID: string
  startDate: string
  endDate: string
  testEvent: string
}

const api = {
  // App: set window title
  setWindowTitle: (title: string): void => {
    ipcRenderer.send('app:set-title', title)
  },

  // App: get hardware-based device ID
  getDeviceId: (): Promise<string> => ipcRenderer.invoke('app:get-device-id'),

  // Dialog
  openDirectory: (): Promise<{ canceled: boolean; path: string }> =>
    ipcRenderer.invoke('dialog:open-directory'),

  // File: read image as data URL for thumbnails
  readImageAsDataUrl: (filepath: string): Promise<string | null> =>
    ipcRenderer.invoke('file:read-as-data-url', filepath),

  // Settings: persist to electron-store on main process
  settings: {
    get: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke('settings:get'),
    set: (data: Record<string, unknown>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('settings:set', data),
  },

  // Gallery: scan printed photos folder
  gallery: {
    scanPrintedFolder: (directory: string): Promise<{
      success: boolean
      photos: Array<{ filename: string; filepath: string; sizeBytes: number; printedAt: number }>
    }> => ipcRenderer.invoke('gallery:scan-printed-folder', directory),
  },

  // Cloud API
  cloud: {
    register: (key: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('cloud:register', key),

    unregister: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('cloud:unregister'),

    syncEvents: (): Promise<CloudEventDTO[]> =>
      ipcRenderer.invoke('cloud:sync-events'),

    selectEvent: (id: number): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('cloud:select-event', id),

    setApprovedOnly: (value: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('cloud:set-approved-only', value),

    start: (): Promise<{ success: boolean }> => ipcRenderer.invoke('cloud:start'),

    stop: (): Promise<{ success: boolean }> => ipcRenderer.invoke('cloud:stop'),

    health: (): Promise<{ status: 'ok' } | null> => ipcRenderer.invoke('cloud:health'),

    status: (): Promise<{
      registered: boolean
      polling: boolean
      connected: boolean
      lastPollTime: number | null
      lastHealthCheckTime: number | null
      selectedEventId: number | null
      events: CloudEventDTO[]
      licenseKey: string
    }> => ipcRenderer.invoke('cloud:status'),

    onPhotoReady: (
      callback: EventCallback<{ filePath: string; filename: string }>
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { filePath: string; filename: string }
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('cloud:photo-ready', handler)
      return () => ipcRenderer.removeListener('cloud:photo-ready', handler)
    },

    onError: (callback: EventCallback<{ error: string }>): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { error: string }
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('cloud:error', handler)
      return () => ipcRenderer.removeListener('cloud:error', handler)
    },

    onConnectionStatus: (callback: EventCallback<{ connected: boolean }>): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { connected: boolean }
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('cloud:connection-status', handler)
      return () => ipcRenderer.removeListener('cloud:connection-status', handler)
    },

    bulkResolve: (action: 'download' | 'skip'): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('cloud:bulk-resolve', action),

    onBulkWarning: (callback: EventCallback<{ count: number }>): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { count: number }
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('cloud:bulk-warning', handler)
      return () => ipcRenderer.removeListener('cloud:bulk-warning', handler)
    },

    onDownloadProgress: (
      callback: EventCallback<{
        status: 'idle' | 'downloading' | 'complete' | 'error'
        current: number
        total: number
        filename: string | null
        lastPollTime: number | null
      }>
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: {
          status: 'idle' | 'downloading' | 'complete' | 'error'
          current: number
          total: number
          filename: string | null
          lastPollTime: number | null
        }
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('cloud:download-progress', handler)
      return () => ipcRenderer.removeListener('cloud:download-progress', handler)
    }
  },

  // Watcher API
  watcher: {
    start: (directory: string): Promise<{ success: boolean; directory: string }> =>
      ipcRenderer.invoke('watcher:start', directory),

    stop: (): Promise<{ success: boolean }> => ipcRenderer.invoke('watcher:stop'),

    moveToProcessed: (filepath: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('watcher:move-to-processed', filepath),

    status: (): Promise<{ running: boolean; directory: string | null }> =>
      ipcRenderer.invoke('watcher:status'),

    scanPending: (directory: string): Promise<{
      success: boolean
      files: Array<{ filename: string; filepath: string; sizeBytes: number }>
    }> => ipcRenderer.invoke('watcher:scan-pending', directory),

    onPhotoReady: (
      callback: EventCallback<{ filepath: string; filename: string; sizeBytes: number }>
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { filepath: string; filename: string; sizeBytes: number }
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('watcher:photo-ready', handler)
      return () => ipcRenderer.removeListener('watcher:photo-ready', handler)
    },

    onPhotoPrinted: (
      callback: EventCallback<{ filename: string; destination: string }>
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { filename: string; destination: string }
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('watcher:photo-printed', handler)
      return () => ipcRenderer.removeListener('watcher:photo-printed', handler)
    },

    onError: (
      callback: EventCallback<{ error: string; filepath?: string }>
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { error: string; filepath?: string }
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('watcher:error', handler)
      return () => ipcRenderer.removeListener('watcher:error', handler)
    }
  },

  // Printer API (F002)
  printer: {
    discover: (forceRefresh?: boolean): Promise<PrinterInfoDTO[]> =>
      ipcRenderer.invoke('printer:discover', forceRefresh),

    list: (): Promise<PrinterInfoDTO[]> => ipcRenderer.invoke('printer:list'),

    get: (name: string): Promise<PrinterInfoDTO | null> =>
      ipcRenderer.invoke('printer:get', name),

    setPool: (names: string[]): Promise<{ pool: string[] }> =>
      ipcRenderer.invoke('printer:set-pool', names),

    getPool: (): Promise<string[]> => ipcRenderer.invoke('printer:get-pool'),

    clearCache: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('printer:clear-cache'),

    mediaSizes: (printerName: string): Promise<PaperSizeDTO[]> =>
      ipcRenderer.invoke('printer:media-sizes', printerName),

    submitJob: (
      filename: string,
      filepath: string,
      options?: PrintJobOptionsDTO
    ): Promise<SubmitJobResultDTO> =>
      ipcRenderer.invoke('printer:submit-job', filename, filepath, options),

    getJob: (jobId: string): Promise<PrintJobDTO | null> =>
      ipcRenderer.invoke('printer:get-job', jobId),

    cancelJob: (jobId: string): Promise<PrintJobDTO | null> =>
      ipcRenderer.invoke('printer:cancel-job', jobId),

    queueSnapshot: (): Promise<QueueSnapshotDTO> =>
      ipcRenderer.invoke('printer:queue-snapshot'),

    clearFinished: (): Promise<{ cleared: number }> =>
      ipcRenderer.invoke('printer:clear-finished'),

    health: (): Promise<QueueHealthDTO> => ipcRenderer.invoke('printer:health'),

    startMonitor: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('printer:start-monitor'),

    stopMonitor: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('printer:stop-monitor'),

    onEvent: (
      callback: EventCallback<PrinterEventDTO>
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: PrinterEventDTO
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('printer:event', handler)
      return () => ipcRenderer.removeListener('printer:event', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
