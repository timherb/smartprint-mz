import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  setMode: (mode: 'local' | 'cloud') => void
  setLocalDirectory: (dir: string) => void
  setCloudApiUrl: (url: string) => void
  setCloudRegistered: (registered: boolean) => void
  setPollInterval: (ms: number) => void
  setHealthInterval: (ms: number) => void
  setLogLevel: (level: LogLevel) => void
  setPaperSize: (size: string) => void
  setPrinterPool: (pool: string[]) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'local',
      localDirectory: '',
      cloudApiUrl: '',
      cloudRegistered: false,
      pollInterval: 5000,
      healthInterval: 30000,
      logLevel: 'info',
      paperSize: '',
      printerPool: [],

      setMode: (mode) => set({ mode }),
      setLocalDirectory: (dir) => set({ localDirectory: dir }),
      setCloudApiUrl: (url) => set({ cloudApiUrl: url }),
      setCloudRegistered: (registered) => set({ cloudRegistered: registered }),
      setPollInterval: (ms) => set({ pollInterval: ms }),
      setHealthInterval: (ms) => set({ healthInterval: ms }),
      setLogLevel: (level) => set({ logLevel: level }),
      setPaperSize: (size) => set({ paperSize: size }),
      setPrinterPool: (pool) => set({ printerPool: pool })
    }),
    {
      name: 'smart-print-settings',
      partialize: (state) => ({
        mode: state.mode,
        localDirectory: state.localDirectory,
        cloudApiUrl: state.cloudApiUrl,
        cloudRegistered: state.cloudRegistered,
        pollInterval: state.pollInterval,
        healthInterval: state.healthInterval,
        logLevel: state.logLevel,
        paperSize: state.paperSize,
        printerPool: state.printerPool
      })
    }
  )
)
