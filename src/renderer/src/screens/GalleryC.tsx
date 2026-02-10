import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Search,
  Image,
  Trash2,
  Printer,
  Download,
  RotateCcw,
  ChevronDown
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GalleryFile {
  id: string
  filename: string
  size: string
  sizeBytes: number
  status: 'printed' | 'queued' | 'error' | 'pending'
  date: string
  dateSort: number
  dimensions: string
  colorSpace: string
}

type StatusFilter = 'all' | GalleryFile['status']

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const FILES: GalleryFile[] = [
  { id: 'f1', filename: 'IMG_4521.jpg', size: '4.2 MB', sizeBytes: 4200000, status: 'printed', date: '2025-01-18 14:32', dateSort: 1737213120, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f2', filename: 'IMG_4520.jpg', size: '4.0 MB', sizeBytes: 4000000, status: 'printed', date: '2025-01-18 14:31', dateSort: 1737213060, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f3', filename: 'IMG_4519.jpg', size: '3.9 MB', sizeBytes: 3900000, status: 'printed', date: '2025-01-18 14:30', dateSort: 1737213000, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f4', filename: 'IMG_4518.jpg', size: '3.8 MB', sizeBytes: 3800000, status: 'queued', date: '2025-01-18 14:29', dateSort: 1737212940, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f5', filename: 'IMG_4522.png', size: '6.1 MB', sizeBytes: 6100000, status: 'queued', date: '2025-01-18 14:28', dateSort: 1737212880, dimensions: '5000x7500', colorSpace: 'Adobe RGB' },
  { id: 'f6', filename: 'IMG_4516.png', size: '7.1 MB', sizeBytes: 7100000, status: 'error', date: '2025-01-18 14:27', dateSort: 1737212820, dimensions: '5000x7500', colorSpace: 'Adobe RGB' },
  { id: 'f7', filename: 'IMG_4517.jpg', size: '3.6 MB', sizeBytes: 3600000, status: 'printed', date: '2025-01-18 14:26', dateSort: 1737212760, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f8', filename: 'IMG_4515.jpg', size: '5.2 MB', sizeBytes: 5200000, status: 'printed', date: '2025-01-18 14:25', dateSort: 1737212700, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f9', filename: 'IMG_4514.jpg', size: '4.3 MB', sizeBytes: 4300000, status: 'printed', date: '2025-01-18 14:24', dateSort: 1737212640, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f10', filename: 'IMG_4513.jpg', size: '3.7 MB', sizeBytes: 3700000, status: 'printed', date: '2025-01-18 14:23', dateSort: 1737212580, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f11', filename: 'IMG_4512.jpg', size: '4.1 MB', sizeBytes: 4100000, status: 'pending', date: '2025-01-18 14:22', dateSort: 1737212520, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f12', filename: 'IMG_4511.jpg', size: '3.5 MB', sizeBytes: 3500000, status: 'pending', date: '2025-01-18 14:21', dateSort: 1737212460, dimensions: '4000x6000', colorSpace: 'sRGB' },
  { id: 'f13', filename: 'IMG_4510.jpg', size: '4.8 MB', sizeBytes: 4800000, status: 'pending', date: '2025-01-18 14:20', dateSort: 1737212400, dimensions: '4000x6000', colorSpace: 'sRGB' }
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileStatusColor(s: GalleryFile['status']): string {
  switch (s) {
    case 'printed':
      return 'text-emerald-400'
    case 'queued':
      return 'text-amber-400'
    case 'error':
      return 'text-red-400'
    case 'pending':
      return 'text-zinc-500'
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Toolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  total,
  filtered
}: {
  search: string
  onSearchChange: (v: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (v: StatusFilter) => void
  total: number
  filtered: number
}) {
  const statuses: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'printed', label: 'Printed' },
    { value: 'queued', label: 'Queued' },
    { value: 'error', label: 'Error' },
    { value: 'pending', label: 'Pending' }
  ]

  return (
    <div className="flex items-center gap-3 border-b border-zinc-800 px-3 py-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter files..."
          className={cn(
            'h-7 w-48 rounded border border-zinc-700 bg-zinc-900 pl-7 pr-2 text-xs text-foreground',
            'outline-none transition-colors placeholder:text-zinc-600',
            'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
          )}
        />
      </div>

      {/* Status filter */}
      <div className="relative">
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          className={cn(
            'h-7 appearance-none rounded border border-zinc-700 bg-zinc-900 pl-2 pr-7 text-xs text-foreground',
            'outline-none transition-colors',
            'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
          )}
        >
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500" />
      </div>

      {/* Count */}
      <span className="text-[11px] text-zinc-600">
        <span className="font-mono text-zinc-400">{filtered}</span> / {total} files
      </span>
    </div>
  )
}

function FileBrowser({
  files,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect
}: {
  files: GalleryFile[]
  selectedId: string | null
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onToggleSelect: (id: string) => void
}) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-zinc-900">
            <th className="w-7 border-b border-zinc-800 px-2 py-1.5" />
            <th className="w-8 border-b border-zinc-800 px-1 py-1.5" />
            <th className="border-b border-zinc-800 px-3 py-1.5 text-left font-medium text-zinc-500">
              Filename
            </th>
            <th className="w-20 border-b border-zinc-800 px-3 py-1.5 text-right font-medium text-zinc-500">
              Size
            </th>
            <th className="w-16 border-b border-zinc-800 px-3 py-1.5 text-left font-medium text-zinc-500">
              Status
            </th>
            <th className="w-36 border-b border-zinc-800 px-3 py-1.5 text-left font-medium text-zinc-500">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => {
            const isSelected = selectedId === f.id
            const isMultiSelected = selectedIds.has(f.id)
            return (
              <tr
                key={f.id}
                onClick={() => onSelect(f.id)}
                className={cn(
                  'cursor-pointer border-b border-zinc-800/40 transition-colors',
                  isSelected
                    ? 'bg-emerald-500/5'
                    : isMultiSelected
                      ? 'bg-zinc-800/40'
                      : 'hover:bg-zinc-900/50'
                )}
              >
                <td className="px-2 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleSelect(f.id)
                    }}
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                      isMultiSelected
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-zinc-700 hover:border-zinc-500'
                    )}
                    aria-label={`Select ${f.filename}`}
                  >
                    {isMultiSelected && (
                      <svg className="h-3 w-3 text-zinc-950" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </td>
                <td className="px-1 py-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-800">
                    <Image className="h-3 w-3 text-zinc-600" />
                  </div>
                </td>
                <td className="px-3 py-1 font-mono text-foreground">{f.filename}</td>
                <td className="px-3 py-1 text-right font-mono text-zinc-500">{f.size}</td>
                <td className={cn('px-3 py-1 font-mono', fileStatusColor(f.status))}>
                  {f.status}
                </td>
                <td className="px-3 py-1 font-mono text-zinc-600">{f.date}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PreviewPanel({ file }: { file: GalleryFile | null }) {
  if (!file) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-zinc-600">
        <Image className="mb-3 h-10 w-10 text-zinc-700" />
        <span className="text-xs">Select a file to preview</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Large preview area */}
      <div className="flex flex-1 items-center justify-center bg-zinc-950 p-4">
        <div className="flex h-full w-full items-center justify-center rounded border border-zinc-800 bg-zinc-900/30">
          <div className="text-center">
            <Image className="mx-auto mb-2 h-12 w-12 text-zinc-700" />
            <span className="font-mono text-xs text-zinc-600">{file.filename}</span>
            <span className="mt-1 block text-[11px] text-zinc-700">{file.dimensions}</span>
          </div>
        </div>
      </div>

      {/* Metadata below */}
      <div className="shrink-0 border-t border-zinc-800 p-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-zinc-600">Filename</span>
            <span className="font-mono text-foreground">{file.filename}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Status</span>
            <span className={cn('font-mono', fileStatusColor(file.status))}>{file.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Size</span>
            <span className="font-mono text-zinc-400">{file.size}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Dimensions</span>
            <span className="font-mono text-zinc-400">{file.dimensions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Color</span>
            <span className="font-mono text-zinc-400">{file.colorSpace}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600">Date</span>
            <span className="font-mono text-zinc-400">{file.date}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function FooterBar({
  selectionCount,
  onPrint,
  onDelete,
  onRetry,
  onExport
}: {
  selectionCount: number
  onPrint: () => void
  onDelete: () => void
  onRetry: () => void
  onExport: () => void
}) {
  const hasSelection = selectionCount > 0

  return (
    <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/30 px-3 py-1.5">
      <div className="flex items-center gap-2 text-[11px]">
        {hasSelection ? (
          <span className="text-zinc-400">
            <span className="font-mono text-emerald-400">{selectionCount}</span> selected
          </span>
        ) : (
          <span className="text-zinc-600">
            No selection
            <span className="ml-2 text-zinc-700">
              Hold Cmd to multi-select
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          disabled={!hasSelection}
          onClick={onPrint}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] transition-colors',
            hasSelection
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
          )}
        >
          <Printer className="h-3 w-3" />
          Print
        </button>
        <button
          disabled={!hasSelection}
          onClick={onRetry}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] transition-colors',
            hasSelection
              ? 'text-zinc-400 hover:bg-zinc-800 hover:text-foreground'
              : 'cursor-not-allowed text-zinc-700'
          )}
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
        <button
          disabled={!hasSelection}
          onClick={onExport}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] transition-colors',
            hasSelection
              ? 'text-zinc-400 hover:bg-zinc-800 hover:text-foreground'
              : 'cursor-not-allowed text-zinc-700'
          )}
        >
          <Download className="h-3 w-3" />
          Export
        </button>
        <button
          disabled={!hasSelection}
          onClick={onDelete}
          className={cn(
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] transition-colors',
            hasSelection
              ? 'text-red-400 hover:bg-red-500/10'
              : 'cursor-not-allowed text-zinc-700'
          )}
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Gallery Screen
// ---------------------------------------------------------------------------

export default function GalleryC() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>('f1')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    return FILES.filter((f) => {
      if (statusFilter !== 'all' && f.status !== statusFilter) return false
      if (search && !f.filename.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [search, statusFilter])

  const selectedFile = FILES.find((f) => f.id === selectedId) ?? null

  function handleSelect(id: string) {
    setSelectedId(id)
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Placeholder batch actions
  const noop = () => {}

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        total={FILES.length}
        filtered={filtered.length}
      />

      {/* Split view: file browser + preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: file browser */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <FileBrowser
            files={filtered}
            selectedId={selectedId}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onToggleSelect={handleToggleSelect}
          />
        </div>

        {/* Right: preview panel */}
        <div className="w-72 shrink-0 border-l border-zinc-800">
          <PreviewPanel file={selectedFile} />
        </div>
      </div>

      {/* Footer */}
      <FooterBar
        selectionCount={selectedIds.size}
        onPrint={noop}
        onDelete={noop}
        onRetry={noop}
        onExport={noop}
      />
    </div>
  )
}
