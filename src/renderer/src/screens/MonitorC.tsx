import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ArrowUpDown,
  Circle
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrinterStatus {
  id: string
  name: string
  status: 'printing' | 'idle' | 'error' | 'offline'
  currentJob: string | null
  jobsDone: number
  progress: number // 0-100
}

interface QueueItem {
  id: string
  file: string
  printer: string
  status: 'queued' | 'printing' | 'done' | 'error' | 'cancelled'
  duration: string
  size: string
  addedAt: string
}

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

type SortKey = 'id' | 'file' | 'printer' | 'status' | 'duration'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const PRINTERS: PrinterStatus[] = [
  { id: 'p1', name: 'DNP DS620', status: 'printing', currentJob: 'IMG_4521.jpg', jobsDone: 47, progress: 68 },
  { id: 'p2', name: 'DNP DS820', status: 'idle', currentJob: null, jobsDone: 32, progress: 0 },
  { id: 'p3', name: 'HiTi P525L', status: 'printing', currentJob: 'IMG_4518.jpg', jobsDone: 29, progress: 34 },
  { id: 'p4', name: 'Canon CP1500', status: 'error', currentJob: null, jobsDone: 15, progress: 0 },
  { id: 'p5', name: 'Mitsubishi D90', status: 'offline', currentJob: null, jobsDone: 0, progress: 0 }
]

const QUEUE: QueueItem[] = [
  { id: 'Q-0147', file: 'IMG_4521.jpg', printer: 'DNP DS620', status: 'printing', duration: '0:23', size: '4.2 MB', addedAt: '14:32:05' },
  { id: 'Q-0148', file: 'IMG_4518.jpg', printer: 'HiTi P525L', status: 'printing', duration: '0:11', size: '3.8 MB', addedAt: '14:32:12' },
  { id: 'Q-0149', file: 'IMG_4522.png', printer: '--', status: 'queued', duration: '--', size: '6.1 MB', addedAt: '14:32:18' },
  { id: 'Q-0150', file: 'IMG_4523.jpg', printer: '--', status: 'queued', duration: '--', size: '4.5 MB', addedAt: '14:32:20' },
  { id: 'Q-0151', file: 'IMG_4519.jpg', printer: 'DNP DS820', status: 'done', duration: '0:42', size: '3.9 MB', addedAt: '14:31:50' },
  { id: 'Q-0152', file: 'IMG_4520.jpg', printer: 'DNP DS620', status: 'done', duration: '0:38', size: '4.0 MB', addedAt: '14:31:44' },
  { id: 'Q-0153', file: 'IMG_4515.jpg', printer: 'HiTi P525L', status: 'done', duration: '0:45', size: '5.2 MB', addedAt: '14:31:30' },
  { id: 'Q-0154', file: 'IMG_4516.png', printer: 'Canon CP1500', status: 'error', duration: '0:12', size: '7.1 MB', addedAt: '14:31:22' },
  { id: 'Q-0155', file: 'IMG_4517.jpg', printer: 'DNP DS820', status: 'done', duration: '0:40', size: '3.6 MB', addedAt: '14:31:10' },
  { id: 'Q-0156', file: 'IMG_4514.jpg', printer: 'DNP DS620', status: 'done', duration: '0:39', size: '4.3 MB', addedAt: '14:30:55' },
  { id: 'Q-0157', file: 'IMG_4513.jpg', printer: 'HiTi P525L', status: 'done', duration: '0:44', size: '3.7 MB', addedAt: '14:30:42' },
  { id: 'Q-0158', file: 'IMG_4510.jpg', printer: 'DNP DS820', status: 'cancelled', duration: '--', size: '4.8 MB', addedAt: '14:30:30' }
]

