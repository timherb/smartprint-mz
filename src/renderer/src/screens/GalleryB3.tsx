import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LocalImage } from '@/components/LocalImage'
import { useGallery, type Photo as StorePhoto } from '@/stores/gallery'
import { usePrinter } from '@/stores/printer'
import { useSettings } from '@/stores/settings'
import {
  Search,
  X,
  ZoomIn,
  Printer,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Grid3X3,
  List,
  SlidersHorizontal,
  Copy,
  CircleDot,
  Aperture,
  Camera,
  LayoutGrid,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarArrowDown,
  CalendarArrowUp,
  FolderOpen,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'grid' | 'list'
type SortMode = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size'

interface DisplayPhoto {
  id: string
  filename: string
  filepath: string
  status: 'printed'
  timestamp: string
  date: string
  size: string
  sizeBytes: number
  printedAt: number
  hue: number
  saturation: number
  lightness: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

/** Generate a stable numeric hash from a string (for thumbnail colors). */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Format byte count to human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** Format a Unix timestamp to a readable time string. */
function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Format a Unix timestamp to a readable date string. */
function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Transform a store Photo into a DisplayPhoto with colors and formatted fields. */
function toDisplayPhoto(photo: StorePhoto): DisplayPhoto {
  const h = hashString(photo.filename)
  // Warm, earthy palette — golden hour tones (matching original design)
  const hueOptions = [15, 25, 35, 190, 210, 160, 340, 30, 45, 200, 170, 20]
  const hue = hueOptions[h % hueOptions.length]
  const saturation = 25 + Math.floor(seededRandom(h) * 35)
  const lightness = 18 + Math.floor(seededRandom(h + 40) * 22)

  return {
    id: photo.id,
    filename: photo.filename,
    filepath: photo.filepath,
    status: photo.status,
    timestamp: formatTime(photo.printedAt),
    date: formatDate(photo.printedAt),
    size: formatBytes(photo.sizeBytes),
    sizeBytes: photo.sizeBytes,
    printedAt: photo.printedAt,
    hue,
    saturation,
    lightness,
  }
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_DOT = { printed: 'bg-emerald-500' } as const
const STATUS_TEXT = { printed: 'text-emerald-500' } as const
const STATUS_LABEL = { printed: 'Printed' } as const

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

function StatChip({
  label,
  count,
  active,
  onClick,
  dotColor,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  dotColor?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium',
        'transition-all duration-300 ease-out hover:scale-[1.01]',
        active
          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
      )}
    >
      {dotColor && <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />}
      <span>{label}</span>
      <span
        className={cn(
          'text-[11px] tabular-nums',
          active ? 'text-foreground' : 'text-muted-foreground/60'
        )}
        style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
      >
        {count}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Photo card — smooth hover scale (the signature detail)
// ---------------------------------------------------------------------------

function PhotoCard({
  photo,
  isSelected,
  batchMode,
  onSelect,
  onClick,
}: {
  photo: DisplayPhoto
  isSelected: boolean
  batchMode: boolean
  onSelect: () => void
  onClick: () => void
}): React.JSX.Element {
  const bgColor = `hsl(${photo.hue}, ${photo.saturation}%, ${photo.lightness}%)`
  const bgColorLight = `hsl(${photo.hue}, ${photo.saturation + 10}%, ${photo.lightness + 8}%)`

  return (
    <button
      type="button"
      onClick={batchMode ? onSelect : onClick}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl text-left',
        'transition-all duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c57d3c] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isSelected && batchMode
          ? 'ring-2 ring-[#c57d3c] ring-offset-2 ring-offset-background scale-[0.97]'
          : 'hover:shadow-xl hover:shadow-black/15 hover:scale-[1.03]'
      )}
    >
      {/* Photo thumbnail with gradient fallback */}
      <div
        className="relative aspect-[3/2] w-full"
        style={{
          background: `linear-gradient(145deg, ${bgColor} 0%, ${bgColorLight} 55%, ${bgColor} 100%)`,
        }}
      >
        {photo.filepath && (
          <LocalImage
            filepath={photo.filepath}
            alt={photo.filename}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      {/* Hover overlay — smooth reveal */}
      <div className={cn(
        'absolute inset-0 flex flex-col justify-end',
        'bg-gradient-to-t from-black/75 via-black/15 to-transparent',
        'opacity-0 transition-opacity duration-300 group-hover:opacity-100',
      )}>
        <div className="p-3.5">
          <p className="truncate text-[13px] font-medium text-white/95">{photo.filename}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[photo.status])} />
            <span className="text-[11px] text-white/60">{STATUS_LABEL[photo.status]}</span>
            <span className="text-white/20">|</span>
            <span
              className="text-[11px] text-white/50"
              style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
            >
              {photo.size}
            </span>
          </div>
        </div>
        {!batchMode && (
          <div className="absolute right-3 top-3 rounded-full bg-black/40 p-2 backdrop-blur-sm">
            <ZoomIn className="h-3.5 w-3.5 text-white/70" />
          </div>
        )}
      </div>

      {/* Batch selection — copper ring indicator */}
      {batchMode && (
        <div className="absolute left-3 top-3 z-10">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300',
              isSelected
                ? 'border-[#c57d3c] bg-[#c57d3c] scale-110 shadow-md shadow-[#c57d3c]/30'
                : 'border-white/40 bg-black/30 backdrop-blur-sm group-hover:border-white/60'
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-white" />}
          </div>
        </div>
      )}

      {/* Status dot (always visible when not batch) */}
      {!batchMode && (
        <div className="absolute bottom-2.5 left-3 group-hover:opacity-0 transition-opacity duration-300">
          <span className={cn('block h-2 w-2 rounded-full', STATUS_DOT[photo.status])} />
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Photo row for list view
// ---------------------------------------------------------------------------

function PhotoRow({
  photo,
  isSelected,
  batchMode,
  onSelect,
  onClick,
}: {
  photo: DisplayPhoto
  isSelected: boolean
  batchMode: boolean
  onSelect: () => void
  onClick: () => void
}): React.JSX.Element {
  const bgColor = `hsl(${photo.hue}, ${photo.saturation}%, ${photo.lightness}%)`
  const bgColorLight = `hsl(${photo.hue}, ${photo.saturation + 10}%, ${photo.lightness + 8}%)`

  return (
    <button
      type="button"
      onClick={batchMode ? onSelect : onClick}
      className={cn(
        'group flex w-full items-center gap-4 rounded-xl px-4 py-2.5 text-left',
        'transition-all duration-300 ease-out',
        isSelected && batchMode
          ? 'bg-[#c57d3c]/8 ring-1 ring-[#c57d3c]/25'
          : 'hover:bg-secondary/40'
      )}
    >
      {/* Selection indicator */}
      {batchMode && (
        <div
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
            isSelected
              ? 'border-[#c57d3c] bg-[#c57d3c]'
              : 'border-border group-hover:border-muted-foreground'
          )}
        >
          {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
        </div>
      )}

      {/* Mini thumbnail */}
      <div
        className="relative h-9 w-14 shrink-0 overflow-hidden rounded-lg"
        style={{
          background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColorLight} 100%)`,
        }}
      >
        {photo.filepath && (
          <LocalImage
            filepath={photo.filepath}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      {/* Filename */}
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
        {photo.filename}
      </span>

      {/* Status */}
      <div className="flex items-center gap-1.5 w-24 shrink-0">
        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[photo.status])} />
        <span className={cn('text-xs', STATUS_TEXT[photo.status])}>
          {STATUS_LABEL[photo.status]}
        </span>
      </div>

      {/* Size */}
      <span
        className="w-20 shrink-0 text-right text-xs text-muted-foreground"
        style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
      >
        {photo.size}
      </span>

      {/* Date */}
      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
        {photo.date}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Detail modal — centered with frosted backdrop
// ---------------------------------------------------------------------------

function DetailModal({
  photo,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onPrint,
}: {
  photo: DisplayPhoto
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  onPrint: () => void
}): React.JSX.Element {
  const bgColor = `hsl(${photo.hue}, ${photo.saturation}%, ${photo.lightness}%)`
  const bgColorLight = `hsl(${photo.hue}, ${photo.saturation + 10}%, ${photo.lightness + 8}%)`

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  const metaRows: { icon: React.ElementType; label: string; value: string; mono?: boolean }[] = [
    { icon: Camera, label: 'Filename', value: photo.filename, mono: true },
    { icon: FolderOpen, label: 'Path', value: photo.filepath, mono: true },
    { icon: Copy, label: 'File Size', value: photo.size, mono: true },
    { icon: Aperture, label: 'Printed At', value: `${photo.date} at ${photo.timestamp}` },
    { icon: CircleDot, label: 'Status', value: STATUS_LABEL[photo.status] },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Frosted backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-2xl"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal content — centered card */}
      <div className="relative z-10 flex w-full max-w-5xl mx-8 rounded-2xl bg-card shadow-2xl shadow-black/30 overflow-hidden">
        {/* Image side */}
        <div className="relative flex-1 flex items-center justify-center p-8 bg-secondary/30">
          {/* Prev */}
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className={cn(
              'absolute left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full',
              'bg-card/80 backdrop-blur-sm text-muted-foreground shadow-sm',
              'transition-all duration-300',
              hasPrev
                ? 'hover:text-foreground hover:shadow-md hover:scale-[1.05]'
                : 'opacity-30 cursor-not-allowed'
            )}
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Image */}
          <div
            className="relative aspect-[3/2] w-full max-w-2xl rounded-2xl overflow-hidden shadow-lg"
            style={{
              background: `linear-gradient(145deg, ${bgColor} 0%, ${bgColorLight} 50%, ${bgColor} 100%)`,
            }}
          >
            {photo.filepath ? (
              <LocalImage
                filepath={photo.filepath}
                alt={photo.filename}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2 opacity-20">
                  <ImageIcon className="h-12 w-12 text-white" />
                  <span
                    className="text-xs text-white"
                    style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                  >
                    {photo.filename}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Next */}
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className={cn(
              'absolute right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full',
              'bg-card/80 backdrop-blur-sm text-muted-foreground shadow-sm',
              'transition-all duration-300',
              hasNext
                ? 'hover:text-foreground hover:shadow-md hover:scale-[1.05]'
                : 'opacity-30 cursor-not-allowed'
            )}
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Metadata sidebar */}
        <div className="w-[320px] shrink-0 border-l border-border flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Details</h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-foreground"
              aria-label="Close detail panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Metadata */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              {metaRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <row.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {row.label}
                    </p>
                    <p className={cn(
                      'mt-0.5 truncate text-[13px] text-foreground',
                    )} style={row.mono ? { fontFamily: '"JetBrains Mono", ui-monospace, monospace' } : undefined}>
                      {row.label === 'Status' ? (
                        <span className="flex items-center gap-1.5">
                          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[photo.status])} />
                          <span className={STATUS_TEXT[photo.status]}>{row.value}</span>
                        </span>
                      ) : (
                        row.value
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-border px-6 py-5 space-y-2.5">
            <button
              type="button"
              onClick={onPrint}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5',
                'bg-[#c57d3c] text-white',
                'text-sm font-semibold',
                'transition-all duration-300 ease-out',
                'hover:brightness-110 hover:shadow-md hover:shadow-[#c57d3c]/20 hover:scale-[1.01]',
                'active:scale-[0.98]',
              )}
            >
              <Printer className="h-4 w-4" />
              Reprint
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GalleryB3(): React.JSX.Element {
  // Store hooks — subscribe to entire store to ensure re-renders on any change
  const galleryStore = useGallery()
  const photos = galleryStore.photos
  const submitJob = usePrinter((s) => s.submitJob)
  const localDirectory = useSettings((s) => s.localDirectory)
  const copies = useSettings((s) => s.copies)

  // Scan printed folder on mount and when directory changes
  useEffect(() => {
    if (localDirectory) {
      galleryStore.scanPrintedFolder(localDirectory)
    }
  }, [localDirectory])

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState(false)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // Transform store photos to display photos
  const displayPhotos = useMemo(() => photos.map(toDisplayPhoto), [photos])

  // Close sort menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    if (showSortMenu) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
    return undefined
  }, [showSortMenu])

  // Filter & sort
  const filteredPhotos = useMemo(() => {
    return displayPhotos
      .filter((p) => {
        if (searchQuery && !p.filename.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'newest': return b.printedAt - a.printedAt
          case 'oldest': return a.printedAt - b.printedAt
          case 'name-asc': return a.filename.localeCompare(b.filename)
          case 'name-desc': return b.filename.localeCompare(a.filename)
          case 'size': return b.sizeBytes - a.sizeBytes
          default: return 0
        }
      })
  }, [displayPhotos, searchQuery, sortMode])

  const filteredCount = filteredPhotos.length

  // Handlers
  const togglePhotoSelection = useCallback((id: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedPhotos(new Set(filteredPhotos.map((p) => p.id)))
  }, [filteredPhotos])

  const deselectAll = useCallback(() => {
    setSelectedPhotos(new Set())
  }, [])

  function openDetail(index: number): void {
    if (batchMode) return
    setDetailIndex(index)
  }

  function closeDetail(): void {
    setDetailIndex(null)
  }

  function prevPhoto(): void {
    if (detailIndex === null) return
    setDetailIndex(detailIndex > 0 ? detailIndex - 1 : detailIndex)
  }

  function nextPhoto(): void {
    if (detailIndex === null) return
    setDetailIndex(detailIndex < filteredPhotos.length - 1 ? detailIndex + 1 : detailIndex)
  }

  function exitBatchMode(): void {
    setBatchMode(false)
    setSelectedPhotos(new Set())
  }

  // Batch actions
  function handleBatchReprint(): void {
    for (const id of selectedPhotos) {
      const photo = displayPhotos.find((p) => p.id === id)
      if (photo) {
        void submitJob(photo.filename, photo.filepath, { copies })
      }
    }
    exitBatchMode()
  }

  // Detail panel actions
  function handleDetailReprint(photo: DisplayPhoto): void {
    void submitJob(photo.filename, photo.filepath, { copies })
  }

  const sortOptions: { mode: SortMode; label: string; icon: React.ElementType }[] = [
    { mode: 'newest', label: 'Newest First', icon: CalendarArrowDown },
    { mode: 'oldest', label: 'Oldest First', icon: CalendarArrowUp },
    { mode: 'name-asc', label: 'Name A-Z', icon: ArrowDownAZ },
    { mode: 'name-desc', label: 'Name Z-A', icon: ArrowUpAZ },
    { mode: 'size', label: 'Largest First', icon: LayoutGrid },
  ]

  // Determine if we're in a true empty state (no photos at all) vs filtered empty
  const isEmptyState = displayPhotos.length === 0

  return (
    <div
      className="relative flex h-full flex-col bg-background"
      style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
    >
      {/* ── Floating filter bar ── */}
      <div className="shrink-0 border-b border-border/60">

        {/* Top row: Title + search + controls */}
        <div className="flex items-center gap-4 px-8 pt-8 pb-4">
          {/* Title */}
          <div className="shrink-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Gallery</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filteredCount} of {displayPhotos.length} printed photos
            </p>
          </div>

          <div className="flex-1" />

          {/* Search — pill shaped */}
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className={cn(
                'h-9 w-full rounded-full border border-border bg-secondary/40 pl-10 pr-9 text-[13px] text-foreground',
                'outline-none placeholder:text-muted-foreground/50',
                'transition-all duration-300',
                'focus:border-[#c57d3c]/40 focus:bg-card focus:ring-1 focus:ring-[#c57d3c]/15 focus:shadow-sm',
              )}
              aria-label="Search photos"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-300"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-xs text-muted-foreground',
                'transition-all duration-300',
                'hover:text-foreground hover:bg-secondary/50',
                showSortMenu && 'border-foreground/20 text-foreground bg-secondary/50',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{sortOptions.find((s) => s.mode === sortMode)?.label}</span>
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-2xl border border-border bg-card py-1.5 shadow-xl shadow-black/15">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => {
                      setSortMode(opt.mode)
                      setShowSortMenu(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs transition-all duration-200',
                      sortMode === opt.mode
                        ? 'text-[#c57d3c] bg-[#c57d3c]/8'
                        : 'text-foreground hover:bg-secondary/50'
                    )}
                  >
                    <opt.icon className="h-3.5 w-3.5" />
                    {opt.label}
                    {sortMode === opt.mode && <Check className="ml-auto h-3 w-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle — pill */}
          <div className="flex items-center rounded-full border border-border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300',
                viewMode === 'grid'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300',
                viewMode === 'list'
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Batch toggle */}
          <button
            type="button"
            onClick={() => batchMode ? exitBatchMode() : setBatchMode(true)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-medium',
              'transition-all duration-300',
              batchMode
                ? 'border-[#c57d3c]/40 bg-[#c57d3c]/10 text-[#c57d3c]'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            )}
          >
            {batchMode ? (
              <>
                <X className="h-3.5 w-3.5" />
                Cancel
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Select
              </>
            )}
          </button>
        </div>

        {/* Count pill + batch controls */}
        <div className="flex items-center gap-1 px-8 pb-4">
          <StatChip
            label="All"
            count={displayPhotos.length}
            active
            onClick={() => {}}
            dotColor="bg-emerald-500"
          />

          {/* Batch info */}
          {batchMode && (
            <div className="ml-auto flex items-center gap-2.5">
              <span className="text-xs text-muted-foreground">
                <span
                  className="font-medium text-foreground"
                  style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
                >
                  {selectedPhotos.size}
                </span>{' '}
                selected
              </span>
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] font-medium text-[#c57d3c] transition-colors duration-300 hover:text-[#c57d3c]/80"
              >
                Select All
              </button>
              {selectedPhotos.size > 0 && (
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-[11px] font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Gallery content ── */}
      <div className="flex-1 overflow-y-auto">
        {isEmptyState ? (
          /* True empty state — no photos in the store at all */
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <Camera className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">No photos yet</p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Start monitoring a folder to see photos appear here automatically.
            </p>
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <ImageIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">No photos match your criteria</p>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Try broadening your search or changing the status filter.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-5 rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-foreground transition-all duration-300 hover:bg-card hover:shadow-sm"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="px-8 py-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredPhotos.map((photo, index) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  isSelected={selectedPhotos.has(photo.id)}
                  batchMode={batchMode}
                  onSelect={() => togglePhotoSelection(photo.id)}
                  onClick={() => openDetail(index)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="px-8 py-4">
            {/* List header */}
            <div className="mb-1 flex items-center gap-4 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {batchMode && <div className="w-5 shrink-0" />}
              <div className="h-9 w-14 shrink-0" />
              <div className="min-w-0 flex-1">Filename</div>
              <div className="w-24 shrink-0">Status</div>
              <div className="w-20 shrink-0 text-right">Size</div>
              <div className="w-24 shrink-0 text-right">Date</div>
            </div>
            <div className="space-y-0.5">
              {filteredPhotos.map((photo, index) => (
                <PhotoRow
                  key={photo.id}
                  photo={photo}
                  isSelected={selectedPhotos.has(photo.id)}
                  batchMode={batchMode}
                  onSelect={() => togglePhotoSelection(photo.id)}
                  onClick={() => openDetail(index)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Floating batch action bar ── */}
      {batchMode && selectedPhotos.size > 0 && (
        <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
          <div className={cn(
            'flex items-center gap-2.5 rounded-full border border-border bg-card px-5 py-3',
            'shadow-2xl shadow-black/20 backdrop-blur-sm',
          )}>
            <span className="mr-1 text-xs text-muted-foreground">
              <span
                className="font-semibold text-foreground"
                style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
              >
                {selectedPhotos.size}
              </span>{' '}
              selected
            </span>

            <div className="mx-1 h-4 w-px bg-border" />

            <button
              type="button"
              onClick={handleBatchReprint}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold',
                'bg-[#c57d3c] text-white',
                'transition-all duration-300',
                'hover:brightness-110 hover:shadow-md hover:shadow-[#c57d3c]/20',
                'active:scale-[0.97]',
              )}
            >
              <Printer className="h-3.5 w-3.5" />
              Reprint
            </button>
          </div>
        </div>
      )}

      {/* ── Detail modal overlay ── */}
      {detailIndex !== null && filteredPhotos[detailIndex] && (
        <DetailModal
          photo={filteredPhotos[detailIndex]}
          onClose={closeDetail}
          onPrev={prevPhoto}
          onNext={nextPhoto}
          hasPrev={detailIndex > 0}
          hasNext={detailIndex < filteredPhotos.length - 1}
          onPrint={() => handleDetailReprint(filteredPhotos[detailIndex])}
        />
      )}
    </div>
  )
}
