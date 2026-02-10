import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
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
  Timer,
  Activity,
  Zap,
  CircleDot,
  Layers,
  TrendingUp,
  Droplets,
  FileImage,
  Ban,
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
  paperRemaining: number
  paperType: string
  inkLevel: number
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
// Mock data
// ---------------------------------------------------------------------------

const mockJobs: PrintJob[] = [
  {
    id: 'j1',
    filename: 'IMG_4821.jpg',
    printer: 'Canon SELPHY CP1500',
    status: 'printing',
    progress: 67,
    timestamp: '12:04:32 PM',
    size: '4x6',
    elapsed: '0:23',
  },
  {
    id: 'j2',
    filename: 'IMG_4822.jpg',
    printer: 'DNP DS620A',
    status: 'printing',
    progress: 31,
    timestamp: '12:04:28 PM',
    size: '4x6',
    elapsed: '0:11',
  },
  {
    id: 'j3',
    filename: 'IMG_4823.jpg',
    printer: '--',
    status: 'queued',
    progress: 0,
    timestamp: '12:04:25 PM',
    size: '4x6',
  },
  {
    id: 'j4',
    filename: 'IMG_4824.jpg',
    printer: '--',
    status: 'queued',
    progress: 0,
    timestamp: '12:04:22 PM',
    size: '5x7',
  },
  {
    id: 'j5',
    filename: 'IMG_4819.jpg',
    printer: 'Canon SELPHY CP1500',
    status: 'complete',
    progress: 100,
    timestamp: '12:03:58 PM',
    size: '4x6',
    elapsed: '0:38',
  },
  {
    id: 'j6',
    filename: 'IMG_4818.jpg',
    printer: 'DNP DS620A',
    status: 'error',
    progress: 45,
    timestamp: '12:03:41 PM',
    size: '4x6',
    elapsed: '0:12',
  },
]

const mockPrinters: PrinterInfo[] = [
  {
    id: 'p1',
    name: 'Canon SELPHY',
    model: 'CP1500',
    status: 'online',
    jobsPrinted: 84,
    paperRemaining: 142,
    paperType: '4x6 Glossy',
    inkLevel: 72,
    currentJob: 'IMG_4821.jpg',
    avgPrintTime: '0:38',
  },
  {
    id: 'p2',
    name: 'DNP',
    model: 'DS620A',
    status: 'online',
    jobsPrinted: 97,
    paperRemaining: 89,
    paperType: '4x6 Matte',
    inkLevel: 54,
    currentJob: 'IMG_4822.jpg',
    avgPrintTime: '0:42',
  },
  {
    id: 'p3',
    name: 'Mitsubishi',
    model: 'CP-D90DW',
    status: 'warning',
    jobsPrinted: 41,
    paperRemaining: 12,
    paperType: '5x7 Glossy',
    inkLevel: 88,
    currentJob: null,
    avgPrintTime: '0:51',
  },
]

const mockActivity: ActivityEvent[] = [
  { id: 'a1', type: 'print', message: 'IMG_4820.jpg printed successfully', timestamp: '12:04:01 PM' },
  { id: 'a2', type: 'error', message: 'IMG_4818.jpg failed -- paper jam on DNP DS620A', timestamp: '12:03:41 PM' },
  { id: 'a3', type: 'queue', message: 'IMG_4824.jpg added to queue (5x7)', timestamp: '12:03:30 PM' },
  { id: 'a4', type: 'print', message: 'IMG_4817.jpg printed successfully', timestamp: '12:03:15 PM' },
  { id: 'a5', type: 'warning', message: 'Mitsubishi CP-D90DW paper low (12 sheets)', timestamp: '12:02:48 PM' },
  { id: 'a6', type: 'print', message: 'IMG_4816.jpg printed successfully', timestamp: '12:02:31 PM' },
  { id: 'a7', type: 'queue', message: 'IMG_4823.jpg added to queue (4x6)', timestamp: '12:02:20 PM' },
  { id: 'a8', type: 'print', message: 'IMG_4815.jpg printed on Canon SELPHY', timestamp: '12:01:55 PM' },
  { id: 'a9', type: 'connect', message: 'DNP DS620A reconnected', timestamp: '12:01:30 PM' },
  { id: 'a10', type: 'print', message: 'IMG_4814.jpg printed successfully', timestamp: '12:01:12 PM' },
]

// ---------------------------------------------------------------------------
// Animated counter -- numbers tick up on mount
// ---------------------------------------------------------------------------

