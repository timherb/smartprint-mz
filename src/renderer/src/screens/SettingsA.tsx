import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  FolderOpen,
  Cloud,
  HardDrive,
  Printer,
  Check,
  ChevronDown,
  RefreshCw,
  Save,
  Wifi,
  WifiOff
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = 'local' | 'cloud'
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface PrinterInfo {
  id: string
  name: string
  status: 'online' | 'offline' | 'busy'
  isPooled: boolean
  isDefault: boolean
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PRINTERS: PrinterInfo[] = [
  { id: 'p1', name: 'Canon SELPHY CP1500', status: 'online', isPooled: true, isDefault: true },
  { id: 'p2', name: 'DNP DS620A', status: 'online', isPooled: true, isDefault: false },
  { id: 'p3', name: 'Epson SureColor P700', status: 'offline', isPooled: false, isDefault: false },
  { id: 'p4', name: 'Mitsubishi CP-D90DW', status: 'busy', isPooled: false, isDefault: false }
]

const FILE_TYPES = [
  { ext: 'jpg', label: 'JPEG', enabled: true },
  { ext: 'png', label: 'PNG', enabled: true },
  { ext: 'tiff', label: 'TIFF', enabled: false },
  { ext: 'bmp', label: 'BMP', enabled: false },
  { ext: 'heic', label: 'HEIC', enabled: false }
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: 'online' | 'offline' | 'busy' }): React.JSX.Element {
  const colors: Record<string, string> = {
    online: 'bg-emerald-500',
    offline: 'bg-zinc-500',
    busy: 'bg-amber-500'
  }
  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', colors[status])}
      aria-label={status}
    />
  )
}

function SectionHeading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      {children}
    </div>
  )
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }): React.JSX.Element {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground">
      {children}
    </label>
  )
}

