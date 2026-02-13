import { create } from 'zustand'
import { useSettings } from '@/stores/settings'
import { usePrinter } from '@/stores/printer'

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

// Guard against StrictMode double-mount registering duplicate IPC listeners
let _cloudSubscribed = false

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
    if (_cloudSubscribed) return () => {}
    _cloudSubscribed = true

    const unsubPhotoReady = window.api.cloud.onPhotoReady((payload) => {
      // Auto-print: submit immediately if enabled and printers are configured
      const { autoPrint, printerPool, copies } = useSettings.getState()
      if (autoPrint && printerPool.length > 0) {
        usePrinter.getState().submitJob(payload.filename, payload.filePath, { copies })
      }
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
      _cloudSubscribed = false
      unsubPhotoReady()
      unsubError()
      unsubConnectionStatus()
    }
  }
}))
