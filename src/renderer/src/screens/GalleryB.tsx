import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Search,
  X,
  ZoomIn,
  Download,
  Printer,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
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
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PhotoStatus = 'printed' | 'pending' | 'error'
type ViewMode = 'grid' | 'list'
type SortMode = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size'

interface Photo {
  id: string
  filename: string
  status: PhotoStatus
  timestamp: string
  date: string
  dimensions: string
  width: number
  height: number
  size: string
  sizeBytes: number
  printer?: string
  printTime?: string
  hue: number
  saturation: number
  lightness: number
}

// ---------------------------------------------------------------------------
// Mock data - realistic photo library
// ---------------------------------------------------------------------------

const PRINTERS = ['Canon SELPHY CP1500', 'DNP DS620A', 'Mitsubishi CP-D90DW', 'Epson SureColor P700']

const FILENAMES = [
  'DSC_0142.ARW', 'IMG_7831.CR3', 'DSC_0287.ARW', '_MG_4401.CR2',
  'IMG_7832.CR3', 'DSC_0143.ARW', '_MG_4402.CR2', 'IMG_7833.CR3',
  'DSC_0288.ARW', 'DSCF1192.RAF', 'IMG_7834.CR3', 'DSC_0144.ARW',
  '_MG_4403.CR2', 'DSCF1193.RAF', 'IMG_7835.CR3', 'DSC_0289.ARW',
  'DSC_0145.ARW', '_MG_4404.CR2', 'IMG_7836.CR3', 'DSCF1194.RAF',
  'DSC_0290.ARW', 'IMG_7837.CR3', '_MG_4405.CR2', 'DSC_0146.ARW',
  'DSCF1195.RAF', 'IMG_7838.CR3', 'DSC_0291.ARW', '_MG_4406.CR2',
]

const DIMENSIONS: [number, number][] = [
  [6000, 4000], [5472, 3648], [4032, 3024], [6720, 4480],
  [5184, 3456], [6000, 4000], [5472, 3648], [4032, 3024],
]

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function generateMockPhotos(): Photo[] {
  const photos: Photo[] = []
  const statuses: PhotoStatus[] = [
    'printed', 'printed', 'printed', 'printed', 'printed',
    'printed', 'printed', 'printed', 'pending', 'pending',
    'pending', 'error',
  ]

  // Earthy, warm palette - no neon, no purple. Think golden hour photographs.
  const hues = [
    15, 25, 35, 190, 210, 160, 340, 30, 45, 200, 170, 20,
    28, 195, 175, 38, 12, 205, 22, 185, 32, 215, 165, 40,
    18, 192, 178, 42,
  ]

  for (let i = 0; i < 28; i++) {
    const r = seededRandom(i + 7)
    const status = statuses[i % statuses.length]
    const [w, h] = DIMENSIONS[i % DIMENSIONS.length]
    const hour = 9 + Math.floor(r * 8)
    const min = Math.floor(seededRandom(i + 100) * 60)
    const sizeVal = 2.4 + seededRandom(i + 50) * 14

    photos.push({
      id: `photo-${i}`,
      filename: FILENAMES[i],
      status,
      timestamp: `${hour}:${String(min).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`,
      date: `Feb ${5 + Math.floor(i / 7)}, 2026`,
      dimensions: `${w} x ${h}`,
      width: w,
      height: h,
      size: `${sizeVal.toFixed(1)} MB`,
      sizeBytes: Math.round(sizeVal * 1024 * 1024),
      printer: status === 'printed' ? PRINTERS[i % PRINTERS.length] : undefined,
      printTime: status === 'printed' ? `${Math.floor(18 + seededRandom(i + 30) * 25)}s` : undefined,
      hue: hues[i],
      saturation: 25 + Math.floor(seededRandom(i + 20) * 35),
      lightness: 18 + Math.floor(seededRandom(i + 40) * 22),
    })
  }
  return photos
}

const ALL_PHOTOS = generateMockPhotos()

// ---------------------------------------------------------------------------
// Status dot colors - tasteful, not loud
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<PhotoStatus, string> = {
  printed: 'bg-emerald-500',
  pending: 'bg-amber-accent',
  error: 'bg-red-500',
}

const STATUS_TEXT: Record<PhotoStatus, string> = {
  printed: 'text-emerald-500',
  pending: 'text-amber-accent',
  error: 'text-red-500',
}

const STATUS_LABEL: Record<PhotoStatus, string> = {
  printed: 'Printed',
  pending: 'Pending',
  error: 'Error',
}

