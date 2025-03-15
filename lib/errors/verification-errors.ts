import { ApplicationError } from '@/lib/errors'
import { ErrorCategory } from './index'

/**
 * A generic error class for verification-specific errors
 */
export class VerificationError extends ApplicationError {
  constructor({
    message,
    code = 'VERIFICATION_ERROR',
    statusCode = 400,
    data = {},
    cause,
    category = ErrorCategory.VALIDATION,
    isOperational = true
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
    category?: string
    isOperational?: boolean
  }) {
    super({
      message,
      code,
      statusCode,
      data,
      cause,
      isOperational,
      category
    })
  }
}

/**
 * A specialized error class for document processing failures
 */
export class DocumentProcessingError extends ApplicationError {
  constructor({
    message,
    code = 'DOCUMENT_PROCESSING_ERROR',
    statusCode = 500,
    data = {},
    cause,
    category = ErrorCategory.SYSTEM,
    isOperational = true
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
    category?: string
    isOperational?: boolean
  }) {
    super({
      message,
      code,
      statusCode,
      data,
      cause,
      isOperational,
      category
    })
  }
}

/**
 * A specialized error class for report generation failures
 */
export class ReportGenerationError extends ApplicationError {
  constructor({
    message,
    code = 'REPORT_GENERATION_ERROR',
    statusCode = 500,
    data = {},
    cause,
    category = ErrorCategory.SYSTEM,
    isOperational = true
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
    category?: string
    isOperational?: boolean
  }) {
    super({
      message,
      code,
      statusCode,
      data,
      cause,
      isOperational,
      category
    })
  }
}

/**
 * A specialized error class for validation issues
 */
export class ValidationError extends ApplicationError {
  constructor({
    message,
    code = 'VALIDATION_ERROR',
    statusCode = 422,
    data = {},
    cause,
    category = ErrorCategory.VALIDATION,
    isOperational = true
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
    category?: string
    isOperational?: boolean
  }) {
    super({
      message,
      code,
      statusCode,
      data,
      cause,
      isOperational,
      category
    })
  }
}