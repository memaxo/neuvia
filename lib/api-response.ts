import { NextResponse } from 'next/server'
import logger from './logger'
import { ApplicationError, normalizeError } from './errors'

type ApiResponseOptions = {
  status?: number
  headers?: Record<string, string>
}

/**
 * Creates a standardized successful API response
 */
export function apiSuccess<T>(
  data: T, 
  options: ApiResponseOptions = {}
) {
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
 * Creates a standardized error API response
 */
export function apiError(
  error: unknown,
  options: ApiResponseOptions & { 
    logError?: boolean
    logLevel?: 'warn' | 'error' | 'fatal'
    logMetadata?: Record<string, any>
  } = {}
) {
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
  options: {
    logError?: boolean
    logLevel?: 'warn' | 'error' | 'fatal'
    logMetadata?: Record<string, any>
  } = {}
): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    return apiError(error, options)
  }
}

/**
 * Extract request ID from headers for consistent logging
 */
export function getRequestId(request: Request): string | undefined {
  return request.headers.get('x-request-id') || undefined
}