const LOG_ENTRIES: LogEntry[] = [
  { id: 'l1', timestamp: '14:32:20', level: 'info', message: 'File queued: IMG_4523.jpg' },
  { id: 'l2', timestamp: '14:32:18', level: 'info', message: 'File queued: IMG_4522.png' },
  { id: 'l3', timestamp: '14:32:12', level: 'info', message: 'Print started: IMG_4518.jpg -> HiTi P525L' },
  { id: 'l4', timestamp: '14:32:05', level: 'info', message: 'Print started: IMG_4521.jpg -> DNP DS620' },
  { id: 'l5', timestamp: '14:31:50', level: 'success', message: 'Print complete: IMG_4519.jpg (0:42)' },
  { id: 'l6', timestamp: '14:31:44', level: 'success', message: 'Print complete: IMG_4520.jpg (0:38)' },
  { id: 'l7', timestamp: '14:31:35', level: 'error', message: 'Printer error: Canon CP1500 - paper jam detected' },
  { id: 'l8', timestamp: '14:31:30', level: 'success', message: 'Print complete: IMG_4515.jpg (0:45)' },
  { id: 'l9', timestamp: '14:31:22', level: 'error', message: 'Print failed: IMG_4516.png -> Canon CP1500' },
  { id: 'l10', timestamp: '14:31:10', level: 'success', message: 'Print complete: IMG_4517.jpg (0:40)' },
  { id: 'l11', timestamp: '14:30:55', level: 'success', message: 'Print complete: IMG_4514.jpg (0:39)' },
  { id: 'l12', timestamp: '14:30:42', level: 'success', message: 'Print complete: IMG_4513.jpg (0:44)' },
  { id: 'l13', timestamp: '14:30:30', level: 'warn', message: 'Job cancelled: IMG_4510.jpg by user' },
  { id: 'l14', timestamp: '14:30:15', level: 'info', message: 'Printer pool updated: 3 active printers' },
  { id: 'l15', timestamp: '14:30:00', level: 'info', message: 'Watch directory scanning: /Volumes/Events/photos' }
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printerStatusColor(s: PrinterStatus['status']): string {
  switch (s) {
    case 'printing':
      return 'text-emerald-400'
    case 'idle':
      return 'text-zinc-400'
    case 'error':
      return 'text-red-400'
    case 'offline':
      return 'text-zinc-600'
  }
}

function printerStatusDot(s: PrinterStatus['status']): string {
  switch (s) {
    case 'printing':
      return 'text-emerald-400'
    case 'idle':
      return 'text-blue-400'
    case 'error':
      return 'text-red-400'
    case 'offline':
      return 'text-zinc-600'
  }
}

function queueStatusColor(s: QueueItem['status']): string {
  switch (s) {
    case 'printing':
      return 'text-emerald-400'
    case 'queued':
      return 'text-amber-400'
    case 'done':
      return 'text-zinc-500'
    case 'error':
      return 'text-red-400'
    case 'cancelled':
      return 'text-zinc-600'
  }
}

function logLevelColor(l: LogEntry['level']): string {
  switch (l) {
    case 'info':
      return 'text-blue-400'
    case 'warn':
      return 'text-amber-400'
    case 'error':
      return 'text-red-400'
    case 'success':
      return 'text-emerald-400'
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricsBar() {
  const queued = QUEUE.filter((q) => q.status === 'queued').length
  const printing = QUEUE.filter((q) => q.status === 'printing').length
  const done = QUEUE.filter((q) => q.status === 'done').length
  const errors = QUEUE.filter((q) => q.status === 'error').length

  const metrics = [
    { label: 'queued', value: queued, color: 'text-amber-400' },
    { label: 'printing', value: printing, color: 'text-emerald-400' },
    { label: 'done', value: done, color: 'text-zinc-400' },
    { label: 'errors', value: errors, color: 'text-red-400' }
  ]

  return (
    <div className="flex items-center gap-1 border-b border-zinc-800 bg-zinc-900/30 px-4 py-2 text-xs">
      {metrics.map((m, i) => (
        <span key={m.label} className="flex items-center">
          {i > 0 && <span className="mx-2 text-zinc-700">|</span>}
          <span className="text-zinc-500">{m.label}:</span>
          <span className={cn('ml-1 font-mono font-medium', m.color)}>{m.value}</span>
        </span>
      ))}
      <span className="ml-auto font-mono text-zinc-600">
        {new Date().toLocaleTimeString('en-US', { hour12: false })}
      </span>
    </div>
  )
}

function PrinterPanel() {
  return (
    <div className="flex h-full flex-col border-r border-zinc-800">
      <div className="border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
          Printers
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {PRINTERS.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              'border-b border-zinc-800/50 px-3 py-2.5',
              i === PRINTERS.length - 1 && 'border-b-0'
            )}
          >
            {/* Name + status */}
            <div className="flex items-center gap-2">
              <Circle
                className={cn('h-2 w-2 fill-current', printerStatusDot(p.status))}
              />
              <span className="flex-1 truncate text-xs font-medium text-foreground">
                {p.name}
              </span>
            </div>

            {/* Status text */}
            <div className="mt-1 pl-4">
              <span className={cn('font-mono text-[11px]', printerStatusColor(p.status))}>
                {p.status}
              </span>
              {p.currentJob && (
                <span className="ml-2 text-[11px] text-zinc-600">
                  {p.currentJob}
                </span>
              )}
            </div>

            {/* Job count */}
            <div className="mt-1 flex items-center gap-2 pl-4">
              <span className="text-[11px] text-zinc-600">
                jobs: <span className="font-mono text-zinc-400">{p.jobsDone}</span>
              </span>
            </div>

            {/* Progress bar (only when printing) */}
            {p.status === 'printing' && (
              <div className="mt-1.5 pl-4">
                <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
                <span className="mt-0.5 block text-right font-mono text-[10px] text-zinc-600">
                  {p.progress}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function QueuePanel() {
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortAsc, setSortAsc] = useState(false)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted = [...QUEUE].sort((a, b) => {
    const va = a[sortKey]
    const vb = b[sortKey]
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return sortAsc ? cmp : -cmp
  })

  const columns: { key: SortKey; label: string; mono?: boolean; width?: string }[] = [
    { key: 'id', label: 'ID', mono: true, width: 'w-20' },
    { key: 'file', label: 'File', mono: true },
    { key: 'printer', label: 'Printer' },
    { key: 'status', label: 'Status', width: 'w-20' },
    { key: 'duration', label: 'Time', mono: true, width: 'w-14' }
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
          Queue
        </span>
        <span className="ml-2 font-mono text-[11px] text-zinc-600">{QUEUE.length}</span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-zinc-900">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'cursor-pointer border-b border-zinc-800 px-3 py-1.5 text-left font-medium text-zinc-500',
                    'select-none transition-colors hover:text-zinc-300',
                    col.width
                  )}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <ArrowUpDown className="h-3 w-3 text-emerald-500" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((q) => (
              <tr
                key={q.id}
                className="border-b border-zinc-800/40 transition-colors hover:bg-zinc-900/50"
              >
                <td className="w-20 px-3 py-1.5 font-mono text-zinc-500">{q.id}</td>
                <td className="max-w-0 truncate px-3 py-1.5 font-mono text-foreground">
                  {q.file}
                </td>
                <td className="px-3 py-1.5 text-zinc-400">{q.printer}</td>
                <td className={cn('w-20 px-3 py-1.5 font-mono', queueStatusColor(q.status))}>
                  {q.status}
                </td>
                <td className="w-14 px-3 py-1.5 font-mono text-zinc-500">{q.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ActivityLog() {
  return (
    <div className="flex h-full flex-col border-l border-zinc-800">
      <div className="border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
          Activity
        </span>
      </div>
      <div className="flex-1 overflow-y-auto bg-zinc-950 p-2 font-mono text-[11px] leading-5">
        {LOG_ENTRIES.map((entry) => (
          <div key={entry.id} className="flex gap-2 hover:bg-zinc-900/50">
            <span className="shrink-0 text-zinc-600">{entry.timestamp}</span>
            <span className={cn('shrink-0 w-12', logLevelColor(entry.level))}>
              {entry.level === 'success' ? 'ok' : entry.level}
            </span>
            <span className="min-w-0 break-words text-zinc-400">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Monitor Screen
// ---------------------------------------------------------------------------

export default function MonitorC() {
  return (
    <div className="flex h-full flex-col">
      {/* Top metrics bar */}
      <MetricsBar />

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Printer status */}
        <div className="w-56 shrink-0">
          <PrinterPanel />
        </div>

        {/* Center: Queue */}
        <div className="flex-1 overflow-hidden">
          <QueuePanel />
        </div>

        {/* Right: Activity log */}
        <div className="w-72 shrink-0">
          <ActivityLog />
        </div>
      </div>
    </div>
  )
}
