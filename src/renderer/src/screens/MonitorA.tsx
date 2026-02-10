import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Printer,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  HardDrive,
  ArrowUpRight,
  Image
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PrintJobStatus = 'printing' | 'queued' | 'complete' | 'error'
type PrinterStatus = 'online' | 'offline' | 'busy'
type EventType = 'print_complete' | 'print_error' | 'printer_online' | 'printer_offline' | 'new_photo' | 'queue_cleared'

interface PrintJob {
  id: string
  filename: string
  printer: string
  status: PrintJobStatus
  time: string
  copies: number
}

interface PrinterHealth {
  id: string
  name: string
  status: PrinterStatus
  jobsInQueue: number
  paperRemaining: number
  temperature: string
}

interface ActivityEvent {
  id: string
  type: EventType
  message: string
  time: string
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_JOBS: PrintJob[] = [
  { id: 'j1', filename: 'IMG_4821.jpg', printer: 'Canon SELPHY CP1500', status: 'printing', time: '12:04:32', copies: 1 },
  { id: 'j2', filename: 'IMG_4820.jpg', printer: 'DNP DS620A', status: 'printing', time: '12:04:28', copies: 2 },
  { id: 'j3', filename: 'IMG_4819.jpg', printer: 'Canon SELPHY CP1500', status: 'queued', time: '12:04:15', copies: 1 },
  { id: 'j4', filename: 'IMG_4818.jpg', printer: 'DNP DS620A', status: 'queued', time: '12:04:10', copies: 1 },
  { id: 'j5', filename: 'IMG_4817.jpg', printer: 'Canon SELPHY CP1500', status: 'queued', time: '12:03:58', copies: 1 },
  { id: 'j6', filename: 'IMG_4816.jpg', printer: 'DNP DS620A', status: 'complete', time: '12:03:44', copies: 1 },
  { id: 'j7', filename: 'IMG_4815.jpg', printer: 'Canon SELPHY CP1500', status: 'complete', time: '12:03:30', copies: 1 },
  { id: 'j8', filename: 'IMG_4814.jpg', printer: 'DNP DS620A', status: 'error', time: '12:03:12', copies: 1 }
]

const MOCK_PRINTERS: PrinterHealth[] = [
  { id: 'p1', name: 'Canon SELPHY CP1500', status: 'online', jobsInQueue: 3, paperRemaining: 82, temperature: 'Normal' },
  { id: 'p2', name: 'DNP DS620A', status: 'busy', jobsInQueue: 2, paperRemaining: 45, temperature: 'Normal' },
  { id: 'p3', name: 'Epson SureColor P700', status: 'offline', jobsInQueue: 0, paperRemaining: 100, temperature: '--' }
]

const MOCK_EVENTS: ActivityEvent[] = [
  { id: 'e1', type: 'print_complete', message: 'IMG_4816.jpg printed on DNP DS620A', time: '12:03:44' },
  { id: 'e2', type: 'print_complete', message: 'IMG_4815.jpg printed on Canon SELPHY CP1500', time: '12:03:30' },
  { id: 'e3', type: 'print_error', message: 'IMG_4814.jpg failed on DNP DS620A -- paper jam', time: '12:03:12' },
  { id: 'e4', type: 'new_photo', message: 'New photo detected: IMG_4821.jpg', time: '12:04:30' },
  { id: 'e5', type: 'new_photo', message: 'New photo detected: IMG_4820.jpg', time: '12:04:25' },
  { id: 'e6', type: 'printer_online', message: 'Canon SELPHY CP1500 came online', time: '11:58:00' },
  { id: 'e7', type: 'printer_online', message: 'DNP DS620A came online', time: '11:58:05' },
  { id: 'e8', type: 'printer_offline', message: 'Epson SureColor P700 went offline', time: '12:01:22' },
  { id: 'e9', type: 'print_complete', message: 'IMG_4813.jpg printed on Canon SELPHY CP1500', time: '12:02:50' },
  { id: 'e10', type: 'print_complete', message: 'IMG_4812.jpg printed on DNP DS620A', time: '12:02:31' },
  { id: 'e11', type: 'new_photo', message: 'New photo detected: IMG_4819.jpg', time: '12:04:10' },
  { id: 'e12', type: 'print_complete', message: 'IMG_4811.jpg printed on Canon SELPHY CP1500', time: '12:01:55' },
  { id: 'e13', type: 'print_complete', message: 'IMG_4810.jpg printed on DNP DS620A', time: '12:01:30' },
  { id: 'e14', type: 'queue_cleared', message: 'Morning queue cleared (24 photos)', time: '11:45:00' },
  { id: 'e15', type: 'new_photo', message: 'New photo detected: IMG_4818.jpg', time: '12:04:05' }
]

// Sort events newest first
const SORTED_EVENTS = [...MOCK_EVENTS].sort((a, b) => b.time.localeCompare(a.time))

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
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', colors[status])}
      aria-label={status}
    />
  )
}

