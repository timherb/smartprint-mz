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
// Section divider -- editorial gradient line
// ---------------------------------------------------------------------------

function SectionDivider(): React.JSX.Element {
  return (
    <div className="py-2">
      <div
        className="h-px w-full"
        style={{
          background: 'linear-gradient(90deg, var(--amber), transparent 60%)',
          opacity: 0.25,
        }}
      />
    </div>
  )
}

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
    <div className="mb-8">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-glow">
          <Icon className="h-4.5 w-4.5 text-amber-accent" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground" style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}>
          {title}
        </h2>
      </div>
      <p className="mt-2 pl-12 text-[13px] leading-relaxed text-muted-foreground max-w-xl">
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
    <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-medium text-foreground tracking-wide">
      {children}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{children}</p>
}

/** Toggle switch */
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
          'h-10 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-9 text-sm text-foreground',
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
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

/** Number stepper */
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
    <div className="flex items-center gap-2.5">
      <div className="flex items-center overflow-hidden rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="flex h-10 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
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
          className="h-10 w-14 border-x border-border bg-transparent text-center text-sm text-foreground outline-none"
          style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
          aria-label={`Value in ${unit}`}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="flex h-10 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
          aria-label="Increase"
        >
          +
        </button>
      </div>
      <span className="text-sm text-muted-foreground tracking-wide">{unit}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Registration Key Input (segmented, auto-advance)
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
  const segments = [value.slice(0, 4), value.slice(4, 8), value.slice(8, 12)]
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleSegmentChange = useCallback(
    (index: number, raw: string) => {
      const cleaned = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4)
      const newSegments = [...segments]
      newSegments[index] = cleaned
      onChange(newSegments.join(''))
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
    <div className="flex items-center gap-2.5">
      {segments.map((seg, i) => (
        <div key={i} className="flex items-center gap-2.5">
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
              'h-11 w-[5rem] rounded-2xl border border-border bg-card text-center text-sm tracking-[0.25em] text-foreground',
              'outline-none transition-all duration-150',
              'placeholder:text-muted-foreground/40',
              'focus:border-amber-accent/60 focus:ring-2 focus:ring-amber-accent/15',
              !showKey && 'tracking-normal'
            )}
            style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
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

export default function SettingsB2(): React.JSX.Element {
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

  // -- Handlers --

  function handleTogglePrinter(id: string): void {
    const selectedCount = printers.filter((p) => p.selected).length
    const target = printers.find((p) => p.id === id)
    if (!target) return
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

  // -- Render --

  return (
    <div className="flex h-full flex-col" style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[54rem] px-10 py-10">
          <div className="space-y-14">
            {/* ================================================================
                SECTION 1: Photo Source
            ================================================================ */}
            <section>
              <SectionHeader
                icon={HardDrive}
                title="Photo Source"
                description="Choose how Smart Print discovers new photos. Local watches a folder on this machine; Cloud connects to a remote API."
              />

              {/* Mode selector -- two editorial cards */}
              <div className="grid grid-cols-2 gap-5">
                {/* Local card */}
                <button
                  type="button"
                  onClick={() => setMode('local')}
                  className={cn(
                    'group relative flex flex-col gap-5 rounded-2xl border-2 p-6 text-left transition-all duration-300',
                    mode === 'local'
                      ? 'border-amber-accent bg-glow shadow-[0_0_32px_-8px_var(--amber)]'
                      : 'border-transparent bg-card hover:bg-surface-elevated'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300',
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
                    <p className="text-base font-semibold text-foreground tracking-tight">Local Folder</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      Watch a directory on this machine for new images. Best for on-site event printing.
                    </p>
                  </div>
                </button>

                {/* Cloud card */}
                <button
                  type="button"
                  onClick={() => setMode('cloud')}
                  className={cn(
                    'group relative flex flex-col gap-5 rounded-2xl border-2 p-6 text-left transition-all duration-300',
                    mode === 'cloud'
                      ? 'border-amber-accent bg-glow shadow-[0_0_32px_-8px_var(--amber)]'
                      : 'border-transparent bg-card hover:bg-surface-elevated'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300',
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
                    <p className="text-base font-semibold text-foreground tracking-tight">Cloud Service</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      Receive photos from a remote API. Ideal for multi-location or remote workflows.
                    </p>
                  </div>
                </button>
              </div>

              {/* Local mode config */}
              {mode === 'local' && (
                <div className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-7">
                  {/* Watch directory */}
                  <div>
                    <FieldLabel htmlFor="watch-dir-b2">Watch Directory</FieldLabel>
                    <div className="flex gap-2.5">
                      <div className="flex flex-1 items-center rounded-2xl border border-border bg-surface-sunken px-4">
                        <FolderOpen className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          id="watch-dir-b2"
                          type="text"
                          value={watchDir}
                          onChange={(e) => setWatchDir(e.target.value)}
                          className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                          style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
                          placeholder="/path/to/photos"
                        />
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-2xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary"
                      >
                        Browse
                      </button>
                    </div>
                    <FieldHint>
                      New images placed in this folder will be automatically queued for printing.
                    </FieldHint>
                  </div>

                  <SectionDivider />

                  {/* File formats */}
                  <div>
                    <FieldLabel>File Formats</FieldLabel>
                    <div className="flex flex-wrap gap-2.5">
                      {FILE_FORMATS.map((f) => {
                        const active = enabledFormats.has(f.ext)
                        return (
                          <button
                            key={f.ext}
                            type="button"
                            onClick={() => toggleFormat(f.ext)}
                            className={cn(
                              'rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200',
                              active
                                ? 'border-amber-accent/40 bg-amber-accent/10 text-amber-accent'
                                : 'border-border bg-surface-sunken text-muted-foreground hover:border-border hover:text-foreground'
                            )}
                            style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
                          >
                            .{f.ext.toLowerCase()}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Max file size */}
                  <div>
                    <FieldLabel htmlFor="max-file-size-b2">Maximum File Size</FieldLabel>
                    <NumberStepper
                      id="max-file-size-b2"
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

              {/* Cloud mode config */}
              {mode === 'cloud' && (
                <div className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-7">
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

                  <SectionDivider />

                  {/* API endpoint */}
                  <div>
                    <FieldLabel htmlFor="api-endpoint-b2">API Endpoint</FieldLabel>
                    <input
                      id="api-endpoint-b2"
                      type="url"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      className={cn(
                        'h-10 w-full rounded-2xl border border-border bg-surface-sunken px-4 text-sm text-foreground',
                        'outline-none transition-all duration-150',
                        'placeholder:text-muted-foreground/50',
                        'focus:border-amber-accent/50 focus:ring-2 focus:ring-amber-accent/15'
                      )}
                      style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
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
                        'inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-2.5 text-sm font-medium transition-all duration-200',
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
                        'group relative flex items-center gap-4 rounded-2xl border p-5 transition-all duration-200',
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
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
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
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors duration-200',
                          printer.selected
                            ? 'bg-amber-accent/15 text-amber-accent'
                            : 'bg-secondary text-muted-foreground'
                        )}
                      >
                        <Printer className="h-5 w-5" />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {printer.name}
                          </p>
                          {printer.isDefault && (
                            <span className="shrink-0 rounded-full bg-amber-accent/15 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-accent">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-4">
                          <StatusDot status={printer.status} />
                          <span className="text-xs text-muted-foreground">
                            {printer.paper} {printer.paperFinish}
                          </span>
                          {printer.jobCount > 0 && (
                            <span
                              className="text-xs text-muted-foreground"
                              style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
                            >
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
                          className="shrink-0 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground opacity-0 transition-all duration-200 hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                        >
                          Set default
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Default paper size */}
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card p-5">
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
                  className="w-36"
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

              <div className="space-y-5">
                {/* Timing row */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="mb-4 flex items-center gap-2.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Poll Interval</span>
                    </div>
                    <NumberStepper
                      id="poll-interval-b2"
                      value={pollInterval}
                      onChange={setPollInterval}
                      min={1}
                      max={60}
                      unit="sec"
                    />
                    <FieldHint>How often to check for new photos.</FieldHint>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="mb-4 flex items-center gap-2.5">
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Health Check</span>
                    </div>
                    <NumberStepper
                      id="health-check-b2"
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
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
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
                    className="w-32"
                  />
                </div>

                {/* Appearance -- theme toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-2xl transition-colors duration-300',
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

            {/* Bottom spacer */}
            <div className="h-2" aria-hidden />
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="shrink-0 border-t border-border bg-background/80 px-10 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-[54rem] items-center justify-between">
          <p className="text-xs text-muted-foreground tracking-wide">
            Changes are saved locally to this machine.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-2xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>

            {/* Save button with state transitions */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState !== 'idle'}
              className={cn(
                'relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-2xl px-6 text-sm font-semibold transition-all duration-300',
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
