import { useState, useEffect } from 'react'
import { useToast, type Toast, type ToastType } from '@/stores/toast'
import { usePressTheme } from '@/stores/pressTheme'
import type { PressThemeColors } from '@/themes/press-themes'
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

// ---------------------------------------------------------------------------
// Style helpers (local — matches per-screen pattern)
// ---------------------------------------------------------------------------

function metalPanelStyle(c: PressThemeColors): React.CSSProperties {
  return {
    borderRadius: '0.5rem',
    background: `linear-gradient(to bottom, ${c.baseLight}, ${c.baseMid})`,
    boxShadow: `inset 0 1px 0 ${c.highlightColor}0.04), 0 2px 8px ${c.shadowColor}0.3)`,
    border: `1px solid ${c.borderColor}`,
  }
}

const headerFont = { fontFamily: '"Inter", system-ui, sans-serif' }

// ---------------------------------------------------------------------------
// Color + icon by type
// ---------------------------------------------------------------------------

function toastColor(c: PressThemeColors, type: ToastType): string {
  switch (type) {
    case 'success': return c.ledGreen
    case 'error': return c.ledRed
    case 'warning': return c.ledAmber
    case 'info': return c.accent
  }
}

function ToastIcon({ type, color }: { type: ToastType; color: string }): React.JSX.Element {
  const cls = "h-3.5 w-3.5"
  switch (type) {
    case 'success': return <CheckCircle2 className={cls} style={{ color }} />
    case 'error': return <XCircle className={cls} style={{ color }} />
    case 'warning': return <AlertTriangle className={cls} style={{ color }} />
    case 'info': return <Info className={cls} style={{ color }} />
  }
}

// ---------------------------------------------------------------------------
// Individual toast item with enter/exit animation
// ---------------------------------------------------------------------------

function ToastItem({
  toast,
  onDismiss,
  colors,
}: {
  toast: Toast
  onDismiss: () => void
  colors: PressThemeColors
}): React.JSX.Element {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const color = toastColor(colors, toast.type)

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 transition-all duration-200"
      style={{
        ...metalPanelStyle(colors),
        borderLeft: `3px solid ${color}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(1rem)',
        minWidth: 280,
        maxWidth: 360,
      }}
    >
      <ToastIcon type={toast.type} color={color} />
      <span
        className="flex-1 text-xs font-medium leading-snug"
        style={{ ...headerFont, color: colors.textPrimary }}
      >
        {toast.message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 transition-opacity hover:opacity-70"
        style={{ color: colors.textMuted }}
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Container — mount once in AppLayoutD
// ---------------------------------------------------------------------------

export function ToastContainer(): React.JSX.Element | null {
  const toasts = useToast((s) => s.toasts)
  const removeToast = useToast((s) => s.removeToast)
  const colors = usePressTheme()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => removeToast(toast.id)}
          colors={colors}
        />
      ))}
    </div>
  )
}
