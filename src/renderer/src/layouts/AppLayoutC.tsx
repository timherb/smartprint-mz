import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Activity,
  Images,
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react'
import MonitorC from '@/screens/MonitorC'
import GalleryC from '@/screens/GalleryC'
import SettingsC from '@/screens/SettingsC'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Page = 'monitor' | 'gallery' | 'settings'

interface NavItem {
  id: Page
  icon: React.ElementType
  label: string
  position: 'top' | 'bottom'
}

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  { id: 'monitor', icon: Activity, label: 'Monitor', position: 'top' },
  { id: 'gallery', icon: Images, label: 'Gallery', position: 'top' },
  { id: 'settings', icon: Settings, label: 'Settings', position: 'bottom' }
]

// ---------------------------------------------------------------------------
// Activity bar
// ---------------------------------------------------------------------------

function ActivityBar({
  activePage,
  onNavigate
}: {
  activePage: Page
  onNavigate: (page: Page) => void
}) {
  const topItems = NAV_ITEMS.filter((n) => n.position === 'top')
  const bottomItems = NAV_ITEMS.filter((n) => n.position === 'bottom')

  return (
    <nav
      className="flex w-12 shrink-0 flex-col items-center border-r border-zinc-800 bg-zinc-950 py-2"
      aria-label="Main navigation"
    >
      {/* Top-aligned icons */}
      <div className="flex flex-col items-center gap-1">
        {topItems.map((item) => {
          const Icon = item.icon
          const active = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                active
                  ? 'text-emerald-400'
                  : 'text-zinc-600 hover:text-zinc-300'
              )}
            >
              {/* Active indicator */}
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-emerald-400" />
              )}
              <Icon className="h-5 w-5" strokeWidth={1.75} />

              {/* Tooltip */}
              <span
                className={cn(
                  'pointer-events-none absolute left-full ml-2 rounded bg-zinc-800 px-2 py-1',
                  'text-xs text-foreground opacity-0 shadow-lg transition-opacity',
                  'group-hover:opacity-100'
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom-aligned icons */}
      <div className="flex flex-col items-center gap-1">
        {bottomItems.map((item) => {
          const Icon = item.icon
          const active = activePage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                active
                  ? 'text-emerald-400'
                  : 'text-zinc-600 hover:text-zinc-300'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-emerald-400" />
              )}
              <Icon className="h-5 w-5" strokeWidth={1.75} />

              <span
                className={cn(
                  'pointer-events-none absolute left-full ml-2 rounded bg-zinc-800 px-2 py-1',
                  'text-xs text-foreground opacity-0 shadow-lg transition-opacity',
                  'group-hover:opacity-100'
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function StatusBar() {
  const connected = true

  return (
    <footer className="flex h-6 shrink-0 items-center border-t border-zinc-800 bg-zinc-950 px-3 text-[11px]">
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        {connected ? (
          <>
            <Wifi className="h-3 w-3 text-emerald-500" />
            <span className="text-emerald-500">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-red-400" />
            <span className="text-red-400">Disconnected</span>
          </>
        )}
      </div>

      <span className="mx-2 text-zinc-700">|</span>

      {/* Mode */}
      <span className="text-zinc-600">
        mode: <span className="font-mono text-zinc-400">usb</span>
      </span>

      <span className="mx-2 text-zinc-700">|</span>

      {/* Printer pool */}
      <span className="text-zinc-600">
        pool: <span className="font-mono text-zinc-400">3 printers</span>
      </span>

      {/* Push version to the right */}
      <span className="ml-auto font-mono text-zinc-700">Smart Print v0.1.0</span>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Page content
// ---------------------------------------------------------------------------

function PageContent({ page }: { page: Page }) {
  switch (page) {
    case 'monitor':
      return <MonitorC />
    case 'gallery':
      return <GalleryC />
    case 'settings':
      return <SettingsC />
  }
}

// ---------------------------------------------------------------------------
// Main App Layout
// ---------------------------------------------------------------------------

export default function AppLayoutC() {
  const [activePage, setActivePage] = useState<Page>('monitor')

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-foreground">
      {/* Main area: activity bar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity bar */}
        <ActivityBar activePage={activePage} onNavigate={setActivePage} />

        {/* Page content */}
        <main className="flex-1 overflow-hidden bg-zinc-900/20">
          <PageContent page={activePage} />
        </main>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  )
}
