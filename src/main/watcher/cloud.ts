/**
 * F004 - Cloud polling service
 *
 * Polls the cloud API for new photos, downloads them to a local temp directory,
 * verifies file sizes, and emits events compatible with the local watcher pattern.
 */

import { EventEmitter } from 'events'
import { join } from 'path'
import { app } from 'electron'
import { writeFile, mkdir, stat } from 'fs/promises'
import { createLogger, format, transports } from 'winston'
import {
  registerDevice,
  fetchPhotos,
  confirmPrint as apiConfirmPrint,
  checkHealth as apiCheckHealth,
  downloadFile,
  getAuthToken,
  setAuthToken,
  getPollInterval,
  getHealthInterval,
  checkNetworkConnectivity,
  type PhotoEntry,
  type HealthResponse
} from '../api'

// ─── Logger ───────────────────────────────────────────────────────────────────

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(
      ({ timestamp, level, message }) => `${timestamp} [cloud-watcher] ${level}: ${message}`
    )
  ),
  transports: [new transports.Console()]
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloudWatcherEvents {
  'photo-ready': (filePath: string, filename: string) => void
  'cloud-error': (error: Error) => void
  'connection-status': (connected: boolean) => void
}

export interface CloudWatcherStatus {
  registered: boolean
  polling: boolean
  connected: boolean
  lastPollTime: number | null
  lastHealthCheckTime: number | null
}

// ─── Registration Key Validation ──────────────────────────────────────────────

const REGISTRATION_KEY_PATTERN = /^\d{12}$/

function isValidRegistrationKey(key: string): boolean {
  return REGISTRATION_KEY_PATTERN.test(key)
}

// ─── Cloud Watcher Class ──────────────────────────────────────────────────────

export class CloudWatcher extends EventEmitter {
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private isPolling = false
  private connected = false
  private lastPollTime: number | null = null
  private lastHealthCheckTime: number | null = null
  private downloadDir: string
  private processedFiles: Set<string> = new Set()

  constructor() {
    super()
    this.downloadDir = join(app.getPath('temp'), 'smart-print-cloud')
  }

  // ─── Event Typing Overrides ───────────────────────────────────────────────

  override emit<K extends keyof CloudWatcherEvents>(
    event: K,
    ...args: Parameters<CloudWatcherEvents[K]>
  ): boolean {
    return super.emit(event, ...args)
  }

  override on<K extends keyof CloudWatcherEvents>(
    event: K,
    listener: CloudWatcherEvents[K]
  ): this {
    return super.on(event, listener)
  }

  override once<K extends keyof CloudWatcherEvents>(
    event: K,
    listener: CloudWatcherEvents[K]
  ): this {
    return super.once(event, listener)
  }

  // ─── Public Methods ───────────────────────────────────────────────────────

