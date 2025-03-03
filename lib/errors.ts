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
 * Error caused by user input or user actions
 * Generally mapped to 4xx HTTP status codes
 */
export class UserError extends ApplicationError {
  constructor(options: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({
      ...options,
      statusCode: options.statusCode || 400,
      isOperational: true
    })
  }
}

/**
 * Error for authentication failures
 */
export class AuthenticationError extends UserError {
  constructor(options: {
    message?: string
    code?: string
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({
      message: options.message || 'Authentication failed',
      statusCode: 401,
      code: options.code || 'AUTHENTICATION_FAILED',
      data: options.data,
      cause: options.cause
    })
  }
}

/**
 * Error for permission/authorization failures
 */
export class AuthorizationError extends UserError {
  constructor(options: {
    message?: string
    code?: string
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({
      message: options.message || 'You do not have permission to perform this action',
      statusCode: 403,
      code: options.code || 'FORBIDDEN',
      data: options.data,
      cause: options.cause
    })
  }
}

/**
 * Error for resource not found
 */
export class NotFoundError extends UserError {
  constructor(options: {
    message?: string
    resource?: string
    code?: string
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    const resource = options.resource || 'Resource'
    super({
      message: options.message || `${resource} not found`,
      statusCode: 404,
      code: options.code || 'NOT_FOUND',
      data: options.data,
      cause: options.cause
    })
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends UserError {
  constructor(options: {
    message?: string
    code?: string
    fields?: Record<string, string>
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({
      message: options.message || 'Validation failed',
      statusCode: 422,
      code: options.code || 'VALIDATION_FAILED',
      data: {
        ...options.data,
        ...(options.fields ? { fields: options.fields } : {})
      },
      cause: options.cause
    })
  }
}

/**
 * System or internal error not caused by user
 */
export class SystemError extends ApplicationError {
  constructor(options: {
    message: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
    isOperational?: boolean
  }) {
    super({
      ...options,
      statusCode: options.statusCode || 500,
      isOperational: options.isOperational ?? false
    })
  }
}

/**
 * Error for external API or service failures
 */
export class ExternalServiceError extends SystemError {
  constructor(options: {
    message?: string
    service?: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    const service = options.service || 'External service'
    super({
      message: options.message || `${service} error`,
      code: options.code || 'EXTERNAL_SERVICE_ERROR',
      statusCode: options.statusCode || 502,
      data: {
        ...options.data,
        service: options.service
      },
      cause: options.cause,
      isOperational: true
    })
  }
}

/**
 * Workflow state error - specialized for workflow state machine issues
 */
export class WorkflowStateError extends SystemError {
  constructor(options: {
    message?: string
    transition?: { from: string; to: string }
    code?: string
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    const transitionInfo = options.transition 
      ? `from '${options.transition.from}' to '${options.transition.to}'` 
      : '';
    
    super({
      message: options.message || `Invalid workflow transition ${transitionInfo}`,
      code: options.code || 'WORKFLOW_STATE_ERROR',
      statusCode: 422, // Using 422 since it's an operational validation issue
      data: {
        ...options.data,
        ...(options.transition && { transition: options.transition })
      },
      cause: options.cause,
      isOperational: true
    })
  }
}

/**
 * Document processing error - for issues during document extraction and analysis
 */
export class DocumentProcessingError extends SystemError {
  constructor(options: {
    message?: string
    documentId?: string
    phase?: string
    code?: string
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    const phaseInfo = options.phase ? ` during ${options.phase}` : '';
    const docInfo = options.documentId ? ` for document ${options.documentId}` : '';
    
    super({
      message: options.message || `Document processing failed${phaseInfo}${docInfo}`,
      code: options.code || 'DOCUMENT_PROCESSING_ERROR',
      statusCode: 500,
      data: {
        ...options.data,
        documentId: options.documentId,
        phase: options.phase
      },
      cause: options.cause,
      isOperational: true // Document processing errors are typically recoverable
    })
  }
}

/**
 * Verification error - for issues during the verification workflow
 */
export class VerificationError extends SystemError {
  constructor(options: {
    message?: string
    verificationId?: string
    documentId?: string
    code?: string
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({
      message: options.message || 'Verification failed',
      code: options.code || 'VERIFICATION_ERROR',
      statusCode: 422,
      data: {
        ...options.data,
        verificationId: options.verificationId,
        documentId: options.documentId
      },
      cause: options.cause,
      isOperational: true
    })
  }
}

/**
 * Report generation error - for issues during report creation
 */
export class ReportGenerationError extends SystemError {
  constructor(options: {
    message?: string
    workflowId?: string
    patientId?: string
    reportId?: string
    code?: string
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({
      message: options.message || 'Report generation failed',
      code: options.code || 'REPORT_GENERATION_ERROR',
      statusCode: 500,
      data: {
        ...options.data,
        workflowId: options.workflowId,
        patientId: options.patientId,
        reportId: options.reportId
      },
      cause: options.cause,
      isOperational: true
    })
  }
}

/**
 * Storage error - for issues with file upload, download, or storage
 */
export class StorageError extends SystemError {
  constructor(options: {
    message?: string
    operation?: 'upload' | 'download' | 'delete' | 'access'
    fileId?: string
    filePath?: string
    code?: string
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    const opInfo = options.operation ? `${options.operation} operation` : 'storage operation';
    
    super({
      message: options.message || `File ${opInfo} failed`,
      code: options.code || 'STORAGE_ERROR',
      statusCode: 500,
      data: {
        ...options.data,
        operation: options.operation,
        fileId: options.fileId,
        filePath: options.filePath
      },
      cause: options.cause,
      isOperational: true
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
    return new SystemError({
      message: error.message,
      cause: error,
      code: 'UNKNOWN_ERROR'
    })
  }
  
  return new SystemError({
    message: String(error),
    data: { originalError: error },
    code: 'UNKNOWN_ERROR'
  })
}
