import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/stores/theme'
import {
  FolderOpen,
  Cloud,
  HardDrive,
  Printer,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Check,
  RotateCcw,
  Clock,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  AlertTriangle,
  FileText,
  Gauge,
  ChevronDown,
  Loader2,
  Sparkles,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceMode = 'local' | 'cloud'
type PrinterStatus = 'online' | 'warning' | 'offline'
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type PaperSize = '4x6' | '5x7' | '6x8' | '8x10'
type ConnectionTestState = 'idle' | 'testing' | 'success' | 'error'
type SaveState = 'idle' | 'saving' | 'saved'

interface PrinterInfo {
  id: string
  name: string
  model: string
  status: PrinterStatus
  paper: PaperSize
  paperFinish: string
  jobCount: number
  selected: boolean
  isDefault: boolean
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPrinters: PrinterInfo[] = [
  {
    id: 'p1',
    name: 'Canon SELPHY CP1500',
    model: 'CP1500',
    status: 'online',
    paper: '4x6',
    paperFinish: 'Glossy',
    jobCount: 247,
    selected: true,
    isDefault: true,
  },
  {
    id: 'p2',
    name: 'DNP DS620A',
    model: 'DS620A',
    status: 'online',
    paper: '4x6',
    paperFinish: 'Matte',
    jobCount: 189,
    selected: true,
    isDefault: false,
  },
  {
    id: 'p3',
    name: 'Mitsubishi CP-D90DW',
    model: 'CP-D90DW',
    status: 'warning',
    paper: '5x7',
    paperFinish: 'Glossy',
    jobCount: 56,
    selected: false,
    isDefault: false,
  },
  {
    id: 'p4',
    name: 'HiTi P525L',
    model: 'P525L',
    status: 'offline',
    paper: '4x6',
    paperFinish: 'N/A',
    jobCount: 0,
    selected: false,
    isDefault: false,
  },
]

const FILE_FORMATS = [
  { ext: 'JPG', enabled: true },
  { ext: 'PNG', enabled: true },
  { ext: 'TIFF', enabled: false },
  { ext: 'BMP', enabled: false },
  { ext: 'HEIC', enabled: true },
] as const

const PAPER_SIZES: { value: PaperSize; label: string }[] = [
  { value: '4x6', label: '4 x 6"' },
  { value: '5x7', label: '5 x 7"' },
  { value: '6x8', label: '6 x 8"' },
  { value: '8x10', label: '8 x 10"' },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}): React.JSX.Element {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4.5 w-4.5 text-amber-accent" />
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <p className="mt-1.5 pl-7 text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}

function StatusDot({ status }: { status: PrinterStatus }): React.JSX.Element {
  const colors: Record<PrinterStatus, string> = {
    online: 'bg-emerald-500',
    warning: 'bg-amber-400',
    offline: 'bg-zinc-400',
  }
  const labels: Record<PrinterStatus, string> = {
    online: 'Online',
    warning: 'Low media',
    offline: 'Offline',
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', colors[status])} />
      <span
        className={cn(
          'text-xs',
          status === 'online' && 'text-emerald-500',
          status === 'warning' && 'text-amber-accent',
          status === 'offline' && 'text-muted-foreground'
        )}
      >
        {labels[status]}
      </span>
    </span>
  )
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode
  htmlFor?: string
}): React.JSX.Element {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-foreground">
      {children}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{children}</p>
}

/** A custom toggle switch -- the amber pill */
function Toggle({
  checked,
  onChange,
  size = 'md',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  size?: 'sm' | 'md'
}): React.JSX.Element {
  const w = size === 'sm' ? 'w-9' : 'w-11'
  const h = size === 'sm' ? 'h-5' : 'h-6'
  const dot = size === 'sm' ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'
  const translate = size === 'sm' ? 'translate-x-[16px]' : 'translate-x-[20px]'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        w,
        h,
        checked ? 'bg-amber-accent' : 'bg-secondary'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
          dot,
          checked ? translate : 'translate-x-[3px]'
        )}
      />
    </button>
  )
}

/** Custom select dropdown */
function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 w-full appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm text-foreground',
          'outline-none transition-all duration-150',
          'focus:border-amber-accent/50 focus:ring-2 focus:ring-amber-accent/15'
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

