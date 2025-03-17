/**
 * Document Storage Service Errors
 * 
 * Centralized error definitions for document storage services
 */
import { ApplicationError } from '@/lib/errors'

/**
 * Base error for document storage
 */
export class DocumentStorageError extends ApplicationError {
  constructor(
    message: string,
    code: string,
    isRetryable: boolean = false,
    data?: Record<string, unknown>
  ) {
    super({
      message,
      code,
      data: {
        ...data,
        isRetryable,
      },
    })
  }
}

/**
 * Database operation errors
 */
export class DatabaseOperationError extends DocumentStorageError {
  constructor(
    message: string,
    code: string = 'DATABASE_OPERATION_ERROR',
    isRetryable: boolean = true,
    data?: Record<string, unknown>
  ) {
    super(message, code, isRetryable, data)
  }
}

/**
 * Document retrieval errors
 */
export class DocumentRetrievalError extends DocumentStorageError {
  constructor(
    message: string,
    code: string = 'DOCUMENT_RETRIEVAL_ERROR',
    isRetryable: boolean = true,
    data?: Record<string, unknown>
  ) {
    super(message, code, isRetryable, data)
  }
}

/**
 * Status update errors
 */
export class StatusUpdateError extends DocumentStorageError {
  constructor(
    message: string,
    code: string = 'STATUS_UPDATE_ERROR',
    isRetryable: boolean = true,
    data?: Record<string, unknown>
  ) {
    super(message, code, isRetryable, data)
  }
}

/**
 * Metadata formatting errors
 */
export class MetadataFormattingError extends DocumentStorageError {
  constructor(
    message: string,
    code: string = 'METADATA_FORMATTING_ERROR',
    isRetryable: boolean = false,
    data?: Record<string, unknown>
  ) {
    super(message, code, isRetryable, data)
  }
}