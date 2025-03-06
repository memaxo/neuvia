import { z } from 'zod'

/**
 * Base error class for all application errors
 * Includes support for structured data, HTTP status codes, and error codes
 */
export class ApplicationError extends Error {
  readonly timestamp: string
  readonly code?: string
  readonly statusCode: number
  readonly data: Record<string, any>
  readonly isOperational: boolean

  constructor({
    message,
    code,
    statusCode = 500,
    data = {},
    cause,
    isOperational = true
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
    isOperational?: boolean
  }) {
    super(message, { cause })

    this.name = this.constructor.name
    this.timestamp = new Date().toISOString()
    this.code = code
    this.statusCode = statusCode
    this.data = data
    this.isOperational = isOperational

    // Maintains proper stack trace for where error was thrown (only V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Get the error details for API responses
   */
  toJSON(): Record<string, any> {
    return {
      error: {
        message: this.message,
        code: this.code,
        timestamp: this.timestamp,
        ...(Object.keys(this.data).length > 0 ? { details: this.data } : {})
      }
    }
  }
}

/**
 * ExternalServiceError - for errors from external API services
 */
export class ExternalServiceError extends ApplicationError {
  constructor({
    message = 'External service error',
    code = 'EXTERNAL_SERVICE_ERROR',
    statusCode = 500,
    service,
    data = {},
    cause
  }: {
    message?: string
    code?: string
    statusCode?: number
    service: string
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({ 
      message, 
      code, 
      statusCode, 
      data: { ...data, service }, 
      cause, 
      isOperational: true 
    })
  }
}

/**
 * SystemError - for internal system errors
 */
export class SystemError extends ApplicationError {
  constructor({
    message = 'System error',
    code = 'SYSTEM_ERROR',
    statusCode = 500,
    data = {},
    cause
  }: {
    message?: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({ 
      message, 
      code, 
      statusCode, 
      data, 
      cause, 
      isOperational: false 
    })
  }
}

/**
 * Helper function to safely handle unknown errors and convert to ApplicationError
 */
export function normalizeError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) {
    return error
  }

  if (error instanceof Error) {
    return new ApplicationError({
      message: error.message,
      cause: error,
      code: (error as any).code || 'UNKNOWN_ERROR',
      data: { originalStack: error.stack }
    })
  }

  return new ApplicationError({
    message: String(error),
    code: 'UNKNOWN_ERROR',
    data: { originalError: error }
  })
}

/**
 * Helper function to convert Zod errors to our new ValidationError
 * We'll import ValidationError from lib/errors/verification-errors
 */
import { ValidationError } from '@/lib/errors/verification-errors'

export function zodErrorToValidationError(
  error: z.ZodError,
  message = 'Validation failed',
  code = 'VALIDATION_ERROR'
): ValidationError {
  const fields: Record<string, string> = {}
  error.errors.forEach(err => {
    fields[err.path.join('.')] = err.message
  })

  return new ValidationError({
    message,
    code,
    data: { fields }
  })
}