  /**
   * Register this device with a 12-digit registration key.
   * Stores the received auth token in electron-store.
   */
  async register(key: string): Promise<{ success: boolean; error?: string }> {
    if (!isValidRegistrationKey(key)) {
      const msg = `Invalid registration key: must be exactly 12 digits`
      logger.error(msg)
      return { success: false, error: msg }
    }

    try {
      logger.info(`Registering device with key: ${key.slice(0, 4)}****${key.slice(-4)}`)
      const response = await registerDevice(key)
      setAuthToken(response.token)
      logger.info('Device registered successfully — token stored')
      return { success: true }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Registration failed: ${error.message}`)
      this.emit('cloud-error', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Start polling for new photos and running health checks.
   */
  async start(): Promise<void> {
    const token = getAuthToken()
    if (!token) {
      const error = new Error('Cannot start polling: no auth token. Register first.')
      logger.error(error.message)
      this.emit('cloud-error', error)
      return
    }

    // Ensure download directory exists
    await this.ensureDownloadDir()

    // Clear any existing timers
    this.stop()

    logger.info('Starting cloud polling service')

    // Perform an initial poll immediately
    await this.poll()

    // Set up recurring poll timer
    const pollInterval = getPollInterval()
    this.pollTimer = setInterval(() => {
      void this.poll()
    }, pollInterval)
    logger.info(`Photo polling interval: ${pollInterval}ms`)

    // Perform an initial health check immediately
    await this.performHealthCheck()

    // Set up recurring health check timer
    const healthInterval = getHealthInterval()
    this.healthTimer = setInterval(() => {
      void this.performHealthCheck()
    }, healthInterval)
    logger.info(`Health check interval: ${healthInterval}ms`)
  }

  /**
   * Stop all polling and health check timers.
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
    this.isPolling = false
    logger.info('Cloud polling service stopped')
  }

  /**
   * Confirm that a photo was printed successfully.
   */
  async confirmPrint(filename: string): Promise<{ success: boolean; error?: string }> {
    const token = getAuthToken()
    if (!token) {
      return { success: false, error: 'No auth token available' }
    }

    try {
      logger.info(`Confirming print for: ${filename}`)
      const response = await apiConfirmPrint(token, filename)
      return { success: response.success }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Print confirmation failed for ${filename}: ${error.message}`)
      this.emit('cloud-error', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Perform a health check against the API.
   */
  async checkHealth(): Promise<HealthResponse | null> {
    try {
      const response = await apiCheckHealth()
      return response
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Health check failed: ${error.message}`)
      return null
    }
  }

  /**
   * Get current watcher status.
   */
  getStatus(): CloudWatcherStatus {
    return {
      registered: !!getAuthToken(),
      polling: this.pollTimer !== null,
      connected: this.connected,
      lastPollTime: this.lastPollTime,
      lastHealthCheckTime: this.lastHealthCheckTime
    }
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private async ensureDownloadDir(): Promise<void> {
    try {
      await mkdir(this.downloadDir, { recursive: true })
      logger.info(`Download directory ready: ${this.downloadDir}`)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Failed to create download directory: ${error.message}`)
      throw error
    }
  }

  private async poll(): Promise<void> {
    // Guard against overlapping polls
    if (this.isPolling) {
      logger.warn('Poll already in progress — skipping')
      return
    }

    const token = getAuthToken()
    if (!token) {
      logger.warn('No auth token — stopping poll')
      this.stop()
      return
    }

    this.isPolling = true

    try {
      const { photos } = await fetchPhotos(token)
      this.lastPollTime = Date.now()

      if (photos.length === 0) {
        logger.info('No new photos available')
        this.isPolling = false
        return
      }

      logger.info(`Found ${photos.length} photo(s) to download`)

      for (const photo of photos) {
        // Skip already processed files in this session
        if (this.processedFiles.has(photo.filename)) {
          continue
        }

        try {
          await this.downloadAndVerify(photo)
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          logger.error(`Failed to process photo ${photo.filename}: ${error.message}`)
          this.emit('cloud-error', error)
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Poll failed: ${error.message}`)
      this.emit('cloud-error', error)
    } finally {
      this.isPolling = false
    }
  }

  private async downloadAndVerify(photo: PhotoEntry): Promise<void> {
    const filePath = join(this.downloadDir, photo.filename)

    logger.info(`Downloading: ${photo.filename} (${photo.sizeBytes} bytes)`)

    // Download the file
    const buffer = await downloadFile(photo.url)

    // Write to disk
    await writeFile(filePath, buffer)

    // Verify file size matches API-provided size
    const fileStat = await stat(filePath)
    if (fileStat.size !== photo.sizeBytes) {
      const error = new Error(
        `Size mismatch for ${photo.filename}: expected ${photo.sizeBytes} bytes, got ${fileStat.size} bytes`
      )
      logger.error(error.message)
      throw error
    }

    logger.info(`Download verified: ${photo.filename} (${fileStat.size} bytes)`)

    // Mark as processed and emit event
    this.processedFiles.add(photo.filename)
    this.emit('photo-ready', filePath, photo.filename)
  }

  private async performHealthCheck(): Promise<void> {
    const isConnected = await checkNetworkConnectivity()
    this.lastHealthCheckTime = Date.now()

    if (isConnected !== this.connected) {
      this.connected = isConnected
      logger.info(`Connection status changed: ${isConnected ? 'connected' : 'disconnected'}`)
      this.emit('connection-status', isConnected)
    }
  }
}
