import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type LogLevel = 'debug' | 'info' | 'warning' | 'error'

interface SettingsState {
  mode: 'local' | 'cloud'
  localDirectory: string
  cloudApiUrl: string
  cloudRegistered: boolean
  pollInterval: number
  healthInterval: number
  logLevel: LogLevel
  paperSize: string
  printerPool: string[]
  readonly autoPrint: true
  copies: number
  _loaded: boolean
  setMode: (mode: 'local' | 'cloud') => void
  setLocalDirectory: (dir: string) => void
  setCloudApiUrl: (url: string) => void
  setCloudRegistered: (registered: boolean) => void
  setPollInterval: (ms: number) => void
  setHealthInterval: (ms: number) => void
  setLogLevel: (level: LogLevel) => void
  setPaperSize: (size: string) => void
  setPrinterPool: (pool: string[]) => void
  setCopies: (n: number) => void
  loadFromMain: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Custom storage backed by electron-store via IPC (survives portable restarts)
// ---------------------------------------------------------------------------

const electronStorage = createJSONStorage<SettingsState>(() => ({
  getItem: async () => {
    try {
      const data = await window.api.settings.get()
      return JSON.stringify({ state: data })
    } catch {
      return null
    }
  },
  setItem: async (_name: string, value: string) => {
    try {
      const parsed = JSON.parse(value)
      const state = parsed.state ?? parsed
      await window.api.settings.set(state)
    } catch {
      // Ignore serialization errors
    }
  },
  removeItem: async () => {
    // Not used — settings are never fully cleared
  }
}))

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'local',
      localDirectory: '',
      cloudApiUrl: '',
      cloudRegistered: false,
      pollInterval: 60000,
      healthInterval: 30000,
      logLevel: 'info',
      paperSize: '',
      printerPool: [],
      autoPrint: true as const,
      copies: 1,
      _loaded: false,

      setMode: (mode) => set({ mode }),
      setLocalDirectory: (dir) => set({ localDirectory: dir }),
      setCloudApiUrl: (url) => set({ cloudApiUrl: url }),
      setCloudRegistered: (registered) => set({ cloudRegistered: registered }),
      setPollInterval: (ms) => set({ pollInterval: ms }),
      setHealthInterval: (ms) => set({ healthInterval: ms }),
      setLogLevel: (level) => set({ logLevel: level }),
      setPaperSize: (size) => set({ paperSize: size }),
      setPrinterPool: (pool) => set({ printerPool: pool }),
      setCopies: (n) => set({ copies: Math.max(1, Math.min(10, n)) }),
      loadFromMain: async () => {
        try {
          const data = await window.api.settings.get()
          set({ ...data, _loaded: true } as Partial<SettingsState>)
        } catch {
          set({ _loaded: true })
        }
      }
    }),
    {
      name: 'smart-print-settings',
      storage: electronStorage
    }
  )
)
