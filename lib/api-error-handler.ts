/**
 * Centralized API Error Handler
 *
 * Standardizes error handling across all API routes
 * Provides consistent error responses, logging, and HTTP status codes
 *
 * Usage:
 * ```typescript
 * import { apiError, handleApiError } from '@/lib/api-error-handler'
 *
 * // In API route:
 * try {
 *   // ... your code
 * } catch (error) {
 *   return handleApiError(error, 'operation_name')
 * }
 *
 * // Or throw specific errors:
 * if (!user) {
 *   throw apiError.unauthorized('User not authenticated')
 * }
 * ```
 */

import { NextResponse } from 'next/server'

// Error types with standard HTTP status codes
export enum ErrorType {
  // 400-level client errors
  VALIDATION = 'validation_error',
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  RATE_LIMIT = 'rate_limit_exceeded',

  // 500-level server errors
  DATABASE = 'database_error',
  EXTERNAL_API = 'external_api_error',
  INTERNAL = 'internal_server_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
}

// Standard error response interface
export interface ApiErrorResponse {
  success: false
  error: string
  error_type: ErrorType
  details?: string
  troubleshooting?: {
    [key: string]: string
  }
  timestamp: string
  request_id?: string
}

// Custom API Error class
export class ApiError extends Error {
  constructor(
    public type: ErrorType,
    public message: string,
    public statusCode: number,
    public details?: string,
    public troubleshooting?: { [key: string]: string }
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Error factory functions for common scenarios
export const apiError = {
  // 400 Bad Request
  validation: (message: string, details?: string) =>
    new ApiError(ErrorType.VALIDATION, message, 400, details),

  // 401 Unauthorized
  unauthorized: (message: string = 'Authentication required', details?: string) =>
    new ApiError(ErrorType.UNAUTHORIZED, message, 401, details),

  // 403 Forbidden
  forbidden: (message: string = 'Access denied', details?: string) =>
    new ApiError(ErrorType.FORBIDDEN, message, 403, details),

  // 404 Not Found
  notFound: (resource: string, details?: string) =>
    new ApiError(ErrorType.NOT_FOUND, `${resource} not found`, 404, details),

  // 409 Conflict
  conflict: (message: string, details?: string) =>
    new ApiError(ErrorType.CONFLICT, message, 409, details),

  // 429 Too Many Requests
  rateLimit: (message: string = 'Rate limit exceeded', retryAfter?: number) =>
    new ApiError(
      ErrorType.RATE_LIMIT,
      message,
      429,
      retryAfter ? `Retry after ${retryAfter} seconds` : undefined
    ),

  // 500 Internal Server Error
  internal: (message: string = 'Internal server error', details?: string) =>
    new ApiError(ErrorType.INTERNAL, message, 500, details),

  // 502 Bad Gateway (external API)
  externalApi: (service: string, details?: string) =>
    new ApiError(
      ErrorType.EXTERNAL_API,
      `External service error: ${service}`,
      502,
      details,
      {
        step1: `The ${service} service may be temporarily unavailable`,
        step2: 'Try again in a few moments',
        step3: 'Contact support if problem persists'
      }
    ),

  // 500 Database Error
  database: (operation: string, error: any) =>
    new ApiError(
      ErrorType.DATABASE,
      'Database operation failed',
      500,
      `Operation: ${operation}, Error: ${error.message || error}`,
      {
        step1: 'This is a temporary database issue',
        step2: 'Try again in a moment',
        step3: 'Contact support if error persists'
      }
    ),

  // 503 Service Unavailable
  serviceUnavailable: (service: string, details?: string) =>
    new ApiError(
      ErrorType.SERVICE_UNAVAILABLE,
      `Service temporarily unavailable: ${service}`,
      503,
      details
    ),
}

/**
 * Main error handler - converts any error to standardized NextResponse
 *
 * @param error - The error to handle (ApiError, Error, or unknown)
 * @param context - Optional context for logging (e.g., 'campaign_activation')
 * @returns NextResponse with standardized error format
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  // Generate unique request ID for tracking
  const requestId = `err_${Date.now()}_${Math.random().toString(36).substring(7)}`

  // Log error with context
  console.error(`[API Error${context ? ` - ${context}` : ''}] [${requestId}]`, error)

  // Handle ApiError instances
  if (error instanceof ApiError) {
    const response: ApiErrorResponse = {
      success: false,
      error: error.message,
      error_type: error.type,
      details: error.details,
      troubleshooting: error.troubleshooting,
      timestamp: new Date().toISOString(),
      request_id: requestId
    }

    return NextResponse.json(response, { status: error.statusCode })
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('not found')) {
      return handleApiError(apiError.notFound('Resource', error.message), context)
    }

    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      return handleApiError(apiError.unauthorized(error.message), context)
    }

    if (error.message.includes('forbidden') || error.message.includes('access denied')) {
      return handleApiError(apiError.forbidden(error.message), context)
    }

    if (error.message.includes('database') || error.message.includes('postgres')) {
      return handleApiError(apiError.database('operation', error), context)
    }

    // Generic error
    const response: ApiErrorResponse = {
      success: false,
      error: error.message || 'An unexpected error occurred',
      error_type: ErrorType.INTERNAL,
      timestamp: new Date().toISOString(),
      request_id: requestId
    }

    return NextResponse.json(response, { status: 500 })
  }

  // Handle unknown errors
  const response: ApiErrorResponse = {
    success: false,
    error: 'An unexpected error occurred',
    error_type: ErrorType.INTERNAL,
    details: typeof error === 'string' ? error : JSON.stringify(error),
    timestamp: new Date().toISOString(),
    request_id: requestId
  }

  return NextResponse.json(response, { status: 500 })
}

/**
 * Success response helper for consistency
 */
export function apiSuccess<T = any>(data: T, message?: string): NextResponse {
  return NextResponse.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  })
}

/**
 * Middleware wrapper for API routes with automatic error handling
 *
 * @example
 * export const POST = withErrorHandling(async (request) => {
 *   // Your handler code
 *   return apiSuccess({ result: 'data' })
 * }, 'post_campaign')
 */
export function withErrorHandling(
  handler: (request: Request) => Promise<NextResponse>,
  context: string
) {
  return async (request: Request): Promise<NextResponse> => {
    try {
      return await handler(request)
    } catch (error) {
      return handleApiError(error, context)
    }
  }
}
