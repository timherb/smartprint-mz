import { EventEmitter } from 'node:events'
import { stat, mkdir, rename, access, constants } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import winston from 'winston'

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export interface PhotoReadyPayload {
  filepath: string
  filename: string
  sizeBytes: number
}

export interface PhotoPrintedPayload {
  filename: string
  destination: string
}

export interface WatchErrorPayload {
  error: Error
  filepath?: string
}

export interface LocalWatcherEvents {
  'photo-ready': [payload: PhotoReadyPayload]
  'photo-printed': [payload: PhotoPrintedPayload]
  'watch-error': [payload: WatchErrorPayload]
}

export interface LocalWatcherOptions {
  /** Maximum file size in bytes (default: 20 MB) */
  maxFileSize?: number
  /** Milliseconds to wait for writes to finish (default: 2000) */
  stabilityThreshold?: number
  /** Polling interval in ms used by awaitWriteFinish (default: 100) */
  pollInterval?: number
  /** Name of the subdirectory for printed photos (default: "Printed Photos") */
  printedDirName?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])
const DEFAULT_PRINTED_DIR = 'Printed Photos'
const STABILITY_THRESHOLD = 2000
const POLL_INTERVAL = 100

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
      return `${timestamp} [LocalWatcher] ${level}: ${message}${metaStr}`
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'smart-print-watcher.log',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3
    })
  ]
})

// ---------------------------------------------------------------------------
// Helper: parse expected size from filename
// ---------------------------------------------------------------------------

/**
 * Attempt to parse the expected file size (in bytes) from the filename.
 * Convention: the filename contains the expected size as a numeric token,
 * e.g. "photo_1234567.jpg" where 1234567 is the size in bytes.
 *
 * Returns `undefined` if no numeric token is found.
 */
/**
 * Parse expected file size from filename. Only matches filenames that
 * explicitly encode the size in bytes, e.g.:
 *   - "photo_size_12345678.jpg" → 12345678
 *   - "IMG_4821_bytes_3456789.jpg" → 3456789
 *
 * Regular camera filenames (IMG_4821.jpg, DSC_0142.jpg) return undefined
 * and skip the size check — they pass through to printing.
 */
function parseExpectedSize(filename: string): number | undefined {
  // Only match explicit size markers like _size_NNNN or _bytes_NNNN
  const sizeMatch = filename.match(/[_-](?:size|bytes)[_-](\d+)/i)
  if (!sizeMatch) return undefined
  const candidate = parseInt(sizeMatch[1], 10)
  // Size must be at least 1KB to be a realistic file size
  return Number.isFinite(candidate) && candidate >= 1024 ? candidate : undefined
}

// ---------------------------------------------------------------------------
// LocalWatcher
// ---------------------------------------------------------------------------

export class LocalWatcher extends EventEmitter<LocalWatcherEvents> {
  private watcher: FSWatcher | null = null
  private watchDirectory: string | null = null
  private printedDirName: string
  private maxFileSize: number
  private stabilityThreshold: number
  private pollInterval: number
  private isRunning = false

  constructor(options?: LocalWatcherOptions) {
    super()
    this.maxFileSize = options?.maxFileSize ?? MAX_FILE_SIZE_BYTES
    this.stabilityThreshold = options?.stabilityThreshold ?? STABILITY_THRESHOLD
    this.pollInterval = options?.pollInterval ?? POLL_INTERVAL
    this.printedDirName = options?.printedDirName ?? DEFAULT_PRINTED_DIR
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Begin watching `directory` for new image files. */
  async start(directory: string): Promise<void> {
    if (this.isRunning) {
      logger.warn('Watcher is already running, stopping previous instance first')
      await this.stop()
    }

    // Validate directory is accessible
    try {
      await access(directory, constants.R_OK)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error('Cannot access watch directory', { directory, error: error.message })
      this.emit('watch-error', { error, filepath: directory })
      throw error
    }

    this.watchDirectory = directory

    // Ensure "Printed Photos" subdirectory exists
    const printedDir = join(directory, this.printedDirName)
    try {
      await mkdir(printedDir, { recursive: true })
      logger.info('Printed photos directory ready', { printedDir })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error('Failed to create printed photos directory', {
        printedDir,
        error: error.message
      })
      this.emit('watch-error', { error, filepath: printedDir })
      throw error
    }

    // Create chokidar watcher
    this.watcher = watch(directory, {
      ignoreInitial: false, // Pick up existing files when watcher starts
      depth: 0, // only watch the top-level directory, not subdirectories
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: this.stabilityThreshold,
        pollInterval: this.pollInterval
      },
      ignored: [
        // Ignore the printed photos subdirectory
        join(directory, this.printedDirName, '**'),
        // Ignore non-image files via a matcher function
        (filePath: string) => {
          const ext = extname(filePath).toLowerCase()
          // Allow directories (so chokidar can traverse)
          // and image files with allowed extensions
          if (ext === '') return false
          return !ALLOWED_EXTENSIONS.has(ext)
        }
      ]
    })

    this.watcher.on('add', (filePath) => {
      void this.handleFileAdd(filePath)
    })

    this.watcher.on('error', (err) => {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error('Chokidar watcher error', { error: error.message })
      this.emit('watch-error', { error })
    })

    this.isRunning = true
    logger.info('Watcher started', { directory })
  }

