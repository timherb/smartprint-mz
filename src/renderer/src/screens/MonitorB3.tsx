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
  Images,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  WifiOff,
  Wifi,
  Loader2,
  ImagePlus,
  RefreshCw,
  Pause,
  Play,
  Activity,
  CircleDot,
  Layers,
  FileImage,
  Ban,
  Printer,
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
// Helpers: map store DTOs to component types
// ---------------------------------------------------------------------------

/** Map PrintJobDTO.status (string) to the component's JobStatus */
function mapJobStatus(status: string): JobStatus {
  switch (status) {
    case 'printing':
      return 'printing'
    case 'pending':
      return 'queued'
    case 'completed':
      return 'complete'
    case 'failed':
    case 'cancelled':
      return 'error'
    default:
      return 'queued'
  }
}

/** Map PrinterHealthStatusDTO.status (string) to the component's PrinterStatus */
function mapPrinterStatus(status: string): PrinterStatus {
  switch (status) {
    case 'ready':
    case 'busy':
      return 'online'
    case 'paused':
      return 'warning'
    case 'error':
    case 'offline':
      return 'offline'
    case 'unknown':
    default:
      return 'offline'
  }
}

/** Format a timestamp (epoch ms) to a locale time string */
function formatTime(epoch: number): string {
  return new Date(epoch).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Calculate elapsed time string from start to now or end */
function formatElapsed(startedAt: number | null, completedAt: number | null): string | undefined {
  if (!startedAt) return undefined
  const end = completedAt ?? Date.now()
  const seconds = Math.floor((end - startedAt) / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/** Derive activity events from gallery photos (printed photos only) */
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
// Animated counter hook
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
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

// ---------------------------------------------------------------------------
// Soft pulse dot for live indicators
// ---------------------------------------------------------------------------

function PulseDot({ color = 'bg-emerald-500', size = 'sm' }: { color?: string; size?: 'sm' | 'md' }): React.JSX.Element {
  const px = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2'
  const ring = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={cn('absolute inline-flex rounded-full opacity-25 animate-ping', color, ring)} />
      <span className={cn('relative inline-flex rounded-full', color, px)} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Last image preview — thumbnail of the most recent photo
// ---------------------------------------------------------------------------

function LastImagePreview({ photo }: { photo: Photo }): React.JSX.Element {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-5">
        {/* Thumbnail */}
        <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-secondary">
          {photo.filepath ? (
            <LocalImage
              filepath={photo.filepath}
              alt={photo.filename}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FileImage className="h-8 w-8 text-muted-foreground opacity-40" />
            </div>
          )}
        </div>
        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            Last Image
          </p>
          <p
            className="text-sm font-medium text-foreground truncate"
            style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
          >
            {photo.filename}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(photo.printedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {photo.sizeBytes > 0 && ` \u00b7 ${(photo.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero stat card — soft, elevated, with depth
// ---------------------------------------------------------------------------

function HeroStat({
  label,
  value,
  suffix,
  sub,
  icon: Icon,
  glow,
}: {
  label: string
  value: number
  suffix?: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  glow?: boolean
}): React.JSX.Element {
  const animated = useAnimatedValue(value)

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl bg-card p-6',
        'transition-all duration-300 ease-out hover:scale-[1.01]',
        glow
          ? 'shadow-md shadow-[#c57d3c]/10 ring-1 ring-[#c57d3c]/15 overflow-hidden'
          : 'shadow-sm hover:shadow-md'
      )}
    >
      {/* Copper glow for primary stat */}
      {glow && (
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#c57d3c]/[0.06] blur-3xl" />
      )}

      <div className="flex items-center justify-between relative">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-300',
          glow ? 'bg-[#c57d3c]/10 text-[#c57d3c]' : 'bg-secondary text-muted-foreground group-hover:text-foreground'
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1 relative">
        <span
          className={cn(
            'text-4xl font-bold tracking-tighter',
            glow ? 'text-[#c57d3c]' : 'text-foreground'
          )}
          style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
        >
          {animated}
        </span>
        {suffix && (
          <span
            className={cn(
              'text-lg font-bold tracking-tight',
              glow ? 'text-[#c57d3c]/60' : 'text-muted-foreground'
            )}
            style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
          >
            {suffix}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Job status badge
// ---------------------------------------------------------------------------

function JobBadge({ status }: { status: JobStatus }): React.JSX.Element {
  const map: Record<JobStatus, { label: string; classes: string; dot?: string }> = {
    printing: {
      label: 'Printing',
      classes: 'text-[#c57d3c] bg-[#c57d3c]/10 border border-[#c57d3c]/20',
      dot: 'bg-[#c57d3c]',
    },
    queued: {
      label: 'Queued',
      classes: 'text-muted-foreground bg-secondary border border-transparent',
    },
    complete: {
      label: 'Done',
      classes: 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/15',
    },
    error: {
      label: 'Error',
      classes: 'text-red-400 bg-red-500/10 border border-red-500/15',
    },
  }
  const cfg = map[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium', cfg.classes)}>
      {cfg.dot && <PulseDot color={cfg.dot} size="sm" />}
      {status === 'complete' && <CheckCircle2 className="h-3 w-3" />}
      {status === 'error' && <XCircle className="h-3 w-3" />}
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Queue card — each job as a physical card, not a row
// ---------------------------------------------------------------------------

function QueueCard({ job, onCancel, onRetry }: { job: PrintJob; onCancel: (id: string) => void; onRetry: (id: string) => void }): React.JSX.Element {
  const isPrinting = job.status === 'printing'
  const isError = job.status === 'error'
  const isComplete = job.status === 'complete'
  const isQueued = job.status === 'queued'

  return (
    <div
      className={cn(
        'group rounded-2xl bg-card p-5',
        'transition-all duration-300 ease-out hover:scale-[1.01]',
        isPrinting && 'shadow-md shadow-[#c57d3c]/8 ring-1 ring-[#c57d3c]/15',
        isError && 'shadow-sm ring-1 ring-red-500/15',
        isComplete && 'shadow-sm opacity-60 hover:opacity-100',
        isQueued && 'shadow-sm hover:shadow-md',
      )}
    >
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
          isPrinting ? 'bg-[#c57d3c]/10' : 'bg-secondary',
        )}>
          <FileImage className={cn('h-5 w-5', isPrinting ? 'text-[#c57d3c]' : 'text-muted-foreground')} />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span
              className="text-sm font-medium text-foreground truncate"
              style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
            >
              {job.filename}
            </span>
            <JobBadge status={job.status} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            {!isQueued && (
              <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>{job.printer}</span>
            )}
            {isQueued && <span>Waiting for assignment</span>}
            <span className="text-border">/</span>
            <span>{job.size}</span>
            {job.elapsed && (
              <>
                <span className="text-border">/</span>
                <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>{job.elapsed}</span>
              </>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="shrink-0 w-16 text-right">
          {isPrinting && (
            <span
              className="text-sm font-bold text-[#c57d3c]"
              style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
            >
              {job.progress}%
            </span>
          )}
          {isComplete && <CheckCircle2 className="h-5 w-5 text-emerald-500 ml-auto" />}
          {isError && (
            <button
              type="button"
              onClick={() => onRetry(job.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-400 transition-all duration-300 hover:bg-red-500/20"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
          {(isQueued || isPrinting) && (
            <button
              type="button"
              onClick={() => onCancel(job.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground transition-all duration-300 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
            >
              <Ban className="h-3 w-3" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(isPrinting || isError) && (
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out',
              isError ? 'bg-red-500' : 'bg-[#c57d3c]',
              isPrinting && 'animate-pulse'
            )}
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Printer card — with circular progress feel
// ---------------------------------------------------------------------------

function PrinterCard({ printer }: { printer: PrinterInfo }): React.JSX.Element {
  const statusDot: Record<PrinterStatus, string> = {
    online: 'bg-emerald-500',
    warning: 'bg-amber-400',
    offline: 'bg-red-400',
  }
  const statusLabel: Record<PrinterStatus, string> = {
    online: 'Online',
    warning: 'Low Paper',
    offline: 'Offline',
  }
  const statusColor: Record<PrinterStatus, string> = {
    online: 'text-emerald-500',
    warning: 'text-amber-400',
    offline: 'text-red-400',
  }

  return (
    <div className={cn(
      'rounded-2xl bg-card p-6',
      'transition-all duration-300 ease-out hover:scale-[1.01]',
      'shadow-sm hover:shadow-md',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
            <Printer className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{printer.name}</p>
            <p
              className="text-xs text-muted-foreground"
              style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
            >
              {printer.model}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {printer.status === 'online' ? (
            <PulseDot color={statusDot[printer.status]} />
          ) : (
            <span className={cn('h-2 w-2 rounded-full', statusDot[printer.status])} />
          )}
          <span className={cn('text-[11px] font-medium', statusColor[printer.status])}>
            {statusLabel[printer.status]}
          </span>
        </div>
      </div>

      {/* Current job */}
      {printer.currentJob ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-[#c57d3c]/8 px-4 py-2.5">
          <Loader2 className="h-3.5 w-3.5 text-[#c57d3c] animate-spin" />
          <span
            className="text-xs font-medium text-[#c57d3c] truncate"
            style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
          >
            {printer.currentJob}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl bg-secondary px-4 py-2.5">
          <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Idle</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity feed item with soft alternating backgrounds
// ---------------------------------------------------------------------------

function ActivityItem({
  event,
  isLast,
  isEven,
}: {
  event: ActivityEvent
  isLast: boolean
  isEven: boolean
}): React.JSX.Element {
  const iconMap: Record<ActivityEvent['type'], { icon: React.ComponentType<{ className?: string }>; accent: string }> = {
    print: { icon: CheckCircle2, accent: 'text-emerald-500 bg-emerald-500/10' },
    error: { icon: XCircle, accent: 'text-red-400 bg-red-500/10' },
    connect: { icon: Wifi, accent: 'text-blue-400 bg-blue-500/10' },
    queue: { icon: ImagePlus, accent: 'text-foreground bg-secondary' },
    warning: { icon: AlertTriangle, accent: 'text-amber-400 bg-amber-400/10' },
  }
  const { icon: Icon, accent } = iconMap[event.type]

  return (
    <div className={cn(
      'flex gap-3 px-4 py-3 rounded-xl transition-colors duration-200',
      isEven ? 'bg-transparent' : 'bg-secondary/30'
    )}>
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', accent)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className={cn('min-w-0', isLast && 'pb-0')}>
        <p className="text-xs leading-relaxed text-foreground/90">{event.message}</p>
        <p
          className="mt-0.5 text-[11px] text-muted-foreground"
          style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
        >
          {event.timestamp}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MonitorB3(): React.JSX.Element {
  const [isPaused, setIsPaused] = useState(false)
  const [now, setNow] = useState(new Date())
  // Session start kept for potential future use
  // const [sessionStart] = useState(() => new Date())

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

  // --- Connection status based on mode ---
  const isConnected = mode === 'cloud' ? cloudConnected : watcherRunning

  // --- Clock tick ---
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // --- Auto-refresh: poll queue + health every 5s ---
  useEffect(() => {
    // Initial fetch
    refreshQueue()
    refreshHealth()

    if (isPaused) return

    const id = setInterval(() => {
      refreshQueue()
      refreshHealth()
    }, 5000)
    return () => clearInterval(id)
  }, [isPaused, refreshQueue, refreshHealth])

  // --- Subscribe to real-time printer events ---
  useEffect(() => {
    const unsubscribe = subscribeToEvents()
    return unsubscribe
  }, [subscribeToEvents])

  // --- Map queue jobs from store to component format ---
  const mappedJobs: PrintJob[] = queue.map((job) => {
    const mappedStatus = mapJobStatus(job.status)
    // For printing jobs, show an indeterminate progress since API doesn't provide percentage
    // TODO: wire real progress when API supports per-job progress reporting
    const progress = mappedStatus === 'printing' ? 50 : mappedStatus === 'complete' ? 100 : mappedStatus === 'error' ? 0 : 0
    return {
      id: job.id,
      filename: job.filename,
      printer: job.printerName || '--',
      status: mappedStatus,
      progress,
      timestamp: formatTime(job.createdAt),
      size: job.options.paperSize ?? '4x6', // TODO: wire when API provides actual paper size info
      elapsed: formatElapsed(job.startedAt, job.completedAt),
    }
  })

  // --- Map printer health from store, filtered to pool only ---
  const pool = useSettings((s) => s.printerPool)
  const healthPrinters = (health?.printers ?? []).filter(
    (p) => pool.length === 0 || pool.includes(p.name)
  )
  const mappedPrinters: PrinterInfo[] = healthPrinters
    .filter((p) => mapPrinterStatus(p.status) !== 'offline') // Hide truly offline printers
    .map((p, idx) => {
      // Find if this printer has an active job in the queue
      const activeJob = queue.find((j) => j.printerName === p.name && j.status === 'printing')
      return {
        id: `printer-${idx}`,
        name: p.displayName || p.name,
        model: p.name, // API doesn't provide separate model field; use name
        status: mapPrinterStatus(p.status),
        jobsPrinted: 0, // TODO: wire when API supports per-printer job count
        currentJob: activeJob?.filename ?? null,
        avgPrintTime: '--:--', // TODO: wire when API supports avg print time
      }
    })

  // --- Derive activity feed from gallery photos ---
  const activityEvents = deriveActivityFromPhotos(photos)

  // --- Handle cancel ---
  const handleCancel = useCallback(
    (jobId: string) => {
      cancelJob(jobId)
    },
    [cancelJob]
  )

  // --- Handle retry: clear old job, resubmit the file ---
  const clearFinished = usePrinter((s) => s.clearFinished)
  const handleRetry = useCallback(
    async (jobId: string) => {
      const job = queue.find((j) => j.id === jobId)
      if (!job) return
      // Clear finished/failed jobs first to clean up the queue
      await clearFinished()
      // Resubmit
      await submitJob(job.filename, job.filepath, job.options as Record<string, unknown>)
    },
    [queue, submitJob, clearFinished]
  )

  // --- Computed stats ---
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
    <div
      className="flex h-full flex-col bg-background"
      style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
    >
      {/* Disconnection banner */}
      {!isConnected && (
        <div className="flex items-center justify-center gap-2 bg-red-500/10 border-b border-red-500/20 px-4 py-3 text-sm text-red-400">
          <WifiOff className="h-4 w-4" />
          <span className="font-medium">Connection lost.</span>
          <span className="text-red-400/70">Attempting to reconnect...</span>
          <button
            type="button"
            className="ml-3 rounded-full bg-red-500/15 px-4 py-1 text-xs font-semibold transition-all duration-300 hover:bg-red-500/25"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-8 py-8 space-y-8">

          {/* -- Top bar: title + controls -- */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-foreground tracking-tight">Live Monitor</h2>
                <PulseDot color="bg-emerald-500" size="md" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {onlinePrinters} of {totalPrinters} printers online &middot; {printingCount} active, {queuedCount} queued
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Live clock */}
              <div className="flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span
                  className="text-xs font-medium text-foreground tabular-nums"
                  style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                >
                  {clockStr}
                </span>
              </div>

              {/* Pause toggle */}
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-semibold',
                  'transition-all duration-300 hover:scale-[1.01]',
                  isPaused
                    ? 'border-[#c57d3c]/30 bg-[#c57d3c]/10 text-[#c57d3c] shadow-sm'
                    : 'border-border bg-card text-muted-foreground shadow-sm hover:text-foreground'
                )}
              >
                {isPaused ? (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </>
                )}
              </button>

            </div>
          </div>

          {/* -- Hero stat cards -- */}
          <div className="grid grid-cols-2 gap-5">
            <HeroStat
              label="Photos Printed"
              value={completedCount}
              sub={`${failedCount} failed out of ${totalCount} total`}
              icon={Images}
              glow
            />
            <HeroStat
              label="Queue Depth"
              value={queueDepth}
              sub={`${printingCount} printing, ${queuedCount} waiting`}
              icon={Layers}
            />
          </div>

          {/* -- Last image preview -- */}
          {lastPhoto && <LastImagePreview photo={lastPhoto} />}

          {/* -- Main grid: Queue cards (left) + Activity (right) */}
          <div className="grid grid-cols-[1fr_340px] gap-8">

            {/* Print Queue -- cards layout */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-foreground">Print Queue</h3>
                  <span
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                    style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                  >
                    {mappedJobs.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Activity className="h-3 w-3" />
                  <span>Live</span>
                </div>
              </div>

              <div className="space-y-3">
                {mappedJobs.length > 0 ? (
                  mappedJobs.map((job) => (
                    <QueueCard key={job.id} job={job} onCancel={handleCancel} onRetry={handleRetry} />
                  ))
                ) : (
                  <div className="rounded-2xl bg-card p-8 shadow-sm text-center">
                    <FileImage className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-muted-foreground">No jobs in the queue</p>
                    <p className="text-xs text-muted-foreground mt-1">Jobs will appear here when photos are submitted for printing</p>
                  </div>
                )}
              </div>
            </section>

            {/* Activity Feed */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Activity</h3>
                <span
                  className="text-[11px] text-muted-foreground"
                  style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                >
                  Latest
                </span>
              </div>

              <div className="rounded-2xl bg-card p-2 shadow-sm">
                {activityEvents.length > 0 ? (
                  activityEvents.map((event, i) => (
                    <ActivityItem
                      key={event.id}
                      event={event}
                      isLast={i === activityEvents.length - 1}
                      isEven={i % 2 === 0}
                    />
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <Activity className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-xs text-muted-foreground">No activity yet</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Events will appear here as photos are processed</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* -- Printer Status Cards -- */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-foreground">Printers</h3>
                <span
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                  style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                >
                  {onlinePrinters}/{totalPrinters}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="text-[#c57d3c]"
                  style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                >
                  {completedCount} total prints
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-5">
              {mappedPrinters.length > 0 ? (
                mappedPrinters.map((printer) => (
                  <PrinterCard key={printer.id} printer={printer} />
                ))
              ) : (
                <div className="col-span-3 rounded-2xl bg-card p-8 shadow-sm text-center">
                  <Printer className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-muted-foreground">No printers detected</p>
                  <p className="text-xs text-muted-foreground mt-1">Printers will appear here once discovered by the health monitor</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
