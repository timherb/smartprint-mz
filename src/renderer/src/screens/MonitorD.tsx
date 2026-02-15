import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { LocalImage } from '@/components/LocalImage'
import { usePrinter } from '@/stores/printer'
import { useGallery } from '@/stores/gallery'
import { useCloud } from '@/stores/cloud'
import { useWatcher } from '@/stores/watcher'
import { useSettings } from '@/stores/settings'
import { usePressTheme } from '@/stores/pressTheme'
import type { PressThemeColors } from '@/themes/press-themes'
import type { Photo } from '@/stores/gallery'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  WifiOff,
  Loader2,
  RefreshCw,
  Pause,
  Play,
  FileImage,
  Ban,
  Printer,
  Wifi,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobStatus = 'printing' | 'queued' | 'complete' | 'error'
type PrinterStatus = 'online' | 'warning' | 'offline'

interface PrintJob {
  id: string
  filename: string
  printer: string
  status: JobStatus
  progress: number
  timestamp: string
  size: string
  elapsed?: string
}

interface PrinterInfo {
  id: string
  name: string
  model: string
  status: PrinterStatus
  jobsPrinted: number
  currentJob: string | null
  avgPrintTime: string
}

interface ActivityEvent {
  id: string
  type: 'print' | 'error' | 'connect' | 'queue' | 'warning'
  message: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapJobStatus(status: string): JobStatus {
  switch (status) {
    case 'printing': return 'printing'
    case 'pending': return 'queued'
    case 'completed': return 'complete'
    case 'failed':
    case 'cancelled': return 'error'
    default: return 'queued'
  }
}

function mapPrinterStatus(status: string): PrinterStatus {
  switch (status) {
    case 'ready':
    case 'busy': return 'online'
    case 'paused': return 'warning'
    case 'error':
    case 'offline': return 'offline'
    default: return 'offline'
  }
}

function formatTime(epoch: number): string {
  return new Date(epoch).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatElapsed(startedAt: number | null, completedAt: number | null): string | undefined {
  if (!startedAt) return undefined
  const end = completedAt ?? Date.now()
  const seconds = Math.floor((end - startedAt) / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function deriveActivityFromPhotos(photos: Photo[]): ActivityEvent[] {
  const sorted = [...photos].sort((a, b) => b.printedAt - a.printedAt)
  return sorted.slice(0, 15).map((photo): ActivityEvent => ({
    id: `activity-${photo.id}-printed`,
    type: 'print',
    message: `${photo.filename} printed successfully`,
    timestamp: formatTime(photo.printedAt),
  }))
}

// ---------------------------------------------------------------------------
// Animated counter
// ---------------------------------------------------------------------------

function useAnimatedValue(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  const startTime = useRef<number | null>(null)

  useEffect(() => {
    startTime.current = performance.now()
    let raf: number
    function tick(now: number): void {
      const elapsed = now - (startTime.current ?? now)
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

// ---------------------------------------------------------------------------
// Font constants
// ---------------------------------------------------------------------------

const monoFont = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' }
const headerFont = { fontFamily: '"Inter", system-ui, sans-serif' }

// ---------------------------------------------------------------------------
// Shadow / style builder helpers
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

function paperBgStyle(c: PressThemeColors): React.CSSProperties {
  return {
    borderRadius: '0.5rem',
    background: `linear-gradient(to bottom right, ${c.paper}, ${c.paperDark})`,
    boxShadow: `inset 0 1px 3px ${c.shadowColor}0.08)`,
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
// Circular gauge (SVG)
// ---------------------------------------------------------------------------

function CircularGauge({
  value,
  max,
  label,
  color,
  size = 140,
  colors,
}: {
  value: number
  max: number
  label: string
  color: string
  size?: number
  colors: PressThemeColors
}): React.JSX.Element {
  const animated = useAnimatedValue(value)
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const progress = max > 0 ? Math.min(animated / max, 1) : 0
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="relative flex flex-col items-center p-6" style={metalPanelStyle(colors)}>
      <PanelRivets colors={colors} />

      {/* Section label - stencil style */}
      <p
        className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{ ...headerFont, color: colors.textMuted }}
      >
        {label}
      </p>

      {/* Gauge SVG */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.baseDark}
            strokeWidth="8"
            className="opacity-80"
          />
          {/* Bezel outer ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius + 4}
            fill="none"
            stroke={`url(#accentGradient-${label.replace(/\s/g, '')})`}
            strokeWidth="2"
            opacity="0.5"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
            style={{
              filter: `drop-shadow(0 0 6px ${color}40)`,
            }}
          />
          {/* Inner bezel ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius - 6}
            fill="none"
            stroke={colors.borderColor}
            strokeWidth="1"
            opacity="0.3"
          />
          <defs>
            <linearGradient id={`accentGradient-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colors.accent} />
              <stop offset="50%" stopColor={colors.accentDark} />
              <stop offset="100%" stopColor={colors.accentDark} />
            </linearGradient>
          </defs>
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{
              ...monoFont,
              color,
              textShadow: `0 0 12px ${color}30`,
            }}
          >
            {animated}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-wider mt-0.5"
            style={{ color: colors.textMuted }}
          >
            {max > 0 ? `of ${max}` : 'total'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LED status indicator
// ---------------------------------------------------------------------------

function LEDIndicator({
  status,
  label,
  detail,
  colors,
}: {
  status: PrinterStatus
  label: string
  detail: string | null
  colors: PressThemeColors
}): React.JSX.Element {
  const color = status === 'online' ? colors.ledGreen : status === 'warning' ? colors.ledAmber : colors.textMuted
  const colorText = status === 'online' ? colors.ledGreen : status === 'warning' ? colors.ledAmber : colors.textMuted

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={insetPanelStyle(colors)}
    >
      {/* LED */}
      <div className="relative shrink-0">
        {status === 'online' && (
          <span
            className="absolute inset-0 rounded-full blur-[4px] opacity-50"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        )}
        <span
          className="relative block h-3 w-3 rounded-full"
          style={{
            background: `linear-gradient(to bottom, ${color}cc, ${color})`,
            boxShadow: status === 'online'
              ? `inset 0 -1px 2px ${colors.shadowColor}0.3), 0 0 4px ${color}40`
              : `inset 0 -1px 2px ${colors.shadowColor}0.3)`,
          }}
        />
      </div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate" style={{ ...headerFont, color: colors.textPrimary }}>
          {label}
        </p>
        {detail && (
          <p className="text-[10px] truncate mt-0.5" style={{ ...monoFont, color: colors.accent }}>
            {detail}
          </p>
        )}
      </div>

      {/* Status text */}
      <span
        className="text-[10px] font-bold uppercase tracking-wider shrink-0"
        style={{ color: colorText }}
      >
        {status === 'online' ? 'READY' : status === 'warning' ? 'WARN' : 'OFF'}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Print queue card - "paper on conveyor" look
// ---------------------------------------------------------------------------

function ConveyorCard({
  job,
  onCancel,
  onRetry,
  colors,
}: {
  job: PrintJob
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  colors: PressThemeColors
}): React.JSX.Element {
  const isPrinting = job.status === 'printing'
  const isError = job.status === 'error'
  const isComplete = job.status === 'complete'
  const isQueued = job.status === 'queued'

  const borderHighlight = isPrinting
    ? `0 0 0 1px ${colors.accent}4d`
    : isError
      ? `0 0 0 1px ${colors.ledRed}4d`
      : 'none'

  return (
    <div
      className={cn(
        'group relative rounded-md overflow-hidden transition-all duration-200',
        isComplete && 'opacity-60 hover:opacity-100',
      )}
      style={{
        background: `linear-gradient(to bottom right, ${colors.paper}, ${colors.paperDark})`,
        boxShadow: `0 2px 8px ${colors.shadowColor}0.2), ${borderHighlight}`,
      }}
    >
      {/* Ink roller progress bar */}
      {(isPrinting || isError) && (
        <div className="h-1 w-full" style={{ backgroundColor: colors.paperDark }}>
          <div
            className={cn(
              'h-full transition-all duration-700 ease-out',
              isPrinting && 'animate-pulse',
            )}
            style={{
              width: `${job.progress}%`,
              background: isError
                ? `linear-gradient(to right, ${colors.ledRed}, ${colors.ledRed})`
                : `linear-gradient(to right, ${colors.accentDark}, ${colors.accent}, ${colors.accentDark})`,
              boxShadow: isError
                ? `0 0 8px ${colors.ledRed}4d`
                : `0 0 8px ${colors.accentGlow}0.3)`,
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status icon */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded"
          style={{
            backgroundColor: isPrinting
              ? `${colors.accent}26`
              : isError
                ? `${colors.ledRed}1a`
                : isComplete
                  ? `${colors.ledGreen}1a`
                  : `${colors.textOnPaper}0d`,
          }}
        >
          {isPrinting && <Loader2 className="h-4 w-4 animate-spin" style={{ color: colors.accent }} />}
          {isQueued && <FileImage className="h-4 w-4" style={{ color: colors.textOnPaperMuted }} />}
          {isComplete && <CheckCircle2 className="h-4 w-4" style={{ color: colors.ledGreen }} />}
          {isError && <XCircle className="h-4 w-4" style={{ color: colors.ledRed }} />}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold truncate"
            style={{ ...monoFont, color: colors.textOnPaper }}
          >
            {job.filename}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: colors.textOnPaperMuted }}>
            {!isQueued && <span style={monoFont}>{job.printer}</span>}
            {isQueued && <span>Waiting...</span>}
            <span>&middot;</span>
            <span>{job.size}</span>
            {job.elapsed && (
              <>
                <span>&middot;</span>
                <span style={monoFont}>{job.elapsed}</span>
              </>
            )}
          </div>
        </div>

        {/* Status badge / actions */}
        <div className="shrink-0">
          {isPrinting && (
            <span
              className="text-sm font-bold"
              style={{ ...monoFont, color: colors.accent }}
            >
              {job.progress}%
            </span>
          )}
          {isComplete && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: colors.ledGreen }}
            >
              DONE
            </span>
          )}
          {isError && (
            <button
              type="button"
              onClick={() => onRetry(job.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition"
              style={{
                backgroundColor: `${colors.ledRed}1a`,
                color: colors.ledRed,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${colors.ledRed}33` }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = `${colors.ledRed}1a` }}
            >
              <RefreshCw className="h-3 w-3" />
              RETRY
            </button>
          )}
          {(isQueued || isPrinting) && (
            <button
              type="button"
              onClick={() => onCancel(job.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition"
              style={{ color: colors.textOnPaperMuted }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = colors.ledRed
                e.currentTarget.style.backgroundColor = `${colors.ledRed}1a`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.textOnPaperMuted
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Ban className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity ticker item (on paper bg)
// ---------------------------------------------------------------------------

function TickerItem({
  event,
  colors,
}: {
  event: ActivityEvent
  colors: PressThemeColors
}): React.JSX.Element {
  const iconMap: Record<ActivityEvent['type'], { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
    print: { icon: CheckCircle2, color: colors.ledGreen },
    error: { icon: XCircle, color: colors.ledRed },
    connect: { icon: Wifi, color: colors.accent },
    queue: { icon: FileImage, color: colors.textOnPaperMuted },
    warning: { icon: AlertTriangle, color: colors.ledAmber },
  }
  const { icon: Icon, color } = iconMap[event.type]

  return (
    <div
      className="flex items-start gap-2 px-3 py-2 last:border-b-0"
      style={{ borderBottom: `1px solid ${colors.paperBorder}99` }}
    >
      <Icon className="h-3 w-3 mt-0.5 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-relaxed" style={{ color: colors.textOnPaper }}>{event.message}</p>
        <p className="text-[10px] mt-0.5" style={{ ...monoFont, color: colors.textOnPaperMuted }}>
          {event.timestamp}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Last printed preview
// ---------------------------------------------------------------------------

function LastPrintPreview({ photo, colors }: { photo: Photo; colors: PressThemeColors }): React.JSX.Element {
  return (
    <div className="relative p-4" style={metalPanelStyle(colors)}>
      <PanelRivets colors={colors} />
      <p
        className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
        style={{ ...headerFont, color: colors.textMuted }}
      >
        LAST PRINT
      </p>
      <div className="flex items-center gap-4">
        {/* Thumbnail on paper */}
        <div className="h-16 w-24 shrink-0 overflow-hidden" style={paperBgStyle(colors)}>
          {photo.filepath ? (
            <LocalImage
              filepath={photo.filepath}
              alt={photo.filename}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileImage className="h-6 w-6 opacity-40" style={{ color: colors.textOnPaperMuted }} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate" style={{ ...monoFont, color: colors.textPrimary }}>
            {photo.filename}
          </p>
          <p className="mt-1 text-[10px]" style={{ color: colors.textMuted }}>
            {new Date(photo.printedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {photo.sizeBytes > 0 && ` \u00b7 ${(photo.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MonitorD(): React.JSX.Element {
  const [isPaused, setIsPaused] = useState(false)
  const [now, setNow] = useState(new Date())

  // Press theme
  const c = usePressTheme()

  // --- Zustand stores ---
  const queue = usePrinter((s) => s.queue)
  const queueStats = usePrinter((s) => s.queueStats)
  const health = usePrinter((s) => s.health)
  const refreshQueue = usePrinter((s) => s.refreshQueue)
  const refreshHealth = usePrinter((s) => s.refreshHealth)
  const cancelJob = usePrinter((s) => s.cancelJob)
  const submitJob = usePrinter((s) => s.submitJob)
  const photos = useGallery((s) => s.photos)
  // photos are sorted newest-first, so index 0 is the most recent
  const lastPhoto = photos.length > 0 ? photos[0] : null
  const mode = useSettings((s) => s.mode)
  const cloudConnected = useCloud((s) => s.connected)
  const watcherRunning = useWatcher((s) => s.running)
  const isConnected = mode === 'cloud' ? cloudConnected : watcherRunning

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-refresh (event subscription is handled by AppLayoutD on mount)
  useEffect(() => {
    refreshQueue()
    refreshHealth()
    if (isPaused) return
    const id = setInterval(() => {
      refreshQueue()
      refreshHealth()
    }, 5000)
    return () => clearInterval(id)
  }, [isPaused, refreshQueue, refreshHealth])

  // Map queue jobs
  const mappedJobs: PrintJob[] = queue.map((job) => {
    const mappedStatus = mapJobStatus(job.status)
    const progress = mappedStatus === 'printing' ? 50 : mappedStatus === 'complete' ? 100 : 0
    return {
      id: job.id,
      filename: job.filename,
      printer: job.printerName || '--',
      status: mappedStatus,
      progress,
      timestamp: formatTime(job.createdAt),
      size: job.options.paperSize ?? '4x6',
      elapsed: formatElapsed(job.startedAt, job.completedAt),
    }
  })

  // Map printer health
  const pool = useSettings((s) => s.printerPool)
  const healthPrinters = (health?.printers ?? []).filter(
    (p) => pool.length === 0 || pool.includes(p.name),
  )
  const mappedPrinters: PrinterInfo[] = healthPrinters
    .filter((p) => mapPrinterStatus(p.status) !== 'offline')
    .map((p, idx) => {
      const activeJob = queue.find((j) => j.printerName === p.name && j.status === 'printing')
      return {
        id: `printer-${idx}`,
        name: p.displayName || p.name,
        model: p.name,
        status: mapPrinterStatus(p.status),
        jobsPrinted: 0,
        currentJob: activeJob?.filename ?? null,
        avgPrintTime: '--:--',
      }
    })

  const activityEvents = deriveActivityFromPhotos(photos)

  const handleCancel = useCallback(
    (jobId: string) => cancelJob(jobId),
    [cancelJob],
  )

  const clearFinished = usePrinter((s) => s.clearFinished)
  const handleRetry = useCallback(
    async (jobId: string) => {
      const job = queue.find((j) => j.id === jobId)
      if (!job) return
      await clearFinished()
      await submitJob(job.filename, job.filepath, job.options as Record<string, unknown>)
    },
    [queue, submitJob, clearFinished],
  )

  // Stats
  const clockStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const printingCount = queueStats.printing
  const queuedCount = queueStats.pending
  const queueDepth = queueStats.pending + queueStats.printing
  const completedCount = queueStats.completed
  const failedCount = queueStats.failed
  const totalCount = queueStats.total
  const onlinePrinters = healthPrinters.filter((p) => mapPrinterStatus(p.status) === 'online').length
  const totalPrinters = pool.length || healthPrinters.length

  // Themed shadows
  const pauseBtnActiveShadow = `0 2px 6px ${c.accentGlow}0.3), inset 0 1px 0 ${c.highlightColor}0.15)`

  return (
    <div className="flex h-full flex-col" style={headerFont}>
      {/* Disconnection banner */}
      {!isConnected && (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 text-sm"
          style={{
            background: `linear-gradient(to right, ${c.ledRed}26, ${c.ledRed}1a, ${c.ledRed}26)`,
            borderBottom: `1px solid ${c.ledRed}33`,
          }}
        >
          <WifiOff className="h-4 w-4" style={{ color: c.ledRed }} />
          <span className="font-bold" style={{ color: c.ledRed }}>CONNECTION LOST</span>
          <span className="text-xs" style={{ color: `${c.ledRed}99` }}>Attempting to reconnect...</span>
          <button
            type="button"
            className="ml-3 rounded px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition"
            style={{
              backgroundColor: `${c.ledRed}26`,
              color: c.ledRed,
            }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6 space-y-6">

          {/* ---- Status Bar (mechanical clock feel) ---- */}
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-sm font-bold uppercase tracking-[0.15em]"
                style={{ color: c.textPrimary }}
              >
                LIVE MONITOR
              </h2>
              <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: c.textMuted }}>
                {onlinePrinters} of {totalPrinters} printers &middot; {printingCount} active, {queuedCount} queued
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Mechanical clock */}
              <div
                className="flex items-center gap-2 px-4 py-2"
                style={insetPanelStyle(c)}
              >
                <Clock className="h-3.5 w-3.5" style={{ color: c.accent }} />
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{
                    ...monoFont,
                    color: c.accent,
                    textShadow: `0 0 8px ${c.accentGlow}0.2)`,
                  }}
                >
                  {clockStr}
                </span>
              </div>

              {/* Pause/Resume rocker */}
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className="flex items-center gap-2 rounded px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200"
                style={
                  isPaused
                    ? {
                        background: `linear-gradient(to bottom, ${c.accent}, ${c.accentDark})`,
                        color: '#ffffff',
                        boxShadow: pauseBtnActiveShadow,
                      }
                    : {
                        ...metalPanelStyle(c),
                        color: c.textPrimary,
                      }
                }
                onMouseEnter={(e) => {
                  if (!isPaused) e.currentTarget.style.color = '#ffffff'
                }}
                onMouseLeave={(e) => {
                  if (!isPaused) e.currentTarget.style.color = c.textPrimary
                }}
              >
                {isPaused ? (
                  <>
                    <Play className="h-3 w-3" />
                    RESUME
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3" />
                    PAUSE
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ---- Gauges row ---- */}
          <div className="grid grid-cols-2 gap-5">
            <CircularGauge
              value={completedCount}
              max={totalCount || completedCount}
              label="PHOTOS PRINTED"
              color={c.accent}
              colors={c}
            />
            <CircularGauge
              value={queueDepth}
              max={Math.max(queueDepth, 10)}
              label="QUEUE DEPTH"
              color={c.ledGreen}
              colors={c}
            />
          </div>

          {/* ---- Stats strip ---- */}
          <div
            className="flex items-center justify-around py-3"
            style={insetPanelStyle(c)}
          >
            {[
              { label: 'TOTAL', value: totalCount, color: c.textPrimary, isAccent: false },
              { label: 'PRINTING', value: printingCount, color: c.accent, isAccent: true },
              { label: 'QUEUED', value: queuedCount, color: c.textMuted, isAccent: false },
              { label: 'COMPLETE', value: completedCount, color: c.ledGreen, isAccent: false },
              { label: 'FAILED', value: failedCount, color: c.ledRed, isAccent: false },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{
                    ...monoFont,
                    color: stat.color,
                    textShadow: stat.isAccent ? `0 0 8px ${c.accentGlow}0.2)` : undefined,
                  }}
                >
                  {stat.value}
                </span>
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: c.textMuted }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* ---- Last print preview ---- */}
          {lastPhoto && <LastPrintPreview photo={lastPhoto} colors={c} />}

          {/* ---- Main grid: Queue (left) + Sidebar (right) ---- */}
          <div className="grid grid-cols-[1fr_320px] gap-5">

            {/* Print Queue - "Paper Feed" */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3
                    className="text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={{ ...headerFont, color: c.textPrimary }}
                  >
                    PRINT QUEUE
                  </h3>
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{
                      ...insetPanelStyle(c),
                      ...monoFont,
                      color: c.accent,
                    }}
                  >
                    {mappedJobs.length}
                  </span>
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: c.textMuted }}
                >
                  PAPER FEED
                </span>
              </div>

              <div className="space-y-2">
                {mappedJobs.length > 0 ? (
                  mappedJobs.map((job) => (
                    <ConveyorCard key={job.id} job={job} onCancel={handleCancel} onRetry={handleRetry} colors={c} />
                  ))
                ) : (
                  <div className="p-8 text-center" style={insetPanelStyle(c)}>
                    <FileImage className="h-8 w-8 mx-auto mb-3 opacity-30" style={{ color: c.textMuted }} />
                    <p className="text-xs font-medium" style={{ color: c.textMuted }}>No jobs in the queue</p>
                    <p className="text-[10px] mt-1" style={{ color: c.textMuted }}>
                      Jobs appear here when photos are submitted for printing
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Right sidebar */}
            <div className="space-y-5">

              {/* Printer LED Panel */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className="text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={{ ...headerFont, color: c.textPrimary }}
                  >
                    PRINTERS
                  </h3>
                  <span
                    className="text-[10px] font-bold tabular-nums"
                    style={{ ...monoFont, color: c.accent }}
                  >
                    {onlinePrinters}/{totalPrinters}
                  </span>
                </div>

                <div className="relative p-3 space-y-2" style={metalPanelStyle(c)}>
                  <PanelRivets colors={c} />
                  {mappedPrinters.length > 0 ? (
                    mappedPrinters.map((printer) => (
                      <LEDIndicator
                        key={printer.id}
                        status={printer.status}
                        label={printer.name}
                        detail={printer.currentJob}
                        colors={c}
                      />
                    ))
                  ) : (
                    <div className="p-6 text-center" style={insetPanelStyle(c)}>
                      <Printer className="h-6 w-6 mx-auto mb-2 opacity-30" style={{ color: c.textMuted }} />
                      <p className="text-[10px]" style={{ color: c.textMuted }}>No printers detected</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Activity Feed - Print Log on paper */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className="text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={{ ...headerFont, color: c.textPrimary }}
                  >
                    PRINT LOG
                  </h3>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: c.textMuted }}
                  >
                    LATEST
                  </span>
                </div>

                <div className="max-h-[360px] overflow-y-auto" style={paperBgStyle(c)}>
                  {activityEvents.length > 0 ? (
                    activityEvents.map((event) => (
                      <TickerItem key={event.id} event={event} colors={c} />
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-[10px]" style={{ color: c.textOnPaperMuted }}>No activity yet</p>
                      <p className="text-[10px] mt-1 opacity-60" style={{ color: c.textOnPaperMuted }}>
                        Events appear as photos are processed
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
