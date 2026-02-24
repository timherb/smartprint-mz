import { create } from 'zustand'
import { addToast } from '@/stores/toast'

interface CloudEvent {
  id: number
  name: string
  externalID: string
  startDate: string
  endDate: string
  testEvent: string
}

interface CloudState {
  registered: boolean
  polling: boolean
  connected: boolean
  lastPollTime: number | null
  // Event selection (in-memory only — cleared on app restart)
  events: CloudEvent[]
  selectedEventId: number | null
  selectedEventName: string
  licenseKey: string

  // Bulk download warning
  bulkWarningCount: number | null

  // Download progress for current/last poll
  downloadProgress: {
    status: 'idle' | 'downloading' | 'complete' | 'error'
    current: number
    total: number
    filename: string | null
    lastPollTime: number | null
  } | null

  // Actions
  register: (key: string) => Promise<{ success: boolean; error?: string }>
  unregister: () => Promise<void>
  syncEvents: () => Promise<CloudEvent[]>
  selectEvent: (id: number) => Promise<void>
  clearEventSelection: () => void
  start: () => Promise<void>
  stop: () => Promise<void>
  checkHealth: () => Promise<void>
  refreshStatus: () => Promise<void>
  resolveBulk: (action: 'download' | 'skip' | 'gallery') => Promise<void>

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
  events: [],
  selectedEventId: null,
  selectedEventName: '',
  licenseKey: '',
  bulkWarningCount: null,
  downloadProgress: null,

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

  unregister: async () => {
    try {
      await window.api.cloud.unregister()
      set({
        registered: false,
        polling: false,
        selectedEventId: null,
        selectedEventName: '',
        events: [],
        licenseKey: ''
      })
    } catch (err) {
      console.error('Failed to unregister:', err)
    }
  },

  syncEvents: async () => {
    try {
      const events = await window.api.cloud.syncEvents()
      set({ events })
      return events
    } catch (err) {
      console.error('Failed to sync events:', err)
      return []
    }
  },

  selectEvent: async (id) => {
    try {
      await window.api.cloud.selectEvent(id)
      const events = get().events
      const event = events.find((e) => e.id === id)
      set({ selectedEventId: id, selectedEventName: event?.name ?? '' })
    } catch (err) {
      console.error('Failed to select event:', err)
    }
  },

  clearEventSelection: () => {
    set({ selectedEventId: null, selectedEventName: '' })
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
        lastPollTime: status.lastPollTime,
        selectedEventId: status.selectedEventId,
        events: status.events,
        licenseKey: status.licenseKey
      })
    } catch (err) {
      console.error('Failed to refresh cloud status:', err)
    }
  },

  resolveBulk: async (action: 'download' | 'skip' | 'gallery') => {
    try {
      await window.api.cloud.bulkResolve(action)
      set({ bulkWarningCount: null })
    } catch (err) {
      console.error('Failed to resolve bulk warning:', err)
    }
  },

  subscribe: () => {
    if (_cloudSubscribed) return () => {}
    _cloudSubscribed = true

    // Note: photo-ready from cloud watcher is no longer used for printing.
    // The local watcher picks up downloaded files from the watch folder and handles printing.
    const unsubError = window.api.cloud.onError((payload) => {
      console.error('Cloud error:', payload.error)
      addToast(payload.error, 'error')
    })

    const unsubConnectionStatus = window.api.cloud.onConnectionStatus((payload) => {
      set({ connected: payload.connected })
    })

    const unsubBulkWarning = window.api.cloud.onBulkWarning((payload) => {
      set({ bulkWarningCount: payload.count })
    })

    const unsubDownloadProgress = window.api.cloud.onDownloadProgress((payload) => {
      set({ downloadProgress: payload })
    })

    // Sync initial status
    get().refreshStatus()

    return () => {
      _cloudSubscribed = false
      unsubError()
      unsubConnectionStatus()
      unsubBulkWarning()
      unsubDownloadProgress()
    }
  }
}))