// ---------------------------------------------------------------------------
// Stat counter component
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
        'group flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
        active
          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
      )}
    >
      {dotColor && (
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
      )}
      <span>{label}</span>
      <span
        className={cn(
          'font-mono text-[11px] tabular-nums',
          active ? 'text-foreground' : 'text-muted-foreground/60'
        )}
      >
        {count}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Photo thumbnail in grid view
// ---------------------------------------------------------------------------

function PhotoCard({
  photo,
  isSelected,
  batchMode,
  onSelect,
  onClick,
}: {
  photo: Photo
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
        'group relative w-full overflow-hidden rounded-lg text-left',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isSelected && batchMode
          ? 'ring-2 ring-amber-accent ring-offset-2 ring-offset-background scale-[0.97]'
          : 'hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5'
      )}
    >
      {/* Image placeholder - warm, photographic gradients */}
      <div
        className="aspect-[3/2] w-full"
        style={{
          background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColorLight} 60%, ${bgColor} 100%)`,
        }}
      >
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.8) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.5) 0%, transparent 40%)',
        }} />

        {/* Film-style frame number in corner */}
        <div className="absolute bottom-1.5 right-2 font-mono text-[9px] tracking-wider text-white/20">
          {photo.filename.split('.')[0]}
        </div>
      </div>

      {/* Hover overlay - slide up reveal */}
      <div className={cn(
        'absolute inset-0 flex flex-col justify-end',
        'bg-gradient-to-t from-black/80 via-black/20 to-transparent',
        'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
      )}>
        <div className="p-3">
          <p className="truncate text-[13px] font-medium text-white/95">{photo.filename}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[photo.status])} />
            <span className="text-[11px] text-white/60">{STATUS_LABEL[photo.status]}</span>
            <span className="text-white/20">|</span>
            <span className="font-mono text-[11px] text-white/50">{photo.size}</span>
          </div>
        </div>
        {!batchMode && (
          <div className="absolute right-2.5 top-2.5 rounded-md bg-black/40 p-1.5 backdrop-blur-sm">
            <ZoomIn className="h-3.5 w-3.5 text-white/70" />
          </div>
        )}
      </div>

      {/* Selection ring indicator */}
      {batchMode && (
        <div className="absolute left-2.5 top-2.5 z-10">
          <div
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] transition-all duration-150',
              isSelected
                ? 'border-amber-accent bg-amber-accent scale-110'
                : 'border-white/40 bg-black/30 backdrop-blur-sm group-hover:border-white/60'
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-amber-accent-foreground" />}
          </div>
        </div>
      )}

      {/* Status dot on card (always visible, bottom-left) */}
      {!batchMode && (
        <div className="absolute bottom-2 left-2.5 group-hover:opacity-0 transition-opacity duration-200">
          <span className={cn('block h-2 w-2 rounded-full', STATUS_DOT[photo.status])} />
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Photo row in list view
// ---------------------------------------------------------------------------

function PhotoRow({
  photo,
  isSelected,
  batchMode,
  onSelect,
  onClick,
}: {
  photo: Photo
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
        'group flex w-full items-center gap-4 rounded-lg px-3 py-2 text-left transition-all duration-150',
        isSelected && batchMode
          ? 'bg-glow ring-1 ring-amber-accent/30'
          : 'hover:bg-secondary/50'
      )}
    >
      {/* Selection indicator */}
      {batchMode && (
        <div
          className={cn(
            'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all',
            isSelected
              ? 'border-amber-accent bg-amber-accent'
              : 'border-border group-hover:border-muted-foreground'
          )}
        >
          {isSelected && <Check className="h-2.5 w-2.5 text-amber-accent-foreground" />}
        </div>
      )}

      {/* Mini thumbnail */}
      <div
        className="h-9 w-14 shrink-0 rounded"
        style={{
          background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColorLight} 100%)`,
        }}
      />

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

      {/* Dimensions */}
      <span className="w-28 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {photo.dimensions}
      </span>

      {/* Size */}
      <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
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
// Detail Panel - the "special moment"
// ---------------------------------------------------------------------------