function JobStatusBadge({ status }: { status: PrintJobStatus }): React.JSX.Element {
  const config: Record<PrintJobStatus, { icon: React.JSX.Element; label: string; className: string }> = {
    printing: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Printing',
      className: 'text-blue-400 bg-blue-500/10'
    },
    queued: {
      icon: <Clock className="h-3 w-3" />,
      label: 'Queued',
      className: 'text-muted-foreground bg-secondary/50'
    },
    complete: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: 'Done',
      className: 'text-emerald-400 bg-emerald-500/10'
    },
    error: {
      icon: <XCircle className="h-3 w-3" />,
      label: 'Error',
      className: 'text-red-400 bg-red-500/10'
    }
  }
  const c = config[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium', c.className)}>
      {c.icon}
      {c.label}
    </span>
  )
}

function EventIcon({ type }: { type: EventType }): React.JSX.Element {
  const icons: Record<EventType, React.JSX.Element> = {
    print_complete: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
    print_error: <XCircle className="h-3 w-3 text-red-400" />,
    printer_online: <ArrowUpRight className="h-3 w-3 text-emerald-400" />,
    printer_offline: <AlertTriangle className="h-3 w-3 text-amber-400" />,
    new_photo: <Image className="h-3 w-3 text-blue-400" />,
    queue_cleared: <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
  }
  return icons[type]
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  )
}

function StatCard({
  label,
  value,
  sub
}: {
  label: string
  value: string
  sub?: string
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold leading-tight text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MonitorA(): React.JSX.Element {
  const [tick, setTick] = useState(0)

  // Auto-refresh timer simulation
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2000)
    return () => clearInterval(interval)
  }, [])

  const activeJobs = MOCK_JOBS.filter((j) => j.status === 'printing' || j.status === 'queued')

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground">Monitor</h1>
          <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2 py-1">
            <HardDrive className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Local Mode</span>
            <StatusDot status="online" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className={cn('inline-block h-1.5 w-1.5 rounded-full bg-emerald-500', tick % 2 === 0 && 'opacity-50')} />
          <span>Auto-refresh</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5">
          {/* Stats row */}
          <div className="mb-5 grid grid-cols-4 gap-3">
            <StatCard label="Photos Today" value="147" sub="+12 this hour" />
            <StatCard label="Success Rate" value="98.6%" sub="145 / 147" />
            <StatCard label="Avg Print Time" value="8.2s" sub="last 50 jobs" />
            <StatCard label="Queue Depth" value={String(activeJobs.length)} sub="2 printers active" />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-3 gap-5">
            {/* Left: Print Queue (2 cols wide) */}
            <div className="col-span-2 space-y-5">
              {/* Active Queue */}
              <section>
                <SectionLabel>Print Queue</SectionLabel>
                <div className="overflow-hidden rounded-lg border border-border">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_1fr_100px_70px_50px] gap-2 border-b border-border bg-secondary/30 px-3 py-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">File</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Printer</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Time</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-right">Qty</span>
                  </div>
                  {/* Table rows */}
                  {MOCK_JOBS.map((job) => (
                    <div
                      key={job.id}
                      className="grid grid-cols-[1fr_1fr_100px_70px_50px] gap-2 border-b border-border/50 px-3 py-1.5 last:border-b-0 hover:bg-secondary/20 transition-colors"
                    >
                      <span className="truncate font-mono text-xs text-foreground">{job.filename}</span>
                      <span className="truncate text-xs text-muted-foreground">{job.printer}</span>
                      <JobStatusBadge status={job.status} />
                      <span className="font-mono text-[11px] text-muted-foreground">{job.time}</span>
                      <span className="text-right font-mono text-[11px] text-muted-foreground">{job.copies}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Activity Feed */}
              <section>
                <SectionLabel>Recent Activity</SectionLabel>
                <div className="max-h-[260px] overflow-y-auto rounded-lg border border-border">
                  {SORTED_EVENTS.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 last:border-b-0"
                    >
                      <EventIcon type={event.type} />
                      <span className="flex-1 truncate text-xs text-foreground/80">{event.message}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{event.time}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right: Printer Health (1 col) */}
            <div>
              <SectionLabel>Printer Health</SectionLabel>
              <div className="space-y-2">
                {MOCK_PRINTERS.map((printer) => (
                  <div
                    key={printer.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={printer.status} />
                      <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate text-xs font-medium text-foreground">
                        {printer.name}
                      </span>
                    </div>
                    <div className="mt-2.5 space-y-1.5">
                      {/* Jobs in queue */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Jobs</span>
                        <span className="font-mono text-[11px] text-foreground">{printer.jobsInQueue}</span>
                      </div>
                      {/* Paper remaining */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Paper</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                printer.paperRemaining > 50
                                  ? 'bg-emerald-500'
                                  : printer.paperRemaining > 20
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                              )}
                              style={{ width: `${printer.paperRemaining}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {printer.paperRemaining}%
                          </span>
                        </div>
                      </div>
                      {/* Temperature */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Temp</span>
                        <span className="text-[11px] text-foreground">{printer.temperature}</span>
                      </div>
                    </div>
                    {/* Status badge */}
                    <div className="mt-2.5 flex">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                          printer.status === 'online' && 'bg-emerald-500/10 text-emerald-400',
                          printer.status === 'busy' && 'bg-amber-500/10 text-amber-400',
                          printer.status === 'offline' && 'bg-secondary text-muted-foreground'
                        )}
                      >
                        {printer.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
