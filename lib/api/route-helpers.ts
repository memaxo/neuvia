/**
 * API Route Helpers
 * 
 * Utilities for creating standardized API routes with OpenAPI validation
 */
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling, getRequestId } from '@/lib/api-response'
import { validateRequest } from './validation'
import logger from '@/lib/logger'

// Import HttpMethod type from validation module
import { HttpMethod } from './validation'

/**
 * Configuration options for creating a standardized API route handler
 */
export interface CreateApiRouteOptions {
  /**
   * Path in the OpenAPI specification
   * This should match a valid path in your OpenAPI schema document
   */
  openApiPath: string
  
  /**
   * HTTP method for this endpoint
   */
  method: HttpMethod
  
  /**
   * Whether to validate the request against the OpenAPI schema
   * @default true
   */
  validate?: boolean
  
  /**
   * Whether to enable request/response logging
   * @default true
   */
  logging?: boolean
  
  /**
   * Additional metadata to include in logs
   * This can help with filtering logs for specific endpoints
   */
  logMetadata?: Record<string, any>
}

/**
 * Create a standardized API route handler with OpenAPI validation
 * 
 * This helper creates a NextJS route handler with consistent validation,
 * error handling, and logging for all API endpoints.
 * 
 * @param handler The route handler function that implements the business logic
 * @param options Configuration options for the route
 * @returns NextJS-compatible route handler function
 * 
 * @example
 * export const GET = createApiRoute(
 *   async (req) => {
 *     const data = await getPatientData(req.params.id);
 *     return apiSuccess(data);
 *   },
 *   {
 *     openApiPath: '/api/patients/{id}',
 *     method: 'get'
 *   }
 * );
 */
export function createApiRoute(
  handler: (req: NextRequest) => Promise<Response>,
  options: CreateApiRouteOptions
): (req: NextRequest) => Promise<Response> {
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