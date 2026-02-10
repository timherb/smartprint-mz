import { create } from 'zustand'
import { useGallery } from '@/stores/gallery'

interface CloudState {
  registered: boolean
  polling: boolean
  connected: boolean
  lastPollTime: number | null

  // Actions
  register: (key: string) => Promise<{ success: boolean; error?: string }>
  start: () => Promise<void>
  stop: () => Promise<void>
  confirmPrint: (filename: string) => Promise<{ success: boolean; error?: string }>
  checkHealth: () => Promise<void>
  refreshStatus: () => Promise<void>

  // Event subscriber
  subscribe: () => () => void
}

export const useCloud = create<CloudState>((set, get) => ({
  registered: false,
  polling: false,
  connected: false,
  lastPollTime: null,

  register: async (key) => {
    try {
      const result = await window.api.cloud.register(key)
      if (result.success) {
        set({ registered: true })
      }
      return result
    } catch (err) {
      console.error('Failed to register with cloud:', err)
      return { success: false, error: String(err) }
    }
  },

  start: async () => {
    try {
      await window.api.cloud.start()
      set({ polling: true })
    } catch (err) {
      console.error('Failed to start cloud polling:', err)
    }
  },

  stop: async () => {
    try {
      await window.api.cloud.stop()
      set({ polling: false })
    } catch (err) {
      console.error('Failed to stop cloud polling:', err)
    }
  },

  confirmPrint: async (filename) => {
    try {
      const result = await window.api.cloud.confirmPrint(filename)
      return result
    } catch (err) {
      console.error('Failed to confirm print:', err)
      return { success: false, error: String(err) }
    }
  },

  checkHealth: async () => {
    try {
      const result = await window.api.cloud.health()
      set({ connected: result !== null })
    } catch (err) {
      console.error('Failed to check cloud health:', err)
      set({ connected: false })
    }
  },

  refreshStatus: async () => {
    try {
      const status = await window.api.cloud.status()
      set({
        registered: status.registered,
        polling: status.polling,
        connected: status.connected,
        lastPollTime: status.lastPollTime
      })
    } catch (err) {
      console.error('Failed to refresh cloud status:', err)
    }
  },

  subscribe: () => {
    const gallery = useGallery.getState()

    const unsubPhotoReady = window.api.cloud.onPhotoReady((payload) => {
      gallery.addPhoto(payload.filename, payload.filePath, 0)
    })

    const unsubError = window.api.cloud.onError((payload) => {
      console.error('Cloud error:', payload.error)
    })

    const unsubConnectionStatus = window.api.cloud.onConnectionStatus((payload) => {
      set({ connected: payload.connected })
    })

    // Sync initial status
    get().refreshStatus()

    return () => {
      unsubPhotoReady()
      unsubError()
      unsubConnectionStatus()
    }
  }
}))
