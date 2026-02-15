import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/stores/theme'
import { useSettings } from '@/stores/settings'
import { useCloud } from '@/stores/cloud'
import { usePrinter } from '@/stores/printer'
import { useWatcher } from '@/stores/watcher'
import {
  Settings,
  Activity,
  Image as ImageIcon,
  HardDrive,
  Cloud,
} from 'lucide-react'
import SettingsD from '@/screens/SettingsD'
import MonitorD from '@/screens/MonitorD'
import GalleryD from '@/screens/GalleryD'
import { ErrorBoundary } from '@/components/ErrorBoundary'

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

function Rivet({ className }: { className?: string }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-block h-[6px] w-[6px] rounded-full',
        'bg-gradient-to-br from-[#4a4f56] to-[#2a2e33]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.4)]',
        className,
      )}
      aria-hidden
    />
  )
}

// ---------------------------------------------------------------------------
// Metal noise texture background (CSS gradient trick)
// ---------------------------------------------------------------------------

const metalBg = {
  backgroundImage: `
    radial-gradient(ellipse at 20% 50%, rgba(58,63,70,0.4) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 50%, rgba(58,63,70,0.3) 0%, transparent 50%),
    radial-gradient(circle at 50% 0%, rgba(58,63,70,0.15) 0%, transparent 70%),
    linear-gradient(180deg, #22262b 0%, #1a1d21 100%)
  `,
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

function PageContent({ page }: { page: Page }): React.JSX.Element {
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
          <MonitorD />
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
// Main layout
// ---------------------------------------------------------------------------

export default function AppLayoutD(): React.JSX.Element {
  const [activePage, setActivePage] = useState<Page>('monitor')

  // Store subscriptions
  const isConnected = useCloud((s) => s.connected)
  const mode = useSettings((s) => s.mode)
  useTheme() // subscribe to theme changes

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

    return () => {
      unsubPrinter()
      unsubWatcher()
      unsubCloud()
    }
  }, [])

  return (
    <div
      className="flex h-screen w-screen flex-col"
      style={{
        ...metalBg,
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
        className={cn(
          'relative z-10 shrink-0',
          'border-b border-[#3a3f46]/60',
          'bg-gradient-to-b from-[#2d3238] to-[#22262b]',
          'shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]',
        )}
      >
        <div className="flex h-14 items-center px-6">
          {/* Rivets left */}
          <Rivet className="mr-3" />

          {/* App brand - brass printing press icon */}
          <div className="flex items-center gap-3 mr-8">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md',
                'bg-gradient-to-br from-[#cd853f] to-[#8b5e2b]',
                'shadow-[0_2px_4px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]',
              )}
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
              className="text-sm font-bold uppercase tracking-[0.15em] text-[#c8ccd2]"
              style={{ fontFamily: '"Inter", system-ui, sans-serif' }}
            >
              Smart Print
            </span>
          </div>

          {/* Riveted metal tab bar */}
          <nav
            className={cn(
              'flex items-center gap-0.5',
              'rounded-md',
              'bg-[#1a1d21]',
              'shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),inset_0_-1px_0_rgba(255,255,255,0.03)]',
              'p-1',
            )}
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
                    isActive
                      ? [
                          'bg-gradient-to-b from-[#3a3f46] to-[#2d3238]',
                          'text-[#cd853f]',
                          'shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]',
                        ]
                      : [
                          'text-[#6b7280]',
                          'hover:text-[#c8ccd2]',
                          'hover:bg-[#22262b]',
                        ],
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {/* Active indicator - brass line under tab */}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#cd853f] to-transparent"
                      aria-hidden
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side: mode badge + connection LED */}
          <div className="flex items-center gap-4">
            {/* Source mode badge - embossed metal label */}
            <div
              className={cn(
                'flex items-center gap-2 rounded px-3 py-1.5',
                'bg-[#1a1d21]',
                'shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),inset_0_-1px_0_rgba(255,255,255,0.03)]',
                'text-xs font-bold uppercase tracking-[0.08em] text-[#6b7280]',
              )}
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
                    className="absolute inset-0 rounded-full bg-[#4ade80] blur-[4px] opacity-40"
                    aria-hidden
                  />
                )}
                {/* LED body */}
                <span
                  className={cn(
                    'relative block h-3 w-3 rounded-full',
                    'shadow-[inset_0_-1px_2px_rgba(0,0,0,0.3),0_0_1px_rgba(0,0,0,0.5)]',
                    isConnected
                      ? 'bg-gradient-to-b from-[#86efac] to-[#22c55e]'
                      : 'bg-gradient-to-b from-[#6b7280] to-[#4b5563]',
                  )}
                />
              </div>
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-[0.08em]',
                isConnected ? 'text-[#4ade80]' : 'text-[#6b7280]',
              )}>
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* Rivet right */}
            <Rivet />
          </div>
        </div>
      </header>

      {/* ---- Content area ---- */}
      <main className="relative z-10 flex-1 overflow-hidden">
        <PageContent page={activePage} />
      </main>
    </div>
  )
}
