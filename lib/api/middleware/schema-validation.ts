/**
 * Schema Validation Middleware
 * 
 * Middleware for validating API requests and responses against OpenAPI schemas
 */
import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from '../validation'
import { ValidationError } from '@/lib/errors'
import logger from '@/lib/logger'
import { getRequestId } from '@/lib/api-response'

// Type for HTTP methods
type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

/**
 * Options for validation middleware
 */
interface ValidationMiddlewareOptions {
  /**
   * Path in the OpenAPI specification
   */
  openApiPath: string
  
  /**
   * HTTP method
   */
  method: HttpMethod
  
  /**
   * Whether to log validation errors
   */
  logErrors?: boolean
  
  /**
   * Additional metadata for logging
   */
  logMetadata?: Record<string, any>
}

/**
 * Middleware for validating requests against OpenAPI schemas
 * @param options Options for the middleware
 */
export function schemaValidationMiddleware(options: ValidationMiddlewareOptions) {
  const { openApiPath, method, logErrors = true, logMetadata = {} } = options
  
  return async function middleware(request: NextRequest) {
    const requestId = getRequestId(request)
    
    try {
      // Validate request against schema
      await validateRequest(request, openApiPath, method)
      
      // Continue to the next middleware/handler
      return NextResponse.next()
    } catch (error) {
      if (logErrors) {
        const moduleLogger = logger.withMetadata({
          module: 'SchemaValidation',
          path: openApiPath,
          method: method.toUpperCase(),
          requestId,
          ...logMetadata
        })
        
        moduleLogger.warn('Request validation failed', {}, error)
      }
      
      // Handle validation error
      if (error instanceof ValidationError) {
        return NextResponse.json(
          {
            error: {
              message: error.message,
              code: error.code,
              timestamp: error.timestamp,
              details: error.data
            }
          },
          { status: error.statusCode }
        )
      }
      
      // Pass other errors to error boundary
      throw error
    }
  }
}

/**
 * Factory function for creating schema validation middleware
 * @param path Path in the OpenAPI specification
 * @param method HTTP method
 * @param options Additional options
 */
export function createSchemaValidator(
  path: string,
  method: HttpMethod,
  options: Omit<ValidationMiddlewareOptions, 'openApiPath' | 'method'> = {}
) {
  return schemaValidationMiddleware({
    openApiPath: path,
    method,
    ...options
  })
}