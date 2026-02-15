import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/stores/theme'
import { useSettings } from '@/stores/settings'
import { usePrinter } from '@/stores/printer'
import type { PrinterInfoDTO } from '@/stores/printer'
import { useCloud } from '@/stores/cloud'
import { useWatcher } from '@/stores/watcher'
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
  Copy,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PrinterStatus = 'online' | 'warning' | 'offline'
type LogLevel = 'debug' | 'info' | 'warning' | 'error'
type PaperSize = '4x6' | '5x7' | '6x8' | '8x10'
type ConnectionTestState = 'idle' | 'testing' | 'success' | 'error'
type SaveState = 'idle' | 'saving' | 'saved'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map the string status from the API to our display status */
function mapPrinterStatus(apiStatus: string): PrinterStatus {
  const lower = apiStatus.toLowerCase()
  if (lower === 'ready' || lower === 'busy') return 'online'
  if (lower === 'paused') return 'warning'
  if (lower === 'warning' || lower === 'low_media' || lower === 'low media') return 'warning'
  return 'offline'
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
// Sub-components — B3 "Soft Studio" style
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
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c57d3c]/10">
          <Icon className="h-4.5 w-4.5 text-[#c57d3c]" />
        </div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      <p className="mt-2 pl-12 text-[13px] leading-relaxed text-muted-foreground">
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
          status === 'warning' && 'text-amber-400',
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
    <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-medium text-foreground">
      {children}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{children}</p>
}

/** Toggle switch with copper accent, smooth animation */
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
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full',
        'transition-colors duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c57d3c]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        w,
        h,
        checked ? 'bg-[#c57d3c]' : 'bg-secondary'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-sm ring-0',
          'transition-transform duration-300 ease-out',
          dot,
          checked ? translate : 'translate-x-[3px]'
        )}
      />
    </button>
  )
}

/** Soft rounded select */
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
          'h-10 w-full appearance-none rounded-xl border border-border bg-card px-4 pr-9 text-sm text-foreground',
          'outline-none transition-all duration-300',
          'focus:border-[#c57d3c]/50 focus:ring-2 focus:ring-[#c57d3c]/15'
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

