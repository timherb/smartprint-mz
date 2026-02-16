import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  createdAt: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type: ToastType) => void
  removeToast: (id: string) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 4000

let toastCounter = 0

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, type) => {
    toastCounter += 1
    const id = `toast-${Date.now()}-${toastCounter}`
    const toast: Toast = { id, message, type, createdAt: Date.now() }

    set((state) => {
      const next = [...state.toasts, toast]
      // Cap at MAX_TOASTS — drop oldest
      if (next.length > MAX_TOASTS) next.splice(0, next.length - MAX_TOASTS)
      return { toasts: next }
    })

    // Auto-dismiss
    setTimeout(() => {
      // Only remove if still present (may have been manually dismissed)
      if (get().toasts.some((t) => t.id === id)) {
        get().removeToast(id)
      }
    }, AUTO_DISMISS_MS)
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))

/** Standalone addToast for use outside React components */
export const addToast = (message: string, type: ToastType): void => {
  useToast.getState().addToast(message, type)
}
