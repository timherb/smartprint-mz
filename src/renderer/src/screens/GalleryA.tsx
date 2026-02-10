import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Search,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  X,
  Check,
  Clock,
  AlertTriangle,
  Image,
  Printer,
  Download
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PhotoStatus = 'pending' | 'printed' | 'error' | 'printing'
type ViewMode = 'grid' | 'list'
type StatusFilter = 'all' | 'pending' | 'printed' | 'error'

interface Photo {
  id: string
  filename: string
  status: PhotoStatus
  size: string
  dimensions: string
  timestamp: string
  printer?: string
  color: string
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const COLORS = [
  'bg-zinc-700', 'bg-zinc-600', 'bg-zinc-800', 'bg-neutral-700',
  'bg-stone-700', 'bg-neutral-600', 'bg-zinc-700/80', 'bg-stone-600'
]

function generatePhotos(): Photo[] {
  const photos: Photo[] = []
  const statuses: PhotoStatus[] = ['printed', 'printed', 'printed', 'printed', 'printed', 'pending', 'pending', 'error', 'printing']
  const printers = ['Canon SELPHY CP1500', 'DNP DS620A', undefined]

  for (let i = 0; i < 48; i++) {
    const num = 4821 - i
    const status = statuses[i % statuses.length]
    const hour = 12 - Math.floor(i / 6)
    const minute = 59 - ((i * 7) % 60)
    photos.push({
      id: `photo-${i}`,
      filename: `IMG_${num}.jpg`,
      status,
      size: `${(2.1 + Math.random() * 4.2).toFixed(1)} MB`,
      dimensions: '4032 x 3024',
      timestamp: `${String(hour).padStart(2, '0')}:${String(Math.abs(minute)).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}`,
      printer: status === 'printed' || status === 'printing' ? printers[i % 2] : undefined,
      color: COLORS[i % COLORS.length]
    })
  }
  return photos
}

const ALL_PHOTOS = generatePhotos()
const PAGE_SIZE = 24

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PhotoStatus }): React.JSX.Element {
  const config: Record<PhotoStatus, { icon: React.JSX.Element; label: string; className: string }> = {
    printed: {
      icon: <Check className="h-3 w-3" />,
      label: 'Printed',
      className: 'text-emerald-400 bg-emerald-500/10'
    },
    pending: {
      icon: <Clock className="h-3 w-3" />,
      label: 'Pending',
      className: 'text-muted-foreground bg-secondary/50'
    },
    error: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Error',
      className: 'text-red-400 bg-red-500/10'
    },
    printing: {
      icon: <Printer className="h-3 w-3" />,
      label: 'Printing',
      className: 'text-blue-400 bg-blue-500/10'
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GalleryA(): React.JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredPhotos = useMemo(() => {
    return ALL_PHOTOS.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (searchQuery && !p.filename.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [statusFilter, searchQuery])

  const totalPages = Math.ceil(filteredPhotos.length / PAGE_SIZE)
  const pagePhotos = filteredPhotos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const toggleSelect = (id: string): void => {
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

  const clearSelection = (): void => {
    setSelectedIds(new Set())
  }

  const statusCounts = useMemo(() => {
    const counts = { all: ALL_PHOTOS.length, pending: 0, printed: 0, error: 0 }
    for (const p of ALL_PHOTOS) {
      if (p.status === 'pending') counts.pending++
      if (p.status === 'printed') counts.printed++
      if (p.status === 'error') counts.error++
    }
    return counts
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <h1 className="text-sm font-semibold text-foreground">Gallery</h1>
        <span className="text-[11px] text-muted-foreground">
          {filteredPhotos.length} photos
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-2">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search photos..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
            className="w-full rounded-md border border-border bg-secondary/30 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setPage(0) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Status filter pills */}
        <div className="flex rounded-md border border-border bg-secondary/30 p-0.5">
          {(['all', 'pending', 'printed', 'error'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0) }}
              className={cn(
                'rounded-[5px] px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                statusFilter === s
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s}
              <span className="ml-1 text-[10px] opacity-60">{statusCounts[s === 'all' ? 'all' : s] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border" />

        {/* View toggle */}
        <div className="flex rounded-md border border-border bg-secondary/30 p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded-[5px] p-1.5 transition-colors',
              viewMode === 'grid'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="Grid view"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded-[5px] p-1.5 transition-colors',
              viewMode === 'list'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-label="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Batch actions (visible when selection active) */}
        {selectedIds.size > 0 && (
          <>
            <div className="h-5 w-px bg-border" />
            <span className="text-[11px] text-blue-400">{selectedIds.size} selected</span>
            <button
              onClick={() => {/* reprint action */}}
              className="flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary/80 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reprint
            </button>
            <button
              onClick={() => {/* delete action */}}
              className="flex items-center gap-1 rounded-md bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main gallery */}
        <div className="flex-1 overflow-y-auto p-5">
          {viewMode === 'grid' ? (
            /* ---- Grid View ---- */
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
              {pagePhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    toggleSelect(photo.id)
                  }}
                  className={cn(
                    'group relative flex flex-col overflow-hidden rounded-lg border transition-all text-left',
                    selectedIds.has(photo.id)
                      ? 'border-blue-500 ring-1 ring-blue-500/50'
                      : selectedPhoto?.id === photo.id
                        ? 'border-blue-500/50'
                        : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  {/* Thumbnail placeholder */}
                  <div className={cn('flex aspect-[4/3] items-center justify-center', photo.color)}>
                    <Image className="h-6 w-6 text-zinc-500" />
                    {/* Select checkbox overlay */}
                    <div
                      className={cn(
                        'absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border transition-opacity',
                        selectedIds.has(photo.id)
                          ? 'border-blue-500 bg-blue-500 opacity-100'
                          : 'border-white/30 bg-black/30 opacity-0 group-hover:opacity-100'
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(photo.id)
                      }}
                    >
                      {selectedIds.has(photo.id) && <Check className="h-3 w-3 text-white" />}
                    </div>
                    {/* Status indicator */}
                    <div className="absolute bottom-1.5 right-1.5">
                      <span
                        className={cn(
                          'inline-block h-2 w-2 rounded-full',
                          photo.status === 'printed' && 'bg-emerald-500',
                          photo.status === 'pending' && 'bg-zinc-400',
                          photo.status === 'error' && 'bg-red-500',
                          photo.status === 'printing' && 'bg-blue-500'
                        )}
                      />
                    </div>
                  </div>
                  {/* Info */}
                  <div className="bg-card px-2 py-1.5">
                    <p className="truncate font-mono text-[11px] text-foreground">{photo.filename}</p>
                    <p className="text-[10px] text-muted-foreground">{photo.size}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* ---- List View ---- */
            <div className="overflow-hidden rounded-lg border border-border">
              {/* Header */}
              <div className="grid grid-cols-[32px_1fr_100px_80px_80px_100px] gap-2 border-b border-border bg-secondary/30 px-3 py-1.5">
                <span />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Filename</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Size</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Dimensions</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Time</span>
              </div>
              {pagePhotos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className={cn(
                    'grid cursor-pointer grid-cols-[32px_1fr_100px_80px_80px_100px] gap-2 border-b border-border/50 px-3 py-1.5 last:border-b-0 transition-colors',
                    selectedPhoto?.id === photo.id
                      ? 'bg-blue-500/5'
                      : 'hover:bg-secondary/20'
                  )}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSelect(photo.id)
                      }}
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                        selectedIds.has(photo.id)
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      {selectedIds.has(photo.id) && <Check className="h-2.5 w-2.5 text-white" />}
                    </button>
                  </div>
                  <span className="flex items-center truncate font-mono text-xs text-foreground">{photo.filename}</span>
                  <div className="flex items-center">
                    <StatusBadge status={photo.status} />
                  </div>
                  <span className="flex items-center text-xs text-muted-foreground">{photo.size}</span>
                  <span className="flex items-center text-xs text-muted-foreground">{photo.dimensions}</span>
                  <span className="flex items-center font-mono text-[11px] text-muted-foreground">{photo.timestamp}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={cn(
                    'h-7 w-7 rounded-md text-[11px] font-medium transition-colors',
                    page === i
                      ? 'bg-blue-500 text-white'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Detail Panel (slides in from right when photo selected) */}
        {selectedPhoto && (
          <div className="w-72 shrink-0 border-l border-border bg-card overflow-y-auto">
            <div className="p-4">
              {/* Close */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Details</span>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Preview placeholder */}
              <div className={cn('mb-4 flex aspect-[4/3] items-center justify-center rounded-lg', selectedPhoto.color)}>
                <Image className="h-10 w-10 text-zinc-500" />
              </div>

              {/* Meta */}
              <div className="space-y-3">
                <div>
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Filename</span>
                  <span className="mt-0.5 block font-mono text-xs text-foreground">{selectedPhoto.filename}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</span>
                  <div className="mt-1">
                    <StatusBadge status={selectedPhoto.status} />
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">File Size</span>
                  <span className="mt-0.5 block text-xs text-foreground">{selectedPhoto.size}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Dimensions</span>
                  <span className="mt-0.5 block text-xs text-foreground">{selectedPhoto.dimensions}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Timestamp</span>
                  <span className="mt-0.5 block font-mono text-xs text-foreground">{selectedPhoto.timestamp}</span>
                </div>
                {selectedPhoto.printer && (
                  <div>
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Printer</span>
                    <span className="mt-0.5 block text-xs text-foreground">{selectedPhoto.printer}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-5 space-y-1.5">
                <button className="flex w-full items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reprint
                </button>
                <button className="flex w-full items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>
                <button className="flex w-full items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
