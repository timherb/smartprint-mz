import { useState, useEffect } from 'react'

/**
 * Displays a local image file by reading it via IPC as a data URL.
 * Works in both dev mode (http://) and production (file://).
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
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    window.api.readImageAsDataUrl(filepath).then((url) => {
      if (!cancelled) {
        if (url) {
          setDataUrl(url)
        } else {
          onError?.()
        }
      }
    })
    return () => { cancelled = true }
  }, [filepath])

  if (!dataUrl) return null

  return (
    <img
      src={dataUrl}
      alt={alt}
      className={className}
      loading={loading}
      onError={onError}
    />
  )
}
