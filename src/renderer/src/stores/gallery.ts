import { create } from 'zustand'

interface Photo {
  id: string
  filename: string
  filepath: string
  sizeBytes: number
  status: 'printed'
  printedAt: number
}

interface GalleryState {
  photos: Photo[]
  loading: boolean
  scanPrintedFolder: (directory: string) => Promise<void>
  refresh: () => Promise<void>
  clearAll: () => void
}

let _lastDirectory = ''

export const useGallery = create<GalleryState>((set, get) => ({
  photos: [],
  loading: false,

  scanPrintedFolder: async (directory: string) => {
    _lastDirectory = directory
    set({ loading: true })
    try {
      const result = await window.api.gallery.scanPrintedFolder(directory)
      if (result.success) {
        const photos: Photo[] = result.photos.map((p, i) => ({
          id: `printed-${i}-${p.filename}`,
          filename: p.filename,
          filepath: p.filepath,
          sizeBytes: p.sizeBytes,
          status: 'printed' as const,
          printedAt: p.printedAt
        }))
        // Sort newest first
        photos.sort((a, b) => b.printedAt - a.printedAt)
        set({ photos })
      }
    } catch (err) {
      console.error('Failed to scan printed folder:', err)
    } finally {
      set({ loading: false })
    }
  },

  refresh: async () => {
    if (_lastDirectory) {
      await get().scanPrintedFolder(_lastDirectory)
    }
  },

  clearAll: () => {
    set({ photos: [] })
  }
}))

export type { Photo, GalleryState }
