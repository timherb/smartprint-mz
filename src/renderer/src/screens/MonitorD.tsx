import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { LocalImage } from '@/components/LocalImage'
import { usePrinter } from '@/stores/printer'
import { useGallery } from '@/stores/gallery'
import { useCloud } from '@/stores/cloud'
import { useWatcher } from '@/stores/watcher'
import { useSettings } from '@/stores/settings'
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

const paperBg = cn(
  'rounded-lg',
  'bg-gradient-to-br from-[#f5f0e8] to-[#ebe5d9]',
  'shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)]',
)

const brassText = 'text-[#cd853f]'
const ledGreen = 'text-[#4ade80]'
const ledAmber = 'text-[#f59e0b]'
const ledRed = 'text-[#ef4444]'
const metalText = 'text-[#c8ccd2]'
const dimText = 'text-[#6b7280]'

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
// Circular gauge (SVG)
// ---------------------------------------------------------------------------

function CircularGauge({
  value,
  max,
  label,
  color = '#cd853f',
  size = 140,
}: {
  value: number
  max: number
  label: string
  color?: string
  size?: number
}): React.JSX.Element {
  const animated = useAnimatedValue(value)
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const progress = max > 0 ? Math.min(animated / max, 1) : 0
  const dashOffset = circumference * (1 - progress)

  return (
    <div className={cn(metalPanel, 'relative flex flex-col items-center p-6')}>
      <PanelRivets />

      {/* Section label - stencil style */}
      <p
        className={cn('mb-3 text-[10px] font-bold uppercase tracking-[0.15em]', dimText)}
        style={headerFont}
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
            stroke="#1a1d21"
            strokeWidth="8"
            className="opacity-80"
          />
          {/* Brass bezel outer ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius + 4}
            fill="none"
            stroke="url(#brassGradient)"
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
            stroke="#3a3f46"
            strokeWidth="1"
            opacity="0.3"
          />
          <defs>
            <linearGradient id="brassGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cd853f" />
              <stop offset="50%" stopColor="#b87333" />
              <stop offset="100%" stopColor="#8b5e2b" />
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
          <span className={cn('text-[10px] font-medium uppercase tracking-wider mt-0.5', dimText)}>
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
}: {
  status: PrinterStatus
  label: string
  detail: string | null
}): React.JSX.Element {
  const color = status === 'online' ? '#4ade80' : status === 'warning' ? '#f59e0b' : '#6b7280'
  const colorClass = status === 'online' ? ledGreen : status === 'warning' ? ledAmber : dimText

  return (
    <div
      className={cn(
        insetPanel,
        'flex items-center gap-3 px-4 py-3',
      )}
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
          className={cn(
            'relative block h-3 w-3 rounded-full',
            'shadow-[inset_0_-1px_2px_rgba(0,0,0,0.3)]',
          )}
          style={{
            background: `linear-gradient(to bottom, ${color}cc, ${color})`,
            boxShadow: status === 'online'
              ? `inset 0 -1px 2px rgba(0,0,0,0.3), 0 0 4px ${color}40`
              : 'inset 0 -1px 2px rgba(0,0,0,0.3)',
          }}
        />
      </div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <p className={cn('text-xs font-semibold truncate', metalText)} style={headerFont}>
          {label}
        </p>
        {detail && (
          <p className={cn('text-[10px] truncate mt-0.5', brassText)} style={monoFont}>
            {detail}
          </p>
        )}
      </div>

      {/* Status text */}
      <span className={cn('text-[10px] font-bold uppercase tracking-wider shrink-0', colorClass)}>
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
}: {
  job: PrintJob
  onCancel: (id: string) => void
  onRetry: (id: string) => void
}): React.JSX.Element {
  const isPrinting = job.status === 'printing'
  const isError = job.status === 'error'
  const isComplete = job.status === 'complete'
  const isQueued = job.status === 'queued'

  return (
    <div
      className={cn(
        'group relative rounded-md overflow-hidden transition-all duration-200',
        // Paper-textured card look
        isPrinting
          ? 'bg-gradient-to-br from-[#f5f0e8] to-[#ebe5d9] shadow-[0_2px_8px_rgba(0,0,0,0.2),0_0_0_1px_rgba(184,115,51,0.3)]'
          : isError
            ? 'bg-gradient-to-br from-[#f5f0e8] to-[#ebe5d9] shadow-[0_2px_8px_rgba(0,0,0,0.2),0_0_0_1px_rgba(239,68,68,0.3)]'
            : isComplete
              ? 'bg-gradient-to-br from-[#eae5dd] to-[#e0dbd3] shadow-[0_1px_4px_rgba(0,0,0,0.15)] opacity-60 hover:opacity-100'
              : 'bg-gradient-to-br from-[#f5f0e8] to-[#ebe5d9] shadow-[0_2px_6px_rgba(0,0,0,0.15)]',
      )}
    >
      {/* Ink roller progress bar */}
      {(isPrinting || isError) && (
        <div className="h-1 w-full bg-[#e0dbd3]">
          <div
            className={cn(
              'h-full transition-all duration-700 ease-out',
              isError
                ? 'bg-gradient-to-r from-[#ef4444] to-[#dc2626]'
                : 'bg-gradient-to-r from-[#b87333] via-[#cd853f] to-[#b87333]',
              isPrinting && 'animate-pulse',
            )}
            style={{
              width: `${job.progress}%`,
              boxShadow: isError ? '0 0 8px rgba(239,68,68,0.3)' : '0 0 8px rgba(184,115,51,0.3)',
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status icon */}
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded',
            isPrinting ? 'bg-[#b87333]/15' : isError ? 'bg-[#ef4444]/10' : isComplete ? 'bg-[#22c55e]/10' : 'bg-[#1a1a1a]/5',
          )}
        >
          {isPrinting && <Loader2 className="h-4 w-4 text-[#b87333] animate-spin" />}
          {isQueued && <FileImage className="h-4 w-4 text-[#6b7280]" />}
          {isComplete && <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />}
          {isError && <XCircle className="h-4 w-4 text-[#ef4444]" />}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold text-[#1a1a1a] truncate"
            style={monoFont}
          >
            {job.filename}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#6b7280]">
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
              className="text-sm font-bold text-[#b87333]"
              style={monoFont}
            >
              {job.progress}%
            </span>
          )}
          {isComplete && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#22c55e]">
              DONE
            </span>
          )}
          {isError && (
            <button
              type="button"
              onClick={() => onRetry(job.id)}
              className="flex items-center gap-1 rounded bg-[#ef4444]/10 px-2 py-1 text-[10px] font-bold text-[#ef4444] transition hover:bg-[#ef4444]/20"
            >
              <RefreshCw className="h-3 w-3" />
              RETRY
            </button>
          )}
          {(isQueued || isPrinting) && (
            <button
              type="button"
              onClick={() => onCancel(job.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-[#6b7280] transition hover:text-[#ef4444] hover:bg-[#ef4444]/10 opacity-0 group-hover:opacity-100"
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
}: {
  event: ActivityEvent
}): React.JSX.Element {
  const iconMap: Record<ActivityEvent['type'], { icon: React.ComponentType<{ className?: string }>; color: string }> = {
    print: { icon: CheckCircle2, color: 'text-[#22c55e]' },
    error: { icon: XCircle, color: 'text-[#ef4444]' },
    connect: { icon: Wifi, color: 'text-[#3b82f6]' },
    queue: { icon: FileImage, color: 'text-[#6b7280]' },
    warning: { icon: AlertTriangle, color: 'text-[#f59e0b]' },
  }
  const { icon: Icon, color } = iconMap[event.type]

  return (
    <div className="flex items-start gap-2 px-3 py-2 border-b border-[#d4cfc5]/60 last:border-b-0">
      <Icon className={cn('h-3 w-3 mt-0.5 shrink-0', color)} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[#1a1a1a] leading-relaxed">{event.message}</p>
        <p className="text-[10px] text-[#8b8178] mt-0.5" style={monoFont}>
          {event.timestamp}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Last printed preview
// ---------------------------------------------------------------------------

function LastPrintPreview({ photo }: { photo: Photo }): React.JSX.Element {
  return (
    <div className={cn(metalPanel, 'relative p-4')}>
      <PanelRivets />
      <p
        className={cn('text-[10px] font-bold uppercase tracking-[0.15em] mb-3', dimText)}
        style={headerFont}
      >
        LAST PRINT
      </p>
      <div className="flex items-center gap-4">
        {/* Thumbnail on paper */}
        <div className={cn('h-16 w-24 shrink-0 overflow-hidden', paperBg)}>
          {photo.filepath ? (
            <LocalImage
              filepath={photo.filepath}
              alt={photo.filename}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileImage className="h-6 w-6 text-[#8b8178] opacity-40" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-medium truncate', metalText)} style={monoFont}>
            {photo.filename}
          </p>
          <p className={cn('mt-1 text-[10px]', dimText)}>
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

  // --- Zustand stores ---
  const queue = usePrinter((s) => s.queue)
  const queueStats = usePrinter((s) => s.queueStats)
  const health = usePrinter((s) => s.health)
  const refreshQueue = usePrinter((s) => s.refreshQueue)
  const refreshHealth = usePrinter((s) => s.refreshHealth)
  const cancelJob = usePrinter((s) => s.cancelJob)
  const submitJob = usePrinter((s) => s.submitJob)
  const subscribeToEvents = usePrinter((s) => s.subscribeToEvents)
  const photos = useGallery().photos
  const lastPhoto = photos.length > 0 ? photos[photos.length - 1] : null
  const mode = useSettings((s) => s.mode)
  const cloudConnected = useCloud((s) => s.connected)
  const watcherRunning = useWatcher((s) => s.running)
  const isConnected = mode === 'cloud' ? cloudConnected : watcherRunning

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-refresh
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

  // Events
  useEffect(() => {
    const unsubscribe = subscribeToEvents()
    return unsubscribe
  }, [subscribeToEvents])

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

  return (
    <div className="flex h-full flex-col" style={headerFont}>
      {/* Disconnection banner */}
      {!isConnected && (
        <div
          className={cn(
            'flex items-center justify-center gap-2 px-4 py-3 text-sm',
            'bg-gradient-to-r from-[#ef4444]/15 via-[#ef4444]/10 to-[#ef4444]/15',
            'border-b border-[#ef4444]/20',
          )}
        >
          <WifiOff className={cn('h-4 w-4', ledRed)} />
          <span className={cn('font-bold', ledRed)}>CONNECTION LOST</span>
          <span className="text-[#ef4444]/60 text-xs">Attempting to reconnect...</span>
          <button
            type="button"
            className={cn(
              'ml-3 rounded px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
              'bg-[#ef4444]/15 text-[#ef4444] transition hover:bg-[#ef4444]/25',
            )}
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
                className={cn('text-sm font-bold uppercase tracking-[0.15em]', metalText)}
              >
                LIVE MONITOR
              </h2>
              <p className={cn('text-[10px] mt-1 uppercase tracking-wider', dimText)}>
                {onlinePrinters} of {totalPrinters} printers &middot; {printingCount} active, {queuedCount} queued
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Mechanical clock */}
              <div
                className={cn(insetPanel, 'flex items-center gap-2 px-4 py-2')}
              >
                <Clock className={cn('h-3.5 w-3.5', brassText)} />
                <span
                  className={cn('text-xs font-bold tabular-nums', brassText)}
                  style={{
                    ...monoFont,
                    textShadow: '0 0 8px rgba(205,133,63,0.2)',
                  }}
                >
                  {clockStr}
                </span>
              </div>

              {/* Pause/Resume rocker */}
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className={cn(
                  'flex items-center gap-2 rounded px-4 py-2 text-[10px] font-bold uppercase tracking-wider',
                  'transition-all duration-200',
                  isPaused
                    ? [
                        'bg-gradient-to-b from-[#cd853f] to-[#b87333]',
                        'text-white',
                        'shadow-[0_2px_6px_rgba(184,115,51,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]',
                      ]
                    : [
                        metalPanel,
                        metalText,
                        'hover:text-white',
                      ],
                )}
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
              color="#cd853f"
            />
            <CircularGauge
              value={queueDepth}
              max={Math.max(queueDepth, 10)}
              label="QUEUE DEPTH"
              color="#4ade80"
            />
          </div>

          {/* ---- Stats strip ---- */}
          <div className={cn(insetPanel, 'flex items-center justify-around py-3')}>
            {[
              { label: 'TOTAL', value: totalCount, color: metalText },
              { label: 'PRINTING', value: printingCount, color: brassText },
              { label: 'QUEUED', value: queuedCount, color: dimText },
              { label: 'COMPLETE', value: completedCount, color: ledGreen },
              { label: 'FAILED', value: failedCount, color: ledRed },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <span
                  className={cn('text-lg font-bold tabular-nums', stat.color)}
                  style={{
                    ...monoFont,
                    textShadow: stat.color === brassText ? '0 0 8px rgba(205,133,63,0.2)' : undefined,
                  }}
                >
                  {stat.value}
                </span>
                <span className={cn('text-[9px] font-bold uppercase tracking-[0.12em]', dimText)}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* ---- Last print preview ---- */}
          {lastPhoto && <LastPrintPreview photo={lastPhoto} />}

          {/* ---- Main grid: Queue (left) + Sidebar (right) ---- */}
          <div className="grid grid-cols-[1fr_320px] gap-5">

            {/* Print Queue - "Paper Feed" */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3
                    className={cn('text-[11px] font-bold uppercase tracking-[0.12em]', metalText)}
                    style={headerFont}
                  >
                    PRINT QUEUE
                  </h3>
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-bold tabular-nums',
                      insetPanel,
                      brassText,
                    )}
                    style={monoFont}
                  >
                    {mappedJobs.length}
                  </span>
                </div>
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', dimText)}>
                  PAPER FEED
                </span>
              </div>

              <div className="space-y-2">
                {mappedJobs.length > 0 ? (
                  mappedJobs.map((job) => (
                    <ConveyorCard key={job.id} job={job} onCancel={handleCancel} onRetry={handleRetry} />
                  ))
                ) : (
                  <div className={cn(insetPanel, 'p-8 text-center')}>
                    <FileImage className={cn('h-8 w-8 mx-auto mb-3 opacity-30', dimText)} />
                    <p className={cn('text-xs font-medium', dimText)}>No jobs in the queue</p>
                    <p className={cn('text-[10px] mt-1', dimText)}>
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
                    className={cn('text-[11px] font-bold uppercase tracking-[0.12em]', metalText)}
                    style={headerFont}
                  >
                    PRINTERS
                  </h3>
                  <span
                    className={cn('text-[10px] font-bold tabular-nums', brassText)}
                    style={monoFont}
                  >
                    {onlinePrinters}/{totalPrinters}
                  </span>
                </div>

                <div className={cn(metalPanel, 'relative p-3 space-y-2')}>
                  <PanelRivets />
                  {mappedPrinters.length > 0 ? (
                    mappedPrinters.map((printer) => (
                      <LEDIndicator
                        key={printer.id}
                        status={printer.status}
                        label={printer.name}
                        detail={printer.currentJob}
                      />
                    ))
                  ) : (
                    <div className={cn(insetPanel, 'p-6 text-center')}>
                      <Printer className={cn('h-6 w-6 mx-auto mb-2 opacity-30', dimText)} />
                      <p className={cn('text-[10px]', dimText)}>No printers detected</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Activity Feed - Print Log on paper */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className={cn('text-[11px] font-bold uppercase tracking-[0.12em]', metalText)}
                    style={headerFont}
                  >
                    PRINT LOG
                  </h3>
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', dimText)}>
                    LATEST
                  </span>
                </div>

                <div className={cn(paperBg, 'max-h-[360px] overflow-y-auto')}>
                  {activityEvents.length > 0 ? (
                    activityEvents.map((event) => (
                      <TickerItem key={event.id} event={event} />
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-[10px] text-[#8b8178]">No activity yet</p>
                      <p className="text-[10px] text-[#8b8178] mt-1 opacity-60">
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
