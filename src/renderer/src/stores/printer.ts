import { create } from 'zustand'

// Derive DTO types from the window.api printer interface
type PrinterInfoDTO = Awaited<ReturnType<typeof window.api.printer.list>>[number]
type PrintJobDTO = Awaited<ReturnType<typeof window.api.printer.getJob>> & {}
type QueueSnapshotDTO = Awaited<ReturnType<typeof window.api.printer.queueSnapshot>>
type QueueHealthDTO = Awaited<ReturnType<typeof window.api.printer.health>>

interface PrinterState {
  printers: PrinterInfoDTO[]
  pool: string[]
  queue: NonNullable<PrintJobDTO>[]
  queueStats: {
    pending: number
    printing: number
    completed: number
    failed: number
    total: number
  }
  health: QueueHealthDTO | null
  loading: boolean

  // Actions
  discover: (forceRefresh?: boolean) => Promise<void>
  setPool: (names: string[]) => Promise<void>
  submitJob: (filename: string, options?: Record<string, unknown>) => Promise<void>
  cancelJob: (jobId: string) => Promise<void>
  refreshQueue: () => Promise<void>
  refreshHealth: () => Promise<void>
  clearFinished: () => Promise<void>
  startMonitor: () => Promise<void>
  stopMonitor: () => Promise<void>

  // Event subscriber - call once on mount to subscribe to printer:event
  subscribeToEvents: () => () => void
}

export const usePrinter = create<PrinterState>((set, get) => ({
  printers: [],
  pool: [],
  queue: [],
  queueStats: { pending: 0, printing: 0, completed: 0, failed: 0, total: 0 },
  health: null,
  loading: false,

  discover: async (forceRefresh) => {
    set({ loading: true })
    try {
      const printers = await window.api.printer.discover(forceRefresh)
      const pool = await window.api.printer.getPool()
      set({ printers, pool })
    } catch (err) {
      console.error('Failed to discover printers:', err)
    } finally {
      set({ loading: false })
    }
  },

  setPool: async (names) => {
    try {
      const result = await window.api.printer.setPool(names)
      set({ pool: result.pool })
    } catch (err) {
      console.error('Failed to set printer pool:', err)
    }
  },

  submitJob: async (filename, options) => {
    try {
      await window.api.printer.submitJob(filename, options as Parameters<typeof window.api.printer.submitJob>[1])
      await get().refreshQueue()
    } catch (err) {
      console.error('Failed to submit print job:', err)
    }
  },

  cancelJob: async (jobId) => {
    try {
      await window.api.printer.cancelJob(jobId)
      await get().refreshQueue()
    } catch (err) {
      console.error('Failed to cancel print job:', err)
    }
  },

  refreshQueue: async () => {
    try {
      const snapshot: QueueSnapshotDTO = await window.api.printer.queueSnapshot()
      set({
        queue: snapshot.jobs,
        queueStats: {
          pending: snapshot.pending,
          printing: snapshot.printing,
          completed: snapshot.completed,
          failed: snapshot.failed,
          total: snapshot.total
        }
      })
    } catch (err) {
      console.error('Failed to refresh print queue:', err)
    }
  },

  refreshHealth: async () => {
    try {
      const health = await window.api.printer.health()
      set({ health })
    } catch (err) {
      console.error('Failed to refresh printer health:', err)
    }
  },

  clearFinished: async () => {
    try {
      await window.api.printer.clearFinished()
      await get().refreshQueue()
    } catch (err) {
      console.error('Failed to clear finished jobs:', err)
    }
  },

  startMonitor: async () => {
    try {
      await window.api.printer.startMonitor()
    } catch (err) {
      console.error('Failed to start printer monitor:', err)
    }
  },

  stopMonitor: async () => {
    try {
      await window.api.printer.stopMonitor()
    } catch (err) {
      console.error('Failed to stop printer monitor:', err)
    }
  },

  subscribeToEvents: () => {
    const unsubscribe = window.api.printer.onEvent((event) => {
      console.debug('Printer event:', event.type, event.data)

      // Refresh queue and health on any printer event
      get().refreshQueue()
      get().refreshHealth()
    })

    return unsubscribe
  }
}))

export type { PrinterInfoDTO, PrintJobDTO, QueueSnapshotDTO, QueueHealthDTO }
