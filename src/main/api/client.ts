/**
 * F004 - Axios HTTP client with interceptors, retry logic, and connectivity checks
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse
} from 'axios'
import ElectronStoreModule from 'electron-store'
// Handle ESM/CJS interop - electron-store v11 is ESM-only
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ElectronStore = ((ElectronStoreModule as any).default || ElectronStoreModule) as typeof ElectronStoreModule
import { createLogger, format, transports } from 'winston'
import { app } from 'electron'
import {
  ENDPOINTS,
  ActivateRequest,
  ActivateResponse,
  SyncEventsRequest,
  SyncEventsResponse,
  CloudEvent,
  GetImagesRequest,
  GetImagesResponse,
  ImageEntry,
  UpdateDownloadedRequest,
  UpdateDownloadedResponse
} from './endpoints'

// ─── Logger ───────────────────────────────────────────────────────────────────

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => `${timestamp} [api-client] ${level}: ${message}`)
  ),
  transports: [new transports.Console()]
})

// ─── Store Schema ─────────────────────────────────────────────────────────────

interface CloudStoreSchema extends Record<string, unknown> {
  cloudAuthToken: string
  cloudApiBaseUrl: string
  cloudPollIntervalMs: number
  cloudHealthIntervalMs: number
  cloudLicenseKey: string
}

const store = new ElectronStore<CloudStoreSchema>({
  name: 'cloud-config',
  defaults: {
    cloudAuthToken: '',
    cloudApiBaseUrl: 'https://smartprint.smartactivator-api.net',
    cloudPollIntervalMs: 15000,
    cloudHealthIntervalMs: 60000,
    cloudLicenseKey: ''
  }
})

// ─── Retry Configuration ──────────────────────────────────────────────────────

interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000
}

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  public readonly statusCode?: number
  public readonly isNetworkError: boolean
  public readonly isAuthError: boolean

  constructor(message: string, statusCode?: number, isNetworkError = false) {
    super(message)
    this.name = 'ApiClientError'
    this.statusCode = statusCode
    this.isNetworkError = isNetworkError
    this.isAuthError = statusCode === 401
  }
}

// ─── Sleep utility ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Token management (used by interceptors and external callers) ─────────────

export function getAuthToken(): string {
  return store.get('cloudAuthToken')
}

export function setAuthToken(token: string): void {
  store.set('cloudAuthToken', token)
}

export function clearAuthToken(): void {
  store.set('cloudAuthToken', '')
}

export function getBaseUrl(): string {
  return store.get('cloudApiBaseUrl')
}

export function setBaseUrl(url: string): void {
  store.set('cloudApiBaseUrl', url)
}

export function getLicenseKey(): string {
  return store.get('cloudLicenseKey')
}

export function setLicenseKey(key: string): void {
  store.set('cloudLicenseKey', key)
}

export function getPollInterval(): number {
  return store.get('cloudPollIntervalMs')
}

export function getHealthInterval(): number {
  return store.get('cloudHealthIntervalMs')
}

// ─── Create Axios Instance ────────────────────────────────────────────────────

function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: getBaseUrl(),
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  // Request interceptor: attach auth token
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Update baseURL in case it changed in store
      config.baseURL = getBaseUrl()

      const token = getAuthToken()
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`)
        logger.info(`→ ${config.method?.toUpperCase()} ${config.baseURL}${config.url} [token: ${token.slice(0, 20)}...]`)
      } else {
        logger.warn(`→ ${config.method?.toUpperCase()} ${config.baseURL}${config.url} [NO TOKEN]`)
      }
      return config
    },
    (error: AxiosError) => {
      logger.error(`Request interceptor error: ${error.message}`)
      return Promise.reject(error)
    }
  )

  // Response interceptor: log responses and handle 401
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      logger.info(
        `← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`
      )
      return response
    },
    (error: AxiosError) => {
      if (error.response) {
        const status = error.response.status
        logger.error(
          `← ${status} ${error.config?.method?.toUpperCase()} ${error.config?.url}: ${error.message}`
        )

        if (status === 401) {
          // Note: do NOT auto-clear token here — a 401 on one endpoint (e.g. syncevents)
          // would wipe a valid token from a just-completed activation.
          // Callers are responsible for handling 401 and clearing if appropriate.
          logger.warn('401 received — token may be expired or invalid')
        }
      } else if (error.code === 'ECONNABORTED') {
        logger.error(`Request timeout: ${error.config?.url}`)
      } else {
        logger.error(`Network error: ${error.message}`)
      }

      return Promise.reject(error)
    }
  )

  return instance
}

const apiClient: AxiosInstance = createApiClient()

// ─── Retry wrapper ────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      const isAxiosErr = axios.isAxiosError(err)
      const status = isAxiosErr ? err.response?.status : undefined

      // Don't retry on 4xx client errors (except 408 Request Timeout and 429 Too Many Requests)
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw toApiClientError(lastError)
      }

      if (attempt < config.maxRetries) {
        const delayMs = config.baseDelayMs * Math.pow(2, attempt)
        logger.warn(`Retry ${attempt + 1}/${config.maxRetries} after ${delayMs}ms: ${lastError.message}`)
        await sleep(delayMs)
      }
    }
  }

  throw toApiClientError(lastError!)
}

function toApiClientError(err: Error): ApiClientError {
  if (err instanceof ApiClientError) return err

  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const isNetwork = !err.response && err.code !== 'ECONNABORTED'
    const message = err.response?.data?.error || err.message
    return new ApiClientError(message, status, isNetwork)
  }

  return new ApiClientError(err.message)
}

// ─── Network Connectivity Check ───────────────────────────────────────────────

export async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    await axios.get(getBaseUrl(), {
      timeout: 5000,
      // Any HTTP response (even 4xx/5xx) means the server is reachable
      validateStatus: () => true
    })
    return true
  } catch {
    // Only network-level errors (ECONNREFUSED, timeout, etc.) reach here
    return false
  }
}

// ─── Typed API Methods ────────────────────────────────────────────────────────

export async function activateDevice(
  licenseKey: string,
  deviceCode: string
): Promise<ActivateResponse> {
  const { APP_ID } = await import('./endpoints')
  const payload: ActivateRequest = {
    appID: APP_ID,
    licenseKey,
    deviceCode,
    swVersion: app.getVersion(),
    osVersion: process.getSystemVersion(),
    name: `SmartPrint-${deviceCode.slice(0, 8)}`,
    platform: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux'
  }
  // Activate endpoint has no auth requirement — post without Bearer token
  const response = await withRetry(() =>
    axios.post<ActivateResponse>(getBaseUrl() + ENDPOINTS.ACTIVATE, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    })
  )
  return response.data
}

export async function syncEvents(): Promise<CloudEvent[]> {
  const payload: SyncEventsRequest = {
    osVersion: process.getSystemVersion(),
    swVersion: app.getVersion()
  }
  const response = await withRetry(() =>
    apiClient.post<SyncEventsResponse>(ENDPOINTS.SYNC_EVENTS, payload)
  )
  return response.data.events
}

export async function getImages(
  eventID: number,
  approvedOnly: boolean
): Promise<ImageEntry[]> {
  const payload: GetImagesRequest = {
    eventID,
    downloaded: false,
    ...(approvedOnly && { approved: true })
  }
  const response = await withRetry(() =>
    apiClient.post<GetImagesResponse>(ENDPOINTS.IMAGES, payload)
  )
  return response.data.images
}

export async function updateDownloaded(
  fileNames: string[]
): Promise<UpdateDownloadedResponse> {
  const payload: UpdateDownloadedRequest = { fileNames }
  const response = await withRetry(
    () => apiClient.post<UpdateDownloadedResponse>(ENDPOINTS.UPDATE_DOWNLOADED, payload),
    { maxRetries: 3, baseDelayMs: 500 }
  )
  return response.data
}

// ─── Download helper (for binary/image data) ─────────────────────────────────

export async function downloadFile(
  url: string
): Promise<Buffer> {
  const response = await withRetry(() =>
    axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 60000
    })
  )
  return Buffer.from(response.data)
}

export { apiClient, store as cloudStore }
