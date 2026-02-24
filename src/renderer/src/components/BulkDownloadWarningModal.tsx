/**
 * BulkDownloadWarningModal — Shown when a poll returns more than 49 images.
 *
 * Pauses auto-print and gives the operator two choices:
 *   - Download All: proceed with the full batch (photos will print normally)
 *   - Mark All Complete: tell the API these images are "downloaded" without
 *     actually downloading or printing them
 */

import { useState } from 'react'
import { AlertTriangle, Download, CheckCheck, FolderOpen } from 'lucide-react'
import { usePressTheme } from '@/stores/pressTheme'
import { useCloud } from '@/stores/cloud'

export function BulkDownloadWarningModal(): React.JSX.Element | null {
  const c = usePressTheme()
  const { bulkWarningCount, resolveBulk } = useCloud()
  const [resolving, setResolving] = useState<'download' | 'skip' | 'gallery' | null>(null)

  if (bulkWarningCount === null) return null

  const panelShadow = `0 0 0 1px ${c.borderDark}, 0 24px 48px ${c.shadowColor}0.7), inset 0 1px 0 ${c.highlightColor}0.12)`
  const buttonShadow = `0 2px 4px ${c.shadowColor}0.4), inset 0 1px 0 ${c.highlightColor}0.12)`
  const buttonShadowHover = `0 4px 8px ${c.shadowColor}0.5), inset 0 1px 0 ${c.highlightColor}0.16)`

  const handleAction = async (action: 'download' | 'skip' | 'gallery'): Promise<void> => {
    setResolving(action)
    try {
      await resolveBulk(action)
    } catch (err) {
      console.error('Failed to resolve bulk warning:', err)
      setResolving(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
    >
      <div
        className="w-full max-w-md rounded-lg"
        style={{
          backgroundColor: c.baseMid,
          boxShadow: panelShadow,
          border: `1px solid ${c.borderColor}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 rounded-t-lg px-5 py-4"
          style={{
            backgroundColor: c.baseDark,
            borderBottom: `1px solid ${c.borderDark}`,
          }}
        >
          <span
            className="block h-2 w-2 rounded-full"
            style={{ backgroundColor: c.ledAmber, boxShadow: `0 0 6px ${c.ledAmber}` }}
            aria-hidden
          />
          <h2
            className="text-xs font-bold uppercase tracking-[0.12em]"
            style={{ color: c.textPrimary, fontFamily: 'JetBrains Mono, monospace' }}
          >
            Large Batch Detected
          </h2>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Warning icon + count */}
          <div className="mb-5 flex items-start gap-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded"
              style={{ backgroundColor: `${c.ledAmber}18`, border: `1px solid ${c.ledAmber}30` }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: c.ledAmber }} />
            </div>
            <div>
              <p
                className="text-sm font-bold uppercase tracking-[0.06em]"
                style={{ color: c.textPrimary }}
              >
                {bulkWarningCount} photos ready to download
              </p>
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ color: c.textMuted }}
              >
                Auto-print is paused. Downloading and printing this many photos may take a
                while. Choose how to proceed.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {/* Download All */}
            <button
              onClick={() => handleAction('download')}
              disabled={resolving !== null}
              className="flex w-full items-center gap-3 rounded px-4 py-3 text-left transition-all"
              style={{
                backgroundColor: resolving === 'download' ? `${c.accent}20` : c.baseDark,
                border: `1px solid ${resolving === 'download' ? c.accent : c.borderColor}`,
                boxShadow: buttonShadow,
                opacity: resolving !== null && resolving !== 'download' ? 0.4 : 1,
                cursor: resolving !== null ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (resolving === null) {
                  e.currentTarget.style.borderColor = c.accent
                  e.currentTarget.style.boxShadow = `0 0 0 1px ${c.accent}40, ${buttonShadowHover}`
                }
              }}
              onMouseLeave={(e) => {
                if (resolving === null) {
                  e.currentTarget.style.borderColor = c.borderColor
                  e.currentTarget.style.boxShadow = buttonShadow
                }
              }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                style={{ backgroundColor: `${c.accent}18` }}
              >
                <Download className="h-3.5 w-3.5" style={{ color: c.accent }} />
              </div>
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-[0.06em]"
                  style={{ color: c.textPrimary }}
                >
                  {resolving === 'download' ? 'Downloading…' : 'Download All'}
                </div>
                <div className="mt-0.5 text-[10px]" style={{ color: c.textMuted }}>
                  Download and print all {bulkWarningCount} photos
                </div>
              </div>
            </button>

            {/* Download to Gallery */}
            <button
              onClick={() => handleAction('gallery')}
              disabled={resolving !== null}
              className="flex w-full items-center gap-3 rounded px-4 py-3 text-left transition-all"
              style={{
                backgroundColor: resolving === 'gallery' ? `${c.ledGreen}15` : c.baseDark,
                border: `1px solid ${resolving === 'gallery' ? c.ledGreen : c.borderColor}`,
                boxShadow: buttonShadow,
                opacity: resolving !== null && resolving !== 'gallery' ? 0.4 : 1,
                cursor: resolving !== null ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (resolving === null) {
                  e.currentTarget.style.borderColor = c.ledGreen
                  e.currentTarget.style.boxShadow = `0 0 0 1px ${c.ledGreen}30, ${buttonShadowHover}`
                }
              }}
              onMouseLeave={(e) => {
                if (resolving === null) {
                  e.currentTarget.style.borderColor = c.borderColor
                  e.currentTarget.style.boxShadow = buttonShadow
                }
              }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                style={{ backgroundColor: `${c.ledGreen}15` }}
              >
                <FolderOpen className="h-3.5 w-3.5" style={{ color: c.ledGreen }} />
              </div>
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-[0.06em]"
                  style={{ color: c.textPrimary }}
                >
                  {resolving === 'gallery' ? 'Saving to Gallery…' : 'Download to Gallery'}
                </div>
                <div className="mt-0.5 text-[10px]" style={{ color: c.textMuted }}>
                  Save all {bulkWarningCount} photos for manual printing — no auto-print
                </div>
              </div>
            </button>

            {/* Mark All Complete */}
            <button
              onClick={() => handleAction('skip')}
              disabled={resolving !== null}
              className="flex w-full items-center gap-3 rounded px-4 py-3 text-left transition-all"
              style={{
                backgroundColor: resolving === 'skip' ? `${c.ledAmber}15` : c.baseDark,
                border: `1px solid ${resolving === 'skip' ? c.ledAmber : c.borderColor}`,
                boxShadow: buttonShadow,
                opacity: resolving !== null && resolving !== 'skip' ? 0.4 : 1,
                cursor: resolving !== null ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (resolving === null) {
                  e.currentTarget.style.borderColor = c.ledAmber
                  e.currentTarget.style.boxShadow = `0 0 0 1px ${c.ledAmber}30, ${buttonShadowHover}`
                }
              }}
              onMouseLeave={(e) => {
                if (resolving === null) {
                  e.currentTarget.style.borderColor = c.borderColor
                  e.currentTarget.style.boxShadow = buttonShadow
                }
              }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                style={{ backgroundColor: `${c.ledAmber}15` }}
              >
                <CheckCheck className="h-3.5 w-3.5" style={{ color: c.ledAmber }} />
              </div>
              <div>
                <div
                  className="text-xs font-bold uppercase tracking-[0.06em]"
                  style={{ color: c.textPrimary }}
                >
                  {resolving === 'skip' ? 'Marking Complete…' : 'Mark All Complete'}
                </div>
                <div className="mt-0.5 text-[10px]" style={{ color: c.textMuted }}>
                  Skip download — mark all {bulkWarningCount} photos as already processed
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
