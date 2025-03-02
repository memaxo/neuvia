/**
 * API Route Helpers
 * 
 * Utilities for creating standardized API routes with OpenAPI validation
 */
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling, getRequestId } from '@/lib/api-response'
import { validateRequest } from './validation'
import logger from '@/lib/logger'

// Type for HTTP methods
type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

/**
 * Options for creating an API route handler
 */
interface CreateApiRouteOptions {
  /**
   * Path in the OpenAPI specification
   */
  openApiPath: string
  
  /**
   * HTTP method
   */
  method: HttpMethod
  
  /**
   * Whether to validate the request against the OpenAPI schema
   */
  validate?: boolean
  
  /**
   * Whether to log request and response
   */
  logging?: boolean
  
  /**
   * Additional metadata for logging
   */
  logMetadata?: Record<string, any>
}

/**
 * Create a standardized API route handler with OpenAPI validation
 * @param handler The route handler function
 * @param options Options for the route handler
 */
export function createApiRoute(
  handler: (req: NextRequest) => Promise<Response>,
  options: CreateApiRouteOptions
) {
  const { openApiPath, method, validate = true, logging = true, logMetadata = {} } = options
  
  return async function routeHandler(req: NextRequest): Promise<Response> {
    // Set up logging
    const requestId = getRequestId(req)
    const moduleLogger = logging 
      ? logger.withMetadata({
          module: 'ApiRoute',
          method: method.toUpperCase(),
          path: openApiPath,
          requestId,
          ...logMetadata
        })
      : undefined
    
    // Log request if logging enabled
    if (logging && moduleLogger) {
      moduleLogger.info('API request received', {
        url: req.url,
        method: req.method,
        headers: Object.fromEntries(req.headers.entries())
      })
    }
    
    // Validate request if validation enabled
    if (validate) {
      try {
        await validateRequest(req, openApiPath, method)
      } catch (error) {
        if (logging && moduleLogger) {
          moduleLogger.warn('Request validation failed', {}, error)
        }
        throw error
      }
    }
    
    // Handle the request with error handling
    return withErrorHandling(async () => {
      const response = await handler(req)
      
      // Log response if logging enabled
      if (logging && moduleLogger) {
        moduleLogger.info('API response sent', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        })
      }
      
      return response
    }, {
      logError: logging,
      logMetadata: {
        ...logMetadata,
        requestId,
        path: openApiPath,
        method: method.toUpperCase()
      }
    })()
  }
}