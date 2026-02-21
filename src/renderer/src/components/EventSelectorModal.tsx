/**
 * EventSelectorModal — Persistent blocking modal for cloud event selection.
 *
 * Shown when: mode === 'cloud' AND registered AND no event selected.
 * Cannot be dismissed without selecting an event.
 * Syncs today's events from the API on mount; user must choose one before
 * cloud polling begins.
 */

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Calendar, CheckCircle2 } from 'lucide-react'
import { usePressTheme } from '@/stores/pressTheme'
import { useSettings } from '@/stores/settings'
import { useCloud } from '@/stores/cloud'

interface CloudEvent {
  id: number
  name: string
  externalID: string
  startDate: string
  endDate: string
  testEvent: string
}

function formatDateRange(startDate: string, endDate: string): string {
  try {
    const fmt = (d: string): string =>
      new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    return `${fmt(startDate)} – ${fmt(endDate)}`
  } catch {
    return `${startDate} – ${endDate}`
  }
}

export function EventSelectorModal(): React.JSX.Element | null {
  const c = usePressTheme()
  const { mode, approvedOnly } = useSettings()
  const { registered, selectedEventId, events, syncEvents, selectEvent, start } = useCloud()

  const [loading, setLoading] = useState(false)
  const [selecting, setSelecting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const visible = mode === 'cloud' && registered && selectedEventId === null

  const handleSync = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await syncEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [syncEvents])

  // Sync events when modal becomes visible; clear stale local state when hidden
  useEffect(() => {
    if (visible) {
      handleSync()
    } else {
      setSelecting(null)
      setError(null)
    }
  }, [visible, handleSync])

  const handleSelect = async (event: CloudEvent): Promise<void> => {
    setSelecting(event.id)
    try {
      // Push approved-only setting to main process before starting
      await window.api.cloud.setApprovedOnly(approvedOnly)
      await selectEvent(event.id)
      // Fire start() without awaiting — it triggers an immediate poll which
      // can take time. selectedEventId is already set so the modal closes now.
      void start()
    } catch (err) {
      console.error('Failed to select event:', err)
      setSelecting(null)
    }
  }

  if (!visible) return null

  const panelShadow = `0 0 0 1px ${c.borderDark}, 0 24px 48px ${c.shadowColor}0.7), inset 0 1px 0 ${c.highlightColor}0.12)`
  const buttonShadow = `0 2px 4px ${c.shadowColor}0.4), inset 0 1px 0 ${c.highlightColor}0.12)`
  const buttonShadowHover = `0 4px 8px ${c.shadowColor}0.5), inset 0 1px 0 ${c.highlightColor}0.16)`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="w-full max-w-lg rounded-lg"
        style={{
          backgroundColor: c.baseMid,
          boxShadow: panelShadow,
          border: `1px solid ${c.borderColor}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between rounded-t-lg px-5 py-4"
          style={{
            backgroundColor: c.baseDark,
            borderBottom: `1px solid ${c.borderDark}`,
          }}
        >
          <div className="flex items-center gap-3">
            {/* Accent LED */}
            <span
              className="block h-2 w-2 rounded-full"
              style={{ backgroundColor: c.accent, boxShadow: `0 0 6px ${c.accentGlow}` }}
              aria-hidden
            />
            <h2
              className="text-xs font-bold uppercase tracking-[0.12em]"
              style={{ color: c.textPrimary, fontFamily: 'JetBrains Mono, monospace' }}
            >
              Select Event
            </h2>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleSync}
            disabled={loading}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-all"
            style={{
              backgroundColor: c.baseMid,
              color: loading ? c.textMuted : c.textPrimary,
              boxShadow: buttonShadow,
              border: `1px solid ${c.borderColor}`,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.boxShadow = buttonShadowHover
                e.currentTarget.style.color = c.accent
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = buttonShadow
              e.currentTarget.style.color = loading ? c.textMuted : c.textPrimary
            }}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p
            className="mb-4 text-xs uppercase tracking-[0.06em]"
            style={{ color: c.textMuted }}
          >
            Choose an event to begin cloud printing. Only images for the selected
            event will be downloaded.
          </p>

          {/* Error state */}
          {error && (
            <div
              className="mb-4 rounded px-3 py-2 text-xs"
              style={{
                backgroundColor: `${c.ledRed}18`,
                border: `1px solid ${c.ledRed}40`,
                color: c.ledRed,
              }}
            >
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && events.length === 0 && (
            <div
              className="flex items-center justify-center gap-2 py-8 text-xs uppercase tracking-[0.08em]"
              style={{ color: c.textMuted }}
            >
              <RefreshCw className="h-3 w-3 animate-spin" />
              Loading events…
            </div>
          )}

          {/* Empty state */}
          {!loading && events.length === 0 && !error && (
            <div
              className="py-8 text-center text-xs uppercase tracking-[0.08em]"
              style={{ color: c.textMuted }}
            >
              No events found for today
            </div>
          )}

          {/* Event list */}
          {events.length > 0 && (
            <div className="space-y-2">
              {events.map((event) => {
                const isSelecting = selecting === event.id
                const isTest = event.testEvent === 'true' || event.testEvent === '1'

                return (
                  <button
                    key={event.id}
                    onClick={() => handleSelect(event)}
                    disabled={selecting !== null}
                    className="w-full rounded text-left transition-all"
                    style={{
                      backgroundColor: c.baseDark,
                      border: `1px solid ${c.borderColor}`,
                      boxShadow: buttonShadow,
                      opacity: selecting !== null && !isSelecting ? 0.5 : 1,
                      cursor: selecting !== null ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (selecting === null) {
                        e.currentTarget.style.borderColor = c.accent
                        e.currentTarget.style.boxShadow = `0 0 0 1px ${c.accent}40, ${buttonShadowHover}`
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = c.borderColor
                      e.currentTarget.style.boxShadow = buttonShadow
                    }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Left: icon */}
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                        style={{ backgroundColor: `${c.accent}18` }}
                      >
                        {isSelecting ? (
                          <RefreshCw
                            className="h-3.5 w-3.5 animate-spin"
                            style={{ color: c.accent }}
                          />
                        ) : (
                          <Calendar
                            className="h-3.5 w-3.5"
                            style={{ color: c.accent }}
                          />
                        )}
                      </div>

                      {/* Center: name + dates */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="truncate text-xs font-bold uppercase tracking-[0.06em]"
                            style={{ color: c.textPrimary }}
                          >
                            {event.name}
                          </span>
                          {isTest && (
                            <span
                              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                              style={{
                                backgroundColor: `${c.ledAmber}20`,
                                color: c.ledAmber,
                                border: `1px solid ${c.ledAmber}40`,
                              }}
                            >
                              TEST
                            </span>
                          )}
                        </div>
                        <div
                          className="mt-0.5 text-[10px] font-mono"
                          style={{ color: c.textMuted }}
                        >
                          {formatDateRange(event.startDate, event.endDate)}
                        </div>
                      </div>

                      {/* Right: select indicator */}
                      {isSelecting ? (
                        <span
                          className="text-[10px] uppercase tracking-[0.08em]"
                          style={{ color: c.accent }}
                        >
                          Starting…
                        </span>
                      ) : (
                        <CheckCircle2
                          className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                          style={{ color: c.accent }}
                        />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
