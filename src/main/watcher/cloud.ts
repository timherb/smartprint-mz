/**
 * F004 - Cloud polling service
 *
 * Polls the cloud API for new photos, downloads them directly to the watch
 * folder, where the local watcher picks them up for printing — same pipeline
 * as local mode.
 */

import { EventEmitter } from 'events'
import { join } from 'path'
import { writeFile, mkdir, stat } from 'fs/promises'
import { createLogger, format, transports } from 'winston'
import {
  activateDevice,
  syncEvents as apiSyncEvents,
  getImages,
  updateDownloaded,
  downloadFile,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getLicenseKey,
  setLicenseKey,
  getPollInterval,
  getHealthInterval,
  checkNetworkConnectivity,
  ApiClientError,
  type CloudEvent,
  type ImageEntry
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

export interface DownloadProgress {
  status: 'idle' | 'downloading' | 'complete' | 'error'
  current: number
  total: number
  filename: string | null
  lastPollTime: number | null
}

export interface CloudWatcherEvents {
  'photo-ready': (filePath: string, filename: string) => void
  'cloud-error': (error: Error) => void
  'connection-status': (connected: boolean) => void
  'bulk-warning': (count: number) => void
  'download-progress': (progress: DownloadProgress) => void
}

export interface CloudWatcherStatus {
  registered: boolean
  polling: boolean
  connected: boolean
  lastPollTime: number | null
  lastHealthCheckTime: number | null
  selectedEventId: number | null
  events: CloudEvent[]
  licenseKey: string
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
  private watchDirectory: string = ''
  private processedFiles: Set<string> = new Set()
  private selectedEventId: number | null = null
  private events: CloudEvent[] = []
  private approvedOnly: boolean = false
  private deviceId: string = ''
  private pollGeneration: number = 0
  private bulkWarningResolver: ((action: 'download' | 'skip' | 'gallery') => void) | null = null

  constructor() {
    super()
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
   * Set the hardware device ID (called from main process at startup).
   */
  setDeviceId(id: string): void {
    this.deviceId = id
  }

  /**
   * Set the watch directory where downloaded images are placed.
   * The local watcher monitors this folder and handles printing.
   */
  setWatchDirectory(dir: string): void {
    this.watchDirectory = dir
  }

  /**
   * Activate this device with a license key.
   * Calls /device/activate and stores the received auth token.
   */
  async register(key: string): Promise<{ success: boolean; error?: string }> {
    if (!isValidRegistrationKey(key)) {
      const msg = `Invalid registration key: must be exactly 12 digits`
      logger.error(msg)
      return { success: false, error: msg }
    }

    try {
      logger.info(`Activating device with key: ${key.slice(0, 4)}****${key.slice(-4)}`)
      const response = await activateDevice(key, this.deviceId)
      logger.info(`Activate response keys: ${Object.keys(response).join(', ')}`)
      logger.info(`Token received: ${response.token ? response.token.slice(0, 20) + '...' : 'EMPTY/MISSING'}`)
      if (!response.token) {
        return { success: false, error: 'Activation succeeded but no token returned' }
      }
      setAuthToken(response.token)
      setLicenseKey(key)
      logger.info('Device activated successfully — token and license key stored')
      return { success: true }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Activation failed: ${error.message}`)
      this.emit('cloud-error', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Unregister this device — stops polling and clears stored token and license key.
   */
  unregister(): void {
    this.stop()
    this.selectedEventId = null
    this.events = []
    clearAuthToken()
    setLicenseKey('')
    logger.info('Device unregistered — token and license key cleared')
  }

  /**
   * Sync today's events from the API.
   * Returns the list of events for display in the event selector.
   */
  async syncEvents(): Promise<CloudEvent[]> {
    const token = getAuthToken()
    if (!token) {
      const msg = 'Cannot sync events: no auth token. Register first.'
      logger.error(msg)
      throw new Error(msg)
    }

    try {
      logger.info('Syncing events from API')
      const events = await apiSyncEvents()
      this.events = events
      logger.info(`Synced ${events.length} event(s)`)
      return events
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Event sync failed: ${error.message}`)
      this.emit('cloud-error', error)
      throw error
    }
  }

  /**
   * Set the active event ID for image polling.
   */
  selectEvent(id: number): void {
    this.selectedEventId = id
    const event = this.events.find((e) => e.id === id)
    logger.info(`Event selected: ${event?.name ?? id} (id=${id})`)
  }

  /**
   * Resolve a pending bulk-download warning prompt.
   * Called by the main process after the user confirms or cancels.
   */
  resolveBulkWarning(action: 'download' | 'skip' | 'gallery'): void {
    if (this.bulkWarningResolver) {
      this.bulkWarningResolver(action)
      this.bulkWarningResolver = null
    }
  }

  /**
   * Set whether to fetch only approved images.
   * If polling is active, restarts polling so the new filter takes effect immediately.
   */
  setApprovedOnly(value: boolean): void {
    if (this.approvedOnly === value) return
    this.approvedOnly = value
    logger.info(`Approved-only filter changed to: ${value}`)
    if (this.pollTimer !== null) {
      logger.info('Restarting polling to apply new approved-only filter')
      void this.start()
    }
  }

  /**
   * Start polling for new photos and running health checks.
   * Requires an event to be selected first.
   */
  async start(): Promise<void> {
    const token = getAuthToken()
    if (!token) {
      const error = new Error('Cannot start polling: no auth token. Register first.')
      logger.error(error.message)
      this.emit('cloud-error', error)
      return
    }

    if (this.selectedEventId === null) {
      const error = new Error('Cannot start polling: no event selected. Select an event first.')
      logger.error(error.message)
      this.emit('cloud-error', error)
      return
    }

    if (!this.watchDirectory) {
      const error = new Error('Cannot start polling: no output folder configured. Set a folder in Settings.')
      logger.error(error.message)
      this.emit('cloud-error', error)
      return
    }

    // Clear any existing timers
    this.stop()

    logger.info(`Starting cloud polling service for event ${this.selectedEventId}`)

    // Fire initial poll without awaiting — same behaviour as recurring polls,
    // prevents start() from blocking until 1000 images download
    void this.poll()

    // Set up recurring poll timer
    const pollInterval = getPollInterval()
    this.pollTimer = setInterval(() => {
      void this.poll()
    }, pollInterval)
    logger.info(`Photo polling interval: ${pollInterval}ms`)

    // Fire initial health check without awaiting
    void this.performHealthCheck()

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
    this.processedFiles.clear()
    this.pollGeneration++
    logger.info('Cloud polling service stopped')
  }

  /**
   * Perform a health check against the API.
   */
  async checkHealth(): Promise<{ status: 'ok' } | null> {
    const isConnected = await checkNetworkConnectivity()
    return isConnected ? { status: 'ok' } : null
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
      lastHealthCheckTime: this.lastHealthCheckTime,
      selectedEventId: this.selectedEventId,
      events: this.events,
      licenseKey: getLicenseKey()
    }
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private async ensureWatchDir(): Promise<void> {
    try {
      await mkdir(this.watchDirectory, { recursive: true })
      logger.info(`Watch directory ready: ${this.watchDirectory}`)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Failed to create watch directory: ${error.message}`)
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

    if (this.selectedEventId === null) {
      logger.warn('No event selected — skipping poll')
      return
    }

    this.isPolling = true
    const generation = this.pollGeneration

    try {
      const images = await getImages(this.selectedEventId, this.approvedOnly)
      this.lastPollTime = Date.now()

      if (images.length === 0) {
        logger.info('No new images available')
        this.emit('download-progress', {
          status: 'idle',
          current: 0,
          total: 0,
          filename: null,
          lastPollTime: this.lastPollTime,
        })
        this.isPolling = false
        return
      }

      logger.info(`Found ${images.length} image(s) to download`)

      this.emit('download-progress', {
        status: 'downloading',
        current: 0,
        total: images.length,
        filename: null,
        lastPollTime: this.lastPollTime,
      })

      // If batch is large, pause and wait for user confirmation before downloading
      if (images.length > 49) {
        logger.warn(`Large batch detected: ${images.length} images — waiting for user confirmation`)
        this.emit('bulk-warning', images.length)

        const action = await new Promise<'download' | 'skip' | 'gallery'>((resolve) => {
          this.bulkWarningResolver = resolve
        })

        if (this.pollGeneration !== generation) {
          logger.info('Poll cancelled during bulk warning — aborting')
          return
        }

        if (action === 'skip') {
          logger.info(`User skipped download — marking all ${images.length} images as downloaded`)
          await this.markDownloaded(images.map((img) => img.fileName))
          return
        }

        if (action === 'gallery') {
          logger.info(`User chose gallery download — saving ${images.length} images to Printed Photos folder`)
          await this.downloadBatchToGallery(images)
          return
        }

        logger.info(`User confirmed download of ${images.length} images — proceeding`)
      }

      for (const image of images) {
        // Stop downloading if a restart/stop was triggered since this poll began
        if (this.pollGeneration !== generation) {
          logger.info('Poll cancelled — newer poll generation detected')
          break
        }

        // Skip already processed files in this session
        if (this.processedFiles.has(image.fileName)) {
          continue
        }

        this.emit('download-progress', {
          status: 'downloading',
          current: this.processedFiles.size,
          total: images.length,
          filename: image.fileName,
          lastPollTime: this.lastPollTime,
        })

        try {
          await this.downloadAndVerify(image)
          // Mark downloaded immediately after each verified file — if app crashes
          // mid-batch, only the current image needs re-downloading
          await this.markDownloaded([image.fileName])
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          logger.error(`Failed to process image ${image.fileName}: ${error.message}`)
          this.emit('cloud-error', error)
          // Abort the entire poll cycle on network errors — no point retrying
          // 1000 images individually when the connection is down
          if (error instanceof ApiClientError && error.isNetworkError) {
            logger.warn('Network error detected — aborting poll cycle')
            break
          }
        }
      }

      // Emit completion after all images are processed
      this.emit('download-progress', {
        status: 'complete',
        current: this.processedFiles.size,
        total: images.length,
        filename: null,
        lastPollTime: this.lastPollTime,
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Poll failed: ${error.message}`)
      this.emit('cloud-error', error)
      this.emit('download-progress', {
        status: 'error',
        current: 0,
        total: 0,
        filename: null,
        lastPollTime: this.lastPollTime,
      })
    } finally {
      this.isPolling = false
    }
  }

  private async downloadAndVerify(image: ImageEntry): Promise<void> {
    await this.ensureWatchDir()
    const filePath = join(this.watchDirectory, image.fileName)

    logger.info(`Downloading: ${image.fileName} (${image.bytes} bytes)`)

    // Download the file
    const buffer = await downloadFile(image.url)

    // Write to disk
    await writeFile(filePath, buffer)

    // Verify file size matches API-provided size
    const fileStat = await stat(filePath)
    if (fileStat.size !== image.bytes) {
      const error = new Error(
        `Size mismatch for ${image.fileName}: expected ${image.bytes} bytes, got ${fileStat.size} bytes`
      )
      logger.error(error.message)
      throw error
    }

    logger.info(`Download verified: ${image.fileName} (${fileStat.size} bytes)`)

    // Mark as processed and emit event
    this.processedFiles.add(image.fileName)
    this.emit('photo-ready', filePath, image.fileName)
  }

  /**
   * Mark a batch of filenames as downloaded on the API.
   * Retries up to 3 times on failure. If all retries fail, logs and continues
   * (printing is not blocked; files may be re-served on next session).
   */
  private async markDownloaded(fileNames: string[]): Promise<void> {
    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await updateDownloaded(fileNames)
        logger.info(`Marked ${fileNames.length} file(s) as downloaded`)
        return
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        if (attempt < maxAttempts) {
          logger.warn(`updateDownloaded attempt ${attempt}/${maxAttempts} failed: ${error.message} — retrying in 500ms`)
          await new Promise((resolve) => setTimeout(resolve, 500))
        } else {
          logger.error(`updateDownloaded failed after ${maxAttempts} attempts: ${error.message}`)
          this.emit('cloud-error', new Error(`Failed to mark images as downloaded: ${error.message}`))
        }
      }
    }
  }

  /**
   * Download a batch of images directly to the "Printed Photos" gallery folder,
   * bypassing the local watcher so they are NOT queued for printing.
   * Used when the operator chooses "Download to Gallery" on the bulk warning modal.
   */
  private async downloadBatchToGallery(images: ImageEntry[]): Promise<void> {
    const galleryDir = join(this.watchDirectory, 'Printed Photos')
    try {
      await mkdir(galleryDir, { recursive: true })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(`Failed to create gallery directory: ${error.message}`)
      this.emit('cloud-error', error)
      return
    }

    for (const image of images) {
      this.emit('download-progress', {
        status: 'downloading',
        current: this.processedFiles.size,
        total: images.length,
        filename: image.fileName,
        lastPollTime: this.lastPollTime,
      })

      try {
        const filePath = join(galleryDir, image.fileName)
        const buffer = await downloadFile(image.url)
        await writeFile(filePath, buffer)

        const fileStat = await stat(filePath)
        if (fileStat.size !== image.bytes) {
          throw new Error(
            `Size mismatch for ${image.fileName}: expected ${image.bytes} bytes, got ${fileStat.size} bytes`
          )
        }

        logger.info(`Gallery download verified: ${image.fileName} (${fileStat.size} bytes)`)
        this.processedFiles.add(image.fileName)
        await this.markDownloaded([image.fileName])
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        logger.error(`Gallery download failed for ${image.fileName}: ${error.message}`)
        this.emit('cloud-error', error)
        if (error instanceof ApiClientError && error.isNetworkError) {
          logger.warn('Network error — aborting gallery download batch')
          break
        }
      }
    }

    this.emit('download-progress', {
      status: 'complete',
      current: this.processedFiles.size,
      total: images.length,
      filename: null,
      lastPollTime: this.lastPollTime,
    })
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
