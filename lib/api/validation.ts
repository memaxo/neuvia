/**
 * API Validation Utilities
 * 
 * Provides middleware and helpers for validating API requests against OpenAPI schemas
 */
import { NextRequest } from 'next/server'
import { OpenAPIV3 } from 'openapi-types'
import { ajv } from './ajv'
import { ValidationError } from '@/lib/errors'
import { openAPISpec } from './openapi'

/**
 * Type for request method
 */
type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

/**
 * Type for validation errors
 */
interface ValidationErrorDetail {
  path: string
  message: string
  params?: Record<string, any>
}

/**
 * Find operation object for the given path and method
 */
function findOperation(
  path: string,
  method: HttpMethod
): OpenAPIV3.OperationObject | undefined {
  const pathObject = openAPISpec.paths[path] as OpenAPIV3.PathItemObject
  if (!pathObject) return undefined

  return pathObject[method] as OpenAPIV3.OperationObject
}

/**
 * Validate request body against schema
 */
export async function validateRequestBody(
  request: NextRequest,
  path: string,
  method: HttpMethod
): Promise<void> {
  const operation = findOperation(path, method)
  if (!operation || !operation.requestBody) return

  // Get schema from request body
  const requestBodyObject = operation.requestBody as OpenAPIV3.RequestBodyObject
  const contentType = request.headers.get('content-type') || 'application/json'
  const mediaType = requestBodyObject.content[contentType]
  
  if (!mediaType || !mediaType.schema) return

  // Clone the request to read the body
  const requestClone = request.clone()
  let body: any
  
  try {
    body = await requestClone.json()
  } catch (err) {
    throw new ValidationError({
      message: 'Invalid JSON in request body',
      code: 'INVALID_JSON'
    })
  }

  // Validate against schema
  const schema = mediaType.schema as OpenAPIV3.SchemaObject
  const validate = ajv.compile(schema)
  const isValid = validate(body)

  if (!isValid) {
    const errors = validate.errors?.map(err => ({
      path: err.instancePath || '/',
      message: err.message || 'Validation failed',
      params: err.params
    })) || []

    // Convert errors to field map for ValidationError
    const fields: Record<string, string> = {}
    errors.forEach(err => {
      const field = err.path === '/' ? 'body' : err.path.substring(1)
      fields[field] = err.message
    })

    throw new ValidationError({
      message: 'Request validation failed',
      code: 'VALIDATION_ERROR',
      fields
    })
  }
}

/**
 * Validate request query parameters against schema
 */
export function validateQueryParams(
  request: NextRequest,
  path: string,
  method: HttpMethod
): void {
  const operation = findOperation(path, method)
  if (!operation || !operation.parameters) return

  const queryParams = new URL(request.url).searchParams
  const queryParamMap = Object.fromEntries(queryParams.entries())
  
  // Get query parameters from operation
  const parameters = (operation.parameters as OpenAPIV3.ParameterObject[])
    .filter(param => param.in === 'query')

  // Validate each parameter
  const errors: ValidationErrorDetail[] = []
  
  parameters.forEach(param => {
    const paramName = param.name
    const value = queryParams.get(paramName)
    
    // Check required parameters
    if (param.required && value === null) {
      errors.push({
        path: paramName,
        message: `Parameter '${paramName}' is required`
      })
      return
    }
    
    // If value is present, validate against schema
    if (value !== null && param.schema) {
      const schema = param.schema as OpenAPIV3.SchemaObject
      const validate = ajv.compile(schema)
      const isValid = validate(value)
      
      if (!isValid) {
        errors.push({
          path: paramName,
          message: validate.errors?.[0]?.message || `Invalid value for '${paramName}'`,
          params: validate.errors?.[0]?.params
        })
      }
    }
  })
  
  if (errors.length > 0) {
    // Convert errors to field map for ValidationError
    const fields: Record<string, string> = {}
    errors.forEach(err => {
      fields[err.path] = err.message
    })
    
    throw new ValidationError({
      message: 'Query parameter validation failed',
      code: 'VALIDATION_ERROR',
      fields
    })
  }
}

/**
 * Full request validation against OpenAPI schema
 */
export async function validateRequest(
  request: NextRequest,
  path: string,
  method: HttpMethod
): Promise<void> {
  await validateRequestBody(request, path, method)
  validateQueryParams(request, path, method)
}

/**
 * Middleware to validate request against OpenAPI schema
 * @param handler The route handler
 * @param path API path in OpenAPI spec
 * @param method HTTP method
 */
export function withValidation(
  handler: (request: NextRequest) => Promise<Response>,
  path: string,
  method: HttpMethod
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      await validateRequest(request, path, method)
      return await handler(request)
    } catch (error) {
      if (error instanceof ValidationError) {
        return Response.json(
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
      throw error
    }
  }
}