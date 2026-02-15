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
  Loader2,
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
// Industrial styles
// ---------------------------------------------------------------------------

const metalPanel = cn(
  'rounded-lg',
  'bg-gradient-to-b from-[#2d3238] to-[#22262b]',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.3)]',
  'border border-[#3a3f46]/40',
)

const insetPanel = cn(
  'rounded-lg',
  'bg-[#1a1d21]',
  'shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),inset_0_-1px_0_rgba(255,255,255,0.02)]',
  'border border-[#15171b]',
)

const brassText = 'text-[#cd853f]'
const metalText = 'text-[#c8ccd2]'
const dimText = 'text-[#6b7280]'
const ledGreen = 'text-[#4ade80]'
const ledAmber = 'text-[#f59e0b]'
const ledRed = 'text-[#ef4444]'

const monoFont = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' }
const headerFont = { fontFamily: '"Inter", system-ui, sans-serif' }

// ---------------------------------------------------------------------------
// Rivet decoration
// ---------------------------------------------------------------------------

function Rivet({ className }: { className?: string }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-block h-[5px] w-[5px] rounded-full',
        'bg-gradient-to-br from-[#4a4f56] to-[#2a2e33]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.4)]',
        className,
      )}
      aria-hidden
    />
  )
}

function PanelRivets(): React.JSX.Element {
  return (
    <>
      <Rivet className="absolute top-2 left-2" />
      <Rivet className="absolute top-2 right-2" />
      <Rivet className="absolute bottom-2 left-2" />
      <Rivet className="absolute bottom-2 right-2" />
    </>
  )
}

// ---------------------------------------------------------------------------
// Section header - stencil-style
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
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded',
            'bg-gradient-to-br from-[#cd853f] to-[#8b5e2b]',
            'shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]',
          )}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <h2
          className={cn('text-xs font-bold uppercase tracking-[0.15em]', metalText)}
          style={headerFont}
        >
          {title}
        </h2>
      </div>
      <p className={cn('mt-2 pl-11 text-xs leading-relaxed', dimText)}>
        {description}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field label / hint
// ---------------------------------------------------------------------------

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode
  htmlFor?: string
}): React.JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('mb-2 block text-[10px] font-bold uppercase tracking-[0.1em]', metalText)}
      style={headerFont}
    >
      {children}
    </label>
  )
}

function FieldHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className={cn('mt-2 text-[10px] leading-relaxed', dimText)}>{children}</p>
}

// ---------------------------------------------------------------------------
// Industrial rocker toggle switch
// ---------------------------------------------------------------------------

function RockerSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-14 shrink-0 items-center rounded',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cd853f]/50',
        checked
          ? 'bg-gradient-to-b from-[#cd853f] to-[#b87333] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.3)]'
          : 'bg-[#1a1d21] shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),inset_0_-1px_0_rgba(255,255,255,0.02)] border border-[#15171b]',
      )}
    >
      {/* Track labels */}
      <span
        className={cn(
          'absolute left-2 text-[8px] font-bold uppercase tracking-wider',
          checked ? 'text-white/70' : 'text-transparent',
        )}
      >
        ON
      </span>
      <span
        className={cn(
          'absolute right-1.5 text-[8px] font-bold uppercase tracking-wider',
          checked ? 'text-transparent' : 'text-[#4b5563]',
        )}
      >
        OFF
      </span>
      {/* Knob */}
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-sm',
          'transition-transform duration-200',
          'shadow-[0_2px_4px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]',
          checked
            ? 'translate-x-[33px] bg-gradient-to-b from-[#e8d5b8] to-[#c8b090]'
            : 'translate-x-[3px] bg-gradient-to-b from-[#4a4f56] to-[#3a3f46]',
        )}
      >
        {/* Grip lines on knob */}
        <span className="absolute inset-x-1.5 top-[7px] flex flex-col gap-[2px]">
          <span className={cn('h-px rounded-full', checked ? 'bg-[#8b5e2b]/40' : 'bg-[#2a2e33]/60')} />
          <span className={cn('h-px rounded-full', checked ? 'bg-[#8b5e2b]/40' : 'bg-[#2a2e33]/60')} />
          <span className={cn('h-px rounded-full', checked ? 'bg-[#8b5e2b]/40' : 'bg-[#2a2e33]/60')} />
        </span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Industrial select
