import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/stores/theme'
import { useSettings } from '@/stores/settings'
import { usePrinter } from '@/stores/printer'
import type { PrinterInfoDTO } from '@/stores/printer'
import { useCloud } from '@/stores/cloud'
import { useWatcher } from '@/stores/watcher'
import { usePressTheme, usePressThemeStore } from '@/stores/pressTheme'
import {
  PRESS_THEME_NAMES,
  PRESS_THEME_LABELS,
  PRESS_THEME_SWATCHES,
} from '@/themes/press-themes'
import type { PressThemeColors } from '@/themes/press-themes'
import {
  FolderOpen,
  Cloud,
  HardDrive,
  Printer,
  CheckCircle2,
  RefreshCw,
  Save,
  Check,
  RotateCcw,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
  FileText,
  Gauge,
  Loader2,
  Copy,
  Palette,
  Fingerprint,
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
] as const

const PAPER_SIZES: { value: PaperSize; label: string }[] = [
  { value: '4x6', label: '4 x 6"' },
  { value: '5x7', label: '5 x 7"' },
  { value: '6x8', label: '6 x 8"' },
  { value: '8x10', label: '8 x 10"' },
]

// ---------------------------------------------------------------------------
// Font constants
// ---------------------------------------------------------------------------

const monoFont = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' }
const headerFont = { fontFamily: '"Inter", system-ui, sans-serif' }

// ---------------------------------------------------------------------------
// Style builders
// ---------------------------------------------------------------------------

function metalPanelStyle(c: PressThemeColors): React.CSSProperties {
  return {
    borderRadius: '0.5rem',
    background: `linear-gradient(to bottom, ${c.baseLight}, ${c.baseMid})`,
    boxShadow: `inset 0 1px 0 ${c.highlightColor}0.04), 0 2px 8px ${c.shadowColor}0.3)`,
    border: `1px solid ${c.borderColor}`,
  }
}

function insetPanelStyle(c: PressThemeColors): React.CSSProperties {
  return {
    borderRadius: '0.5rem',
    backgroundColor: c.baseDark,
    boxShadow: `inset 0 2px 6px ${c.shadowColor}0.5), inset 0 -1px 0 ${c.highlightColor}0.02)`,
    border: `1px solid ${c.borderDark}`,
  }
}

// ---------------------------------------------------------------------------
// Rivet decoration
// ---------------------------------------------------------------------------

function Rivet({ className, colors }: { className?: string; colors: PressThemeColors }): React.JSX.Element {
  return (
    <span
      className={cn('inline-block h-[5px] w-[5px] rounded-full', className)}
      style={{
        background: `linear-gradient(to bottom right, ${colors.rivetLight}, ${colors.rivetDark})`,
        boxShadow: `inset 0 1px 0 ${colors.highlightColor}0.08), 0 1px 2px ${colors.shadowColor}0.4)`,
      }}
      aria-hidden
    />
  )
}

function PanelRivets({ colors }: { colors: PressThemeColors }): React.JSX.Element {
  return (
    <>
      <Rivet className="absolute top-2 left-2" colors={colors} />
      <Rivet className="absolute top-2 right-2" colors={colors} />
      <Rivet className="absolute bottom-2 left-2" colors={colors} />
      <Rivet className="absolute bottom-2 right-2" colors={colors} />
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
  colors,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  colors: PressThemeColors
}): React.JSX.Element {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded"
          style={{
            background: `linear-gradient(to bottom right, ${colors.accent}, ${colors.accentDark})`,
            boxShadow: `0 2px 4px ${colors.shadowColor}0.3), inset 0 1px 0 ${colors.highlightColor}0.15)`,
          }}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <h2
          className="text-xs font-bold uppercase tracking-[0.15em]"
          style={{ ...headerFont, color: colors.textPrimary }}
        >
          {title}
        </h2>
      </div>
      <p className="mt-2 pl-11 text-xs leading-relaxed" style={{ color: colors.textMuted }}>
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
  colors,
}: {
  children: React.ReactNode
  htmlFor?: string
  colors: PressThemeColors
}): React.JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em]"
      style={{ ...headerFont, color: colors.textPrimary }}
    >
      {children}
    </label>
  )
}

