/**
 * F004 - Cloud API barrel export
 */

// Endpoint definitions and types
export {
  ENDPOINTS,
  type EndpointPath,
  type RegisterRequest,
  type RegisterResponse,
  type PhotoEntry,
  type GetPhotosParams,
  type GetPhotosResponse,
  type ConfirmPrintRequest,
  type ConfirmPrintResponse,
  type HealthResponse,
  type ApiErrorResponse
} from './endpoints'

// Client utilities and typed API methods
export {
  ApiClientError,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getBaseUrl,
  setBaseUrl,
  getPollInterval,
  getHealthInterval,
  checkNetworkConnectivity,
  registerDevice,
  fetchPhotos,
  confirmPrint,
  checkHealth,
  downloadFile,
  apiClient,
  cloudStore
} from './client'
