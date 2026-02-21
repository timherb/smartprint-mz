/**
 * F004 - Cloud API barrel export
 */

// Endpoint definitions and types
export {
  ENDPOINTS,
  type EndpointPath,
  type ActivateRequest,
  type ActivateResponse,
  type LicenseInfo,
  type CloudEvent,
  type SyncEventsRequest,
  type SyncEventsResponse,
  type ImageEntry,
  type GetImagesRequest,
  type GetImagesResponse,
  type UpdateDownloadedRequest,
  type UpdateDownloadedResponse,
  type ApiErrorResponse
} from './endpoints'

// Client utilities and typed API methods
export {
  ApiClientError,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getLicenseKey,
  setLicenseKey,
  getBaseUrl,
  setBaseUrl,
  getPollInterval,
  getHealthInterval,
  checkNetworkConnectivity,
  activateDevice,
  syncEvents,
  getImages,
  updateDownloaded,
  downloadFile,
  apiClient,
  cloudStore
} from './client'
