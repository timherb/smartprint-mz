import { create } from 'zustand'
import { useGallery } from '@/stores/gallery'

interface WatcherState {
  running: boolean
  directory: string | null

  // Actions
  start: (directory: string) => Promise<void>
  stop: () => Promise<void>
  moveToProcessed: (filepath: string) => Promise<void>
  refreshStatus: () => Promise<void>

  // Event subscriber
  subscribe: () => () => void
}

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

  subscribe: () => {
    const gallery = useGallery.getState()

    const unsubPhotoReady = window.api.watcher.onPhotoReady((payload) => {
      gallery.addPhoto(payload.filename, payload.filepath, payload.sizeBytes)
    })

    const unsubPhotoPrinted = window.api.watcher.onPhotoPrinted((payload) => {
      gallery.updatePhotoStatus(payload.filename, 'printed', {
        printer: payload.destination
      })
    })

    const unsubError = window.api.watcher.onError((payload) => {
      console.error('Watcher error:', payload.error, payload.filepath)
      if (payload.filepath) {
        const filename = payload.filepath.split('/').pop() ?? payload.filepath
        gallery.updatePhotoStatus(filename, 'error', { error: payload.error })
      }
    })

    // Sync initial status
    get().refreshStatus()

    return () => {
      unsubPhotoReady()
      unsubPhotoPrinted()
      unsubError()
    }
  }
}))
