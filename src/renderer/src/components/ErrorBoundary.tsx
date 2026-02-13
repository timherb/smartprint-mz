import React from 'react'
import { cn } from '@/lib/utils'
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Optional label shown in the fallback UI to identify which section crashed */
  label?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  detailsOpen: boolean
}

// ---------------------------------------------------------------------------
// ErrorBoundary — class component (required by React error boundary API)
// ---------------------------------------------------------------------------

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      detailsOpen: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo })
    console.error(
      `[ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ''}] Caught error:`,
      error,
      errorInfo,
    )
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      detailsOpen: false,
    })
  }

  private toggleDetails = (): void => {
    this.setState((prev) => ({ detailsOpen: !prev.detailsOpen }))
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { error, errorInfo, detailsOpen } = this.state
    const label = this.props.label ?? 'This section'

    return (
      <div
        className="flex h-full w-full items-center justify-center p-8"
        style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
      >
        <div
          className={cn(
            'flex w-full max-w-lg flex-col items-center gap-6 rounded-2xl p-8',
            'border border-border/60 bg-card text-card-foreground shadow-sm',
          )}
        >
          {/* Icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#c57d3c]/10">
            <AlertTriangle className="h-7 w-7 text-[#c57d3c]" />
          </div>

          {/* Heading */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-lg font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground">
              {label} encountered an unexpected error. You can try again or
              switch to another tab.
            </p>
          </div>

          {/* Try Again button */}
          <button
            type="button"
            onClick={this.handleReset}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium',
              'bg-[#c57d3c] text-white',
              'transition-all duration-200',
              'hover:bg-[#b06e33] hover:scale-[1.02]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c57d3c]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>

          {/* Expandable technical details */}
          {error && (
            <div className="w-full">
              <button
                type="button"
                onClick={this.toggleDetails}
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground',
                  'transition-colors duration-200 hover:text-foreground',
                )}
              >
                {detailsOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Technical details
              </button>

              {detailsOpen && (
                <div
                  className={cn(
                    'mt-3 max-h-48 overflow-auto rounded-xl',
                    'border border-border/40 bg-secondary/50 p-4',
                  )}
                >
                  <p className="mb-2 text-xs font-medium text-destructive">
                    {error.name}: {error.message}
                  </p>
                  {errorInfo?.componentStack && (
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                      {errorInfo.componentStack.trim()}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}
