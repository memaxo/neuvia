import type { z } from 'zod'

/**
 * Base error class for all application errors
 * Includes support for structured data, HTTP status codes, and error codes
 */
export class ApplicationError extends Error {
  readonly timestamp: string
  readonly code: string
  readonly statusCode: number
  readonly data: Record<string, any>
  readonly isOperational: boolean
  readonly category?: string

  constructor({
    message,
    code = 'UNKNOWN_ERROR',
    statusCode = 500,
    data = {},
    cause,
    isOperational = true,
    category
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
    isOperational?: boolean
    category?: string
  }) {
    super(message, { cause })

    this.name = this.constructor.name
    this.timestamp = new Date().toISOString()
    this.code = code
    this.statusCode = statusCode
    this.data = data
    this.isOperational = isOperational
    this.category = category

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
        ...(this.category ? { category: this.category } : {}),
        ...(Object.keys(this.data).length > 0 ? { details: this.data } : {})
      }
    }
  }

  /**
   * Convert to ResultError format for use with Result pattern
   */
  toResultError(): {
    message: string;
    code: string;
    details?: Record<string, unknown>;
    category?: string;
  } {
    return {
      message: this.message,
      code: this.code,
      details: this.data,
      category: this.category
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
 *
 * This function centralizes error normalization to ensure consistent error handling
 * across the application. It converts any error type into an ApplicationError with
 * standardized properties.
 */
export function normalizeError(error: unknown): ApplicationError {
  // If already an ApplicationError, return as is
  if (error instanceof ApplicationError) {
    return error;
  }

  // Check if it's a ResultError (from Result pattern)
  if (typeof error === 'object' && error !== null &&
      'message' in error && 'code' in error) {
    const resultError = error as {
      message: string;
      code: string;
      details?: Record<string, unknown>;
      category?: string;
    };
    
    return new ApplicationError({
      message: resultError.message,
      code: resultError.code,
      data: resultError.details || { originalError: error },
      category: resultError.category
    });
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const code = (error as any).code || 'UNKNOWN_ERROR';
    const category = (error as any).category;
    
    return new ApplicationError({
      message: error.message,
      cause: error,
      code,
      category,
      data: {
        originalStack: error.stack,
        originalName: error.name,
        // Capture any custom properties
        ...(Object.entries(error).reduce((acc, [key, value]) => {
          if (key !== 'message' && key !== 'stack' && key !== 'name') {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, unknown>))
      }
    });
  }

  // Handle primitive types and other objects
  return new ApplicationError({
    message: String(error),
    code: 'UNKNOWN_ERROR',
    data: { originalError: error }
  });
}

/**
 * Convert an ApplicationError to a standard ResultError format
 * This allows bridging between the exception and Result patterns
 */
export function errorToResultError(error: unknown): {
  message: string;
  code: string;
  details?: Record<string, unknown>;
  category?: string;
} {
  const normalized = normalizeError(error);
  
  return {
    message: normalized.message,
    code: normalized.code,
    details: normalized.data,
    category: normalized.category
  };
}

/*
 * Note: zodErrorToValidationError has been moved to lib/errors/index.ts
 * for centralized error handling
 */