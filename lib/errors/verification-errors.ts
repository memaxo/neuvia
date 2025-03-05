import { ApplicationError } from '@/lib/errors'
import { randomUUID } from 'crypto'

/**
 * ValidationError - for validation failures in any context
 */
export class ValidationError extends ApplicationError {
  constructor({
    message = 'Validation error',
    code = 'VALIDATION_ERROR',
    statusCode = 422,
    data = {},
    cause
  }: {
    message?: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({ message, code, statusCode, data, cause, isOperational: true })
  }
}

/**
 * VerificationError - for verification-related failures
 */
export class VerificationError extends ApplicationError {
  constructor({
    message = 'Verification error',
    code = 'VERIFICATION_ERROR',
    statusCode = 422,
    data = {},
    cause
  }: {
    message?: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({ message, code, statusCode, data, cause, isOperational: true })
  }
}

/**
 * CorrectionError - for correction-related failures
 */
export class CorrectionError extends ApplicationError {
  constructor({
    message = 'Correction error',
    code = 'CORRECTION_ERROR',
    statusCode = 422,
    data = {},
    cause
  }: {
    message?: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({ message, code, statusCode, data, cause, isOperational: true })
  }
}

/**
 * WorkflowStateError - for issues with invalid workflow state transitions
 */
export class WorkflowStateError extends ApplicationError {
  constructor({
    message = 'Invalid workflow transition',
    code = 'WORKFLOW_STATE_ERROR',
    statusCode = 422,
    data = {},
    cause
  }: {
    message?: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: Error | unknown
  }) {
    super({ message, code, statusCode, data, cause, isOperational: true })
  }
}

/**
 * Utility function to generate a correlation ID for error tracking
 */
export function generateCorrelationId(): string {
  return randomUUID()
}

/**
 * Helper to map verification errors to user-friendly messages
 */
export function mapVerificationErrorToMessage(error: ApplicationError): string {
  switch (error.code) {
    case 'VERIFICATION_ERROR':
      return 'A verification error occurred while processing your request.'
    case 'CORRECTION_ERROR':
      return 'A correction error occurred while updating the summary.'
    case 'VALIDATION_ERROR':
      return 'A validation error occurred. Please check your input.'
    default:
      return 'An unexpected verification-related error occurred. Please try again.'
  }
}

/**
 * A standardized error handler for verification routes, if needed.
 * Example usage in serverless context, logs correlation ID, etc.
 */
export function handleVerificationRouteError(
  error: unknown,
  correlationId: string,
  defaultMessage = 'Verification route failed'
) {
  // For production usage, you might send this to Sentry, etc.
  // eslint-disable-next-line no-console
  console.error(`[${correlationId}] Verification route error:`, error)

  let appError: ApplicationError
  if (error instanceof ApplicationError) {
    appError = error
  } else {
    appError = new VerificationError({
      message: defaultMessage,
      code: 'VERIFICATION_ERROR',
      data: { originalError: error }
    })
  }

  const userMsg = mapVerificationErrorToMessage(appError)

  return {
    message: appError.message || defaultMessage,
    code: appError.code || 'VERIFICATION_ERROR',
    details: {
      correlationId,
      ...appError.data,
    },
    status: appError.statusCode,
    userMessage: userMsg,
  }
}