/** Number stepper with rounded edges */
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
    <div className="flex items-center gap-3">
      <div className="flex items-center overflow-hidden rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="flex h-10 w-9 items-center justify-center text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-foreground disabled:opacity-30"
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
          className="h-10 w-12 border-x border-border bg-transparent text-center text-sm text-foreground outline-none"
          style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
          aria-label={`Value in ${unit}`}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="flex h-10 w-9 items-center justify-center text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-foreground disabled:opacity-30"
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
// Registration Key Input — segmented auto-advance
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
          {i > 0 && <span className="text-sm font-medium text-muted-foreground/50 select-none">&ndash;</span>}
          <input
            ref={refs[i]}
            type={showKey ? 'text' : 'password'}
            value={seg}
            onChange={(e) => handleSegmentChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            maxLength={4}
            placeholder="0000"
            className={cn(
              'h-11 w-[5rem] rounded-xl border border-border bg-card text-center text-sm tracking-[0.2em] text-foreground',
              'outline-none transition-all duration-300',
              'placeholder:text-muted-foreground/30',
              'focus:border-[#c57d3c]/60 focus:ring-2 focus:ring-[#c57d3c]/15 focus:shadow-sm',
              !showKey && 'tracking-normal'
            )}
            style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
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

export default function SettingsB3(): React.JSX.Element {
  const { theme, toggle: toggleTheme } = useTheme()

  // ── Settings store ───────────────────────────────────────────
  const mode = useSettings((s) => s.mode)
  const setMode = useSettings((s) => s.setMode)
  const localDirectory = useSettings((s) => s.localDirectory)
  const setLocalDirectory = useSettings((s) => s.setLocalDirectory)
  const cloudApiUrl = useSettings((s) => s.cloudApiUrl)
  const setCloudApiUrl = useSettings((s) => s.setCloudApiUrl)
  const pollIntervalMs = useSettings((s) => s.pollInterval)
  const setPollIntervalMs = useSettings((s) => s.setPollInterval)
  const healthIntervalMs = useSettings((s) => s.healthInterval)
  const setHealthIntervalMs = useSettings((s) => s.setHealthInterval)
  const logLevel = useSettings((s) => s.logLevel)
  const setLogLevel = useSettings((s) => s.setLogLevel)

  // ── Printer store ────────────────────────────────────────────
  const printers = usePrinter((s) => s.printers)
  const printerLoading = usePrinter((s) => s.loading)
  const discover = usePrinter((s) => s.discover)
  const syncPoolToMain = usePrinter((s) => s.setPool)

  // ── Printer pool from persisted settings ────────────────────
  const pool = useSettings((s) => s.printerPool)
  const setPool = useCallback((newPool: string[]) => {
    useSettings.getState().setPrinterPool(newPool)
    syncPoolToMain(newPool) // sync to main process
  }, [syncPoolToMain])

  // ── Cloud store ──────────────────────────────────────────────
  const cloudRegistered = useCloud((s) => s.registered)
  const cloudRegister = useCloud((s) => s.register)
  const cloudCheckHealth = useCloud((s) => s.checkHealth)

  // ── Local UI state (not stored in Zustand) ───────────────────
  const [enabledFormats, setEnabledFormats] = useState<Set<string>>(
    new Set(FILE_FORMATS.filter((f) => f.enabled).map((f) => f.ext))
  )
  const [maxFileSize, setMaxFileSize] = useState(50) // TODO: wire when API supports this
  const [registrationKey, setRegistrationKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [connectionTest, setConnectionTest] = useState<ConnectionTestState>('idle')
  const paperSize = useSettings((s) => s.paperSize)
  const setPaperSize = useSettings((s) => s.setPaperSize)
  const copies = useSettings((s) => s.copies)
  const setCopies = useSettings((s) => s.setCopies)

  // Save state
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Convert poll/health intervals: store uses ms, UI uses seconds ──
  const pollIntervalSec = Math.round(pollIntervalMs / 1000)
  const healthIntervalSec = Math.round(healthIntervalMs / 1000)

  // ── Mount: discover printers ──────────────────────────────────
  useEffect(() => {
    discover()
  }, [discover])

  // ── Cleanup save timer ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────

  function handleTogglePrinter(printer: PrinterInfoDTO): void {
    const isInPool = pool.includes(printer.name)
    if (!isInPool && pool.length >= 4) return

    const newPool = isInPool
      ? pool.filter((n) => n !== printer.name)
      : [...pool, printer.name]
    setPool(newPool)
  }

  function handleSetDefault(_printerName: string): void {
    // TODO: wire when API supports setting a default printer in the pool
    // For now this is a no-op since the API doesn't have a "set default" concept
  }

  function toggleFormat(ext: string): void {
    setEnabledFormats((prev) => {
      const next = new Set(prev)
      if (next.has(ext)) next.delete(ext)
      else next.add(ext)
      return next
    })
  }

  async function handleTestConnection(): Promise<void> {
    setConnectionTest('testing')
    try {
      await cloudCheckHealth()
      // After checkHealth, the cloud store's `connected` state is updated.
      // Re-read it to determine success/failure.
      const connected = useCloud.getState().connected
      setConnectionTest(connected ? 'success' : 'error')
    } catch {
      setConnectionTest('error')
    }
    setTimeout(() => setConnectionTest('idle'), 3000)
  }

  async function handleRegister(): Promise<void> {
    if (registrationKey.length < 12) return
    const result = await cloudRegister(registrationKey)
    if (!result.success) {
      console.error('Registration failed:', result.error)
    }
  }

  function handleSave(): void {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveState('saving')

    const doSave = async (): Promise<void> => {
      // Stop any running watchers first
      const watcherState = useWatcher.getState()
      console.log('[Settings] Current watcher state:', { running: watcherState.running, directory: watcherState.directory })

      if (watcherState.running) {
        console.log('[Settings] Stopping existing watcher...')
        await watcherState.stop()
      }

      const cloudState = useCloud.getState()
      if (cloudState.polling) {
        console.log('[Settings] Stopping existing cloud polling...')
        await cloudState.stop()
      }

      // Start the appropriate service based on mode
      if (mode === 'local' && localDirectory) {
        console.log('[Settings] Starting local watcher for:', localDirectory)
        await useWatcher.getState().start(localDirectory)
        const newState = useWatcher.getState()
        console.log('[Settings] Watcher started:', { running: newState.running, directory: newState.directory })
      } else if (mode === 'cloud' && cloudState.registered) {
        console.log('[Settings] Starting cloud polling...')
        await useCloud.getState().start()
      } else {
        console.log('[Settings] Nothing to start:', { mode, localDirectory, cloudRegistered: cloudState.registered })
      }

      // Start printer health monitor
      await usePrinter.getState().startMonitor()
    }

    doSave()
      .then(() => {
        setSaveState('saved')
        saveTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
      })
      .catch((err) => {
        console.error('[Settings] Save failed:', err)
        setSaveState('idle')
      })
  }

  function handleReset(): void {
    setMode('local')
    setLocalDirectory('')
    setCloudApiUrl('')
    setPollIntervalMs(5000)
    setHealthIntervalMs(30000)
    setLogLevel('info')
    setEnabledFormats(new Set(FILE_FORMATS.filter((f) => f.enabled).map((f) => f.ext)))
    setMaxFileSize(50)
    setRegistrationKey('')
    setPaperSize('')
    setSaveState('idle')
    setConnectionTest('idle')
  }

  const selectedPoolCount = pool.length

  // Query real media sizes from the first pool printer's driver
  const [driverPaperSizes, setDriverPaperSizes] = useState<{ value: string; label: string }[]>(PAPER_SIZES)
  const [paperSizeSource, setPaperSizeSource] = useState<string | null>(null)

  useEffect(() => {
    if (pool.length === 0) {
      setDriverPaperSizes(PAPER_SIZES)
      setPaperSizeSource(null)
      return
    }
    const firstPoolPrinter = printers.find((p) => pool.includes(p.name))
    if (!firstPoolPrinter) return

    setPaperSizeSource(firstPoolPrinter.displayName)
    window.api.printer.mediaSizes(firstPoolPrinter.name)
      .then((sizes) => {
        if (sizes.length > 0) {
          setDriverPaperSizes(sizes.map((s) => ({ value: s.name, label: s.name })))
        } else {
          setDriverPaperSizes(PAPER_SIZES)
        }
      })
      .catch(() => setDriverPaperSizes(PAPER_SIZES))
  }, [pool, printers])

  const availablePaperSizes = driverPaperSizes

  // Auto-select first paper size when store value is empty or not in the list
  const effectivePaperSize = availablePaperSizes.some((s) => s.value === paperSize)
    ? paperSize
    : availablePaperSizes[0]?.value || ''
  useEffect(() => {
    if (!paperSize || !availablePaperSizes.some((s) => s.value === paperSize)) {
      if (availablePaperSizes.length > 0) {
        setPaperSize(availablePaperSizes[0].value)
      }
    }
  }, [paperSize, availablePaperSizes, setPaperSize])

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[56rem] px-8 py-10">
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

              {/* Mode selector — visually rich cards */}
              <div className="grid grid-cols-2 gap-5">
                {/* Local card */}
                <button
                  type="button"
                  onClick={() => setMode('local')}
                  className={cn(
                    'group relative flex flex-col gap-5 rounded-2xl p-6 text-left',
                    'transition-all duration-300 ease-out hover:scale-[1.01]',
                    mode === 'local'
                      ? 'bg-card shadow-md shadow-[#c57d3c]/10 ring-2 ring-[#c57d3c]/40'
                      : 'bg-card shadow-sm hover:shadow-md'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300',
                        mode === 'local'
                          ? 'bg-[#c57d3c] text-white'
                          : 'bg-secondary text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      <HardDrive className="h-5 w-5" />
                    </div>
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300',
                        mode === 'local'
                          ? 'border-[#c57d3c] bg-[#c57d3c]'
                          : 'border-border bg-transparent'
                      )}
                    >
                      {mode === 'local' && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">Local Folder</p>
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
                    'group relative flex flex-col gap-5 rounded-2xl p-6 text-left',
                    'transition-all duration-300 ease-out hover:scale-[1.01]',
                    mode === 'cloud'
                      ? 'bg-card shadow-md shadow-[#c57d3c]/10 ring-2 ring-[#c57d3c]/40'
                      : 'bg-card shadow-sm hover:shadow-md'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300',
                        mode === 'cloud'
                          ? 'bg-[#c57d3c] text-white'
                          : 'bg-secondary text-muted-foreground group-hover:text-foreground'
                      )}
                    >
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300',
                        mode === 'cloud'
                          ? 'border-[#c57d3c] bg-[#c57d3c]'
                          : 'border-border bg-transparent'
                      )}
                    >
                      {mode === 'cloud' && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-foreground">Cloud Service</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      Receive photos from a remote API. Ideal for multi-location or remote workflows.
                    </p>
                  </div>
                </button>
              </div>

              {/* ── Local mode config ── */}
              {mode === 'local' && (
                <div className="mt-6 space-y-6 rounded-2xl bg-card p-8 shadow-sm">
                  {/* Watch directory */}
                  <div>
                    <FieldLabel htmlFor="watch-dir-b3">Watch Directory</FieldLabel>
                    <div className="flex gap-3">
                      <div className="flex flex-1 items-center rounded-xl border border-border bg-surface-sunken px-4">
                        <FolderOpen className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          id="watch-dir-b3"
                          type="text"
                          value={localDirectory}
                          onChange={(e) => setLocalDirectory(e.target.value)}
                          className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                          style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                          placeholder="/path/to/photos"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await window.api.openDirectory()
                          if (!result.canceled && result.path) {
                            setLocalDirectory(result.path)
                          }
                        }}
                        className="shrink-0 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground transition-all duration-300 hover:bg-secondary hover:shadow-sm hover:scale-[1.01]"
                      >
                        Browse
                      </button>
                    </div>
                    <FieldHint>
                      New images placed in this folder will be automatically queued for printing.
                    </FieldHint>
                  </div>

                  {/* File format pills */}
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
                              'rounded-full px-4 py-2 text-xs font-medium',
                              'transition-all duration-300 ease-out hover:scale-[1.01]',
                              active
                                ? 'bg-[#c57d3c]/15 text-[#c57d3c] ring-1 ring-[#c57d3c]/30'
                                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                            )}
                            style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                          >
                            .{f.ext.toLowerCase()}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Max file size */}
                  <div>
                    <FieldLabel htmlFor="max-file-size-b3">Maximum File Size</FieldLabel>
                    <NumberStepper
                      id="max-file-size-b3"
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
                <div className="mt-6 space-y-6 rounded-2xl bg-card p-8 shadow-sm">
                  {/* Registration key */}
                  <div>
                    <div className="flex items-center justify-between">
                      <FieldLabel>Registration Key</FieldLabel>
                      <div className="flex items-center gap-3">
                        {cloudRegistered && (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Registered
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-300 hover:text-foreground"
                          aria-label={showKey ? 'Hide key' : 'Reveal key'}
                        >
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {showKey ? 'Hide' : 'Reveal'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      <RegistrationKeyInput
                        value={registrationKey}
                        onChange={setRegistrationKey}
                        showKey={showKey}
                      />
                      {!cloudRegistered && (
                        <button
                          type="button"
                          onClick={handleRegister}
                          disabled={registrationKey.length < 12}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium',
                            'transition-all duration-300 hover:scale-[1.01]',
                            registrationKey.length < 12
                              ? 'cursor-not-allowed text-muted-foreground opacity-50'
                              : 'text-foreground hover:bg-secondary hover:shadow-sm'
                          )}
                        >
                          Register
                        </button>
                      )}
                    </div>
                    <FieldHint>
                      12-character key from your cloud administrator. Format: XXXX-XXXX-XXXX.
                    </FieldHint>
                  </div>

                  {/* API endpoint */}
                  <div>
                    <FieldLabel htmlFor="api-endpoint-b3">API Endpoint</FieldLabel>
                    <input
                      id="api-endpoint-b3"
                      type="url"
                      value={cloudApiUrl}
                      onChange={(e) => setCloudApiUrl(e.target.value)}
                      className={cn(
                        'h-10 w-full rounded-xl border border-border bg-surface-sunken px-4 text-sm text-foreground',
                        'outline-none transition-all duration-300',
                        'placeholder:text-muted-foreground/50',
                        'focus:border-[#c57d3c]/50 focus:ring-2 focus:ring-[#c57d3c]/15 focus:shadow-sm'
                      )}
                      style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                      placeholder="https://api.example.com/v2"
                    />
                  </div>

                  {/* Connection test */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={connectionTest === 'testing'}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium',
                        'transition-all duration-300 hover:scale-[1.01]',
                        connectionTest === 'testing'
                          ? 'cursor-not-allowed text-muted-foreground'
                          : 'text-foreground hover:bg-secondary hover:shadow-sm'
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
                        Authenticated successfully.
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
                SECTION 2: Printer Pool — grid of cards with hover scale
            ================================================================ */}
            <section>
              <SectionHeader
                icon={Printer}
                title="Printer Pool"
                description={`Select up to 4 printers for the active rotation. ${selectedPoolCount} of 4 slots used.`}
              />

              {printerLoading && printers.length === 0 && (
                <div className="flex items-center justify-center rounded-2xl bg-card p-10 shadow-sm">
                  <Loader2 className="mr-3 h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Discovering printers...</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {printers.map((printer) => {
                  const isInPool = pool.includes(printer.name)
                  const isDisabledToggle = !isInPool && pool.length >= 4
                  const displayStatus = mapPrinterStatus(printer.status)
                  // TODO: wire paper type and finish when API supports per-printer paper info
                  const paperLabel = printer.capabilities.paperSizes[0]
                    ? `${printer.capabilities.paperSizes[0].width}x${printer.capabilities.paperSizes[0].height}`
                    : 'N/A'
                  const paperFinish = printer.capabilities.paperTypes[0] ?? 'N/A' // TODO: wire when API supports this

                  return (
                    <div
                      key={printer.name}
                      className={cn(
                        'group relative rounded-2xl bg-card p-5',
                        'transition-all duration-300 ease-out hover:scale-[1.01]',
                        isInPool
                          ? 'shadow-md shadow-[#c57d3c]/8 ring-1 ring-[#c57d3c]/25'
                          : 'shadow-sm hover:shadow-md',
                        displayStatus === 'offline' && 'opacity-50'
                      )}
                    >
                      {/* Top row: checkbox + name + status */}
                      <div className="flex items-start gap-3.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePrinter(printer)}
                          disabled={isDisabledToggle}
                          className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
                            isInPool
                              ? 'border-[#c57d3c] bg-[#c57d3c]'
                              : isDisabledToggle
                                ? 'cursor-not-allowed border-border opacity-40'
                                : 'border-border hover:border-muted-foreground'
                          )}
                          aria-label={`${isInPool ? 'Remove' : 'Add'} ${printer.displayName} ${isDisabledToggle ? '(pool full)' : ''}`}
                        >
                          {isInPool && (
                            <Check className="h-3 w-3 text-white" strokeWidth={3} />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {printer.displayName}
                            </p>
                            {printer.isDefault && (
                              <span className="shrink-0 rounded-full bg-[#c57d3c]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#c57d3c]">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <StatusDot status={displayStatus} />
                            <span className="text-xs text-muted-foreground">
                              {paperLabel} {paperFinish}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Set default action */}
                      {isInPool && !printer.isDefault && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <button
                            type="button"
                            onClick={() => handleSetDefault(printer.name)}
                            className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground opacity-0 transition-all duration-300 hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                          >
                            Set as default
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Paper size */}
              <div className="mt-6 flex items-center justify-between rounded-2xl bg-card p-5 shadow-sm">
                <div>
                  <p className="text-sm font-medium text-foreground">Paper Size</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {paperSizeSource
                      ? `Sizes from ${paperSizeSource} driver`
                      : 'Select a printer above to load driver sizes'}
                  </p>
                </div>
                <Select
                  value={effectivePaperSize}
                  onChange={(v) => setPaperSize(v)}
                  options={availablePaperSizes}
                  className="w-40"
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
                  <div className="rounded-2xl bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
                    <div className="mb-4 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Poll Interval</span>
                    </div>
                    <NumberStepper
                      id="poll-interval-b3"
                      value={pollIntervalSec}
                      onChange={(sec) => setPollIntervalMs(sec * 1000)}
                      min={1}
                      max={60}
                      unit="sec"
                    />
                    <FieldHint>How often to check for new photos.</FieldHint>
                  </div>

                  <div className="rounded-2xl bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
                    <div className="mb-4 flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Health Check</span>
                    </div>
                    <NumberStepper
                      id="health-check-b3"
                      value={healthIntervalSec}
                      onChange={(sec) => setHealthIntervalMs(sec * 1000)}
                      min={5}
                      max={300}
                      unit="sec"
                    />
                    <FieldHint>Frequency of printer health pings.</FieldHint>
                  </div>
                </div>

                {/* Log level */}
                <div className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground">
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
                      { value: 'warning', label: 'Warning' },
                      { value: 'error', label: 'Error' },
                    ]}
                    className="w-28"
                  />
                </div>

                {/* Print copies */}
                <div className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <Copy className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Print Copies</p>
                      <p className="text-xs text-muted-foreground">
                        Number of copies per print job
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCopies(copies - 1)}
                      disabled={copies <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-30"
                    >
                      −
                    </button>
                    <span
                      className="w-8 text-center text-sm font-semibold text-foreground tabular-nums"
                      style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                    >
                      {copies}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCopies(copies + 1)}
                      disabled={copies >= 10}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Appearance — theme toggle */}
                <div className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300',
                        theme === 'dark'
                          ? 'bg-[#c57d3c]/10 text-[#c57d3c]'
                          : 'bg-[#a0612e]/10 text-[#a0612e]'
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
                    <Sun className={cn('h-4 w-4 transition-colors duration-300', theme === 'light' ? 'text-[#a0612e]' : 'text-muted-foreground')} />
                    <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
                    <Moon className={cn('h-4 w-4 transition-colors duration-300', theme === 'dark' ? 'text-[#c57d3c]' : 'text-muted-foreground')} />
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom spacer for sticky bar */}
            <div className="h-4" aria-hidden />
          </div>
        </div>
      </div>

      {/* ── Sticky action bar — frosted glass ────────────────── */}
      <div className="shrink-0 border-t border-border/60 bg-background/70 px-8 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[56rem] items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Changes are saved locally to this machine.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-foreground hover:scale-[1.01]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saveState !== 'idle'}
              className={cn(
                'relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full px-6 text-sm font-semibold',
                'transition-all duration-300 ease-out hover:scale-[1.01]',
                saveState === 'saved'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-[#c57d3c] text-white shadow-lg shadow-[#c57d3c]/20 hover:brightness-110',
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
