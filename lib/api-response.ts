import { NextResponse } from 'next/server'
import logger from './logger'
import { ApplicationError, normalizeError } from './errors'

/**
 * Options for customizing API responses
 */
interface ApiResponseOptions {
  /**
   * HTTP status code for the response
   * @default 200 for success responses, varies for errors
   */
  status?: number
  
  /**
   * Custom headers to include in the response
   */
  headers?: Record<string, string>
}

/**
 * Creates a standardized successful API response
 * 
 * @template TData Type of the data payload
 * @param data The data to include in the response
 * @param options Additional response options
 * @returns NextResponse with standardized success format
 * 
 * @example
 * return apiSuccess({ user: { id: '123', name: 'John' } });
 */
export function apiSuccess<TData>(
  data: TData, 
  options: ApiResponseOptions = {}
): NextResponse {
  const { status = 200, headers } = options
  
  return NextResponse.json(
    { 
      success: true, 
      data,
      timestamp: new Date().toISOString()
    },
    { 
      status, 
      headers
    }
  )
}

/**
 * Options for error API responses
 */
interface ApiErrorOptions extends ApiResponseOptions {
  /**
   * Whether to log the error
   * @default true
   */
  logError?: boolean;
  
  /**
   * Log level to use for error logging
   * @default 'error'
   */
  logLevel?: 'warn' | 'error' | 'fatal';
  
  /**
   * Additional metadata to include in the error log
   */
  logMetadata?: Record<string, any>;
}

/**
 * Creates a standardized error API response
 * 
 * @param error The error to format (can be any type)
 * @param options Additional error response options
 * @returns NextResponse with standardized error format
 * 
 * @example
 * return apiError(new Error("Not found"), { status: 404 });
 */
export function apiError(
  error: unknown,
  options: ApiErrorOptions = {}
): NextResponse {
  const {
    status,
    headers,
    logError = true,
    logLevel = 'error',
    logMetadata = {}
  } = options

  // Normalize the error to an ApplicationError
  const appError = normalizeError(error)
  
  // Log the error if requested
  if (logError) {
    const metadata = {
      statusCode: appError.statusCode,
      errorCode: appError.code,
      ...logMetadata
    }
    
    logger[logLevel](
      `API Error: ${appError.message}`,
      metadata,
      appError
    )
  }

  // Return formatted error response
  return NextResponse.json(
    appError.toJSON(),
    { 
      status: status || appError.statusCode,
      headers 
    }
  )
}

/**
 * Handle API routes with automatic error handling
 * 
 * Wraps an API handler with standardized error handling to ensure
 * consistent error responses across all API endpoints.
 * 
 * @param handler The API route handler function
 * @param options Error handling options
 * @returns API response with standardized format
 * 
 * @example
 * export async function GET(request: Request) {
 *   return withErrorHandling(async () => {
 *     // Your API logic here
 *     return apiSuccess({ message: 'Success' })
 *   })
 * }
 */
export async function withErrorHandling(
  handler: () => Promise<Response>,
  options: Omit<ApiErrorOptions, 'status' | 'headers'> = {}
): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    return apiError(error, options)
  }
}

/**
 * Extract request ID from headers for consistent logging
 * 
 * This is helpful for tracing requests through the system and correlating
 * logs with specific API calls.
 * 
 * @param request The incoming request
 * @returns The request ID if present, or undefined
 */
export function getRequestId(request: Request): string | undefined {
  return request.headers.get('x-request-id') || undefined
}