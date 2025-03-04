/**
 * Zod Validation Middleware
 * 
 * Provides middleware for validating request data with Zod schemas
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { zodErrorToValidationError } from '@/lib/errors'

/**
 * Middleware factory for validating request body against a Zod schema
 * 
 * @param schema The Zod schema to validate against
 * @returns A middleware function that validates the request body
 */
export function withZodValidation<T>(schema: z.ZodSchema<T>) {
  return async function validateRequest(
    req: NextRequest,
    handler: (data: T) => Promise<Response>
  ): Promise<Response> {
    try {
      const body = await req.json()
      const validatedData = schema.parse(body)
      return await handler(validatedData)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = zodErrorToValidationError(error)
        
        return NextResponse.json(
          validationError.toJSON(),
          { status: validationError.statusCode }
        )
      }
      
      // Re-throw other errors to be handled by error boundary
      throw error
    }
  }
}

/**
 * Validates request query parameters against a Zod schema
 * 
 * @param schema The Zod schema to validate against
 * @returns A middleware function that validates the query parameters
 */
export function withQueryValidation<T>(schema: z.ZodSchema<T>) {
  return function validateQueryParams(
    req: NextRequest,
    handler: (params: T) => Promise<Response>
  ): Promise<Response> {
    try {
      const url = new URL(req.url)
      const queryParams = Object.fromEntries(url.searchParams.entries())
      const validatedParams = schema.parse(queryParams)
      
      return handler(validatedParams)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = zodErrorToValidationError(
          error, 
          'Query parameter validation failed'
        )
        
        return NextResponse.json(
          validationError.toJSON(),
          { status: validationError.statusCode }
        )
      }
      
      throw error
    }
  }
}

/**
 * Safely parses and validates data against a Zod schema
 * 
 * @param schema The Zod schema to validate against
 * @param data The data to validate
 * @param errorMessage Optional custom error message
 * @returns The validated data
 * @throws ValidationError if validation fails
 */
export function validateWithZod<T>(
  schema: z.ZodSchema<T>, 
  data: unknown,
  errorMessage?: string
): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw zodErrorToValidationError(error, errorMessage)
    }
    throw error
  }
}