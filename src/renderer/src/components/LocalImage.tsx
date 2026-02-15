import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Simple LRU cache for data URLs to avoid re-reading the same file
 * from disk via IPC on every mount/re-render. Shared across all
 * LocalImage instances.
 */
const dataUrlCache = new Map<string, string>()
const DATA_URL_CACHE_MAX = 50

function getCachedOrFetch(filepath: string): Promise<string | null> {
  const cached = dataUrlCache.get(filepath)
  if (cached) return Promise.resolve(cached)

  return window.api.readImageAsDataUrl(filepath).then((url) => {
    if (url) {
      // Evict oldest entry if cache is full
      if (dataUrlCache.size >= DATA_URL_CACHE_MAX) {
        const firstKey = dataUrlCache.keys().next().value
        if (firstKey !== undefined) dataUrlCache.delete(firstKey)
      }
      dataUrlCache.set(filepath, url)
    }
    return url
  })
}

/**
 * Displays a local image file by reading it via IPC as a data URL.
 * Works in both dev mode (http://) and production (file://).
 *
 * Uses IntersectionObserver for true lazy loading: images outside the
 * viewport do not load until they scroll into view, reducing memory
 * usage on low-end devices with large galleries.
 */
export function LocalImage({
  filepath,
  alt = '',
  className,
  loading,
  onError,
}: {
  filepath: string
  alt?: string
  className?: string
  loading?: 'lazy' | 'eager'
  onError?: () => void
}): React.JSX.Element | null {
  const [dataUrl, setDataUrl] = useState<string | null>(() => dataUrlCache.get(filepath) ?? null)
  const [isVisible, setIsVisible] = useState(loading !== 'lazy')
  const containerRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver for lazy loading -- only load when visible
  useEffect(() => {
    if (loading !== 'lazy' || !containerRef.current) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' } // Start loading 200px before entering viewport
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [loading])

  // Fetch data URL when visible and filepath changes
  useEffect(() => {
    if (!isVisible) return

    let cancelled = false
    // Check cache synchronously first
    const cached = dataUrlCache.get(filepath)
    if (cached) {
      setDataUrl(cached)
      return
    }

    setDataUrl(null)
    getCachedOrFetch(filepath).then((url) => {
      if (!cancelled) {
        if (url) {
          setDataUrl(url)
        } else {
          onError?.()
        }
      }
    })
    return () => { cancelled = true }
  }, [filepath, isVisible])

  // Release data URL from state when unmounting to help GC
  const handleError = useCallback(() => { onError?.() }, [onError])

  if (loading === 'lazy' && !isVisible) {
    return <div ref={containerRef} className={className} />
  }

  if (!dataUrl) return null

  return (
    <img
      src={dataUrl}
      alt={alt}
      className={className}
      loading={loading}
      onError={handleError}
    />
  )
}