  /** Stop watching and clean up resources. */
  async stop(): Promise<void> {
    if (!this.isRunning && !this.watcher) {
      logger.debug('Watcher is not running, nothing to stop')
      return
    }

    if (this.watcher) {
      try {
        await this.watcher.close()
        logger.info('Chokidar watcher closed')
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        logger.error('Error closing chokidar watcher', { error: error.message })
      }
      this.watcher = null
    }

    this.isRunning = false
    this.watchDirectory = null
    logger.info('Watcher stopped')
  }

  /**
   * Move a processed/printed file to the "Printed Photos" subdirectory.
   * Throws if the watch directory is not set or the move fails.
   */
  async moveToProcessed(filepath: string): Promise<void> {
    if (!this.watchDirectory) {
      const error = new Error('Watcher is not running; cannot move file')
      logger.error(error.message, { filepath })
      this.emit('watch-error', { error, filepath })
      throw error
    }

    const filename = basename(filepath)
    const printedDir = join(this.watchDirectory, this.printedDirName)
    const destination = join(printedDir, filename)

    try {
      // Ensure printed directory still exists
      await mkdir(printedDir, { recursive: true })

      // Check source file is accessible
      await access(filepath, constants.R_OK | constants.W_OK)

      // Move the file
      await rename(filepath, destination)

      logger.info('File moved to printed directory', { filename, destination })
      this.emit('photo-printed', { filename, destination })
    } catch (err) {
      const error = this.normalizeFileError(err, filepath)
      logger.error('Failed to move file to printed directory', {
        filepath,
        destination,
        error: error.message
      })
      this.emit('watch-error', { error, filepath })
      throw error
    }
  }

  /** Returns whether the watcher is currently active. */
  get running(): boolean {
    return this.isRunning
  }

  /** Returns the current watch directory, or null if not watching. */
  get directory(): string | null {
    return this.watchDirectory
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async handleFileAdd(filePath: string): Promise<void> {
    const filename = basename(filePath)
    logger.debug('File detected', { filename, filePath })

    // Double-check extension (belt-and-suspenders with chokidar ignore)
    const ext = extname(filename).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      logger.debug('Ignoring non-image file', { filename })
      return
    }

    // Stat the file to get its size
    let fileStats
    try {
      fileStats = await stat(filePath)
    } catch (err) {
      const error = this.normalizeFileError(err, filePath)
      logger.warn('Cannot stat file, it may have been removed', {
        filename,
        error: error.message
      })
      this.emit('watch-error', { error, filepath: filePath })
      return
    }

    const sizeBytes = fileStats.size

    // Enforce max file size
    if (sizeBytes > this.maxFileSize) {
      logger.warn('File exceeds maximum size limit, skipping', {
        filename,
        sizeBytes,
        maxFileSize: this.maxFileSize
      })
      return
    }

    // Verify file completeness via filename-embedded size
    const expectedSize = parseExpectedSize(filename)
    if (expectedSize !== undefined) {
      if (sizeBytes !== expectedSize) {
        logger.warn('File size mismatch: transfer may be incomplete', {
          filename,
          expectedSize,
          actualSize: sizeBytes
        })
        return
      }
      logger.debug('File size verified against filename', {
        filename,
        expectedSize,
        actualSize: sizeBytes
      })
    } else {
      logger.debug('No expected size in filename, accepting file as-is', { filename, sizeBytes })
    }

    // Verify the file is readable (not locked)
    try {
      await access(filePath, constants.R_OK)
    } catch (err) {
      const error = this.normalizeFileError(err, filePath)
      logger.warn('File is not readable (possibly locked)', {
        filename,
        error: error.message
      })
      this.emit('watch-error', { error, filepath: filePath })
      return
    }

    logger.info('Photo ready for printing', { filename, sizeBytes })
    this.emit('photo-ready', { filepath: filePath, filename, sizeBytes })
  }

  /**
   * Normalize file-system errors into categorised Error instances with
   * helpful messages for locked files, permission issues, and disk space.
   */
  private normalizeFileError(err: unknown, filepath: string): Error {
    if (err instanceof Error) {
      const nodeError = err as NodeJS.ErrnoException
      switch (nodeError.code) {
        case 'EBUSY':
        case 'EPERM':
          return new Error(`File is locked or in use: ${filepath} (${nodeError.code})`)
        case 'EACCES':
          return new Error(`Permission denied: ${filepath}`)
        case 'ENOSPC':
          return new Error(`Disk space insufficient for operation on: ${filepath}`)
        case 'ENOENT':
          return new Error(`File not found: ${filepath}`)
        default:
          return err
      }
    }
    return new Error(String(err))
  }
}