function useAnimatedValue(target: number, duration = 1100): number {
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
// Section divider -- editorial gradient line
// ---------------------------------------------------------------------------

function SectionDivider(): React.JSX.Element {
  return (
    <div className="py-1">
      <div
        className="h-px w-full"
        style={{
          background: 'linear-gradient(90deg, var(--amber), transparent 70%)',
          opacity: 0.3,
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pulsing dot
// ---------------------------------------------------------------------------

function PulseDot({ color = 'bg-emerald-500', size = 'sm' }: { color?: string; size?: 'sm' | 'md' }): React.JSX.Element {
  const px = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2'
  const ring = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={cn('absolute inline-flex rounded-full opacity-30 animate-ping', color, ring)} />
      <span className={cn('relative inline-flex rounded-full', color, px)} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Level gauge
// ---------------------------------------------------------------------------

function LevelGauge({
  value,
  label,
  icon: Icon,
  warn = 20,
}: {
  value: number
  label: string
  icon: React.ComponentType<{ className?: string }>
  warn?: number
}): React.JSX.Element {
  const isLow = value <= warn
  return (
    <div className="flex items-center gap-3">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', isLow ? 'text-amber-accent' : 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground tracking-wide">{label}</span>
          <span
            className={cn('text-[11px] font-medium', isLow ? 'text-amber-accent' : 'text-foreground')}
            style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
          >
            {value}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              isLow ? 'bg-amber-accent' : 'bg-emerald-500/70'
            )}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero stat card -- warm editorial numbers with glow
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
        'group relative flex flex-col rounded-2xl border bg-card p-6 transition-all duration-300',
        glow
          ? 'border-t-2 overflow-hidden'
          : 'border-border hover:border-border/80',
      )}
      style={glow ? { borderTopColor: 'var(--amber)', borderLeftColor: 'var(--border-color)', borderRightColor: 'var(--border-color)', borderBottomColor: 'var(--border-color)' } : undefined}
    >
      {/* Warm glow behind numbers */}
      {glow && (
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 h-24 w-32 rounded-full blur-3xl transition-opacity duration-700 group-hover:opacity-100"
          style={{ background: 'var(--amber)', opacity: 0.07 }}
        />
      )}

      <div className="flex items-center justify-between relative">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}>
          {label}
        </span>
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-2xl transition-colors duration-200',
          glow ? 'bg-glow text-amber-accent' : 'bg-secondary text-muted-foreground group-hover:text-foreground'
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1 relative">
        <span
          className={cn(
            'text-[44px] font-bold tracking-tighter leading-none',
            glow ? 'text-amber-accent' : 'text-foreground'
          )}
          style={{
            fontFamily: '"Fira Code", ui-monospace, monospace',
            ...(glow ? { textShadow: '0 0 40px var(--amber)' } : {}),
          }}
        >
          {animated}
        </span>
        {suffix && (
          <span
            className={cn(
              'text-xl font-bold tracking-tight',
              glow ? 'text-amber-accent/60' : 'text-muted-foreground'
            )}
            style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
          >
            {suffix}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{sub}</p>
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
      classes: 'text-amber-accent bg-glow border border-amber-accent/20',
      dot: 'bg-amber-accent',
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
// Printer card -- editorial layout
// ---------------------------------------------------------------------------

function PrinterCard({ printer }: { printer: PrinterInfo }): React.JSX.Element {
  const statusColor: Record<PrinterStatus, string> = {
    online: 'text-emerald-500',
    warning: 'text-amber-accent',
    offline: 'text-red-400',
  }
  const statusDot: Record<PrinterStatus, string> = {
    online: 'bg-emerald-500',
    warning: 'bg-amber-accent',
    offline: 'bg-red-400',
  }
  const statusLabel: Record<PrinterStatus, string> = {
    online: 'Online',
    warning: 'Low Paper',
    offline: 'Offline',
  }

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card p-6 transition-all duration-200',
        'hover:border-border/80',
        printer.status === 'warning'
          ? 'border-t-2'
          : 'border-border',
      )}
      style={printer.status === 'warning' ? { borderTopColor: 'var(--amber)', borderLeftColor: 'var(--border-color)', borderRightColor: 'var(--border-color)', borderBottomColor: 'var(--border-color)' } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground truncate" style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}>
            {printer.name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}>
            {printer.model}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {printer.status === 'online' ? (
            <PulseDot color={statusDot[printer.status]} />
          ) : (
            <span className={cn('h-2 w-2 rounded-full', statusDot[printer.status])} />
          )}
          <span className={cn('text-[11px] font-medium tracking-wide', statusColor[printer.status])}>
            {statusLabel[printer.status]}
          </span>
        </div>
      </div>

      {/* Large printed count with warm shadow */}
      <div className="flex items-baseline gap-1.5 mb-5">
        <span
          className="text-[36px] font-bold tracking-tighter text-foreground leading-none"
          style={{
            fontFamily: '"Fira Code", ui-monospace, monospace',
            textShadow: '0 0 30px var(--glow)',
          }}
        >
          {printer.jobsPrinted}
        </span>
        <span className="text-xs text-muted-foreground ml-1 tracking-wide">prints</span>
        <span className="ml-auto text-xs text-muted-foreground" style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}>
          avg {printer.avgPrintTime}
        </span>
      </div>

      {/* Current job */}
      {printer.currentJob ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-glow px-4 py-2.5 mb-5">
          <Loader2 className="h-3.5 w-3.5 text-amber-accent animate-spin" />
          <span className="text-xs font-medium text-amber-accent truncate" style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}>
            {printer.currentJob}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-2xl bg-secondary px-4 py-2.5 mb-5">
          <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Idle -- waiting for jobs</span>
        </div>
      )}

      {/* Paper + ink gauges */}
      <div className="space-y-3">
        <LevelGauge
          value={Math.round((printer.paperRemaining / 200) * 100)}
          label={`Paper (${printer.paperRemaining} sheets)`}
          icon={Layers}
          warn={15}
        />
        <LevelGauge
          value={printer.inkLevel}
          label="Ink"
          icon={Droplets}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity feed item
// ---------------------------------------------------------------------------

function ActivityItem({
  event,
  isLast,
}: {
  event: ActivityEvent
  isLast: boolean
}): React.JSX.Element {
  const iconMap: Record<ActivityEvent['type'], { icon: React.ComponentType<{ className?: string }>; accent: string }> = {
    print: { icon: CheckCircle2, accent: 'text-emerald-500 bg-emerald-500/10' },
    error: { icon: XCircle, accent: 'text-red-400 bg-red-500/10' },
    connect: { icon: Wifi, accent: 'text-blue-400 bg-blue-500/10' },
    queue: { icon: ImagePlus, accent: 'text-foreground bg-secondary' },
    warning: { icon: AlertTriangle, accent: 'text-amber-accent bg-glow' },
  }
  const { icon: Icon, accent } = iconMap[event.type]

  return (
    <div className="flex gap-3.5 group">
      {/* Icon + connector */}
      <div className="flex flex-col items-center">
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-full shrink-0', accent)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        {!isLast && (
          <div
            className="w-px flex-1 mt-1"
            style={{
              background: 'linear-gradient(180deg, var(--border-color), transparent)',
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn('pb-4 min-w-0', isLast && 'pb-0')}>
        <p className="text-xs leading-relaxed text-foreground/90">{event.message}</p>
        <p
          className="mt-0.5 text-[11px] text-muted-foreground"
          style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
        >
          {event.timestamp}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Queue row
// ---------------------------------------------------------------------------

function QueueRow({ job }: { job: PrintJob }): React.JSX.Element {
  const isPrinting = job.status === 'printing'
  const isError = job.status === 'error'
  const isComplete = job.status === 'complete'
  const isQueued = job.status === 'queued'

  return (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-2xl border bg-card px-5 py-4 transition-all duration-200',
        isPrinting && 'border-amber-accent/20 bg-glow/50',
        isError && 'border-red-500/20',
        isComplete && 'border-border opacity-50 hover:opacity-100',
        isQueued && 'border-border',
      )}
    >
      {/* Thumbnail */}
      <div className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
        isPrinting ? 'bg-glow' : 'bg-secondary',
      )}>
        <FileImage className={cn('h-5 w-5', isPrinting ? 'text-amber-accent' : 'text-muted-foreground')} />
      </div>

      {/* Info column */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-medium text-foreground truncate"
            style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
          >
            {job.filename}
          </span>
          <JobBadge status={job.status} />
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          {!isQueued && (
            <span style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}>{job.printer}</span>
          )}
          {isQueued && <span className="tracking-wide">Waiting for assignment</span>}
          <span className="opacity-40">/</span>
          <span>{job.size}</span>
          {job.elapsed && (
            <>
              <span className="opacity-40">/</span>
              <span style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}>{job.elapsed}</span>
            </>
          )}
        </div>

        {/* Progress bar */}
        {(isPrinting || isError) && (
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                isError ? 'bg-red-500' : 'bg-amber-accent',
                isPrinting && 'animate-pulse'
              )}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="shrink-0 w-16 text-right">
        {isPrinting && (
          <span
            className="text-sm font-bold text-amber-accent"
            style={{
              fontFamily: '"Fira Code", ui-monospace, monospace',
              textShadow: '0 0 20px var(--amber)',
            }}
          >
            {job.progress}%
          </span>
        )}
        {isComplete && (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 ml-auto" />
        )}
        {isError && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}
        {isQueued && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground opacity-0 group-hover:opacity-100"
          >
            <Ban className="h-3 w-3" />
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MonitorB2(): React.JSX.Element {
  const [isConnected] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const clockStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const printingCount = mockJobs.filter((j) => j.status === 'printing').length
  const queuedCount = mockJobs.filter((j) => j.status === 'queued').length
  const onlinePrinters = mockPrinters.filter((p) => p.status !== 'offline').length

  return (
    <div className="flex h-full flex-col bg-background" style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}>
      {/* Disconnection banner */}
      {!isConnected && (
        <div className="flex items-center justify-center gap-2 bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 text-sm text-red-400">
          <WifiOff className="h-4 w-4" />
          <span className="font-medium">Connection lost.</span>
          <span className="text-red-400/70">Attempting to reconnect...</span>
          <button
            type="button"
            className="ml-3 rounded-full bg-red-500/15 px-4 py-1 text-xs font-semibold transition-colors hover:bg-red-500/25"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1320px] px-10 py-8 space-y-8">

          {/* Top bar: editorial title + controls */}
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: '"Outfit", system-ui, sans-serif' }}>
                  Live Monitor
                </h2>
                <PulseDot color="bg-emerald-500" size="md" />
              </div>
              <p className="text-[13px] text-muted-foreground mt-1 tracking-wide">
                {onlinePrinters} of {mockPrinters.length} printers online &middot; {printingCount} active, {queuedCount} queued
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Live clock */}
              <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-2.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span
                  className="text-xs font-medium text-foreground tabular-nums"
                  style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
                >
                  {clockStr}
                </span>
              </div>

              {/* Pause toggle */}
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className={cn(
                  'inline-flex items-center gap-2.5 rounded-2xl border px-5 py-2.5 text-xs font-semibold tracking-wide transition-all duration-200',
                  isPaused
                    ? 'border-amber-accent/30 bg-glow text-amber-accent hover:bg-amber-accent/15'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80'
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

          {/* Hero stat cards */}
          <div className="grid grid-cols-4 gap-5">
            <HeroStat
              label="Photos Printed"
              value={222}
              sub="+18 in the last hour"
              icon={Images}
              glow
            />
            <HeroStat
              label="Queue Depth"
              value={4}
              sub={`${printingCount} printing, ${queuedCount} waiting`}
              icon={Layers}
            />
            <HeroStat
              label="Success Rate"
              value={98}
              suffix=".2%"
              sub="4 failures total"
              icon={TrendingUp}
            />
            <HeroStat
              label="Session Uptime"
              value={222}
              suffix="m"
              sub="Started at 8:22 AM"
              icon={Timer}
            />
          </div>

          <SectionDivider />

          {/* Main grid: Queue (left) + Activity (right) */}
          <div className="grid grid-cols-[1fr_340px] gap-8">

            {/* Print Queue */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-foreground tracking-tight">Print Queue</h3>
                  <span
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                    style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
                  >
                    {mockJobs.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tracking-wide">
                  <Activity className="h-3 w-3" />
                  <span>Live</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {mockJobs.map((job) => (
                  <QueueRow key={job.id} job={job} />
                ))}
              </div>
            </section>

            {/* Activity Feed */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground tracking-tight">Activity</h3>
                <span
                  className="text-[11px] text-muted-foreground tracking-wide"
                  style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
                >
                  Latest
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                {mockActivity.map((event, i) => (
                  <ActivityItem
                    key={event.id}
                    event={event}
                    isLast={i === mockActivity.length - 1}
                  />
                ))}
              </div>
            </section>
          </div>

          <SectionDivider />

          {/* Printer Status Cards */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-foreground tracking-tight">Printers</h3>
                <span
                  className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                  style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}
                >
                  {onlinePrinters}/{mockPrinters.length}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Zap className="h-3 w-3 text-amber-accent" />
                <span style={{ fontFamily: '"Fira Code", ui-monospace, monospace' }}>
                  {mockPrinters.reduce((sum, p) => sum + p.jobsPrinted, 0)} total prints
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-5">
              {mockPrinters.map((printer) => (
                <PrinterCard key={printer.id} printer={printer} />
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
