import { create } from 'zustand'
import { useSettings } from '@/stores/settings'
import { usePrinter } from '@/stores/printer'

interface WatcherState {
  running: boolean
  directory: string | null

  // Actions
  start: (directory: string) => Promise<void>
  stop: () => Promise<void>
  moveToProcessed: (filepath: string) => Promise<void>
  refreshStatus: () => Promise<void>
  scanAndPrint: () => Promise<void>

  // Event subscriber
  subscribe: () => () => void
}

// Guard against StrictMode double-mount registering duplicate IPC listeners
let _watcherSubscribed = false

export const useWatcher = create<WatcherState>((set, get) => ({
  running: false,
  directory: null,

  start: async (directory) => {
    try {
      const result = await window.api.watcher.start(directory)
      set({ running: result.success, directory: result.directory })
    } catch (err) {
      console.error('Failed to start watcher:', err)
    }
  },

  stop: async () => {
    try {
      await window.api.watcher.stop()
      set({ running: false })
    } catch (err) {
      console.error('Failed to stop watcher:', err)
    }
  },

  moveToProcessed: async (filepath) => {
    try {
      await window.api.watcher.moveToProcessed(filepath)
    } catch (err) {
      console.error('Failed to move file to processed:', err)
    }
  },

  refreshStatus: async () => {
    try {
      const status = await window.api.watcher.status()
      set({ running: status.running, directory: status.directory })
    } catch (err) {
      console.error('Failed to refresh watcher status:', err)
    }
  },

  scanAndPrint: async () => {
    const directory = get().directory ?? useSettings.getState().localDirectory
    if (!directory) return

    const { copies } = useSettings.getState()
    try {
      const result = await window.api.watcher.scanPending(directory)
      if (result.success && result.files.length > 0) {
        const printer = usePrinter.getState()
        for (const file of result.files) {
          await printer.submitJob(file.filename, file.filepath, { copies })
        }
      }
    } catch (err) {
      console.error('Failed to scan and print pending files:', err)
    }
  },

  subscribe: () => {
    if (_watcherSubscribed) return () => {}
    _watcherSubscribed = true

    const unsubPhotoReady = window.api.watcher.onPhotoReady((payload) => {
      // Auto-print: submit immediately if enabled and printers are configured
      const { autoPrint, printerPool, copies } = useSettings.getState()
      if (autoPrint && printerPool.length > 0) {
        usePrinter.getState().submitJob(payload.filename, payload.filepath, { copies })
      }
    })

    const unsubPhotoPrinted = window.api.watcher.onPhotoPrinted(() => {
      // Refresh gallery when a photo is printed (it moved to Printed Photos folder)
      // Gallery will pick it up on next scan
    })

    const unsubError = window.api.watcher.onError((payload) => {
      console.error('Watcher error:', payload.error, payload.filepath)
    })

    // Sync initial status
    get().refreshStatus()

    return () => {
      _watcherSubscribed = false
      unsubPhotoReady()
      unsubPhotoPrinted()
      unsubError()
    }
  }
}))
