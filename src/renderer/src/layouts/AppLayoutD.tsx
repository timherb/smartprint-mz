import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/stores/theme'
import { useSettings } from '@/stores/settings'
import { useCloud } from '@/stores/cloud'
import { usePrinter } from '@/stores/printer'
import { useWatcher } from '@/stores/watcher'
import { usePressTheme, usePressThemeStore } from '@/stores/pressTheme'
import { addToast } from '@/stores/toast'
import {
  PRESS_THEME_NAMES,
  PRESS_THEME_LABELS,
  PRESS_THEME_SWATCHES,
} from '@/themes/press-themes'
import type { PressThemeColors } from '@/themes/press-themes'
import {
  Settings,
  Activity,
  Image as ImageIcon,
  HardDrive,
  Cloud,
  Printer,
} from 'lucide-react'
import SettingsD from '@/screens/SettingsD'
import MonitorD from '@/screens/MonitorD'
import GalleryD from '@/screens/GalleryD'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastContainer } from '@/components/ToastContainer'

type Page = 'settings' | 'monitor' | 'gallery'

interface NavItem {
  id: Page
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { id: 'monitor', label: 'MONITOR', icon: Activity },
  { id: 'gallery', label: 'GALLERY', icon: ImageIcon },
  { id: 'settings', label: 'SETTINGS', icon: Settings },
]

// ---------------------------------------------------------------------------
// Rivet decorations
// ---------------------------------------------------------------------------

function Rivet({ className, colors }: { className?: string; colors: PressThemeColors }): React.JSX.Element {
  return (
    <span
      className={cn('inline-block h-[6px] w-[6px] rounded-full', className)}
      style={{
        background: `linear-gradient(to bottom right, ${colors.rivetLight}, ${colors.rivetDark})`,
        boxShadow: `inset 0 1px 0 ${colors.highlightColor}0.08), 0 1px 2px ${colors.shadowColor}0.4)`,
      }}
      aria-hidden
    />
  )
}

// ---------------------------------------------------------------------------
// Metal noise texture background (CSS gradient trick)
// ---------------------------------------------------------------------------

function makeMetalBg(c: PressThemeColors): React.CSSProperties {
  return {
    backgroundImage: `
      radial-gradient(ellipse at 20% 50%, ${c.metalSpotColor}0.4) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 50%, ${c.metalSpotColor}0.3) 0%, transparent 50%),
      radial-gradient(circle at 50% 0%, ${c.metalSpotColor}0.15) 0%, transparent 70%),
      linear-gradient(180deg, ${c.baseMid} 0%, ${c.baseDark} 100%)
    `,
  }
}

const metalNoise = {
  backgroundImage: `
    url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")
  `,
  backgroundSize: '128px 128px',
}

// ---------------------------------------------------------------------------
// Page content router
// ---------------------------------------------------------------------------

function PageContent({ page, navigateTo }: { page: Page; navigateTo: (p: Page) => void }): React.JSX.Element {
  switch (page) {
    case 'settings':
      return (
        <ErrorBoundary label="Settings">
          <SettingsD />
        </ErrorBoundary>
      )
    case 'monitor':
      return (
        <ErrorBoundary label="Monitor">
          <MonitorD navigateTo={navigateTo} />
        </ErrorBoundary>
      )
    case 'gallery':
      return (
        <ErrorBoundary label="Gallery">
          <GalleryD />
        </ErrorBoundary>
      )
  }
}

// ---------------------------------------------------------------------------
// Theme picker swatches (small row in nav bar)
// ---------------------------------------------------------------------------

