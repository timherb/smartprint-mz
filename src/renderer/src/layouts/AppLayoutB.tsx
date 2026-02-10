import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/stores/theme'
import {
  Settings,
  Activity,
  Image as ImageIcon,
  Zap,
  Wifi,
  WifiOff,
  HardDrive,
  Cloud,
  Sun,
  Moon,
} from 'lucide-react'
import SettingsB from '@/screens/SettingsB'
import MonitorB from '@/screens/MonitorB'
import GalleryB from '@/screens/GalleryB'

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
      return <SettingsB />
    case 'monitor':
      return <MonitorB />
    case 'gallery':
      return <GalleryB />
  }
}

export default function AppLayoutB(): React.JSX.Element {
  const [activePage, setActivePage] = useState<Page>('monitor')
  const [isConnected] = useState(true)
  const [mode] = useState<'local' | 'cloud'>('local')
  const { theme, toggle } = useTheme()

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      {/* ── Top navigation bar ──────────────────────────────── */}
      <header className="shrink-0 border-b border-border bg-surface-elevated/80 backdrop-blur-sm">
        <div className="flex h-12 items-center px-6">
          {/* App name / brand */}
          <div className="flex items-center gap-2.5 mr-8">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-glow">
              <Zap className="h-4 w-4 text-amber-accent" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Smart Print
            </span>
          </div>

          {/* Navigation tabs */}
          <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activePage === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-[9px] left-3 right-3 h-px bg-amber-accent" />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side: status + theme toggle */}
          <div className="flex items-center gap-2.5">
            {/* Source mode badge */}
            <div className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
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
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs',
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

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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

      {/* ── Content area ────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        <PageContent page={activePage} />
      </main>
    </div>
  )
}