function HintText({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{children}</p>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsA(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('local')
  const [watchPath, setWatchPath] = useState('/Users/photographer/EventPhotos/2025-gala')
  const [fileTypes, setFileTypes] = useState(FILE_TYPES)
  const [registrationKey, setRegistrationKey] = useState('')
  const [cloudConnected, setCloudConnected] = useState(false)
  const [printers, setPrinters] = useState(MOCK_PRINTERS)
  const [pollInterval, setPollInterval] = useState(2)
  const [healthCheckInterval, setHealthCheckInterval] = useState(30)
  const [logLevel, setLogLevel] = useState<LogLevel>('info')
  const [saved, setSaved] = useState(false)

  const toggleFileType = (ext: string): void => {
    setFileTypes((prev) =>
      prev.map((ft) => (ft.ext === ext ? { ...ft, enabled: !ft.enabled } : ft))
    )
  }

  const togglePooled = (id: string): void => {
    setPrinters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isPooled: !p.isPooled } : p))
    )
  }

  const setDefaultPrinter = (id: string): void => {
    setPrinters((prev) =>
      prev.map((p) => ({ ...p, isDefault: p.id === id }))
    )
  }

  const handleSave = (): void => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestConnection = (): void => {
    setCloudConnected((prev) => !prev)
  }

  const formatKey = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 12)
    const parts: string[] = []
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4))
    }
    return parts.join('-')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <h1 className="text-sm font-semibold text-foreground">Settings</h1>
        <button
          onClick={handleSave}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            saved
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          )}
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-5 p-5">
          {/* -------------------------------------------------------------- */}
          {/* Mode Selection                                                  */}
          {/* -------------------------------------------------------------- */}
          <section>
            <SectionHeading>Source Mode</SectionHeading>
            <Card>
              <div className="flex items-center gap-2">
                {/* Toggle pill */}
                <div className="flex rounded-md border border-border bg-secondary/50 p-0.5">
                  <button
                    onClick={() => setMode('local')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors',
                      mode === 'local'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                    Local
                  </button>
                  <button
                    onClick={() => setMode('cloud')}
                    className={cn(
                      'flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors',
                      mode === 'cloud'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    Cloud
                  </button>
                </div>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {mode === 'local'
                    ? 'Watch a local folder for new photos'
                    : 'Connect to cloud relay for remote events'}
                </span>
              </div>
            </Card>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* Local mode settings                                             */}
          {/* -------------------------------------------------------------- */}
          {mode === 'local' && (
            <section>
              <SectionHeading>Local Watch Folder</SectionHeading>
              <Card className="space-y-4">
                {/* Directory picker */}
                <div>
                  <Label>Watch Directory</Label>
                  <div className="mt-1.5 flex gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-1.5">
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono text-xs text-foreground">
                        {watchPath}
                      </span>
                    </div>
                    <button
                      onClick={() => setWatchPath('/Users/photographer/EventPhotos/2025-gala')}
                      className="shrink-0 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      Browse
                    </button>
                  </div>
                  <HintText>New photos placed in this directory will be queued for printing.</HintText>
                </div>

                {/* File types */}
                <div>
                  <Label>File Types</Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {fileTypes.map((ft) => (
                      <button
                        key={ft.ext}
                        onClick={() => toggleFileType(ft.ext)}
                        className={cn(
                          'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                          ft.enabled
                            ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
                            : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        .{ft.ext}
                      </button>
                    ))}
                  </div>
                  <HintText>Select which image formats to watch for.</HintText>
                </div>
              </Card>
            </section>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Cloud mode settings                                             */}
          {/* -------------------------------------------------------------- */}
          {mode === 'cloud' && (
            <section>
              <SectionHeading>Cloud Connection</SectionHeading>
              <Card className="space-y-4">
                {/* Registration key */}
                <div>
                  <Label htmlFor="reg-key">Registration Key</Label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="reg-key"
                      type="text"
                      value={registrationKey}
                      onChange={(e) => setRegistrationKey(formatKey(e.target.value))}
                      placeholder="0000-0000-0000"
                      className="flex-1 rounded-md border border-border bg-secondary/30 px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                      maxLength={14}
                    />
                    <button
                      onClick={handleTestConnection}
                      className="shrink-0 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      Test
                    </button>
                  </div>
                  <HintText>Enter the 12-digit key from your event dashboard.</HintText>
                </div>

                {/* Connection status */}
                <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/20 px-3 py-2">
                  {cloudConnected ? (
                    <>
                      <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-xs text-emerald-400">Connected to relay</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        relay-us-east-1.smartprint.io
                      </span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Not connected</span>
                    </>
                  )}
                </div>
              </Card>
            </section>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Printer Configuration                                           */}
          {/* -------------------------------------------------------------- */}
          <section>
            <SectionHeading>Printers</SectionHeading>
            <Card className="space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {printers.filter((p) => p.status === 'online').length} of {printers.length} online
                </span>
                <button className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>

              {/* Printer list */}
              <div className="space-y-1">
                {printers.map((printer) => (
                  <div
                    key={printer.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-secondary/20 px-3 py-2 transition-colors hover:bg-secondary/40"
                  >
                    <StatusDot status={printer.status} />
                    <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate text-xs text-foreground">{printer.name}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {printer.status}
                    </span>

                    {/* Pool checkbox */}
                    <button
                      onClick={() => togglePooled(printer.id)}
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border transition-colors',
                        printer.isPooled
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-border bg-secondary/30 hover:border-muted-foreground'
                      )}
                      aria-label={`Include ${printer.name} in pool`}
                      title="Include in print pool"
                    >
                      {printer.isPooled && <Check className="h-3 w-3 text-white" />}
                    </button>

                    {/* Default radio */}
                    <button
                      onClick={() => setDefaultPrinter(printer.id)}
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
                        printer.isDefault
                          ? 'border-blue-500'
                          : 'border-border hover:border-muted-foreground'
                      )}
                      aria-label={`Set ${printer.name} as default`}
                      title="Set as default printer"
                    >
                      {printer.isDefault && (
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 pt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3.5 w-3.5 rounded border border-blue-500 bg-blue-500 text-center text-[8px] leading-[14px] text-white">
                    <Check className="mx-auto h-2.5 w-2.5" />
                  </span>
                  Pool
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-blue-500">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                  </span>
                  Default
                </span>
              </div>
            </Card>
          </section>

          {/* -------------------------------------------------------------- */}
          {/* General Settings                                                */}
          {/* -------------------------------------------------------------- */}
          <section>
            <SectionHeading>General</SectionHeading>
            <Card className="space-y-4">
              {/* Poll interval */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="poll-interval">Poll Interval</Label>
                  <HintText>How often to check for new photos (seconds).</HintText>
                </div>
                <input
                  id="poll-interval"
                  type="number"
                  min={1}
                  max={60}
                  value={pollInterval}
                  onChange={(e) => setPollInterval(Number(e.target.value))}
                  className="w-20 rounded-md border border-border bg-secondary/30 px-2.5 py-1.5 text-center font-mono text-xs text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              {/* Health check interval */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="health-interval">Health Check Interval</Label>
                  <HintText>How often to ping printers for status (seconds).</HintText>
                </div>
                <input
                  id="health-interval"
                  type="number"
                  min={5}
                  max={300}
                  value={healthCheckInterval}
                  onChange={(e) => setHealthCheckInterval(Number(e.target.value))}
                  className="w-20 rounded-md border border-border bg-secondary/30 px-2.5 py-1.5 text-center font-mono text-xs text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>

              {/* Log level */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="log-level">Log Level</Label>
                  <HintText>Minimum severity to write to the log file.</HintText>
                </div>
                <div className="relative">
                  <select
                    id="log-level"
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value as LogLevel)}
                    className="w-28 appearance-none rounded-md border border-border bg-secondary/30 px-2.5 py-1.5 pr-7 text-xs text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </Card>
          </section>

          {/* Bottom spacer for scroll */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  )
}
