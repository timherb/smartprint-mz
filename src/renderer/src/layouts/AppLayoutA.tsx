import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Settings,
  Activity,
  Images,
  Zap
} from 'lucide-react'

import SettingsA from '@/screens/SettingsA'
import MonitorA from '@/screens/MonitorA'
import GalleryA from '@/screens/GalleryA'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Page = 'monitor' | 'gallery' | 'settings'

interface NavItem {
  id: Page
  label: string
  icon: React.JSX.Element
  shortcut: string
}

// ---------------------------------------------------------------------------
// Navigation config
// ---------------------------------------------------------------------------

const NAV_ITEMS: NavItem[] = [
  {
    id: 'monitor',
    label: 'Monitor',
    icon: <Activity className="h-4 w-4" />,
    shortcut: '1'
  },
  {
    id: 'gallery',
    label: 'Gallery',
    icon: <Images className="h-4 w-4" />,
    shortcut: '2'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="h-4 w-4" />,
    shortcut: '3'
  }
]

// ---------------------------------------------------------------------------
// Page renderer
// ---------------------------------------------------------------------------

function PageContent({ page }: { page: Page }): React.JSX.Element {
  switch (page) {
    case 'monitor':
      return <MonitorA />
    case 'gallery':
      return <GalleryA />
    case 'settings':
      return <SettingsA />
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AppLayoutA(): React.JSX.Element {
  const [activePage, setActivePage] = useState<Page>('monitor')

  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <aside className="flex w-[60px] shrink-0 flex-col items-center border-r border-border bg-card py-3">
        {/* Logo / brand area */}
        <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
          <Zap className="h-4 w-4 text-white" />
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={cn(
                'group relative flex h-10 w-10 flex-col items-center justify-center rounded-lg transition-colors',
                activePage === item.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              )}
              aria-label={item.label}
              title={`${item.label} (${item.shortcut})`}
            >
              {item.icon}
              <span className="mt-0.5 text-[9px] font-medium leading-none">{item.label}</span>

              {/* Active indicator bar */}
              {activePage === item.id && (
                <span className="absolute -left-[1px] top-1.5 h-5 w-[2px] rounded-r-full bg-blue-500" />
              )}
            </button>
          ))}
        </nav>

        {/* Bottom area: version */}
        <div className="mt-auto pt-3">
          <span className="text-[9px] font-medium text-muted-foreground/50">v0.1</span>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Content area                                                       */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 overflow-hidden">
        <PageContent page={activePage} />
      </main>
    </div>
  )
}
