/**
 * F004 - Cloud API endpoint definitions and type-safe interfaces
 */

// ─── Request Interfaces ───────────────────────────────────────────────────────

export interface RegisterRequest {
  registrationKey: string
}

export interface ConfirmPrintRequest {
  token: string
  filename: string
}

export interface GetPhotosParams {
  token: string
}

// ─── Response Interfaces ──────────────────────────────────────────────────────

export interface RegisterResponse {
  token: string
}

export interface PhotoEntry {
  url: string
  filename: string
  sizeBytes: number
}

export interface GetPhotosResponse {
  photos: PhotoEntry[]
}

export interface ConfirmPrintResponse {
  success: boolean
}

export interface HealthResponse {
  status: 'ok'
}

// ─── API Error Response ───────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: string
  code?: string
  statusCode?: number
}

// ─── Endpoint Paths ───────────────────────────────────────────────────────────

export const ENDPOINTS = {
  REGISTER: '/register',
  PHOTOS: '/photos',
  CONFIRM_PRINT: '/photos/confirm',
  HEALTH: '/health'
} as const

export type EndpointPath = (typeof ENDPOINTS)[keyof typeof ENDPOINTS]