function FieldHint({ children, colors }: { children: React.ReactNode; colors: PressThemeColors }): React.JSX.Element {
  return <p className="mt-2 text-[10px] leading-relaxed" style={{ color: colors.textMuted }}>{children}</p>
}

// ---------------------------------------------------------------------------
// Industrial rocker toggle switch
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Industrial select
// ---------------------------------------------------------------------------

function MetalSelect({
  value,
  onChange,
  options,
  className,
  colors,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
  colors: PressThemeColors
}): React.JSX.Element {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded px-3 pr-8 text-xs outline-none transition-all duration-200"
        style={{
          ...insetPanelStyle(colors),
          ...monoFont,
          color: colors.textPrimary,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2"
        viewBox="0 0 12 12"
        fill="none"
        style={{ color: colors.textMuted }}
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
  colors,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  unit: string
  id?: string
  colors: PressThemeColors
}): React.JSX.Element {
  const clamp = (n: number): number => Math.min(max, Math.max(min, n))
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center overflow-hidden rounded" style={insetPanelStyle(colors)}>
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="flex h-9 w-8 items-center justify-center text-sm font-bold transition disabled:opacity-30"
          style={{ color: colors.textPrimary, borderRight: `1px solid ${colors.borderDark}` }}
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
          className="h-9 w-11 bg-transparent text-center text-xs outline-none"
          style={{
            ...monoFont,
            color: colors.accent,
            textShadow: `0 0 8px ${colors.accentGlow}0.2)`,
          }}
          aria-label={`Value in ${unit}`}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="flex h-9 w-8 items-center justify-center text-sm font-bold transition disabled:opacity-30"
          style={{ color: colors.textPrimary, borderLeft: `1px solid ${colors.borderDark}` }}
          aria-label="Increase"
        >
          +
        </button>
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: colors.textMuted }}
      >
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
  colors,
}: {
  value: string
  onChange: (v: string) => void
  colors: PressThemeColors
}): React.JSX.Element {
  const segments = [value.slice(0, 3), value.slice(3, 6), value.slice(6, 9), value.slice(9, 12)]
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleSegmentChange = useCallback(
    (index: number, raw: string) => {
      const cleaned = raw.replace(/\D/g, '').slice(0, 3)
      const newSegments = [...segments]
      newSegments[index] = cleaned
      onChange(newSegments.join(''))
      if (cleaned.length === 3 && index < 3) refs[index + 1].current?.focus()
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
          {i > 0 && <span className="text-sm select-none" style={{ color: colors.textMuted }}>&ndash;</span>}
          <input
            ref={refs[i]}
            type="text"
            inputMode="numeric"
            value={seg}
            onChange={(e) => handleSegmentChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            maxLength={3}
            placeholder="000"
            className="h-10 w-14 rounded text-center text-xs tracking-[0.2em] outline-none transition-all duration-200"
            style={{
              ...insetPanelStyle(colors),
              ...monoFont,
              color: colors.accent,
              textShadow: `0 0 8px ${colors.accentGlow}0.15)`,
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

function StatusLED({ status, colors }: { status: PrinterStatus; colors: PressThemeColors }): React.JSX.Element {
  const color = status === 'online' ? colors.ledGreen : status === 'warning' ? colors.ledAmber : colors.textMuted
  const label = status === 'online' ? 'Online' : status === 'warning' ? 'Warning' : 'Offline'

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
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Theme picker row for Settings
// ---------------------------------------------------------------------------

function ThemePickerRow({ colors }: { colors: PressThemeColors }): React.JSX.Element {
  const currentTheme = usePressThemeStore((s) => s.theme)
  const setTheme = usePressThemeStore((s) => s.setTheme)

  return (
    <div className="relative p-4 flex items-center justify-between" style={metalPanelStyle(colors)}>
      <PanelRivets colors={colors} />
      <div className="flex items-center gap-3 relative">
        <Palette className="h-3.5 w-3.5" style={{ color: colors.accent }} />
        <div>
          <p className="text-xs font-bold" style={{ color: colors.textPrimary }}>PRESS THEME</p>
          <p className="text-[10px]" style={{ color: colors.textMuted }}>
            {PRESS_THEME_LABELS[currentTheme]}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {PRESS_THEME_NAMES.map((name) => {
          const swatch = PRESS_THEME_SWATCHES[name]
          const isActive = currentTheme === name
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTheme(name)}
              title={PRESS_THEME_LABELS[name]}
              className="relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, ${swatch.base} 50%, ${swatch.accent} 50%)`,
                ...(isActive
                  ? {
                      outline: `2px solid ${colors.accent}`,
                      outlineOffset: '2px',
                    }
                  : {
                      outline: `1px solid ${colors.borderColor}`,
                      outlineOffset: '0px',
                    }),
              }}
              aria-label={`Switch to ${PRESS_THEME_LABELS[name]} theme`}
              aria-pressed={isActive}
            >
              {isActive && (
                <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" strokeWidth={3} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Device ID row
// ---------------------------------------------------------------------------

function DeviceIdRow({ colors }: { colors: PressThemeColors }): React.JSX.Element {
  const [deviceId, setDeviceId] = useState<string | null>(null)

  useEffect(() => {
    window.api.getDeviceId().then(setDeviceId).catch(() => setDeviceId('unavailable'))
  }, [])

  return (
    <div className="relative p-4 flex items-center justify-between" style={metalPanelStyle(colors)}>
      <PanelRivets colors={colors} />
      <div className="flex items-center gap-3 relative">
        <Fingerprint className="h-3.5 w-3.5" style={{ color: colors.accent }} />
        <div>
          <p className="text-xs font-bold" style={{ color: colors.textPrimary }}>DEVICE ID</p>
          <p className="text-[10px]" style={{ color: colors.textMuted }}>Hardware-bound identifier</p>
        </div>
      </div>
      <span
        className="text-[10px] select-all rounded px-2 py-1"
        style={{ ...monoFont, ...insetPanelStyle(colors), color: colors.textPrimary }}
      >
        {deviceId ?? '...'}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SettingsD(): React.JSX.Element {
  useTheme() // subscribe
  const c = usePressTheme()

  // Settings store
  const mode = useSettings((s) => s.mode)
  const setMode = useSettings((s) => s.setMode)
  const localDirectory = useSettings((s) => s.localDirectory)
  const setLocalDirectory = useSettings((s) => s.setLocalDirectory)
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
    setPollIntervalMs(60000)
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
  const [driverSizesLoaded, setDriverSizesLoaded] = useState(false)

  useEffect(() => {
    if (pool.length === 0) {
      setDriverPaperSizes(PAPER_SIZES)
      setPaperSizeSource(null)
      setDriverSizesLoaded(true)
      return
    }
    const firstPoolPrinter = printers.find((p) => pool.includes(p.name))
    if (!firstPoolPrinter) return

    setDriverSizesLoaded(false)
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
      .finally(() => setDriverSizesLoaded(true))
  }, [pool, printers])

  const availablePaperSizes = driverPaperSizes
  const effectivePaperSize = availablePaperSizes.some((s) => s.value === paperSize)
    ? paperSize
    : availablePaperSizes[0]?.value || ''

  // Only auto-select a paper size after driver sizes have loaded, to avoid
  // overwriting the persisted value with a fallback during the loading race
  useEffect(() => {
    if (!driverSizesLoaded) return
    if (!paperSize || !availablePaperSizes.some((s) => s.value === paperSize)) {
      if (availablePaperSizes.length > 0) setPaperSize(availablePaperSizes[0].value)
    }
  }, [paperSize, availablePaperSizes, setPaperSize, driverSizesLoaded])

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
                description="Choose how Smart Print discovers new photos."
                colors={c}
              />

              {/* Mode selector cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Local */}
                <button
                  type="button"
                  onClick={() => setMode('local')}
                  className="group relative flex flex-col gap-4 rounded-lg p-5 text-left transition-all duration-200"
                  style={{
                    ...metalPanelStyle(c),
                    ...(mode === 'local' ? {
                      outline: `2px solid ${c.accent}80`,
                      boxShadow: `inset 0 1px 0 ${c.highlightColor}0.04), 0 2px 12px ${c.accentGlow}0.15)`,
                    } : {}),
                  }}
                >
                  <PanelRivets colors={c} />
                  <div className="flex items-start justify-between relative">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded transition-all duration-200"
                      style={
                        mode === 'local'
                          ? {
                              background: `linear-gradient(to bottom right, ${c.accent}, ${c.accentDark})`,
                              color: '#ffffff',
                              boxShadow: `0 2px 6px ${c.accentGlow}0.3)`,
                            }
                          : {
                              backgroundColor: c.baseDark,
                              color: c.textMuted,
                            }
                      }
                    >
                      <HardDrive className="h-4.5 w-4.5" />
                    </div>
                    {/* Indicator LED */}
                    <div className="relative">
                      {mode === 'local' && (
                        <span className="absolute inset-0 rounded-full blur-[3px] opacity-40" style={{ backgroundColor: c.ledGreen }} aria-hidden />
                      )}
                      <span
                        className="relative block h-3 w-3 rounded-full"
                        style={{
                          background: mode === 'local'
                            ? `linear-gradient(to bottom, ${c.ledGreen}cc, ${c.ledGreen})`
                            : `linear-gradient(to bottom, ${c.knobOffFrom}, ${c.knobOffTo})`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <p className="text-sm font-bold" style={{ color: c.textPrimary }}>LOCAL PRINT</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: c.textMuted }}>
                      Watch a directory for new images. Best for FTP and Hardwired Printing.
                    </p>
                  </div>
                </button>

                {/* Cloud */}
                <button
                  type="button"
                  onClick={() => setMode('cloud')}
                  className="group relative flex flex-col gap-4 rounded-lg p-5 text-left transition-all duration-200"
                  style={{
                    ...metalPanelStyle(c),
                    ...(mode === 'cloud' ? {
                      outline: `2px solid ${c.accent}80`,
                      boxShadow: `inset 0 1px 0 ${c.highlightColor}0.04), 0 2px 12px ${c.accentGlow}0.15)`,
                    } : {}),
                  }}
                >
                  <PanelRivets colors={c} />
                  <div className="flex items-start justify-between relative">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded transition-all duration-200"
                      style={
                        mode === 'cloud'
                          ? {
                              background: `linear-gradient(to bottom right, ${c.accent}, ${c.accentDark})`,
                              color: '#ffffff',
                              boxShadow: `0 2px 6px ${c.accentGlow}0.3)`,
                            }
                          : {
                              backgroundColor: c.baseDark,
                              color: c.textMuted,
                            }
                      }
                    >
                      <Cloud className="h-4.5 w-4.5" />
                    </div>
                    <div className="relative">
                      {mode === 'cloud' && (
                        <span className="absolute inset-0 rounded-full blur-[3px] opacity-40" style={{ backgroundColor: c.ledGreen }} aria-hidden />
                      )}
                      <span
                        className="relative block h-3 w-3 rounded-full"
                        style={{
                          background: mode === 'cloud'
                            ? `linear-gradient(to bottom, ${c.ledGreen}cc, ${c.ledGreen})`
                            : `linear-gradient(to bottom, ${c.knobOffFrom}, ${c.knobOffTo})`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <p className="text-sm font-bold" style={{ color: c.textPrimary }}>CLOUD PRINT</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: c.textMuted }}>
                      Receive photos from the Cloud. Best for Microsite Submitted Photos.
                    </p>
                  </div>
                </button>
              </div>

              {/* Local mode config */}
              {mode === 'local' && (
                <div className="relative mt-5 p-6 space-y-5" style={metalPanelStyle(c)}>
                  <PanelRivets colors={c} />
                  <div className="relative">
                    <FieldLabel htmlFor="watch-dir-d" colors={c}>WATCH DIRECTORY</FieldLabel>
                    <div className="flex gap-2">
                      <div className="flex flex-1 items-center rounded px-3" style={insetPanelStyle(c)}>
                        <FolderOpen className="mr-2 h-3.5 w-3.5 shrink-0" style={{ color: c.textMuted }} />
                        <input
                          id="watch-dir-d"
                          type="text"
                          value={localDirectory}
                          onChange={(e) => setLocalDirectory(e.target.value)}
                          className="h-9 w-full bg-transparent text-xs outline-none"
                          style={{ ...monoFont, color: c.textPrimary }}
                          placeholder="/path/to/photos"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await window.api.openDirectory()
                          if (!result.canceled && result.path) setLocalDirectory(result.path)
                        }}
                        className="shrink-0 rounded px-4 text-xs font-bold uppercase tracking-wider transition"
                        style={{ ...metalPanelStyle(c), color: c.textPrimary }}
                      >
                        BROWSE
                      </button>
                    </div>
                    <FieldHint colors={c}>New images in this folder are automatically queued for printing.</FieldHint>
                  </div>
                  <div className="relative">
                    <FieldLabel colors={c}>FILE FORMATS</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {FILE_FORMATS.map((f) => {
                        const active = enabledFormats.has(f.ext)
                        return (
                          <button
                            key={f.ext}
                            type="button"
                            onClick={() => toggleFormat(f.ext)}
                            className="rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200"
                            style={
                              active
                                ? {
                                    background: `linear-gradient(to bottom, ${c.accent}, ${c.accentDark})`,
                                    color: '#ffffff',
                                    boxShadow: `0 2px 4px ${c.shadowColor}0.3), inset 0 1px 0 ${c.highlightColor}0.15)`,
                                    ...monoFont,
                                  }
                                : {
                                    ...insetPanelStyle(c),
                                    ...monoFont,
                                    color: c.textMuted,
                                  }
                            }
                          >
                            .{f.ext.toLowerCase()}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="relative">
                    <FieldLabel htmlFor="max-file-d" colors={c}>MAX FILE SIZE</FieldLabel>
                    <MetalStepper id="max-file-d" value={maxFileSize} onChange={setMaxFileSize} min={1} max={200} unit="MB" colors={c} />
                    <FieldHint colors={c}>Files exceeding this size will be skipped.</FieldHint>
                  </div>
                </div>
              )}

              {/* Cloud mode config */}
              {mode === 'cloud' && (
                <div className="relative mt-5 p-6 space-y-5" style={metalPanelStyle(c)}>
                  <PanelRivets colors={c} />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <FieldLabel colors={c}>REGISTRATION KEY</FieldLabel>
                      <div className="flex items-center gap-3">
                        {cloudRegistered && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: c.ledGreen }}>
                            <CheckCircle2 className="h-3 w-3" /> REGISTERED
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      <RegistrationKeyInput value={registrationKey} onChange={setRegistrationKey} colors={c} />
                      {!cloudRegistered && (
                        <button
                          type="button"
                          onClick={handleRegister}
                          disabled={registrationKey.length < 12}
                          className="rounded px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition"
                          style={{
                            ...metalPanelStyle(c),
                            color: registrationKey.length < 12 ? c.textMuted : c.textPrimary,
                            opacity: registrationKey.length < 12 ? 0.5 : 1,
                          }}
                        >
                          REGISTER
                        </button>
                      )}
                    </div>
                    <FieldHint colors={c}>12-digit code from your administrator. Format: 000-000-000-000.</FieldHint>
                  </div>
                  <div className="flex items-center gap-4 relative">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={connectionTest === 'testing'}
                      className="inline-flex items-center gap-2 rounded px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition"
                      style={{
                        ...metalPanelStyle(c),
                        color: connectionTest === 'testing' ? c.textMuted : c.textPrimary,
                      }}
                    >
                      {connectionTest === 'testing' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : connectionTest === 'success' ? (
                        <Wifi className="h-3.5 w-3.5" style={{ color: c.ledGreen }} />
                      ) : connectionTest === 'error' ? (
                        <WifiOff className="h-3.5 w-3.5" style={{ color: c.ledRed }} />
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
                      <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: c.ledGreen }}>
                        <CheckCircle2 className="h-3 w-3" /> AUTHENTICATED
                      </span>
                    )}
                    {connectionTest === 'error' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: c.ledRed }}>
                        <AlertTriangle className="h-3 w-3" /> UNREACHABLE
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
                colors={c}
              />

              {printerLoading && printers.length === 0 && (
                <div className="flex items-center justify-center p-10" style={metalPanelStyle(c)}>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" style={{ color: c.textMuted }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.textMuted }}>
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
                      className="group relative p-4 transition-all duration-200"
                      style={{
                        ...metalPanelStyle(c),
                        ...(isInPool ? {
                          outline: `1px solid ${c.accent}66`,
                          boxShadow: `0 2px 12px ${c.accentGlow}0.1)`,
                        } : {}),
                        opacity: displayStatus === 'offline' ? 0.5 : 1,
                      }}
                    >
                      <PanelRivets colors={c} />
                      <div className="flex items-start gap-3 relative">
                        <button
                          type="button"
                          onClick={() => handleTogglePrinter(printer)}
                          disabled={isDisabledToggle}
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-all duration-200"
                          style={
                            isInPool
                              ? {
                                  background: `linear-gradient(to bottom, ${c.accent}, ${c.accentDark})`,
                                  boxShadow: `0 2px 4px ${c.shadowColor}0.3), inset 0 1px 0 ${c.highlightColor}0.15)`,
                                }
                              : isDisabledToggle
                                ? { ...insetPanelStyle(c), opacity: 0.4, cursor: 'not-allowed' }
                                : insetPanelStyle(c)
                          }
                          aria-label={`${isInPool ? 'Remove' : 'Add'} ${printer.displayName}`}
                        >
                          {isInPool && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-xs font-bold" style={{ color: c.textPrimary }}>
                              {printer.displayName}
                            </p>
                            {printer.isDefault && (
                              <span
                                className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                                style={{
                                  backgroundColor: `${c.accent}26`,
                                  color: c.accent,
                                }}
                              >
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <StatusLED status={displayStatus} colors={c} />
                            <span className="text-[10px]" style={{ ...monoFont, color: c.textMuted }}>
                              {paperLabel}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isInPool && !printer.isDefault && (
                        <div className="mt-3 pt-3 relative" style={{ borderTop: `1px solid ${c.borderColor}` }}>
                          <button
                            type="button"
                            onClick={() => handleSetDefault(printer.name)}
                            className="rounded px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider opacity-0 transition group-hover:opacity-100"
                            style={{ color: c.textMuted }}
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
              <div className="relative mt-4 flex items-center justify-between p-4" style={metalPanelStyle(c)}>
                <PanelRivets colors={c} />
                <div className="relative">
                  <p className="text-xs font-bold" style={{ color: c.textPrimary }}>PAPER SIZE</p>
                  <p className="mt-0.5 text-[10px]" style={{ color: c.textMuted }}>
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
                  colors={c}
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
                colors={c}
              />

              <div className="space-y-4">
                {/* Timing row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative p-5" style={metalPanelStyle(c)}>
                    <PanelRivets colors={c} />
                    <div className="mb-3 flex items-center gap-2 relative">
                      <Clock className="h-3.5 w-3.5" style={{ color: c.accent }} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: c.textPrimary }}>
                        POLL INTERVAL
                      </span>
                    </div>
                    <MetalStepper id="poll-d" value={pollIntervalSec} onChange={(sec) => setPollIntervalMs(sec * 1000)} min={1} max={60} unit="SEC" colors={c} />
                    <FieldHint colors={c}>How often to check for new photos.</FieldHint>
                  </div>

                  <div className="relative p-5" style={metalPanelStyle(c)}>
                    <PanelRivets colors={c} />
                    <div className="mb-3 flex items-center gap-2 relative">
                      <RefreshCw className="h-3.5 w-3.5" style={{ color: c.accent }} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: c.textPrimary }}>
                        HEALTH CHECK
                      </span>
                    </div>
                    <MetalStepper id="health-d" value={healthIntervalSec} onChange={(sec) => setHealthIntervalMs(sec * 1000)} min={5} max={300} unit="SEC" colors={c} />
                    <FieldHint colors={c}>Frequency of printer health pings.</FieldHint>
                  </div>
                </div>

                {/* Log level */}
                <div className="relative flex items-center justify-between p-4" style={metalPanelStyle(c)}>
                  <PanelRivets colors={c} />
                  <div className="flex items-center gap-3 relative">
                    <FileText className="h-3.5 w-3.5" style={{ color: c.accent }} />
                    <div>
                      <p className="text-xs font-bold" style={{ color: c.textPrimary }}>LOG LEVEL</p>
                      <p className="text-[10px]" style={{ color: c.textMuted }}>Controls log verbosity</p>
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
                    colors={c}
                  />
                </div>

                {/* Print copies */}
                <div className="relative flex items-center justify-between p-4" style={metalPanelStyle(c)}>
                  <PanelRivets colors={c} />
                  <div className="flex items-center gap-3 relative">
                    <Copy className="h-3.5 w-3.5" style={{ color: c.accent }} />
                    <div>
                      <p className="text-xs font-bold" style={{ color: c.textPrimary }}>PRINT COPIES</p>
                      <p className="text-[10px]" style={{ color: c.textMuted }}>Copies per print job</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCopies(copies - 1)}
                      disabled={copies <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold transition disabled:opacity-30"
                      style={{ ...insetPanelStyle(c), color: c.textPrimary }}
                    >
                      -
                    </button>
                    <span
                      className="w-7 text-center text-sm font-bold tabular-nums"
                      style={{
                        ...monoFont,
                        color: c.accent,
                        textShadow: `0 0 8px ${c.accentGlow}0.2)`,
                      }}
                    >
                      {copies}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCopies(copies + 1)}
                      disabled={copies >= 10}
                      className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold transition disabled:opacity-30"
                      style={{ ...insetPanelStyle(c), color: c.textPrimary }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Press theme picker */}
                <ThemePickerRow colors={c} />

                {/* Device ID */}
                <DeviceIdRow colors={c} />
              </div>
            </section>

            {/* Bottom spacer */}
            <div className="h-4" aria-hidden />
          </div>
        </div>
      </div>

      {/* ---- Sticky action bar - riveted metal strip ---- */}
      <div
        className="shrink-0 px-6 py-4"
        style={{
          background: `linear-gradient(to bottom, ${c.baseLight}, ${c.baseMid})`,
          borderTop: `1px solid ${c.borderColor}`,
          boxShadow: `0 -2px 8px ${c.shadowColor}0.3)`,
        }}
      >
        <div className="mx-auto flex max-w-[54rem] items-center justify-between">
          <div className="flex items-center gap-2">
            <Rivet colors={c} />
            <p className="text-[10px] uppercase tracking-wider" style={{ color: c.textMuted }}>
              Changes saved locally to this machine
            </p>
            <Rivet colors={c} />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition"
              style={{ ...metalPanelStyle(c), color: c.textMuted }}
            >
              <RotateCcw className="h-3 w-3" />
              RESET
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saveState !== 'idle'}
              className="relative inline-flex h-9 items-center gap-2 overflow-hidden rounded px-5 text-[10px] font-bold uppercase tracking-wider text-white transition-all duration-200"
              style={
                saveState === 'saved'
                  ? {
                      background: `linear-gradient(to bottom, ${c.ledGreen}, ${c.ledGreen}cc)`,
                      boxShadow: `0 2px 8px ${c.ledGreen}4d`,
                    }
                  : {
                      background: `linear-gradient(to bottom, ${c.accent}, ${c.accentDark})`,
                      boxShadow: `0 2px 8px ${c.accentGlow}0.3), inset 0 1px 0 ${c.highlightColor}0.15)`,
                      cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
                    }
              }
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
