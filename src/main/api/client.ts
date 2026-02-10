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
import {
  ENDPOINTS,
  RegisterRequest,
  RegisterResponse,
  GetPhotosParams,
  GetPhotosResponse,
  ConfirmPrintRequest,
  ConfirmPrintResponse,
  HealthResponse
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
}

const store = new ElectronStore<CloudStoreSchema>({
  name: 'cloud-config',
  defaults: {
    cloudAuthToken: '',
    cloudApiBaseUrl: 'https://api.smartprint.cloud',
    cloudPollIntervalMs: 15000,
    cloudHealthIntervalMs: 60000
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
      }

      logger.info(`→ ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`)
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
          logger.warn('Auth token expired or invalid — clearing stored token')
          clearAuthToken()
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
    await axios.get(getBaseUrl() + ENDPOINTS.HEALTH, { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

// ─── Typed API Methods ────────────────────────────────────────────────────────

export async function registerDevice(
  registrationKey: string
): Promise<RegisterResponse> {
  const payload: RegisterRequest = { registrationKey }
  const response = await withRetry(() =>
    apiClient.post<RegisterResponse>(ENDPOINTS.REGISTER, payload)
  )
  return response.data
}

export async function fetchPhotos(token: string): Promise<GetPhotosResponse> {
  const params: GetPhotosParams = { token }
  const response = await withRetry(() =>
    apiClient.get<GetPhotosResponse>(ENDPOINTS.PHOTOS, { params })
  )
  return response.data
}

export async function confirmPrint(
  token: string,
  filename: string
): Promise<ConfirmPrintResponse> {
  const payload: ConfirmPrintRequest = { token, filename }
  const response = await withRetry(() =>
    apiClient.post<ConfirmPrintResponse>(ENDPOINTS.CONFIRM_PRINT, payload)
  )
  return response.data
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await withRetry(() =>
    apiClient.get<HealthResponse>(ENDPOINTS.HEALTH)
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
