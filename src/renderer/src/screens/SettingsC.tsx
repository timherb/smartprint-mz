import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Wifi,
  Printer,
  FolderOpen,
  Wrench,
  Check,
  ChevronRight
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectionId = 'connection' | 'printers' | 'file-handling' | 'advanced'

interface PrinterRow {
  id: string
  name: string
  model: string
  status: 'online' | 'offline' | 'error'
  inPool: boolean
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'connection', label: 'Connection', icon: Wifi },
  { id: 'printers', label: 'Printers', icon: Printer },
  { id: 'file-handling', label: 'File Handling', icon: FolderOpen },
  { id: 'advanced', label: 'Advanced', icon: Wrench }
]

const INITIAL_PRINTERS: PrinterRow[] = [
  { id: 'p1', name: 'DNP DS620', model: 'DS620', status: 'online', inPool: true },
  { id: 'p2', name: 'DNP DS820', model: 'DS820', status: 'online', inPool: true },
  { id: 'p3', name: 'Canon Selphy CP1500', model: 'CP1500', status: 'offline', inPool: false },
  { id: 'p4', name: 'Mitsubishi CP-D90DW', model: 'CP-D90DW', status: 'error', inPool: false },
  { id: 'p5', name: 'HiTi P525L', model: 'P525L', status: 'online', inPool: true }
]

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'tiff', 'bmp', 'heic'] as const

