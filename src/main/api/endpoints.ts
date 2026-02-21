/**
 * F004 - Cloud API endpoint definitions and type-safe interfaces
 */

// ─── App Identity ────────────────────────────────────────────────────────────

/** Backend-assigned application identifier for SmartPrint */
export const APP_ID = '5174A6DD-55C9-4718-821C-21D26FB348BC'

// ─── Activation Types ────────────────────────────────────────────────────────

export interface ActivateRequest {
  appID: string
  licenseKey: string
  deviceCode: string
  swVersion: string
  osVersion: string
  name: string
  platform: string
}

export interface LicenseInfo {
  name: string
  programName: string
  agencyName: string
  startDate: string
  endDate: string
  supportedDevices: number
  activatedDevices: number
}

export interface ActivateResponse {
  token: string
  userID: string | null
  licenseInfo: LicenseInfo | null
  status: number
}

// ─── Event Types ──────────────────────────────────────────────────────────────

export interface CloudEvent {
  id: number
  name: string
  externalID: string
  startDate: string
  endDate: string
  testEvent: string
}

export interface SyncEventsRequest {
  osVersion: string
  swVersion: string
}

export interface SyncEventsResponse {
  events: CloudEvent[]
  status: number
}

// ─── Image Types ──────────────────────────────────────────────────────────────

export interface ImageEntry {
  url: string
  height: number
  width: number
  fileName: string
  bytes: number
}

export interface GetImagesRequest {
  eventID: number
  downloaded: boolean
  approved?: boolean | null
}

export interface GetImagesResponse {
  images: ImageEntry[]
  status: number
}

// ─── Update Downloaded Types ──────────────────────────────────────────────────

export interface UpdateDownloadedRequest {
  fileNames: string[]
}

export interface UpdateDownloadedResponse {
  status: number
}

// ─── API Error Response ───────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: string
  code?: string
  statusCode?: number
}

// ─── Endpoint Paths ───────────────────────────────────────────────────────────

export const ENDPOINTS = {
  ACTIVATE: '/device/activate',
  SYNC_EVENTS: '/device/syncevents',
  IMAGES: '/image/images',
  UPDATE_DOWNLOADED: '/image/updatedownloaded'
} as const

export type EndpointPath = (typeof ENDPOINTS)[keyof typeof ENDPOINTS]