function DetailPanel({
  photo,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  photo: Photo
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}): React.JSX.Element {
  const bgColor = `hsl(${photo.hue}, ${photo.saturation}%, ${photo.lightness}%)`
  const bgColorLight = `hsl(${photo.hue}, ${photo.saturation + 10}%, ${photo.lightness + 8}%)`

  // Keyboard navigation
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
    { icon: Aperture, label: 'Dimensions', value: photo.dimensions, mono: true },
    { icon: Copy, label: 'File Size', value: photo.size, mono: true },
    { icon: Clock, label: 'Captured', value: `${photo.date} at ${photo.timestamp}` },
    { icon: CircleDot, label: 'Status', value: STATUS_LABEL[photo.status] },
  ]

  if (photo.printer) {
    metaRows.push({ icon: Printer, label: 'Printer', value: photo.printer })
  }
  if (photo.printTime) {
    metaRows.push({ icon: Clock, label: 'Print Time', value: photo.printTime, mono: true })
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-xl"
        onClick={onClose}
        role="presentation"
      />

      {/* Content container */}
      <div className="relative z-10 flex flex-1 items-center justify-center gap-0">

        {/* Main preview area */}
        <div className="flex flex-1 flex-col items-center justify-center px-12 py-8">
          {/* Navigation + Image */}
          <div className="relative flex w-full max-w-3xl items-center justify-center">
            {/* Prev */}
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              className={cn(
                'absolute -left-14 z-20 flex h-10 w-10 items-center justify-center rounded-full',
                'border border-border bg-card text-muted-foreground transition-all duration-150',
                hasPrev
                  ? 'hover:border-foreground/20 hover:text-foreground hover:bg-surface-elevated'
                  : 'opacity-30 cursor-not-allowed'
              )}
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Image */}
            <div
              className="aspect-[3/2] w-full max-w-3xl overflow-hidden rounded-xl shadow-2xl shadow-black/40"
              style={{
                background: `linear-gradient(145deg, ${bgColor} 0%, ${bgColorLight} 50%, ${bgColor} 100%)`,
              }}
            >
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex flex-col items-center gap-2 opacity-20">
                  <ImageIcon className="h-12 w-12 text-white" />
                  <span className="font-mono text-xs text-white">{photo.dimensions}</span>
                </div>
              </div>
            </div>

            {/* Next */}
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className={cn(
                'absolute -right-14 z-20 flex h-10 w-10 items-center justify-center rounded-full',
                'border border-border bg-card text-muted-foreground transition-all duration-150',
                hasNext
                  ? 'hover:border-foreground/20 hover:text-foreground hover:bg-surface-elevated'
                  : 'opacity-30 cursor-not-allowed'
              )}
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Filename below image */}
          <div className="mt-4 flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{photo.filename}</span>
            <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[photo.status])} />
          </div>
        </div>

        {/* Metadata sidebar */}
        <div className="relative h-full w-[340px] shrink-0 border-l border-border bg-card">
          <div className="flex h-full flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Details</h3>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Close detail panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mini preview */}
            <div className="border-b border-border px-5 py-4">
              <div
                className="aspect-[3/2] w-full rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColorLight} 100%)`,
                }}
              />
            </div>

            {/* Metadata */}
            <div className="flex-1 px-5 py-4">
              <div className="space-y-3.5">
                {metaRows.map((row) => (
                  <div key={row.label} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                      <row.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {row.label}
                      </p>
                      <p className={cn(
                        'mt-0.5 truncate text-[13px] text-foreground',
                        row.mono && 'font-mono'
                      )}>
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
            <div className="border-t border-border px-5 py-4 space-y-2">
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
                  'bg-amber-accent text-amber-accent-foreground',
                  'text-sm font-semibold transition-all duration-150',
                  'hover:brightness-110 active:scale-[0.98]',
                )}
              >
                <Printer className="h-4 w-4" />
                {photo.status === 'printed' ? 'Reprint' : 'Print Now'}
              </button>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
                  'border border-border bg-secondary text-foreground',
                  'text-sm font-medium transition-all duration-150',
                  'hover:bg-accent active:scale-[0.98]',
                )}
              >
                <Download className="h-4 w-4" />
                Export Original
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GalleryB(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PhotoStatus | 'all'>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState(false)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

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
    return ALL_PHOTOS
      .filter((p) => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false
        if (searchQuery && !p.filename.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'newest': return b.id.localeCompare(a.id)
          case 'oldest': return a.id.localeCompare(b.id)
          case 'name-asc': return a.filename.localeCompare(b.filename)
          case 'name-desc': return b.filename.localeCompare(a.filename)
          case 'size': return b.sizeBytes - a.sizeBytes
          default: return 0
        }
      })
  }, [searchQuery, statusFilter, sortMode])

  // Stats
  const stats = useMemo(() => {
    const total = ALL_PHOTOS.length
    const printed = ALL_PHOTOS.filter((p) => p.status === 'printed').length
    const pending = ALL_PHOTOS.filter((p) => p.status === 'pending').length
    const error = ALL_PHOTOS.filter((p) => p.status === 'error').length
    return { total, printed, pending, error }
  }, [])

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

  const sortOptions: { mode: SortMode; label: string; icon: React.ElementType }[] = [
    { mode: 'newest', label: 'Newest First', icon: CalendarArrowDown },
    { mode: 'oldest', label: 'Oldest First', icon: CalendarArrowUp },
    { mode: 'name-asc', label: 'Name A-Z', icon: ArrowDownAZ },
    { mode: 'name-desc', label: 'Name Z-A', icon: ArrowUpAZ },
    { mode: 'size', label: 'Largest First', icon: LayoutGrid },
  ]

  return (
    <div className="relative flex h-full flex-col bg-background">

      {/* ── Header area ── */}
      <div className="shrink-0 border-b border-border">

        {/* Top row: Title + search + view controls */}
        <div className="flex items-center gap-4 px-6 pt-5 pb-3">
          {/* Title */}
          <div className="shrink-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Gallery</h1>
            <p className="text-xs text-muted-foreground">
              {filteredPhotos.length} of {stats.total} photos
            </p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className={cn(
                'h-8 w-full rounded-lg border border-border bg-secondary/50 pl-9 pr-8 text-[13px] text-foreground',
                'outline-none placeholder:text-muted-foreground/60',
                'transition-all duration-150',
                'focus:border-amber-accent/40 focus:bg-card focus:ring-1 focus:ring-amber-accent/20',
              )}
              aria-label="Search photos"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                'flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted-foreground transition-all duration-150',
                'hover:text-foreground hover:bg-secondary/50',
                showSortMenu && 'border-foreground/20 text-foreground bg-secondary/50',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{sortOptions.find((s) => s.mode === sortMode)?.label}</span>
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-44 rounded-lg border border-border bg-card py-1 shadow-xl shadow-black/20">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => {
                      setSortMode(opt.mode)
                      setShowSortMenu(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors',
                      sortMode === opt.mode
                        ? 'text-amber-accent bg-glow'
                        : 'text-foreground hover:bg-secondary/60'
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

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150',
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
                'flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150',
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
              'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-150',
              batchMode
                ? 'border-amber-accent/40 bg-glow text-amber-accent'
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

        {/* Filter pills row */}
        <div className="flex items-center gap-1 px-6 pb-3">
          <StatChip
            label="All"
            count={stats.total}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
          />
          <StatChip
            label="Printed"
            count={stats.printed}
            active={statusFilter === 'printed'}
            onClick={() => setStatusFilter('printed')}
            dotColor="bg-emerald-500"
          />
          <StatChip
            label="Pending"
            count={stats.pending}
            active={statusFilter === 'pending'}
            onClick={() => setStatusFilter('pending')}
            dotColor="bg-amber-accent"
          />
          <StatChip
            label="Errors"
            count={stats.error}
            active={statusFilter === 'error'}
            onClick={() => setStatusFilter('error')}
            dotColor="bg-red-500"
          />

          {/* Batch selection info */}
          {batchMode && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                <span className="font-mono font-medium text-foreground">{selectedPhotos.size}</span> selected
              </span>
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] font-medium text-amber-accent transition-colors hover:text-amber-accent/80"
              >
                Select All
              </button>
              {selectedPhotos.size > 0 && (
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
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
        {filteredPhotos.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
              <ImageIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">No photos match your criteria</p>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              Try broadening your search or changing the status filter.
            </p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
              className="mt-4 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid view */
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
          /* List view */
          <div className="px-6 py-3">
            {/* List header */}
            <div className="mb-1 flex items-center gap-4 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {batchMode && <div className="w-4.5 shrink-0" />}
              <div className="h-9 w-14 shrink-0" />
              <div className="min-w-0 flex-1">Filename</div>
              <div className="w-24 shrink-0">Status</div>
              <div className="w-28 shrink-0 text-right">Dimensions</div>
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
        <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className={cn(
            'flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5',
            'shadow-2xl shadow-black/30',
          )}>
            <span className="mr-1 text-xs text-muted-foreground">
              <span className="font-mono font-semibold text-foreground">{selectedPhotos.size}</span> selected
            </span>

            <div className="mx-1 h-4 w-px bg-border" />

            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                'bg-amber-accent text-amber-accent-foreground',
                'hover:brightness-110 active:scale-[0.97]',
              )}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                'bg-secondary text-foreground',
                'hover:bg-accent active:scale-[0.97]',
              )}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                'text-red-500 hover:bg-red-500/10',
                'active:scale-[0.97]',
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* ── Detail panel overlay ── */}
      {detailIndex !== null && filteredPhotos[detailIndex] && (
        <DetailPanel
          photo={filteredPhotos[detailIndex]}
          onClose={closeDetail}
          onPrev={prevPhoto}
          onNext={nextPhoto}
          hasPrev={detailIndex > 0}
          hasNext={detailIndex < filteredPhotos.length - 1}
        />
      )}
    </div>
  )
}