const RAW_CONFIG = `{
  "version": "0.1.0",
  "connection": {
    "mode": "usb",
    "host": "192.168.1.100",
    "port": 9100
  },
  "printerPool": ["p1", "p2", "p5"],
  "watchDirectory": "/Volumes/Events/photos",
  "fileSizeLimitMB": 50,
  "supportedExtensions": ["jpg", "jpeg", "png"],
  "logLevel": "info",
  "pollIntervalMs": 2000,
  "retryAttempts": 3
}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(s: PrinterRow['status']): string {
  switch (s) {
    case 'online':
      return 'text-emerald-400'
    case 'offline':
      return 'text-zinc-500'
    case 'error':
      return 'text-red-400'
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
      {children}
    </h2>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-zinc-400">{children}</label>
}

function InputField({
  value,
  onChange,
  className,
  type = 'text',
  placeholder,
  mono = false,
  disabled = false
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  type?: string
  placeholder?: string
  mono?: boolean
  disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'h-7 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-foreground',
        'outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30',
        'disabled:cursor-not-allowed disabled:opacity-40',
        mono && 'font-mono',
        className
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// Section: Connection
// ---------------------------------------------------------------------------

function ConnectionSection() {
  const [mode, setMode] = useState<'usb' | 'network' | 'cloud'>('usb')
  const [host, setHost] = useState('192.168.1.100')
  const [port, setPort] = useState('9100')
  const [apiKey, setApiKey] = useState('')

  const modes: { value: typeof mode; label: string; desc: string }[] = [
    { value: 'usb', label: 'USB Direct', desc: 'Direct USB connection to printers' },
    { value: 'network', label: 'Network', desc: 'TCP/IP connection over LAN' },
    { value: 'cloud', label: 'Cloud API', desc: 'Remote cloud print service' }
  ]

  return (
    <div>
      <SectionHeading>Connection</SectionHeading>

      <div className="space-y-4">
        {/* Mode radio buttons */}
        <div>
          <FieldLabel>Connection Mode</FieldLabel>
          <div className="mt-2 space-y-1">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded px-3 py-2 text-left text-xs transition-colors',
                  mode === m.value
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300'
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    mode === m.value
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-zinc-600'
                  )}
                >
                  {mode === m.value && (
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-950" />
                  )}
                </span>
                <span>
                  <span className="font-medium text-foreground">{m.label}</span>
                  <span className="ml-2 text-zinc-500">{m.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Inline config fields */}
        {mode === 'network' && (
          <div className="grid grid-cols-[1fr_100px] gap-3 pl-7">
            <div>
              <FieldLabel>Host</FieldLabel>
              <InputField
                value={host}
                onChange={setHost}
                placeholder="192.168.1.100"
                mono
                className="mt-1 w-full"
              />
            </div>
            <div>
              <FieldLabel>Port</FieldLabel>
              <InputField
                value={port}
                onChange={setPort}
                placeholder="9100"
                mono
                className="mt-1 w-full"
              />
            </div>
          </div>
        )}

        {mode === 'cloud' && (
          <div className="pl-7">
            <FieldLabel>API Key</FieldLabel>
            <InputField
              value={apiKey}
              onChange={setApiKey}
              placeholder="sk-..."
              mono
              className="mt-1 w-full"
              type="password"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section: Printers
// ---------------------------------------------------------------------------

function PrintersSection() {
  const [printers, setPrinters] = useState<PrinterRow[]>(INITIAL_PRINTERS)

  function togglePool(id: string) {
    setPrinters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, inPool: !p.inPool } : p))
    )
  }

  return (
    <div>
      <SectionHeading>Printers</SectionHeading>

      <div className="overflow-hidden rounded border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="w-9 px-3 py-2 text-left font-medium text-zinc-500">Pool</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500">Name</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500">Model</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {printers.map((p, i) => (
              <tr
                key={p.id}
                className={cn(
                  'border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/40',
                  i === printers.length - 1 && 'border-b-0'
                )}
              >
                <td className="px-3 py-1.5">
                  <button
                    onClick={() => togglePool(p.id)}
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                      p.inPool
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-zinc-600 hover:border-zinc-500'
                    )}
                    aria-label={`Toggle ${p.name} in pool`}
                  >
                    {p.inPool && <Check className="h-3 w-3 text-zinc-950" strokeWidth={3} />}
                  </button>
                </td>
                <td className="px-3 py-1.5 font-medium text-foreground">{p.name}</td>
                <td className="px-3 py-1.5 font-mono text-zinc-400">{p.model}</td>
                <td className={cn('px-3 py-1.5 font-mono', statusColor(p.status))}>
                  {p.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-zinc-600">
        {printers.filter((p) => p.inPool).length} printer(s) in active pool
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section: File Handling
// ---------------------------------------------------------------------------

function FileHandlingSection() {
  const [watchDir, setWatchDir] = useState('/Volumes/Events/photos')
  const [maxSize, setMaxSize] = useState('50')
  const [enabledExts, setEnabledExts] = useState<Set<string>>(
    new Set(['jpg', 'jpeg', 'png'])
  )

  function toggleExt(ext: string) {
    setEnabledExts((prev) => {
      const next = new Set(prev)
      if (next.has(ext)) {
        next.delete(ext)
      } else {
        next.add(ext)
      }
      return next
    })
  }

  return (
    <div>
      <SectionHeading>File Handling</SectionHeading>

      <div className="space-y-4">
        <div>
          <FieldLabel>Watch Directory</FieldLabel>
          <div className="mt-1 flex gap-2">
            <InputField
              value={watchDir}
              onChange={setWatchDir}
              mono
              className="flex-1"
            />
            <button className="h-7 rounded border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-foreground">
              Browse
            </button>
          </div>
        </div>

        <div>
          <FieldLabel>Max File Size (MB)</FieldLabel>
          <InputField
            value={maxSize}
            onChange={setMaxSize}
            type="number"
            mono
            className="mt-1 w-24"
          />
        </div>

        <div>
          <FieldLabel>Supported Extensions</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {EXTENSIONS.map((ext) => (
              <button
                key={ext}
                onClick={() => toggleExt(ext)}
                className={cn(
                  'rounded border px-2.5 py-1 font-mono text-xs transition-colors',
                  enabledExts.has(ext)
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
                )}
              >
                .{ext}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section: Advanced
// ---------------------------------------------------------------------------

function AdvancedSection() {
  const [logLevel, setLogLevel] = useState('info')
  const [pollInterval, setPollInterval] = useState('2000')
  const [retryAttempts, setRetryAttempts] = useState('3')

  return (
    <div>
      <SectionHeading>Advanced</SectionHeading>

      <div className="space-y-4">
        {/* Inline settings row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <FieldLabel>Log Level</FieldLabel>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className={cn(
                'mt-1 h-7 w-full rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-foreground',
                'outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
              )}
            >
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </div>
          <div>
            <FieldLabel>Poll Interval (ms)</FieldLabel>
            <InputField
              value={pollInterval}
              onChange={setPollInterval}
              mono
              type="number"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <FieldLabel>Retry Attempts</FieldLabel>
            <InputField
              value={retryAttempts}
              onChange={setRetryAttempts}
              mono
              type="number"
              className="mt-1 w-full"
            />
          </div>
        </div>

        {/* Raw JSON viewer */}
        <div>
          <FieldLabel>Raw Configuration</FieldLabel>
          <pre
            className={cn(
              'mt-1 max-h-52 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3',
              'font-mono text-[11px] leading-relaxed text-zinc-400',
              'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700'
            )}
          >
            {RAW_CONFIG}
          </pre>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Settings Screen
// ---------------------------------------------------------------------------

export default function SettingsC() {
  const [activeSection, setActiveSection] = useState<SectionId>('connection')

  const sectionContent: Record<SectionId, React.ReactNode> = {
    connection: <ConnectionSection />,
    printers: <PrintersSection />,
    'file-handling': <FileHandlingSection />,
    advanced: <AdvancedSection />
  }

  return (
    <div className="flex h-full">
      {/* Left navigation */}
      <nav className="w-48 shrink-0 border-r border-zinc-800 py-3">
        <div className="px-4 pb-3">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
            Settings
          </span>
        </div>
        <ul className="space-y-0.5 px-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const active = activeSection === s.id
            return (
              <li key={s.id}>
                <button
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-xs transition-colors',
                    active
                      ? 'bg-zinc-800 text-emerald-400'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">{s.label}</span>
                  {active && <ChevronRight className="h-3 w-3 text-zinc-600" />}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Right content panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {sectionContent[activeSection]}
        </div>

        {/* Apply button fixed at bottom-right */}
        <div className="flex items-center justify-end border-t border-zinc-800 px-6 py-3">
          <button
            className={cn(
              'rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white',
              'transition-colors hover:bg-emerald-500',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-1 focus:ring-offset-zinc-950'
            )}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  )
}
