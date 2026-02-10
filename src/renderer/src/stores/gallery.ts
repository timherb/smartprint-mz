import { create } from 'zustand'

interface Photo {
  id: string
  filename: string
  filepath: string
  sizeBytes: number
  status: 'pending' | 'printing' | 'printed' | 'error'
  addedAt: number
  printedAt: number | null
  printer: string | null
  error: string | null
}

interface GalleryState {
  photos: Photo[]
  addPhoto: (filename: string, filepath: string, sizeBytes: number) => void
  updatePhotoStatus: (filename: string, status: Photo['status'], extra?: Partial<Photo>) => void
  removePhoto: (id: string) => void
  clearAll: () => void
}

let nextId = 1

export const useGallery = create<GalleryState>((set) => ({
  photos: [],

  addPhoto: (filename, filepath, sizeBytes) => {
    const photo: Photo = {
      id: String(nextId++),
      filename,
      filepath,
      sizeBytes,
      status: 'pending',
      addedAt: Date.now(),
      printedAt: null,
      printer: null,
      error: null
    }
    set((state) => ({ photos: [...state.photos, photo] }))
  },

  updatePhotoStatus: (filename, status, extra) => {
    set((state) => ({
      photos: state.photos.map((photo) => {
        if (photo.filename !== filename) return photo
        return {
          ...photo,
          status,
          ...extra,
          ...(status === 'printed' ? { printedAt: Date.now() } : {})
        }
      })
    }))
  },

  removePhoto: (id) => {
    set((state) => ({
      photos: state.photos.filter((photo) => photo.id !== id)
    }))
  },

  clearAll: () => {
    set({ photos: [] })
  }
}))

export type { Photo, GalleryState }
