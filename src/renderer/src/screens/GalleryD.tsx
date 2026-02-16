import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { LocalImage } from '@/components/LocalImage'
import { useGallery, type Photo as StorePhoto } from '@/stores/gallery'
import { usePrinter } from '@/stores/printer'
import { useSettings } from '@/stores/settings'
import { usePressTheme } from '@/stores/pressTheme'
import { addToast } from '@/stores/toast'
import type { PressThemeColors } from '@/themes/press-themes'
import {
  X,
  ZoomIn,
  Printer,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Camera,
  FolderOpen,
  Copy,
  Aperture,
  CircleDot,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
// Fonts
// ---------------------------------------------------------------------------

const monoFont = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' }
const headerFont = { fontFamily: '"Inter", system-ui, sans-serif' }

// ---------------------------------------------------------------------------
// Style builders
// ---------------------------------------------------------------------------

function metalPanelStyle(c: PressThemeColors): React.CSSProperties {
  return {
    borderRadius: '0.5rem',
    background: `linear-gradient(to bottom, ${c.baseLight}, ${c.baseMid})`,
    boxShadow: `inset 0 1px 0 ${c.highlightColor}0.04), 0 2px 8px ${c.shadowColor}0.3)`,
    border: `1px solid ${c.borderColor}`,
  }
}

// ---------------------------------------------------------------------------
// Rivet
// ---------------------------------------------------------------------------

function Rivet({ className, colors }: { className?: string; colors: PressThemeColors }): React.JSX.Element {
  return (
    <span
      className={cn('inline-block h-[5px] w-[5px] rounded-full', className)}
      style={{
        background: `linear-gradient(to bottom right, ${colors.rivetLight}, ${colors.rivetDark})`,
        boxShadow: `inset 0 1px 0 ${colors.highlightColor}0.08), 0 1px 2px ${colors.shadowColor}0.4)`,
      }}
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
  onPrint,
  colors,
}: {
  photo: DisplayPhoto
  isSelected: boolean
  batchMode: boolean
  onSelect: () => void
  onClick: () => void
  onPrint: () => void
  colors: PressThemeColors
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
      )}
      style={{
        outlineOffset: '2px',
      }}
    >
      {/* Paper shadow - simulates a physical photo print */}
      <div
        className={cn(
          'overflow-hidden rounded',
          'transition-all duration-200',
          isSelected && batchMode && 'scale-[0.97]',
          !batchMode && 'group-hover:scale-[1.03] group-hover:-translate-y-0.5',
        )}
        style={{
          boxShadow: isSelected && batchMode
            ? `0 0 0 2px ${colors.accent}, 0 0 0 4px ${colors.baseDark}`
            : `2px 3px 8px ${colors.shadowColor}0.35), 0 1px 2px ${colors.shadowColor}0.2)`,
        }}
      >
        {/* Paper border (white margin around photo, like a real print) */}
        <div className="p-1.5" style={{ backgroundColor: colors.paper }}>
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

        {/* Hover overlay - loupe icon + reprint button */}
        {!batchMode && (
          <div className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-black/30 opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          )}>
            <div className="rounded-full p-2" style={{ backgroundColor: `${colors.baseDark}cc` }}>
              <ZoomIn className="h-4 w-4" style={{ color: colors.accent }} />
            </div>
            {/* Quick reprint button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPrint() }}
              className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded transition-all duration-150 hover:scale-110 active:scale-95"
              style={{
                background: `linear-gradient(to bottom, ${colors.accent}, ${colors.accentDark})`,
                boxShadow: `0 2px 6px ${colors.shadowColor}0.5)`,
              }}
              aria-label={`Reprint ${photo.filename}`}
            >
              <Printer className="h-3 w-3 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Filename below the "print" */}
      <div className="mt-2 px-0.5">
        <p
          className="text-[10px] font-medium truncate"
          style={{ ...monoFont, color: colors.textPrimary }}
        >
          {photo.filename}
        </p>
        <p className="text-[9px] mt-0.5" style={{ color: colors.textMuted }}>
          {photo.size}
        </p>
      </div>

      {/* Industrial checkbox - riveted selector */}
      {batchMode && (
        <div className="absolute left-0 top-0 z-10 p-1">
          <div
            className="flex h-5 w-5 items-center justify-center rounded transition-all duration-200"
            style={
              isSelected
                ? {
                    background: `linear-gradient(to bottom, ${colors.accent}, ${colors.accentDark})`,
                    boxShadow: `0 2px 4px ${colors.shadowColor}0.3)`,
                  }
                : {
                    backgroundColor: `${colors.baseDark}cc`,
                    border: `1px solid ${colors.borderColor}`,
                    boxShadow: `inset 0 1px 3px ${colors.shadowColor}0.4)`,
                  }
            }
          >
            {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </div>
        </div>
      )}
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
  colors,
}: {
  photo: DisplayPhoto
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  onPrint: () => void
  colors: PressThemeColors
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

  const navBtnStyle = (enabled: boolean): React.CSSProperties => ({
    ...metalPanelStyle(colors),
    color: enabled ? colors.textPrimary : colors.textMuted,
    opacity: enabled ? 1 : 0.3,
    cursor: enabled ? 'pointer' : 'not-allowed',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ backgroundColor: `${colors.baseDark}e6` }}
        onClick={onClose}
        role="presentation"
      />

      {/* Modal - industrial frame */}
      <div
        className="relative z-10 flex w-full max-w-5xl mx-6 overflow-hidden rounded-lg"
        style={{
          background: `linear-gradient(to bottom, ${colors.baseLight}, ${colors.baseMid})`,
          border: `1px solid ${colors.borderColor}`,
          boxShadow: `0 20px 60px ${colors.shadowColor}0.6)`,
        }}
      >
        {/* Image side - paper on press bed */}
        <div className="relative flex-1 flex items-center justify-center p-8" style={{ backgroundColor: colors.baseDark }}>
          {/* Prev */}
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className="absolute left-3 z-20 flex h-9 w-9 items-center justify-center rounded transition-all duration-200"
            style={navBtnStyle(hasPrev)}
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Paper print */}
          <div
            className="relative rounded p-3"
            style={{
              backgroundColor: colors.paper,
              boxShadow: `4px 6px 20px ${colors.shadowColor}0.4)`,
              maxWidth: '80%',
            }}
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
                  <ImageIcon className="h-12 w-12 opacity-20" style={{ color: colors.textOnPaperMuted }} />
                </div>
              )}
            </div>
          </div>

          {/* Next */}
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className="absolute right-3 z-20 flex h-9 w-9 items-center justify-center rounded transition-all duration-200"
            style={navBtnStyle(hasNext)}
            aria-label="Next photo"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Metadata sidebar - control panel */}
        <div
          className="w-[300px] shrink-0 flex flex-col"
          style={{ borderLeft: `1px solid ${colors.borderColor}` }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: `1px solid ${colors.borderColor}` }}
          >
            <h3
              className="text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ ...headerFont, color: colors.textPrimary }}
            >
              DETAILS
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded transition-all duration-200"
              style={{ color: colors.textPrimary }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.baseLight
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
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
                    className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1"
                    style={{ ...headerFont, color: colors.textMuted }}
                  >
                    {row.label}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{
                      ...(row.mono ? monoFont : headerFont),
                      color: row.label === 'STATUS' ? colors.ledGreen : colors.textPrimary,
                    }}
                  >
                    {row.label === 'STATUS' && (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor: colors.ledGreen,
                            boxShadow: `0 0 4px ${colors.ledGreen}4d`,
                          }}
                        />
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
          <div className="px-5 py-4" style={{ borderTop: `1px solid ${colors.borderColor}` }}>
            <button
              type="button"
              onClick={onPrint}
              className="flex w-full items-center justify-center gap-2 rounded py-2.5 text-white text-xs font-bold uppercase tracking-[0.1em] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: `linear-gradient(to bottom, ${colors.accent}, ${colors.accentDark})`,
                boxShadow: `0 2px 8px ${colors.accentGlow}0.3), inset 0 1px 0 ${colors.highlightColor}0.15)`,
              }}
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
  const c = usePressTheme()

  const photos = useGallery((s) => s.photos)
  const scanPrintedFolder = useGallery((s) => s.scanPrintedFolder)
  const galleryRefresh = useGallery((s) => s.refresh)
  const submitJob = usePrinter((s) => s.submitJob)
  const completedCount = usePrinter((s) => s.queueStats.completed)
  const localDirectory = useSettings((s) => s.localDirectory)
  const copies = useSettings((s) => s.copies)

  // Scan on mount (event subscription is handled by AppLayoutD)
  useEffect(() => {
    if (localDirectory) scanPrintedFolder(localDirectory)
  }, [localDirectory, scanPrintedFolder])

  // Auto-refresh on new completions
  const prevCompletedRef = useRef(completedCount)
  useEffect(() => {
    if (completedCount > prevCompletedRef.current) {
      const timer = setTimeout(() => galleryRefresh(), 1500)
      prevCompletedRef.current = completedCount
      return () => clearTimeout(timer)
    }
    prevCompletedRef.current = completedCount
    return undefined
  }, [completedCount])

  // Local state
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [batchMode, setBatchMode] = useState(false)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)

  const displayPhotos = useMemo(() => photos.map(toDisplayPhoto), [photos])

  // Always newest-first
  const sortedPhotos = useMemo(
    () => [...displayPhotos].sort((a, b) => b.printedAt - a.printedAt),
    [displayPhotos],
  )

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
    setSelectedPhotos(new Set(sortedPhotos.map((p) => p.id)))
  }, [sortedPhotos])

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
    setDetailIndex(detailIndex < sortedPhotos.length - 1 ? detailIndex + 1 : detailIndex)
  }
  function exitBatchMode(): void {
    setBatchMode(false)
    setSelectedPhotos(new Set())
  }

  function handleBatchReprint(): void {
    const names: string[] = []
    for (const id of selectedPhotos) {
      const photo = displayPhotos.find((p) => p.id === id)
      if (photo) {
        void submitJob(photo.filename, photo.filepath, { copies })
        names.push(photo.filename)
      }
    }
    if (names.length > 0) {
      addToast(`Reprinting ${names.length} photo${names.length > 1 ? 's' : ''}`, 'success')
    }
    exitBatchMode()
  }

  function handleDetailReprint(photo: DisplayPhoto): void {
    void submitJob(photo.filename, photo.filepath, { copies })
    addToast(`Reprinting ${photo.filename}`, 'success')
  }

  const isEmptyState = displayPhotos.length === 0

  // Accent button style (reusable)
  const accentBtnStyle: React.CSSProperties = {
    background: `linear-gradient(to bottom, ${c.accent}, ${c.accentDark})`,
    color: '#ffffff',
    boxShadow: `0 2px 6px ${c.accentGlow}0.3), inset 0 1px 0 ${c.highlightColor}0.15)`,
  }

  return (
    <div className="relative flex h-full flex-col" style={headerFont}>

      {/* ---- Toolbar ---- */}
      <div className="shrink-0" style={{ borderBottom: `1px solid ${c.borderColor}` }}>
        <div className="flex items-center gap-4 px-6 pt-6 pb-3">
          {/* Title */}
          <div className="shrink-0">
            <h1
              className="text-sm font-bold uppercase tracking-[0.15em]"
              style={{ color: c.textPrimary }}
            >
              GALLERY
            </h1>
            <p className="text-[10px] mt-0.5 uppercase tracking-wider" style={{ color: c.textMuted }}>
              {displayPhotos.length} printed photos
            </p>
          </div>

          <div className="flex-1" />

          {/* Batch toggle */}
          <button
            type="button"
            onClick={() => batchMode ? exitBatchMode() : setBatchMode(true)}
            className="flex h-8 items-center gap-1.5 rounded px-3 text-[10px] font-bold uppercase tracking-wider transition-all duration-200"
            style={
              batchMode
                ? accentBtnStyle
                : {
                    ...metalPanelStyle(c),
                    color: c.textMuted,
                  }
            }
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
            <Rivet colors={c} />
            <span className="text-[10px]" style={{ color: c.textMuted }}>
              <span className="font-bold" style={{ ...monoFont, color: c.accent }}>
                {selectedPhotos.size}
              </span>
              {' '}selected
            </span>
            <button
              type="button"
              onClick={selectAll}
              className="text-[10px] font-bold transition"
              style={{ color: c.accent }}
              onMouseEnter={(e) => { e.currentTarget.style.color = c.accentLight }}
              onMouseLeave={(e) => { e.currentTarget.style.color = c.accent }}
            >
              SELECT ALL
            </button>
            {selectedPhotos.size > 0 && (
              <button
                type="button"
                onClick={deselectAll}
                className="text-[10px] font-bold transition"
                style={{ color: c.textMuted }}
              >
                CLEAR
              </button>
            )}
            <Rivet colors={c} />
          </div>
        )}
      </div>

      {/* ---- Gallery content - "Light Table" surface ---- */}
      <div className="flex-1 overflow-y-auto">
        {isEmptyState ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center" style={metalPanelStyle(c)}>
              <Camera className="h-7 w-7" style={{ color: c.textMuted }} />
            </div>
            <p className="text-sm font-bold uppercase tracking-wider" style={{ color: c.textPrimary }}>NO PHOTOS YET</p>
            <p className="mt-2 max-w-xs text-xs" style={{ color: c.textMuted }}>
              Start monitoring a folder to see photos appear here.
            </p>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {sortedPhotos.map((photo, index) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  isSelected={selectedPhotos.has(photo.id)}
                  batchMode={batchMode}
                  onSelect={() => togglePhotoSelection(photo.id)}
                  onClick={() => openDetail(index)}
                  onPrint={() => handleDetailReprint(photo)}
                  colors={c}
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
            className="flex items-center gap-3 rounded-lg px-5 py-3"
            style={{
              background: `linear-gradient(to bottom, ${c.baseLight}, ${c.baseMid})`,
              border: `1px solid ${c.borderColor}`,
              boxShadow: `0 8px 30px ${c.shadowColor}0.5)`,
            }}
          >
            <span className="text-[10px]" style={{ color: c.textMuted }}>
              <span className="font-bold" style={{ ...monoFont, color: c.accent }}>
                {selectedPhotos.size}
              </span>
              {' '}selected
            </span>

            <div className="h-4 w-px" style={{ backgroundColor: c.borderColor }} />

            <button
              type="button"
              onClick={handleBatchReprint}
              className="inline-flex items-center gap-1.5 rounded px-4 py-2 text-white text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
              style={accentBtnStyle}
            >
              <Printer className="h-3 w-3" />
              REPRINT
            </button>
          </div>
        </div>
      )}

      {/* ---- Detail modal ---- */}
      {detailIndex !== null && sortedPhotos[detailIndex] && (
        <DetailModal
          photo={sortedPhotos[detailIndex]}
          onClose={closeDetail}
          onPrev={prevPhoto}
          onNext={nextPhoto}
          hasPrev={detailIndex > 0}
          hasNext={detailIndex < sortedPhotos.length - 1}
          onPrint={() => handleDetailReprint(sortedPhotos[detailIndex])}
          colors={c}
        />
      )}
    </div>
  )
}
