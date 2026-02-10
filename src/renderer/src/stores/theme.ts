import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface ThemeStore {
  theme: Theme
  toggle: () => void
  set: (theme: Theme) => void
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add('light')
  } else {
    root.classList.remove('light')
  }
}

// Apply light mode on initial load (before hydration)
if (typeof document !== 'undefined') {
  const saved = localStorage.getItem('smart-print-theme')
  const theme = saved ? (JSON.parse(saved) as { state: { theme: Theme } }).state.theme : 'light'
  applyTheme(theme)
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'light',
      toggle: () =>
        set((state) => {
          const next = state.theme === 'dark' ? 'light' : 'dark'
          applyTheme(next)
          return { theme: next }
        }),
      set: (theme: Theme) => {
        applyTheme(theme)
        set({ theme })
      }
    }),
    {
      name: 'smart-print-theme',
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      }
    }
  )
)
