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
  Aperture,
  Wifi,
  WifiOff,
  HardDrive,
  Cloud,
  Sun,
  Moon,
} from 'lucide-react'
import SettingsB3 from '@/screens/SettingsB3'
import MonitorB3 from '@/screens/MonitorB3'
import GalleryB3 from '@/screens/GalleryB3'

type Page = 'settings' | 'monitor' | 'gallery'

interface NavItem {
  id: Page
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'gallery', label: 'Gallery', icon: ImageIcon },
  { id: 'settings', label: 'Settings', icon: Settings },
]

function PageContent({ page }: { page: Page }): React.JSX.Element {
  switch (page) {
    case 'settings':
      return <SettingsB3 />
    case 'monitor':
      return <MonitorB3 />
    case 'gallery':
      return <GalleryB3 />
  }
}

export default function AppLayoutB3(): React.JSX.Element {
  const [activePage, setActivePage] = useState<Page>('monitor')

  // ── Store subscriptions ─────────────────────────────────────
  const isConnected = useCloud((s) => s.connected)
  const mode = useSettings((s) => s.mode)
  const { theme, toggle } = useTheme()

  // ── Keyboard: Ctrl+Tab / Ctrl+Shift+Tab to cycle pages ──
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

  // ── Mount: subscribe to real-time events + restore persisted state ──
  useEffect(() => {
    const unsubPrinter = usePrinter.getState().subscribeToEvents()
    const unsubWatcher = useWatcher.getState().subscribe()
    const unsubCloud = useCloud.getState().subscribe()

    // Restore persisted settings to main process
    const settings = useSettings.getState()
    if (settings.printerPool.length > 0) {
      usePrinter.getState().setPool(settings.printerPool)
    }
    // Auto-start watcher if directory was configured
    if (settings.mode === 'local' && settings.localDirectory) {
      useWatcher.getState().start(settings.localDirectory)
    }
    // Start printer health monitor
    usePrinter.getState().startMonitor()

    return () => {
      unsubPrinter()
      unsubWatcher()
      unsubCloud()
    }
  }, [])

  return (
    <div
      className="flex h-screen w-screen flex-col bg-background"
      style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
    >
      {/* ── Frosted glass floating navigation bar ──────────────── */}
      <header
        className={cn(
          'shrink-0 border-b',
          'backdrop-blur-xl',
          // Frosted glass: low opacity bg
          'bg-background/60',
          'border-border/60'
        )}
      >
        <div className="flex h-14 items-center px-8">
          {/* App brand — copper aperture icon */}
          <div className="flex items-center gap-3 mr-10">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c57d3c]/10">
              <Aperture className="h-4.5 w-4.5 text-[#c57d3c]" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              Smart Print
            </span>
          </div>

          {/* Pill-shaped tab navigation */}
          <nav
            className="flex items-center gap-1 rounded-full bg-secondary/50 p-1"
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
                    'relative flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
                    'transition-all duration-300 ease-out',
                    'hover:scale-[1.01]',
                    isActive
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side: mode badge + connection + theme toggle */}
          <div className="flex items-center gap-3">
            {/* Source mode badge */}
            <div className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground">
              {mode === 'local' ? (
                <HardDrive className="h-3 w-3" />
              ) : (
                <Cloud className="h-3 w-3" />
              )}
              <span className="capitalize">{mode}</span>
            </div>

            {/* Connection status */}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-red-500/10 text-red-400'
              )}
              role="status"
              aria-label={isConnected ? 'Connected' : 'Disconnected'}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span>{isConnected ? 'Connected' : 'Offline'}</span>
            </div>

            {/* Theme toggle — soft copper pill */}
            <button
              type="button"
              onClick={toggle}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full',
                'text-muted-foreground transition-all duration-300',
                'hover:bg-[#c57d3c]/10 hover:text-[#c57d3c] hover:scale-[1.01]'
              )}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Content area ──────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        <PageContent page={activePage} />
      </main>
    </div>
  )
}
