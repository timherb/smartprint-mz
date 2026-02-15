import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PRESS_THEMES, type PressThemeName, type PressThemeColors } from '@/themes/press-themes'

interface PressThemeState {
  theme: PressThemeName
  setTheme: (theme: PressThemeName) => void
}

export const usePressThemeStore = create<PressThemeState>()(
  persist(
    (set) => ({
      theme: 'gunmetal',
      setTheme: (theme: PressThemeName) => set({ theme }),
    }),
    {
      name: 'smart-print-press-theme',
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)

/**
 * Hook that returns the current press theme colors.
 * Subscribe to this in every D-concept component.
 */
export function usePressTheme(): PressThemeColors {
  const themeName = usePressThemeStore((s) => s.theme)
  return PRESS_THEMES[themeName]
}
