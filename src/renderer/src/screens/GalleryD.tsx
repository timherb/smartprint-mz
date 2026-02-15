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
  Camera,
  FolderOpen,
  Copy,
  Aperture,
  CircleDot,
  CalendarArrowDown,
  CalendarArrowUp,
  ArrowDownAZ,
  ArrowUpAZ,
  LayoutGrid,
  ChevronDown,
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

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function toDisplayPhoto(photo: StorePhoto): DisplayPhoto {
  const h = hashString(photo.filename)
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

const brassText = 'text-[#cd853f]'
const metalText = 'text-[#c8ccd2]'
const dimText = 'text-[#6b7280]'

const monoFont = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' }
const headerFont = { fontFamily: '"Inter", system-ui, sans-serif' }

// ---------------------------------------------------------------------------
// Rivet
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

// ---------------------------------------------------------------------------
// Photo card - physical print on light table
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
        'group relative w-full text-left',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cd853f]',
      )}
    >
      {/* Paper shadow - simulates a physical photo print */}
      <div
        className={cn(
          'overflow-hidden rounded',
          'shadow-[2px_3px_8px_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.2)]',
          'transition-all duration-200',
          isSelected && batchMode
            ? 'ring-2 ring-[#cd853f] ring-offset-2 ring-offset-[#1a1d21] scale-[0.97]'
            : 'group-hover:shadow-[3px_5px_14px_rgba(0,0,0,0.45)] group-hover:scale-[1.03] group-hover:-translate-y-0.5',
        )}
      >
        {/* Paper border (white margin around photo, like a real print) */}
        <div className="bg-[#f5f0e8] p-1.5">
          <div
            className="relative aspect-[3/2] w-full overflow-hidden"
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
        </div>

        {/* Hover overlay - loupe icon */}
        {!batchMode && (
          <div className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          )}>
            <div className="rounded-full bg-[#1a1d21]/80 p-2">
              <ZoomIn className="h-4 w-4 text-[#cd853f]" />
            </div>
          </div>
        )}
      </div>

      {/* Filename below the "print" */}
      <div className="mt-2 px-0.5">
        <p
          className={cn('text-[10px] font-medium truncate', metalText)}
          style={monoFont}
        >
          {photo.filename}
        </p>
        <p className={cn('text-[9px] mt-0.5', dimText)}>
          {photo.size}
        </p>
      </div>

      {/* Industrial checkbox - riveted selector */}
      {batchMode && (
        <div className="absolute left-0 top-0 z-10 p-1">
          <div
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded',
              'transition-all duration-200',
              isSelected
                ? 'bg-gradient-to-b from-[#cd853f] to-[#b87333] shadow-[0_2px_4px_rgba(0,0,0,0.3)]'
                : 'bg-[#1a1d21]/80 border border-[#3a3f46] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]',
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </div>
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
        'group flex w-full items-center gap-3 rounded px-3 py-2 text-left',
        'transition-all duration-200',
        isSelected && batchMode
          ? 'bg-[#cd853f]/10 ring-1 ring-[#cd853f]/30'
          : 'hover:bg-[#2d3238]/60',
      )}
    >
      {/* Checkbox */}
      {batchMode && (
        <div
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded',
            'transition-all duration-200',
            isSelected
              ? 'bg-gradient-to-b from-[#cd853f] to-[#b87333]'
              : 'bg-[#1a1d21] border border-[#3a3f46]',
          )}
        >
          {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
        </div>
      )}

      {/* Mini thumbnail with paper border */}
      <div className="h-8 w-12 shrink-0 overflow-hidden rounded bg-[#f5f0e8] p-[2px]">
        <div
          className="h-full w-full overflow-hidden rounded-[1px]"
          style={{ background: `linear-gradient(135deg, ${bgColor}, ${bgColorLight})` }}
        >
          {photo.filepath && (
            <LocalImage
              filepath={photo.filepath}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          )}
        </div>
      </div>

      {/* Filename */}
      <span className={cn('min-w-0 flex-1 truncate text-xs font-medium', metalText)} style={monoFont}>
        {photo.filename}
      </span>

      {/* Status LED */}
      <div className="flex items-center gap-1.5 w-20 shrink-0">
        <span className="h-2 w-2 rounded-full bg-[#4ade80] shadow-[0_0_4px_rgba(74,222,128,0.3)]" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#4ade80]">DONE</span>
      </div>

      {/* Size */}
      <span className={cn('w-16 shrink-0 text-right text-[10px]', dimText)} style={monoFont}>
        {photo.size}
      </span>

      {/* Date */}
      <span className={cn('w-24 shrink-0 text-right text-[10px]', dimText)}>
        {photo.date}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Detail modal - loupe/magnifier metaphor
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
    { icon: Camera, label: 'FILENAME', value: photo.filename, mono: true },
    { icon: FolderOpen, label: 'PATH', value: photo.filepath, mono: true },
    { icon: Copy, label: 'FILE SIZE', value: photo.size, mono: true },
    { icon: Aperture, label: 'PRINTED AT', value: `${photo.date} at ${photo.timestamp}` },
    { icon: CircleDot, label: 'STATUS', value: 'Printed' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-[#0a0b0d]/90 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal - industrial frame */}
      <div
        className={cn(
          'relative z-10 flex w-full max-w-5xl mx-6 overflow-hidden rounded-lg',
          'bg-gradient-to-b from-[#2d3238] to-[#22262b]',
          'border border-[#3a3f46]/60',
          'shadow-[0_20px_60px_rgba(0,0,0,0.6)]',
        )}
      >
        {/* Image side - paper on press bed */}
        <div className="relative flex-1 flex items-center justify-center p-8 bg-[#1a1d21]">
          {/* Prev */}
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className={cn(
              'absolute left-3 z-20 flex h-9 w-9 items-center justify-center rounded',
              metalPanel,
              hasPrev
                ? cn(metalText, 'hover:text-[#cd853f] hover:shadow-lg')
                : 'opacity-30 cursor-not-allowed',
              'transition-all duration-200',
            )}
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Paper print */}
          <div
            className="relative rounded bg-[#f5f0e8] p-3 shadow-[4px_6px_20px_rgba(0,0,0,0.4)]"
            style={{ maxWidth: '80%' }}
          >
            <div
              className="aspect-[3/2] w-full max-w-2xl overflow-hidden"
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
                  <ImageIcon className="h-12 w-12 text-[#8b8178] opacity-20" />
                </div>
              )}
            </div>
          </div>

          {/* Next */}
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className={cn(
              'absolute right-3 z-20 flex h-9 w-9 items-center justify-center rounded',
              metalPanel,
              hasNext
                ? cn(metalText, 'hover:text-[#cd853f] hover:shadow-lg')
                : 'opacity-30 cursor-not-allowed',
              'transition-all duration-200',
            )}
            aria-label="Next photo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Metadata sidebar - control panel */}
        <div className="w-[300px] shrink-0 border-l border-[#3a3f46]/60 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#3a3f46]/60 px-5 py-4">
            <h3
              className={cn('text-[11px] font-bold uppercase tracking-[0.12em]', metalText)}
              style={headerFont}
            >
              DETAILS
            </h3>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded',
                metalText,
                'transition-all duration-200 hover:bg-[#3a3f46] hover:text-white',
              )}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Metadata rows */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              {metaRows.map((row) => (
                <div key={row.label}>
                  <p
                    className={cn('text-[9px] font-bold uppercase tracking-[0.12em] mb-1', dimText)}
                    style={headerFont}
                  >
                    {row.label}
                  </p>
                  <p
                    className={cn('text-xs truncate', row.label === 'STATUS' ? 'text-[#4ade80]' : metalText)}
                    style={row.mono ? monoFont : headerFont}
                  >
                    {row.label === 'STATUS' && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#4ade80] shadow-[0_0_4px_rgba(74,222,128,0.3)]" />
                        {row.value}
                      </span>
                    )}
                    {row.label !== 'STATUS' && row.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-[#3a3f46]/60 px-5 py-4">
            <button
              type="button"
              onClick={onPrint}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded py-2.5',
                'bg-gradient-to-b from-[#cd853f] to-[#b87333]',
                'text-white text-xs font-bold uppercase tracking-[0.1em]',
                'shadow-[0_2px_8px_rgba(184,115,51,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]',
                'transition-all duration-200',
                'hover:brightness-110 hover:shadow-[0_4px_12px_rgba(184,115,51,0.4)]',
                'active:scale-[0.98]',
              )}
            >
              <Printer className="h-3.5 w-3.5" />
              REPRINT
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

export default function GalleryD(): React.JSX.Element {
  const galleryStore = useGallery()
  const photos = galleryStore.photos
  const submitJob = usePrinter((s) => s.submitJob)
  const completedCount = usePrinter((s) => s.queueStats.completed)
  const subscribeToEvents = usePrinter((s) => s.subscribeToEvents)
  const localDirectory = useSettings((s) => s.localDirectory)
  const copies = useSettings((s) => s.copies)

  // Scan on mount
  useEffect(() => {
    if (localDirectory) galleryStore.scanPrintedFolder(localDirectory)
  }, [localDirectory])

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = subscribeToEvents()
    return unsubscribe
  }, [subscribeToEvents])

  // Auto-refresh on new completions
  const prevCompletedRef = useRef(completedCount)
  useEffect(() => {
    if (completedCount > prevCompletedRef.current) {
      const timer = setTimeout(() => galleryStore.refresh(), 1500)
      prevCompletedRef.current = completedCount
      return () => clearTimeout(timer)
    }
    prevCompletedRef.current = completedCount
    return undefined
  }, [completedCount])

  // Local state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState(false)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  const displayPhotos = useMemo(() => photos.map(toDisplayPhoto), [photos])

  // Close sort on outside click
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
  function closeDetail(): void { setDetailIndex(null) }
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

  function handleBatchReprint(): void {
    for (const id of selectedPhotos) {
      const photo = displayPhotos.find((p) => p.id === id)
      if (photo) void submitJob(photo.filename, photo.filepath, { copies })
    }
    exitBatchMode()
  }

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

  const isEmptyState = displayPhotos.length === 0

  return (
    <div className="relative flex h-full flex-col" style={headerFont}>

      {/* ---- Filter bar ---- */}
      <div className="shrink-0 border-b border-[#3a3f46]/40">
        <div className="flex items-center gap-4 px-6 pt-6 pb-3">
          {/* Title */}
          <div className="shrink-0">
            <h1
              className={cn('text-sm font-bold uppercase tracking-[0.15em]', metalText)}
            >
              GALLERY
            </h1>
            <p className={cn('text-[10px] mt-0.5 uppercase tracking-wider', dimText)}>
              {filteredCount} of {displayPhotos.length} printed photos
            </p>
          </div>

          <div className="flex-1" />

          {/* Search - recessed metal slot */}
          <div className="relative w-64">
            <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2', dimText)} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className={cn(
                'h-8 w-full rounded pl-8 pr-8 text-xs',
                insetPanel,
                metalText,
                'outline-none placeholder:text-[#4b5563]',
                'transition-all duration-200',
                'focus:ring-1 focus:ring-[#cd853f]/30',
              )}
              style={monoFont}
              aria-label="Search photos"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={cn('absolute right-2 top-1/2 -translate-y-1/2', dimText, 'hover:text-white transition')}
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative" ref={sortRef}>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded px-3 text-[10px] font-bold uppercase tracking-wider',
                metalPanel,
                showSortMenu ? brassText : dimText,
                'transition-all duration-200 hover:text-[#c8ccd2]',
              )}
            >
              <ChevronDown className="h-3 w-3" />
              <span className="hidden sm:inline">{sortOptions.find((s) => s.mode === sortMode)?.label}</span>
            </button>
            {showSortMenu && (
              <div
                className={cn(
                  'absolute right-0 top-full z-30 mt-1 w-44 rounded-lg py-1',
                  'bg-gradient-to-b from-[#2d3238] to-[#22262b]',
                  'border border-[#3a3f46]/60',
                  'shadow-[0_8px_24px_rgba(0,0,0,0.5)]',
                )}
              >
                {sortOptions.map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => { setSortMode(opt.mode); setShowSortMenu(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider',
                      'transition-all duration-200',
                      sortMode === opt.mode
                        ? cn(brassText, 'bg-[#cd853f]/10')
                        : cn(metalText, 'hover:bg-[#3a3f46]/40'),
                    )}
                  >
                    <opt.icon className="h-3 w-3" />
                    {opt.label}
                    {sortMode === opt.mode && <Check className="ml-auto h-3 w-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle - industrial switch */}
          <div className={cn(insetPanel, 'flex items-center p-0.5')}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded transition-all duration-200',
                viewMode === 'grid'
                  ? cn('bg-gradient-to-b from-[#3a3f46] to-[#2d3238]', brassText, 'shadow-sm')
                  : dimText,
              )}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded transition-all duration-200',
                viewMode === 'list'
                  ? cn('bg-gradient-to-b from-[#3a3f46] to-[#2d3238]', brassText, 'shadow-sm')
                  : dimText,
              )}
              aria-label="List view"
            >
              <List className="h-3 w-3" />
            </button>
          </div>

          {/* Batch toggle */}
          <button
            type="button"
            onClick={() => batchMode ? exitBatchMode() : setBatchMode(true)}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded px-3 text-[10px] font-bold uppercase tracking-wider',
              'transition-all duration-200',
              batchMode
                ? 'bg-gradient-to-b from-[#cd853f] to-[#b87333] text-white shadow-[0_2px_6px_rgba(184,115,51,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]'
                : cn(metalPanel, dimText, 'hover:text-[#c8ccd2]'),
            )}
          >
            {batchMode ? (
              <><X className="h-3 w-3" /> CANCEL</>
            ) : (
              <><Check className="h-3 w-3" /> SELECT</>
            )}
          </button>
        </div>

        {/* Batch controls sub-bar */}
        {batchMode && (
          <div className="flex items-center gap-2 px-6 pb-3">
            <Rivet />
            <span className={cn('text-[10px]', dimText)}>
              <span className={cn('font-bold', brassText)} style={monoFont}>
                {selectedPhotos.size}
              </span>
              {' '}selected
            </span>
            <button
              type="button"
              onClick={selectAll}
              className={cn('text-[10px] font-bold', brassText, 'hover:text-[#e0a060] transition')}
            >
              SELECT ALL
            </button>
            {selectedPhotos.size > 0 && (
              <button
                type="button"
                onClick={deselectAll}
                className={cn('text-[10px] font-bold', dimText, 'hover:text-white transition')}
              >
                CLEAR
              </button>
            )}
            <Rivet />
          </div>
        )}
      </div>

      {/* ---- Gallery content - "Light Table" surface ---- */}
      <div className="flex-1 overflow-y-auto">
        {isEmptyState ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className={cn(metalPanel, 'mb-5 flex h-16 w-16 items-center justify-center')}>
              <Camera className={cn('h-7 w-7', dimText)} />
            </div>
            <p className={cn('text-sm font-bold uppercase tracking-wider', metalText)}>NO PHOTOS YET</p>
            <p className={cn('mt-2 max-w-xs text-xs', dimText)}>
              Start monitoring a folder to see photos appear here.
            </p>
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className={cn(metalPanel, 'mb-5 flex h-16 w-16 items-center justify-center')}>
              <ImageIcon className={cn('h-7 w-7', dimText)} />
            </div>
            <p className={cn('text-sm font-bold uppercase tracking-wider', metalText)}>NO MATCHES</p>
            <p className={cn('mt-2 max-w-xs text-xs', dimText)}>
              Try broadening your search criteria.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={cn(
                metalPanel,
                'mt-5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider',
                metalText,
                'transition hover:text-[#cd853f]',
              )}
            >
              RESET FILTERS
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
          <div className="px-6 py-4">
            {/* List header */}
            <div className={cn(
              'mb-1 flex items-center gap-3 px-3 py-2',
              'text-[9px] font-bold uppercase tracking-[0.12em]',
              dimText,
            )}>
              {batchMode && <div className="w-4 shrink-0" />}
              <div className="h-8 w-12 shrink-0" />
              <div className="min-w-0 flex-1">FILENAME</div>
              <div className="w-20 shrink-0">STATUS</div>
              <div className="w-16 shrink-0 text-right">SIZE</div>
              <div className="w-24 shrink-0 text-right">DATE</div>
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

      {/* ---- Floating batch action bar ---- */}
      {batchMode && selectedPhotos.size > 0 && (
        <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg px-5 py-3',
              'bg-gradient-to-b from-[#2d3238] to-[#22262b]',
              'border border-[#3a3f46]/60',
              'shadow-[0_8px_30px_rgba(0,0,0,0.5)]',
            )}
          >
            <span className={cn('text-[10px]', dimText)}>
              <span className={cn('font-bold', brassText)} style={monoFont}>
                {selectedPhotos.size}
              </span>
              {' '}selected
            </span>

            <div className="h-4 w-px bg-[#3a3f46]" />

            <button
              type="button"
              onClick={handleBatchReprint}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-4 py-2',
                'bg-gradient-to-b from-[#cd853f] to-[#b87333]',
                'text-white text-[10px] font-bold uppercase tracking-wider',
                'shadow-[0_2px_8px_rgba(184,115,51,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]',
                'transition-all duration-200',
                'hover:brightness-110 active:scale-[0.97]',
              )}
            >
              <Printer className="h-3 w-3" />
              REPRINT
            </button>
          </div>
        </div>
      )}

      {/* ---- Detail modal ---- */}
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