/** Number stepper with +/- */
function NumberStepper({
  value,
  onChange,
  min,
  max,
  unit,
  id,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  unit: string
  id?: string
}): React.JSX.Element {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="flex h-9 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          aria-label="Decrease"
        >
          -
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n)) onChange(clamp(n))
          }}
          className="h-9 w-12 border-x border-border bg-transparent text-center font-mono text-sm text-foreground outline-none"
          aria-label={`Value in ${unit}`}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="flex h-9 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          aria-label="Increase"
        >
          +
        </button>
      </div>
      <span className="text-sm text-muted-foreground">{unit}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Registration Key Input (the "moment" -- segmented, auto-advance)
// ---------------------------------------------------------------------------

function RegistrationKeyInput({
  value,
  onChange,
  showKey,
}: {
  value: string
  onChange: (v: string) => void
  showKey: boolean
}): React.JSX.Element {
  // Split into 3 segments of 4 chars
  const segments = [value.slice(0, 4), value.slice(4, 8), value.slice(8, 12)]
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleSegmentChange = useCallback(
    (index: number, raw: string) => {
      const cleaned = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4)
      const newSegments = [...segments]
      newSegments[index] = cleaned
      onChange(newSegments.join(''))
      // Auto-advance
      if (cleaned.length === 4 && index < 2) {
        refs[index + 1].current?.focus()
      }
    },
    [segments, onChange, refs]
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && segments[index].length === 0 && index > 0) {
        refs[index - 1].current?.focus()
      }
    },
    [segments, refs]
  )

  return (
    <div className="flex items-center gap-2">
      {segments.map((seg, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-sm font-medium text-muted-foreground select-none">&ndash;</span>}
          <input
            ref={refs[i]}
            type={showKey ? 'text' : 'password'}
            value={seg}
            onChange={(e) => handleSegmentChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            maxLength={4}
            placeholder="0000"
            className={cn(
              'h-10 w-[4.5rem] rounded-lg border border-border bg-card text-center font-mono text-sm tracking-[0.2em] text-foreground',
              'outline-none transition-all duration-150',
              'placeholder:text-muted-foreground/40',
              'focus:border-amber-accent/60 focus:ring-2 focus:ring-amber-accent/15',
              !showKey && 'tracking-normal'
            )}
            aria-label={`Registration key segment ${i + 1}`}
          />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SettingsB(): React.JSX.Element {
  const { theme, toggle: toggleTheme } = useTheme()

  // Source mode
  const [mode, setMode] = useState<SourceMode>('local')

  // Local config
  const [watchDir, setWatchDir] = useState('/Users/photographer/Events/2025-Gala')
  const [enabledFormats, setEnabledFormats] = useState<Set<string>>(
    new Set(FILE_FORMATS.filter((f) => f.enabled).map((f) => f.ext))
  )
  const [maxFileSize, setMaxFileSize] = useState(50)

  // Cloud config
  const [registrationKey, setRegistrationKey] = useState('SPK4829A7714')
  const [showKey, setShowKey] = useState(false)
  const [apiEndpoint, setApiEndpoint] = useState('https://api.smartprint.io/v2')
  const [connectionTest, setConnectionTest] = useState<ConnectionTestState>('idle')

  // Printers
  const [printers, setPrinters] = useState<PrinterInfo[]>(mockPrinters)
  const [defaultPaper, setDefaultPaper] = useState<PaperSize>('4x6')

  // Preferences
  const [pollInterval, setPollInterval] = useState(3)
  const [healthCheckInterval, setHealthCheckInterval] = useState(30)
  const [logLevel, setLogLevel] = useState<LogLevel>('info')

  // Save state
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Handlers ──────────────────────────────────────────────────

  function handleTogglePrinter(id: string): void {
    const selectedCount = printers.filter((p) => p.selected).length
    const target = printers.find((p) => p.id === id)
    if (!target) return

    // Enforce pool limit of 4
    if (!target.selected && selectedCount >= 4) return

    setPrinters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    )
  }

  function handleSetDefault(id: string): void {
    setPrinters((prev) =>
      prev.map((p) => ({
        ...p,
        isDefault: p.id === id,
        selected: p.id === id ? true : p.selected,
      }))
    )
  }

  function toggleFormat(ext: string): void {
    setEnabledFormats((prev) => {
      const next = new Set(prev)
      if (next.has(ext)) next.delete(ext)
      else next.add(ext)
      return next
    })
  }

  function handleTestConnection(): void {
    setConnectionTest('testing')
    setTimeout(() => {
      setConnectionTest('success')
      setTimeout(() => setConnectionTest('idle'), 3000)
    }, 1800)
  }

  function handleSave(): void {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveState('saving')
    saveTimerRef.current = setTimeout(() => {
      setSaveState('saved')
      saveTimerRef.current = setTimeout(() => {
        setSaveState('idle')
      }, 2000)
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  function handleReset(): void {
    setMode('local')
    setWatchDir('/Users/photographer/Events/2025-Gala')
    setEnabledFormats(new Set(FILE_FORMATS.filter((f) => f.enabled).map((f) => f.ext)))
    setMaxFileSize(50)
    setRegistrationKey('SPK4829A7714')
    setApiEndpoint('https://api.smartprint.io/v2')
    setPollInterval(3)
    setHealthCheckInterval(30)
    setLogLevel('info')
    setPrinters(mockPrinters)
    setDefaultPaper('4x6')
    setSaveState('idle')
    setConnectionTest('idle')
  }

  const selectedPoolCount = printers.filter((p) => p.selected).length

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[52rem] px-8 py-8">
          <div className="space-y-12">
            {/* ================================================================
                SECTION 1: Photo Source
            ================================================================ */}
            <section>
              <SectionHeader
                icon={HardDrive}
                title="Photo Source"
                description="Choose how Smart Print discovers new photos. Local watches a folder on this machine; Cloud connects to a remote API."
              />

              {/* Mode selector -- two competing cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Local card */}
                <button
                  type="button"
                  onClick={() => setMode('local')}
                  className={cn(
                    'group relative flex flex-col gap-4 rounded-xl border-2 p-5 text-left transition-all duration-300',
                    mode === 'local'
                      ? 'border-amber-accent bg-glow shadow-[0_0_24px_-6px_var(--amber)]'
                      : 'border-transparent bg-card hover:bg-surface-elevated'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300',
                        mode === 'local'
                          ? 'bg-amber-accent text-amber-accent-foreground'
                          : 'bg-secondary text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300',
                        mode === 'local'
                          ? 'border-amber-accent bg-amber-accent'
                          : 'border-border bg-transparent'
                      )}
                    >
                      {mode === 'local' && <Check className="h-3.5 w-3.5 text-amber-accent-foreground" strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">Local Folder</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      Watch a directory on this machine for new images. Best for on-site event printing.
                    </p>
                  </div>
                </button>

                {/* Cloud card */}
                <button
                  type="button"
                  onClick={() => setMode('cloud')}
                  className={cn(
                    'group relative flex flex-col gap-4 rounded-xl border-2 p-5 text-left transition-all duration-300',
                    mode === 'cloud'
                      ? 'border-amber-accent bg-glow shadow-[0_0_24px_-6px_var(--amber)]'
                      : 'border-transparent bg-card hover:bg-surface-elevated'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300',
                        mode === 'cloud'
                          ? 'bg-amber-accent text-amber-accent-foreground'
                          : 'bg-secondary text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300',
                        mode === 'cloud'
                          ? 'border-amber-accent bg-amber-accent'
                          : 'border-border bg-transparent'
                      )}
                    >
                      {mode === 'cloud' && <Check className="h-3.5 w-3.5 text-amber-accent-foreground" strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">Cloud Service</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      Receive photos from a remote API. Ideal for multi-location or remote workflows.
                    </p>
                  </div>
                </button>
              </div>

              {/* ── Local mode config ── */}
              {mode === 'local' && (
                <div className="mt-5 space-y-5 rounded-xl border border-border bg-card p-6">
                  {/* Watch directory */}
                  <div>
                    <FieldLabel htmlFor="watch-dir">Watch Directory</FieldLabel>
                    <div className="flex gap-2">
                      <div className="flex flex-1 items-center rounded-lg border border-border bg-surface-sunken px-3">
                        <FolderOpen className="mr-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          id="watch-dir"
                          type="text"
                          value={watchDir}
                          onChange={(e) => setWatchDir(e.target.value)}
                          className="h-9 w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                          placeholder="/path/to/photos"
                        />
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary"
                      >
                        Browse
                      </button>
                    </div>
                    <FieldHint>
                      New images placed in this folder will be automatically queued for printing.
                    </FieldHint>
                  </div>

                  {/* File formats */}
                  <div>
                    <FieldLabel>File Formats</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {FILE_FORMATS.map((f) => {
                        const active = enabledFormats.has(f.ext)
                        return (
                          <button
                            key={f.ext}
                            type="button"
                            onClick={() => toggleFormat(f.ext)}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 font-mono text-xs font-medium transition-all duration-200',
                              active
                                ? 'border-amber-accent/40 bg-amber-accent/10 text-amber-accent'
                                : 'border-border bg-surface-sunken text-muted-foreground hover:border-border hover:text-foreground'
                            )}
                          >
                            .{f.ext.toLowerCase()}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Max file size */}
                  <div>
                    <FieldLabel htmlFor="max-file-size">Maximum File Size</FieldLabel>
                    <NumberStepper
                      id="max-file-size"
                      value={maxFileSize}
                      onChange={setMaxFileSize}
                      min={1}
                      max={200}
                      unit="MB"
                    />
                    <FieldHint>Files larger than this will be skipped.</FieldHint>
                  </div>
                </div>
              )}

              {/* ── Cloud mode config ── */}
              {mode === 'cloud' && (
                <div className="mt-5 space-y-5 rounded-xl border border-border bg-card p-6">
                  {/* Registration key */}
                  <div>
                    <div className="flex items-center justify-between">
                      <FieldLabel>Registration Key</FieldLabel>
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showKey ? 'Hide key' : 'Reveal key'}
                      >
                        {showKey ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        {showKey ? 'Hide' : 'Reveal'}
                      </button>
                    </div>
                    <RegistrationKeyInput
                      value={registrationKey}
                      onChange={setRegistrationKey}
                      showKey={showKey}
                    />
                    <FieldHint>
                      12-character key from your cloud administrator. Format: XXXX-XXXX-XXXX.
                    </FieldHint>
                  </div>

                  {/* API endpoint */}
                  <div>
                    <FieldLabel htmlFor="api-endpoint">API Endpoint</FieldLabel>
                    <input
                      id="api-endpoint"
                      type="url"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      className={cn(
                        'h-9 w-full rounded-lg border border-border bg-surface-sunken px-3 font-mono text-sm text-foreground',
                        'outline-none transition-all duration-150',
                        'placeholder:text-muted-foreground/50',
                        'focus:border-amber-accent/50 focus:ring-2 focus:ring-amber-accent/15'
                      )}
                      placeholder="https://api.example.com/v2"
                    />
                  </div>

                  {/* Connection test */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={connectionTest === 'testing'}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-all duration-200',
                        connectionTest === 'testing'
                          ? 'cursor-not-allowed text-muted-foreground'
                          : 'text-foreground hover:bg-secondary'
                      )}
                    >
                      {connectionTest === 'testing' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : connectionTest === 'success' ? (
                        <Wifi className="h-4 w-4 text-emerald-500" />
                      ) : connectionTest === 'error' ? (
                        <WifiOff className="h-4 w-4 text-red-400" />
                      ) : (
                        <Wifi className="h-4 w-4" />
                      )}
                      {connectionTest === 'testing'
                        ? 'Testing...'
                        : connectionTest === 'success'
                          ? 'Connected'
                          : connectionTest === 'error'
                            ? 'Failed'
                            : 'Test Connection'}
                    </button>
                    {connectionTest === 'success' && (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Authenticated successfully. Latency: 42ms
                      </span>
                    )}
                    {connectionTest === 'error' && (
                      <span className="flex items-center gap-1.5 text-xs text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Could not reach endpoint. Check URL and key.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ================================================================
                SECTION 2: Printer Pool
            ================================================================ */}
            <section>
              <SectionHeader
                icon={Printer}
                title="Printer Pool"
                description={`Select up to 4 printers for the active rotation. ${selectedPoolCount} of 4 slots used.`}
              />

              <div className="space-y-3">
                {printers.map((printer) => {
                  const isDisabledToggle =
                    !printer.selected && selectedPoolCount >= 4

                  return (
                    <div
                      key={printer.id}
                      className={cn(
                        'group relative flex items-center gap-4 rounded-xl border p-4 transition-all duration-200',
                        printer.selected
                          ? 'border-amber-accent/30 bg-glow'
                          : 'border-border bg-card',
                        printer.status === 'offline' && 'opacity-60'
                      )}
                    >
                      {/* Toggle checkbox */}
                      <button
                        type="button"
                        onClick={() => handleTogglePrinter(printer.id)}
                        disabled={isDisabledToggle}
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200',
                          printer.selected
                            ? 'border-amber-accent bg-amber-accent'
                            : isDisabledToggle
                              ? 'cursor-not-allowed border-border opacity-40'
                              : 'border-border hover:border-muted-foreground'
                        )}
                        aria-label={`${printer.selected ? 'Remove' : 'Add'} ${printer.name} ${isDisabledToggle ? '(pool full)' : ''}`}
                      >
                        {printer.selected && (
                          <Check className="h-3 w-3 text-amber-accent-foreground" strokeWidth={3} />
                        )}
                      </button>

                      {/* Printer icon */}
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
                          printer.selected
                            ? 'bg-amber-accent/15 text-amber-accent'
                            : 'bg-secondary text-muted-foreground'
                        )}
                      >
                        <Printer className="h-5 w-5" />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {printer.name}
                          </p>
                          {printer.isDefault && (
                            <span className="shrink-0 rounded-md bg-amber-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-accent">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-4">
                          <StatusDot status={printer.status} />
                          <span className="text-xs text-muted-foreground">
                            {printer.paper} {printer.paperFinish}
                          </span>
                          {printer.jobCount > 0 && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {printer.jobCount} jobs
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Set as default */}
                      {printer.selected && !printer.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(printer.id)}
                          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-0 transition-all duration-200 hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                        >
                          Set default
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Default paper size */}
              <div className="mt-5 flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Default Paper Size</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Applied when a printer has no per-job override
                  </p>
                </div>
                <Select
                  value={defaultPaper}
                  onChange={(v) => setDefaultPaper(v as PaperSize)}
                  options={PAPER_SIZES}
                  className="w-32"
                />
              </div>
            </section>

            {/* ================================================================
                SECTION 3: General Preferences
            ================================================================ */}
            <section>
              <SectionHeader
                icon={Gauge}
                title="General"
                description="Fine-tune performance, logging, and appearance settings."
              />

              <div className="space-y-4">
                {/* Timing row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Poll Interval</span>
                    </div>
                    <NumberStepper
                      id="poll-interval"
                      value={pollInterval}
                      onChange={setPollInterval}
                      min={1}
                      max={60}
                      unit="sec"
                    />
                    <FieldHint>How often to check for new photos.</FieldHint>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Health Check</span>
                    </div>
                    <NumberStepper
                      id="health-check"
                      value={healthCheckInterval}
                      onChange={setHealthCheckInterval}
                      min={5}
                      max={300}
                      unit="sec"
                    />
                    <FieldHint>Frequency of printer health pings.</FieldHint>
                  </div>
                </div>

                {/* Log level */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Log Level</p>
                      <p className="text-xs text-muted-foreground">
                        Controls verbosity of application logs
                      </p>
                    </div>
                  </div>
                  <Select
                    value={logLevel}
                    onChange={(v) => setLogLevel(v as LogLevel)}
                    options={[
                      { value: 'debug', label: 'Debug' },
                      { value: 'info', label: 'Info' },
                      { value: 'warn', label: 'Warning' },
                      { value: 'error', label: 'Error' },
                    ]}
                    className="w-28"
                  />
                </div>

                {/* Appearance -- the REAL theme toggle */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-300',
                        theme === 'dark'
                          ? 'bg-secondary text-amber-accent'
                          : 'bg-amber-accent/10 text-amber-accent'
                      )}
                    >
                      {theme === 'dark' ? (
                        <Moon className="h-4 w-4" />
                      ) : (
                        <Sun className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Appearance</p>
                      <p className="text-xs text-muted-foreground">
                        {theme === 'dark' ? 'Dark mode is active' : 'Light mode is active'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Sun className={cn('h-4 w-4 transition-colors', theme === 'light' ? 'text-amber-accent' : 'text-muted-foreground')} />
                    <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
                    <Moon className={cn('h-4 w-4 transition-colors', theme === 'dark' ? 'text-amber-accent' : 'text-muted-foreground')} />
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom spacer so content isn't hidden behind sticky bar */}
            <div className="h-2" aria-hidden />
          </div>
        </div>
      </div>

      {/* ── Sticky action bar ─────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-background/80 px-8 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-[52rem] items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Changes are saved locally to this machine.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>

            {/* THE save button -- transforms on save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState !== 'idle'}
              className={cn(
                'relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-lg px-5 text-sm font-semibold transition-all duration-300',
                saveState === 'saved'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-accent text-amber-accent-foreground hover:brightness-110',
                saveState === 'saving' && 'cursor-not-allowed'
              )}
            >
              {saveState === 'idle' && (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
              {saveState === 'saving' && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              )}
              {saveState === 'saved' && (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Saved
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
