/**
 * Unified API Response Format
 * Used across all dis kaynak uretim and related endpoints
 * 
 * Ensures consistent response structure between web and mobile
 */

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INVALID_STATE'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN';

export interface ApiResponse<T = any> {
  /** Whether the request was successful */
  success: boolean;
  
  /** Response data (only when success=true) */
  data?: T;
  
  /** Error message (only when success=false) */
  error?: string;
  
  /** Error code for client-side handling */
  code?: ApiErrorCode;
  
  /** ISO 8601 timestamp */
  timestamp: string;
  
  /** Optional pagination info */
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Create a successful response
 * @param data Response data
 * @param pagination Optional pagination info
 * @returns Standardized API response
 */
export function successResponse<T>(
  data: T,
  pagination?: {
    page: number;
    limit: number;
    total: number;
  }
): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...(pagination && {
      pagination: {
        ...pagination,
        pages: Math.ceil(pagination.total / pagination.limit),
      },
    }),
  };
}

/**
 * Create an error response
 * @param error Error message (user-friendly)
 * @param code Error code for client handling
 * @returns Standardized API response
 */
export function errorResponse(
  error: string,
  code: ApiErrorCode = 'INTERNAL_ERROR'
): ApiResponse {
  return {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString(),
  };
}

/**
 * HTTP status to error code mapping
 */
export function httpStatusToErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
    case 422:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'INTERNAL_ERROR';
  }
}