function ThemePicker({ colors }: { colors: PressThemeColors }): React.JSX.Element {
  const currentTheme = usePressThemeStore((s) => s.theme)
  const setTheme = usePressThemeStore((s) => s.setTheme)

  return (
    <div className="flex items-center gap-1.5">
      {PRESS_THEME_NAMES.map((name) => {
        const swatch = PRESS_THEME_SWATCHES[name]
        const isActive = currentTheme === name
        return (
          <button
            key={name}
            type="button"
            onClick={() => setTheme(name)}
            title={PRESS_THEME_LABELS[name]}
            className={cn(
              'relative flex h-5 w-5 items-center justify-center rounded-full',
              'transition-all duration-200',
              isActive && 'ring-2 ring-offset-1',
            )}
            style={{
              background: `linear-gradient(135deg, ${swatch.base} 50%, ${swatch.accent} 50%)`,
              ...(isActive
                ? {
                    outline: `2px solid ${colors.accent}`,
                    outlineOffset: '1px',
                  }
                : {}),
            }}
            aria-label={`Switch to ${PRESS_THEME_LABELS[name]} theme`}
            aria-pressed={isActive}
          />
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status bar — printer confidence signal + print counter
// ---------------------------------------------------------------------------

const monoFont = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' }

function StatusBar({
  colors: c,
  onNavigateToSettings,
}: {
  colors: PressThemeColors
  onNavigateToSettings: () => void
}): React.JSX.Element {
  const pool = useSettings((s) => s.printerPool)
  const health = usePrinter((s) => s.health)
  const queueStats = usePrinter((s) => s.queueStats)
  const printCountToday = useSettings((s) => s.printCountToday)
  const printCountDate = useSettings((s) => s.printCountDate)

  // Determine printer status
  let ledColor = c.ledAmber
  let statusText = 'No printer selected'
  let showConfigLink = false

  if (pool.length === 0) {
    ledColor = c.ledAmber
    statusText = 'No printer selected'
    showConfigLink = true
  } else if (queueStats.printing > 0) {
    ledColor = c.accent
    const pendingNote = queueStats.pending > 0 ? `, ${queueStats.pending} queued` : ''
    statusText = `Printing... (${queueStats.printing} active${pendingNote})`
  } else if (health) {
    const onlineCount = health.printersOnline
    if (onlineCount === 0) {
      ledColor = c.ledRed
      const firstName = health.printers[0]?.displayName ?? 'Printer'
      statusText = pool.length === 1 ? `${firstName} \u2014 Offline` : 'All printers offline'
    } else {
      ledColor = c.ledGreen
      if (onlineCount === 1) {
        const onlinePrinter = health.printers.find((p) => p.status !== 'offline')
        statusText = `${onlinePrinter?.displayName ?? 'Printer'} \u2014 Ready`
      } else {
        statusText = `${onlineCount} printers ready`
      }
    }
  } else {
    // Health not loaded yet but pool is configured
    ledColor = c.textMuted
    statusText = 'Checking printers...'
  }

  // Print counter — show 0 if date doesn't match today
  const today = new Date().toISOString().slice(0, 10)
  const displayCount = printCountDate === today ? printCountToday : 0

  return (
    <div
      className="relative z-10 flex h-8 shrink-0 items-center justify-between px-6"
      style={{
        backgroundColor: c.baseDark,
        borderBottom: `1px solid ${c.borderDark}`,
        boxShadow: `inset 0 2px 4px ${c.shadowColor}0.4)`,
      }}
    >
      {/* Left: printer status */}
      <div className="flex items-center gap-2.5">
        <Printer className="h-3 w-3" style={{ color: c.textMuted }} />
        {/* LED dot */}
        <div className="relative">
          {ledColor !== c.textMuted && (
            <span
              className="absolute inset-0 rounded-full blur-[3px] opacity-40"
              style={{ backgroundColor: ledColor }}
              aria-hidden
            />
          )}
          <span
            className="relative block h-2 w-2 rounded-full"
            style={{
              background: `linear-gradient(to bottom, ${ledColor}cc, ${ledColor})`,
              boxShadow: ledColor !== c.textMuted ? `0 0 4px ${ledColor}40` : undefined,
            }}
          />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: c.textPrimary }}
        >
          {statusText}
        </span>
        {showConfigLink && (
          <button
            type="button"
            onClick={onNavigateToSettings}
            className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
            style={{ color: c.accent }}
          >
            &mdash; Configure in Settings
          </button>
        )}
      </div>

      {/* Right: print counter */}
      <div className="flex items-center gap-2">
        <span
          className="text-sm font-bold tabular-nums"
          style={{ ...monoFont, color: c.accent, textShadow: `0 0 8px ${c.accentGlow}0.15)` }}
        >
          {displayCount}
        </span>
        <span
          className="text-[9px] font-bold uppercase tracking-[0.12em]"
          style={{ color: c.textMuted }}
        >
          PRINTS TODAY
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export default function AppLayoutD(): React.JSX.Element {
  const [activePage, setActivePage] = useState<Page>('monitor')

  // Store subscriptions
  const isConnected = useCloud((s) => s.connected)
  const mode = useSettings((s) => s.mode)
  useTheme() // subscribe to theme changes

  // Press theme
  const c = usePressTheme()

  // Window title: live queue status
  const queueStats = usePrinter((s) => s.queueStats)

  useEffect(() => {
    const parts: string[] = []
    if (queueStats.printing > 0) parts.push(`${queueStats.printing} printing`)
    if (queueStats.pending > 0) parts.push(`${queueStats.pending} pending`)
    if (queueStats.failed > 0) parts.push(`${queueStats.failed} failed`)
    if (queueStats.completed > 0) parts.push(`${queueStats.completed} completed`)
    const status = parts.length > 0 ? parts.join(', ') : 'Idle'
    window.api.setWindowTitle(`Smart Print \u2014 ${status}`)
  }, [queueStats])

  // Keyboard: Ctrl+Tab / Ctrl+Shift+Tab to cycle pages
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!e.ctrlKey || e.key !== 'Tab') return
    e.preventDefault()
    setActivePage((current) => {
      const idx = navItems.findIndex((n) => n.id === current)
      const next = e.shiftKey
        ? (idx - 1 + navItems.length) % navItems.length
        : (idx + 1) % navItems.length
      return navItems[next].id
    })
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Mount: subscribe to real-time events + restore persisted state
  const prevFailedRef = useRef(usePrinter.getState().queueStats.failed)

  useEffect(() => {
    const unsubPrinter = usePrinter.getState().subscribeToEvents()
    const unsubWatcher = useWatcher.getState().subscribe()
    const unsubCloud = useCloud.getState().subscribe()

    const settings = useSettings.getState()
    if (settings.printerPool.length > 0) {
      usePrinter.getState().setPool(settings.printerPool)
    }
    if (settings.mode === 'local' && settings.localDirectory) {
      useWatcher.getState().start(settings.localDirectory)
    }
    usePrinter.getState().startMonitor()

    // Toast on print failures
    const unsubFailures = usePrinter.subscribe((state) => {
      if (state.queueStats.failed > prevFailedRef.current) {
        addToast('A print job failed', 'error')
      }
      prevFailedRef.current = state.queueStats.failed
    })

    return () => {
      unsubPrinter()
      unsubWatcher()
      unsubCloud()
      unsubFailures()
    }
  }, [])

  // Shadow helpers for this theme
  const headerShadow = `0 2px 8px ${c.shadowColor}0.4), inset 0 1px 0 ${c.highlightColor}0.04)`
  const insetNavShadow = `inset 0 2px 4px ${c.shadowColor}0.5), inset 0 -1px 0 ${c.highlightColor}0.03)`
  const activeTabShadow = `0 1px 3px ${c.shadowColor}0.3), inset 0 1px 0 ${c.highlightColor}0.06)`
  const modeBadgeShadow = `inset 0 1px 3px ${c.shadowColor}0.4), inset 0 -1px 0 ${c.highlightColor}0.03)`
  const brandIconShadow = `0 2px 4px ${c.shadowColor}0.4), inset 0 1px 0 ${c.highlightColor}0.2)`

  return (
    <div
      className="flex h-screen w-screen flex-col"
      style={{
        ...makeMetalBg(c),
        fontFamily: '"Inter", "DM Sans", system-ui, sans-serif',
      }}
    >
      {/* Noise texture overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={metalNoise}
        aria-hidden
      />

      {/* ---- Industrial riveted navigation header ---- */}
      <header
        className="relative z-10 shrink-0"
        style={{
          borderBottom: `1px solid ${c.borderColor}`,
          background: `linear-gradient(to bottom, ${c.baseLight}, ${c.baseMid})`,
          boxShadow: headerShadow,
        }}
      >
        <div className="flex h-14 items-center px-6">
          {/* Rivets left */}
          <Rivet className="mr-3" colors={c} />

          {/* App brand - accent printing press icon */}
          <div className="flex items-center gap-3 mr-8">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: `linear-gradient(to bottom right, ${c.accent}, ${c.accentDark})`,
                boxShadow: brandIconShadow,
              }}
            >
              {/* Gear/press icon via SVG */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
                <path
                  d="M8 2L9.5 4H6.5L8 2ZM4 6.5V9.5L2 8L4 6.5ZM12 6.5L14 8L12 9.5V6.5ZM8 14L6.5 12H9.5L8 14ZM5 5H11V11H5V5ZM6.5 6.5V9.5H9.5V6.5H6.5Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <span
              className="text-sm font-bold uppercase tracking-[0.15em]"
              style={{ fontFamily: '"Inter", system-ui, sans-serif', color: c.textPrimary }}
            >
              Smart Print
            </span>
          </div>

          {/* Riveted metal tab bar */}
          <nav
            className="flex items-center gap-0.5 rounded-md p-1"
            style={{
              backgroundColor: c.baseDark,
              boxShadow: insetNavShadow,
            }}
            role="navigation"
            aria-label="Main navigation"
          >
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activePage === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={cn(
                    'relative flex items-center gap-2 rounded px-4 py-1.5 text-xs font-bold tracking-[0.1em]',
                    'transition-all duration-200',
                  )}
                  style={
                    isActive
                      ? {
                          background: `linear-gradient(to bottom, ${c.navTabActiveFrom}, ${c.navTabActiveTo})`,
                          color: c.accent,
                          boxShadow: activeTabShadow,
                        }
                      : {
                          color: c.textMuted,
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = c.textPrimary
                      e.currentTarget.style.backgroundColor = c.baseMid
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = c.textMuted
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {/* Active indicator - accent line under tab */}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                      style={{
                        background: `linear-gradient(to right, transparent, ${c.accent}, transparent)`,
                      }}
                      aria-hidden
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side: theme picker + mode badge + connection LED */}
          <div className="flex items-center gap-4">
            {/* Theme picker */}
            <ThemePicker colors={c} />

            {/* Divider */}
            <div
              className="h-5 w-px"
              style={{ backgroundColor: c.borderColor }}
            />

            {/* Source mode badge - embossed metal label */}
            <div
              className="flex items-center gap-2 rounded px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em]"
              style={{
                backgroundColor: c.baseDark,
                boxShadow: modeBadgeShadow,
                color: c.textMuted,
              }}
            >
              {mode === 'local' ? (
                <HardDrive className="h-3 w-3" />
              ) : (
                <Cloud className="h-3 w-3" />
              )}
              <span>{mode}</span>
            </div>

            {/* Connection LED indicator */}
            <div className="flex items-center gap-2">
              <div className="relative">
                {/* LED glow */}
                {isConnected && (
                  <span
                    className="absolute inset-0 rounded-full blur-[4px] opacity-40"
                    style={{ backgroundColor: c.ledGreen }}
                    aria-hidden
                  />
                )}
                {/* LED body */}
                <span
                  className="relative block h-3 w-3 rounded-full"
                  style={{
                    background: isConnected
                      ? `linear-gradient(to bottom, ${c.ledGreen}cc, ${c.ledGreen})`
                      : `linear-gradient(to bottom, ${c.textMuted}, ${c.rivetDark})`,
                    boxShadow: `inset 0 -1px 2px ${c.shadowColor}0.3), 0 0 1px ${c.shadowColor}0.5)`,
                  }}
                />
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{ color: isConnected ? c.ledGreen : c.textMuted }}
              >
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* Rivet right */}
            <Rivet colors={c} />
          </div>
        </div>
      </header>

      {/* ---- Status bar ---- */}
      <StatusBar colors={c} onNavigateToSettings={() => setActivePage('settings')} />

      {/* ---- Content area ---- */}
      <main className="relative z-10 flex-1 overflow-hidden">
        <PageContent page={activePage} navigateTo={setActivePage} />
      </main>

      {/* ---- Toast notifications ---- */}
      <ToastContainer />
    </div>
  )
}
