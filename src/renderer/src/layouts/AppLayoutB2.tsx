import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/stores/theme'
import {
  Settings,
  Activity,
  Image as ImageIcon,
  Wifi,
  WifiOff,
  HardDrive,
  Cloud,
  Sun,
  Moon,
} from 'lucide-react'
import SettingsB2 from '@/screens/SettingsB2'
import MonitorB2 from '@/screens/MonitorB2'
import GalleryB2 from '@/screens/GalleryB2'

// @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Fira+Code:wght@400;500&display=swap')

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
      return <SettingsB2 />
    case 'monitor':
      return <MonitorB2 />
    case 'gallery':
      return <GalleryB2 />
  }
}

export default function AppLayoutB2(): React.JSX.Element {
  const [activePage, setActivePage] = useState<Page>('monitor')
  const [isConnected] = useState(true)
  const [mode] = useState<'local' | 'cloud'>('local')
  const { theme, toggle } = useTheme()

  return (
    <div
      className="flex h-screen w-screen flex-col bg-background"
      style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}
    >
      {/* -- Editorial top navigation bar -- */}
      <header className="shrink-0 border-b border-border bg-surface-elevated/60 backdrop-blur-md">
        <div className="flex h-14 items-center px-8">
          {/* Brand mark */}
          <div className="flex items-center gap-3 mr-10">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[var(--glow)]">
              <span
                className="text-sm font-bold"
                style={{ color: 'var(--amber)', fontFamily: '"Fira Code", ui-monospace, monospace' }}
              >
                SP
              </span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              Smart Print
            </span>
          </div>

          {/* Editorial navigation tabs -- generous letter-spacing */}
          <nav className="flex items-center gap-0.5" role="navigation" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activePage === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={cn(
                    'relative flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium tracking-[0.04em] uppercase transition-colors duration-200',
                    'rounded-2xl',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {/* Gold underline indicator */}
                  {isActive && (
                    <span
                      className="absolute -bottom-[11px] left-4 right-4 h-[2px] rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, var(--amber), transparent)',
                      }}
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side: status badges + theme toggle */}
          <div className="flex items-center gap-3">
            {/* Source mode badge */}
            <div className="flex items-center gap-2 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-medium tracking-wide text-muted-foreground">
              {mode === 'local' ? (
                <HardDrive className="h-3 w-3" />
              ) : (
                <Cloud className="h-3 w-3" />
              )}
              <span className="uppercase text-[11px] tracking-[0.08em]">{mode}</span>
            </div>

            {/* Connection status */}
            <div
              className={cn(
                'flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium',
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
              <span className="text-[11px] tracking-[0.04em]">
                {isConnected ? 'Connected' : 'Offline'}
              </span>
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-border" />

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggle}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200',
                'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* -- Content area -- */}
      <main className="flex-1 overflow-hidden">
        <PageContent page={activePage} />
      </main>
    </div>
  )
}
