import { ApplicationError } from '@/lib/errors'

/**
 * A generic error class for verification-specific errors
 */
export class VerificationError extends ApplicationError {
  constructor({
    message,
    code = 'VERIFICATION_ERROR',
    statusCode = 400,
    data = {},
    cause
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
  }) {
    super({ message, code, statusCode, data, cause, isOperational: true })
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
    cause
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
  }) {
    super({ message, code, statusCode, data, cause, isOperational: true })
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
    cause
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
  }) {
    super({ message, code, statusCode, data, cause, isOperational: true })
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
    cause
  }: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
  }) {
    super({ message, code, statusCode, data, cause, isOperational: true })
  }
}