// ---------------------------------------------------------------------------

function MetalSelect({
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
          'h-9 w-full appearance-none rounded px-3 pr-8 text-xs',
          insetPanel,
          metalText,
          'outline-none transition-all duration-200',
          'focus:ring-1 focus:ring-[#cd853f]/30',
        )}
        style={monoFont}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className={cn('pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2', dimText)}
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Number stepper
// ---------------------------------------------------------------------------

function MetalStepper({
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
      <div className={cn('flex items-center overflow-hidden rounded', insetPanel)}>
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className={cn(
            'flex h-9 w-8 items-center justify-center text-sm font-bold',
            metalText,
            'transition hover:text-[#cd853f] disabled:opacity-30',
            'border-r border-[#15171b]',
          )}
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
          className={cn(
            'h-9 w-11 bg-transparent text-center text-xs outline-none',
            brassText,
          )}
          style={{
            ...monoFont,
            textShadow: '0 0 8px rgba(205,133,63,0.2)',
          }}
          aria-label={`Value in ${unit}`}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className={cn(
            'flex h-9 w-8 items-center justify-center text-sm font-bold',
            metalText,
            'transition hover:text-[#cd853f] disabled:opacity-30',
            'border-l border-[#15171b]',
          )}
          aria-label="Increase"
        >
          +
        </button>
      </div>
      <span className={cn('text-[10px] font-bold uppercase tracking-wider', dimText)}>
        {unit}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Registration key input - segmented
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
      if (cleaned.length === 4 && index < 2) refs[index + 1].current?.focus()
    },
    [segments, onChange, refs],
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && segments[index].length === 0 && index > 0) {
        refs[index - 1].current?.focus()
      }
    },
    [segments, refs],
  )

  return (
    <div className="flex items-center gap-2">
      {segments.map((seg, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && <span className={cn('text-sm select-none', dimText)}>&ndash;</span>}
          <input
            ref={refs[i]}
            type={showKey ? 'text' : 'password'}
            value={seg}
            onChange={(e) => handleSegmentChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            maxLength={4}
            placeholder="0000"
            className={cn(
              'h-10 w-[4.5rem] rounded text-center text-xs tracking-[0.2em]',
              insetPanel,
              brassText,
              'outline-none placeholder:text-[#3a3f46]',
              'transition-all duration-200',
              'focus:ring-1 focus:ring-[#cd853f]/40',
              !showKey && 'tracking-normal',
            )}
            style={{
              ...monoFont,
              textShadow: '0 0 8px rgba(205,133,63,0.15)',
            }}
            aria-label={`Registration key segment ${i + 1}`}
          />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LED status dot
// ---------------------------------------------------------------------------

function StatusLED({ status }: { status: PrinterStatus }): React.JSX.Element {
  const color = status === 'online' ? '#4ade80' : status === 'warning' ? '#f59e0b' : '#6b7280'
  const label = status === 'online' ? 'Online' : status === 'warning' ? 'Warning' : 'Offline'
  const colorClass = status === 'online' ? ledGreen : status === 'warning' ? ledAmber : dimText

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative">
        {status === 'online' && (
          <span
            className="absolute inset-0 rounded-full blur-[3px] opacity-40"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        )}
        <span
          className="relative block h-2 w-2 rounded-full"
          style={{
            background: `linear-gradient(to bottom, ${color}cc, ${color})`,
            boxShadow: status === 'online' ? `0 0 4px ${color}40` : undefined,
          }}
        />
      </span>
      <span className={cn('text-[10px] font-bold uppercase tracking-wider', colorClass)}>
        {label}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SettingsD(): React.JSX.Element {
  const { theme, toggle: toggleTheme } = useTheme()

  // Settings store
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

  // Printer store
  const printers = usePrinter((s) => s.printers)
  const printerLoading = usePrinter((s) => s.loading)
  const discover = usePrinter((s) => s.discover)
  const syncPoolToMain = usePrinter((s) => s.setPool)

  // Printer pool
  const pool = useSettings((s) => s.printerPool)
  const setPool = useCallback(
    (newPool: string[]) => {
      useSettings.getState().setPrinterPool(newPool)
      syncPoolToMain(newPool)
    },
    [syncPoolToMain],
  )

  // Cloud store
  const cloudRegistered = useCloud((s) => s.registered)
  const cloudRegister = useCloud((s) => s.register)
  const cloudCheckHealth = useCloud((s) => s.checkHealth)

  // Local UI state
  const [enabledFormats, setEnabledFormats] = useState<Set<string>>(
    new Set(FILE_FORMATS.filter((f) => f.enabled).map((f) => f.ext)),
  )
  const [maxFileSize, setMaxFileSize] = useState(50)
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

  const pollIntervalSec = Math.round(pollIntervalMs / 1000)
  const healthIntervalSec = Math.round(healthIntervalMs / 1000)

  // Discover printers on mount
  useEffect(() => { discover() }, [discover])

  // Cleanup
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  // Handlers
  function handleTogglePrinter(printer: PrinterInfoDTO): void {
    const isInPool = pool.includes(printer.name)
    if (!isInPool && pool.length >= 4) return
    const newPool = isInPool
      ? pool.filter((n) => n !== printer.name)
      : [...pool, printer.name]
    setPool(newPool)
  }

  function handleSetDefault(_printerName: string): void {
    // TODO: wire when API supports
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
    if (!result.success) console.error('Registration failed:', result.error)
  }

  function handleSave(): void {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveState('saving')

    const doSave = async (): Promise<void> => {
      const watcherState = useWatcher.getState()
      if (watcherState.running) await watcherState.stop()

      const cloudState = useCloud.getState()
      if (cloudState.polling) await cloudState.stop()

      if (mode === 'local' && localDirectory) {
        await useWatcher.getState().start(localDirectory)
      } else if (mode === 'cloud' && cloudState.registered) {
        await useCloud.getState().start()
      }

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

  // Paper sizes from driver
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
  const effectivePaperSize = availablePaperSizes.some((s) => s.value === paperSize)
    ? paperSize
    : availablePaperSizes[0]?.value || ''

  useEffect(() => {
    if (!paperSize || !availablePaperSizes.some((s) => s.value === paperSize)) {
      if (availablePaperSizes.length > 0) setPaperSize(availablePaperSizes[0].value)
    }
  }, [paperSize, availablePaperSizes, setPaperSize])

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="flex h-full flex-col" style={headerFont}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[54rem] px-6 py-8">
          <div className="space-y-12">

            {/* ==============================================================
                SECTION 1: Photo Source
            ============================================================== */}
            <section>
              <SectionHeader
                icon={HardDrive}
                title="PHOTO SOURCE"
                description="Choose how Smart Print discovers new photos. Local watches a folder; Cloud connects to a remote API."
              />

              {/* Mode selector cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Local */}
                <button
                  type="button"
                  onClick={() => setMode('local')}
                  className={cn(
                    'group relative flex flex-col gap-4 rounded-lg p-5 text-left',
                    'transition-all duration-200',
                    mode === 'local'
                      ? [
                          metalPanel,
                          'ring-2 ring-[#cd853f]/50',
                          'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_2px_12px_rgba(184,115,51,0.15)]',
                        ]
                      : [metalPanel, 'hover:border-[#3a3f46]'],
                  )}
                >
                  <PanelRivets />
                  <div className="flex items-start justify-between relative">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded',
                        'transition-all duration-200',
                        mode === 'local'
                          ? 'bg-gradient-to-br from-[#cd853f] to-[#8b5e2b] text-white shadow-[0_2px_6px_rgba(184,115,51,0.3)]'
                          : 'bg-[#1a1d21] text-[#6b7280] group-hover:text-[#c8ccd2]',
                      )}
                    >
                      <HardDrive className="h-4.5 w-4.5" />
                    </div>
                    {/* Indicator LED */}
                    <div className="relative">
                      {mode === 'local' && (
                        <span className="absolute inset-0 rounded-full bg-[#4ade80] blur-[3px] opacity-40" aria-hidden />
                      )}
                      <span
                        className={cn(
                          'relative block h-3 w-3 rounded-full',
                          mode === 'local'
                            ? 'bg-gradient-to-b from-[#86efac] to-[#22c55e]'
                            : 'bg-gradient-to-b from-[#4a4f56] to-[#3a3f46]',
                        )}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <p className={cn('text-sm font-bold', metalText)}>LOCAL FOLDER</p>
                    <p className={cn('mt-1 text-xs leading-relaxed', dimText)}>
                      Watch a directory for new images. Best for on-site printing.
                    </p>
                  </div>
                </button>

                {/* Cloud */}
                <button
                  type="button"
                  onClick={() => setMode('cloud')}
                  className={cn(
                    'group relative flex flex-col gap-4 rounded-lg p-5 text-left',
                    'transition-all duration-200',
                    mode === 'cloud'
                      ? [
                          metalPanel,
                          'ring-2 ring-[#cd853f]/50',
                          'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_2px_12px_rgba(184,115,51,0.15)]',
                        ]
                      : [metalPanel, 'hover:border-[#3a3f46]'],
                  )}
                >
                  <PanelRivets />
                  <div className="flex items-start justify-between relative">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded',
                        'transition-all duration-200',
                        mode === 'cloud'
                          ? 'bg-gradient-to-br from-[#cd853f] to-[#8b5e2b] text-white shadow-[0_2px_6px_rgba(184,115,51,0.3)]'
                          : 'bg-[#1a1d21] text-[#6b7280] group-hover:text-[#c8ccd2]',
                      )}
                    >
                      <Cloud className="h-4.5 w-4.5" />
                    </div>
                    <div className="relative">
                      {mode === 'cloud' && (
                        <span className="absolute inset-0 rounded-full bg-[#4ade80] blur-[3px] opacity-40" aria-hidden />
                      )}
                      <span
                        className={cn(
                          'relative block h-3 w-3 rounded-full',
                          mode === 'cloud'
                            ? 'bg-gradient-to-b from-[#86efac] to-[#22c55e]'
                            : 'bg-gradient-to-b from-[#4a4f56] to-[#3a3f46]',
                        )}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <p className={cn('text-sm font-bold', metalText)}>CLOUD SERVICE</p>
                    <p className={cn('mt-1 text-xs leading-relaxed', dimText)}>
                      Receive photos from a remote API. Ideal for multi-location workflows.
                    </p>
                  </div>
                </button>
              </div>

              {/* Local mode config */}
              {mode === 'local' && (
                <div className={cn(metalPanel, 'relative mt-5 p-6 space-y-5')}>
                  <PanelRivets />

                  {/* Watch directory */}
                  <div className="relative">
                    <FieldLabel htmlFor="watch-dir-d">WATCH DIRECTORY</FieldLabel>
                    <div className="flex gap-2">
                      <div className={cn('flex flex-1 items-center rounded px-3', insetPanel)}>
                        <FolderOpen className={cn('mr-2 h-3.5 w-3.5 shrink-0', dimText)} />
                        <input
                          id="watch-dir-d"
                          type="text"
                          value={localDirectory}
                          onChange={(e) => setLocalDirectory(e.target.value)}
                          className={cn('h-9 w-full bg-transparent text-xs outline-none', metalText)}
                          style={monoFont}
                          placeholder="/path/to/photos"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await window.api.openDirectory()
                          if (!result.canceled && result.path) setLocalDirectory(result.path)
                        }}
                        className={cn(
                          'shrink-0 rounded px-4 text-xs font-bold uppercase tracking-wider',
                          metalPanel,
                          metalText,
                          'transition hover:text-[#cd853f]',
                        )}
                      >
                        BROWSE
                      </button>
                    </div>
                    <FieldHint>New images in this folder are automatically queued for printing.</FieldHint>
                  </div>

                  {/* File formats */}
                  <div className="relative">
                    <FieldLabel>FILE FORMATS</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {FILE_FORMATS.map((f) => {
                        const active = enabledFormats.has(f.ext)
                        return (
                          <button
                            key={f.ext}
                            type="button"
                            onClick={() => toggleFormat(f.ext)}
                            className={cn(
                              'rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider',
                              'transition-all duration-200',
                              active
                                ? [
                                    'bg-gradient-to-b from-[#cd853f] to-[#b87333]',
                                    'text-white',
                                    'shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]',
                                  ]
                                : [insetPanel, dimText, 'hover:text-[#c8ccd2]'],
                            )}
                            style={monoFont}
                          >
                            .{f.ext.toLowerCase()}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Max file size */}
                  <div className="relative">
                    <FieldLabel htmlFor="max-file-d">MAX FILE SIZE</FieldLabel>
                    <MetalStepper
                      id="max-file-d"
                      value={maxFileSize}
                      onChange={setMaxFileSize}
                      min={1}
                      max={200}
                      unit="MB"
                    />
                    <FieldHint>Files exceeding this size will be skipped.</FieldHint>
                  </div>
                </div>
              )}

              {/* Cloud mode config */}
              {mode === 'cloud' && (
                <div className={cn(metalPanel, 'relative mt-5 p-6 space-y-5')}>
                  <PanelRivets />

                  {/* Registration key */}
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <FieldLabel>REGISTRATION KEY</FieldLabel>
                      <div className="flex items-center gap-3">
                        {cloudRegistered && (
                          <span className={cn('flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider', ledGreen)}>
                            <CheckCircle2 className="h-3 w-3" />
                            REGISTERED
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider', dimText, 'hover:text-[#c8ccd2] transition')}
                        >
                          {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {showKey ? 'HIDE' : 'SHOW'}
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
                            'rounded px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider',
                            metalPanel,
                            registrationKey.length < 12
                              ? cn('cursor-not-allowed', dimText, 'opacity-50')
                              : cn(metalText, 'hover:text-[#cd853f]'),
                            'transition',
                          )}
                        >
                          REGISTER
                        </button>
                      )}
                    </div>
                    <FieldHint>12-character key from your administrator. Format: XXXX-XXXX-XXXX.</FieldHint>
                  </div>

                  {/* API endpoint */}
                  <div className="relative">
                    <FieldLabel htmlFor="api-d">API ENDPOINT</FieldLabel>
                    <input
                      id="api-d"
                      type="url"
                      value={cloudApiUrl}
                      onChange={(e) => setCloudApiUrl(e.target.value)}
                      className={cn(
                        'h-9 w-full rounded px-3 text-xs',
                        insetPanel,
                        metalText,
                        'outline-none placeholder:text-[#3a3f46]',
                        'transition-all duration-200',
                        'focus:ring-1 focus:ring-[#cd853f]/30',
                      )}
                      style={monoFont}
                      placeholder="https://api.example.com/v2"
                    />
                  </div>

                  {/* Connection test */}
                  <div className="flex items-center gap-4 relative">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={connectionTest === 'testing'}
                      className={cn(
                        'inline-flex items-center gap-2 rounded px-4 py-2 text-[10px] font-bold uppercase tracking-wider',
                        metalPanel,
                        connectionTest === 'testing'
                          ? cn('cursor-not-allowed', dimText)
                          : cn(metalText, 'hover:text-[#cd853f]'),
                        'transition',
                      )}
                    >
                      {connectionTest === 'testing' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : connectionTest === 'success' ? (
                        <Wifi className={cn('h-3.5 w-3.5', ledGreen)} />
                      ) : connectionTest === 'error' ? (
                        <WifiOff className={cn('h-3.5 w-3.5', ledRed)} />
                      ) : (
                        <Wifi className="h-3.5 w-3.5" />
                      )}
                      {connectionTest === 'testing'
                        ? 'TESTING...'
                        : connectionTest === 'success'
                          ? 'CONNECTED'
                          : connectionTest === 'error'
                            ? 'FAILED'
                            : 'TEST CONNECTION'}
                    </button>
                    {connectionTest === 'success' && (
                      <span className={cn('flex items-center gap-1 text-[10px] font-bold', ledGreen)}>
                        <CheckCircle2 className="h-3 w-3" />
                        AUTHENTICATED
                      </span>
                    )}
                    {connectionTest === 'error' && (
                      <span className={cn('flex items-center gap-1 text-[10px] font-bold', ledRed)}>
                        <AlertTriangle className="h-3 w-3" />
                        UNREACHABLE
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ==============================================================
                SECTION 2: Printer Pool
            ============================================================== */}
            <section>
              <SectionHeader
                icon={Printer}
                title="PRINTER POOL"
                description={`Select up to 4 printers for active rotation. ${selectedPoolCount} of 4 slots used.`}
              />

              {printerLoading && printers.length === 0 && (
                <div className={cn(metalPanel, 'flex items-center justify-center p-10')}>
                  <Loader2 className={cn('mr-3 h-5 w-5 animate-spin', dimText)} />
                  <span className={cn('text-xs font-bold uppercase tracking-wider', dimText)}>
                    DISCOVERING PRINTERS...
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {printers.map((printer) => {
                  const isInPool = pool.includes(printer.name)
                  const isDisabledToggle = !isInPool && pool.length >= 4
                  const displayStatus = mapPrinterStatus(printer.status)
                  const paperLabel = printer.capabilities.paperSizes[0]
                    ? `${printer.capabilities.paperSizes[0].width}x${printer.capabilities.paperSizes[0].height}`
                    : 'N/A'

                  return (
                    <div
                      key={printer.name}
                      className={cn(
                        metalPanel,
                        'group relative p-4',
                        'transition-all duration-200',
                        isInPool && 'ring-1 ring-[#cd853f]/40 shadow-[0_2px_12px_rgba(184,115,51,0.1)]',
                        displayStatus === 'offline' && 'opacity-50',
                      )}
                    >
                      <PanelRivets />
                      <div className="flex items-start gap-3 relative">
                        {/* Industrial checkbox */}
                        <button
                          type="button"
                          onClick={() => handleTogglePrinter(printer)}
                          disabled={isDisabledToggle}
                          className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded',
                            'transition-all duration-200',
                            isInPool
                              ? 'bg-gradient-to-b from-[#cd853f] to-[#b87333] shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]'
                              : isDisabledToggle
                                ? cn('cursor-not-allowed opacity-40', insetPanel)
                                : cn(insetPanel, 'hover:ring-1 hover:ring-[#cd853f]/30'),
                          )}
                          aria-label={`${isInPool ? 'Remove' : 'Add'} ${printer.displayName}`}
                        >
                          {isInPool && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn('truncate text-xs font-bold', metalText)}>
                              {printer.displayName}
                            </p>
                            {printer.isDefault && (
                              <span className={cn(
                                'shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider',
                                'bg-[#cd853f]/15', brassText,
                              )}>
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <StatusLED status={displayStatus} />
                            <span className={cn('text-[10px]', dimText)} style={monoFont}>
                              {paperLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Set default */}
                      {isInPool && !printer.isDefault && (
                        <div className="mt-3 pt-3 border-t border-[#3a3f46]/30 relative">
                          <button
                            type="button"
                            onClick={() => handleSetDefault(printer.name)}
                            className={cn(
                              'rounded px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider',
                              dimText,
                              'opacity-0 transition group-hover:opacity-100 hover:text-[#cd853f]',
                            )}
                          >
                            SET AS DEFAULT
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Paper size selector */}
              <div className={cn(metalPanel, 'relative mt-4 flex items-center justify-between p-4')}>
                <PanelRivets />
                <div className="relative">
                  <p className={cn('text-xs font-bold', metalText)}>PAPER SIZE</p>
                  <p className={cn('mt-0.5 text-[10px]', dimText)}>
                    {paperSizeSource
                      ? `Sizes from ${paperSizeSource} driver`
                      : 'Select a printer to load driver sizes'}
                  </p>
                </div>
                <MetalSelect
                  value={effectivePaperSize}
                  onChange={(v) => setPaperSize(v)}
                  options={availablePaperSizes}
                  className="w-40"
                />
              </div>
            </section>

            {/* ==============================================================
                SECTION 3: General Preferences
            ============================================================== */}
            <section>
              <SectionHeader
                icon={Gauge}
                title="GENERAL"
                description="Fine-tune performance, logging, and appearance."
              />

              <div className="space-y-4">
                {/* Timing row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={cn(metalPanel, 'relative p-5')}>
                    <PanelRivets />
                    <div className="mb-3 flex items-center gap-2 relative">
                      <Clock className={cn('h-3.5 w-3.5', brassText)} />
                      <span className={cn('text-[10px] font-bold uppercase tracking-[0.12em]', metalText)}>
                        POLL INTERVAL
                      </span>
                    </div>
                    <MetalStepper
                      id="poll-d"
                      value={pollIntervalSec}
                      onChange={(sec) => setPollIntervalMs(sec * 1000)}
                      min={1}
                      max={60}
                      unit="SEC"
                    />
                    <FieldHint>How often to check for new photos.</FieldHint>
                  </div>

                  <div className={cn(metalPanel, 'relative p-5')}>
                    <PanelRivets />
                    <div className="mb-3 flex items-center gap-2 relative">
                      <RefreshCw className={cn('h-3.5 w-3.5', brassText)} />
                      <span className={cn('text-[10px] font-bold uppercase tracking-[0.12em]', metalText)}>
                        HEALTH CHECK
                      </span>
                    </div>
                    <MetalStepper
                      id="health-d"
                      value={healthIntervalSec}
                      onChange={(sec) => setHealthIntervalMs(sec * 1000)}
                      min={5}
                      max={300}
                      unit="SEC"
                    />
                    <FieldHint>Frequency of printer health pings.</FieldHint>
                  </div>
                </div>

                {/* Log level */}
                <div className={cn(metalPanel, 'relative flex items-center justify-between p-4')}>
                  <PanelRivets />
                  <div className="flex items-center gap-3 relative">
                    <FileText className={cn('h-3.5 w-3.5', brassText)} />
                    <div>
                      <p className={cn('text-xs font-bold', metalText)}>LOG LEVEL</p>
                      <p className={cn('text-[10px]', dimText)}>Controls log verbosity</p>
                    </div>
                  </div>
                  <MetalSelect
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
                <div className={cn(metalPanel, 'relative flex items-center justify-between p-4')}>
                  <PanelRivets />
                  <div className="flex items-center gap-3 relative">
                    <Copy className={cn('h-3.5 w-3.5', brassText)} />
                    <div>
                      <p className={cn('text-xs font-bold', metalText)}>PRINT COPIES</p>
                      <p className={cn('text-[10px]', dimText)}>Copies per print job</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCopies(copies - 1)}
                      disabled={copies <= 1}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded text-sm font-bold',
                        insetPanel,
                        metalText,
                        'transition hover:text-[#cd853f] disabled:opacity-30',
                      )}
                    >
                      -
                    </button>
                    <span
                      className={cn('w-7 text-center text-sm font-bold tabular-nums', brassText)}
                      style={{
                        ...monoFont,
                        textShadow: '0 0 8px rgba(205,133,63,0.2)',
                      }}
                    >
                      {copies}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCopies(copies + 1)}
                      disabled={copies >= 10}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded text-sm font-bold',
                        insetPanel,
                        metalText,
                        'transition hover:text-[#cd853f] disabled:opacity-30',
                      )}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Appearance - industrial rocker switch */}
                <div className={cn(metalPanel, 'relative flex items-center justify-between p-4')}>
                  <PanelRivets />
                  <div className="flex items-center gap-3 relative">
                    {theme === 'dark' ? (
                      <Moon className={cn('h-3.5 w-3.5', brassText)} />
                    ) : (
                      <Sun className={cn('h-3.5 w-3.5', brassText)} />
                    )}
                    <div>
                      <p className={cn('text-xs font-bold', metalText)}>APPEARANCE</p>
                      <p className={cn('text-[10px]', dimText)}>
                        {theme === 'dark' ? 'Dark mode active' : 'Light mode active'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Sun className={cn('h-3.5 w-3.5', theme === 'light' ? brassText : dimText)} />
                    <RockerSwitch checked={theme === 'dark'} onChange={toggleTheme} />
                    <Moon className={cn('h-3.5 w-3.5', theme === 'dark' ? brassText : dimText)} />
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom spacer */}
            <div className="h-4" aria-hidden />
          </div>
        </div>
      </div>

      {/* ---- Sticky action bar - riveted metal strip ---- */}
      <div
        className={cn(
          'shrink-0 px-6 py-4',
          'bg-gradient-to-b from-[#2d3238] to-[#22262b]',
          'border-t border-[#3a3f46]/60',
          'shadow-[0_-2px_8px_rgba(0,0,0,0.3)]',
        )}
      >
        <div className="mx-auto flex max-w-[54rem] items-center justify-between">
          <div className="flex items-center gap-2">
            <Rivet />
            <p className={cn('text-[10px] uppercase tracking-wider', dimText)}>
              Changes saved locally to this machine
            </p>
            <Rivet />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className={cn(
                'inline-flex items-center gap-2 rounded px-4 py-2 text-[10px] font-bold uppercase tracking-wider',
                metalPanel,
                dimText,
                'transition hover:text-[#c8ccd2]',
              )}
            >
              <RotateCcw className="h-3 w-3" />
              RESET
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saveState !== 'idle'}
              className={cn(
                'relative inline-flex h-9 items-center gap-2 overflow-hidden rounded px-5 text-[10px] font-bold uppercase tracking-wider',
                'transition-all duration-200',
                saveState === 'saved'
                  ? 'bg-gradient-to-b from-[#4ade80] to-[#22c55e] text-white shadow-[0_2px_8px_rgba(74,222,128,0.3)]'
                  : 'bg-gradient-to-b from-[#cd853f] to-[#b87333] text-white shadow-[0_2px_8px_rgba(184,115,51,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]',
                saveState === 'saving' && 'cursor-not-allowed',
                saveState === 'idle' && 'hover:brightness-110 hover:shadow-[0_4px_12px_rgba(184,115,51,0.4)]',
              )}
            >
              {saveState === 'idle' && (
                <><Save className="h-3 w-3" /> SAVE CHANGES</>
              )}
              {saveState === 'saving' && (
                <><Loader2 className="h-3 w-3 animate-spin" /> SAVING...</>
              )}
              {saveState === 'saved' && (
                <><CheckCircle2 className="h-3 w-3" /> SAVED</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
