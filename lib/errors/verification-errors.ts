import { ApplicationError } from '@/lib/errors'
import { randomUUID } from 'crypto'

/**
 * Specialized error for general verification failures
 */
export class VerificationError extends ApplicationError {
  constructor({
    message = 'Verification error',
    code = 'VERIFICATION_ERROR',
    statusCode = 422,
    data = {},
    cause,
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
 * Specialized error for correction failures
 */
export class CorrectionError extends ApplicationError {
  constructor({
    message = 'Correction error',
    code = 'CORRECTION_ERROR',
    statusCode = 422,
    data = {},
    cause,
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
 * Helper to map errors from the verification domain to user-friendly messages.
 * Extend this if you want specific user-facing strings for each code.
 */
export function mapVerificationErrorToMessage(error: ApplicationError): string {
  switch (error.code) {
    case 'VERIFICATION_ERROR':
      return 'A verification error occurred while processing your request.'
    case 'CORRECTION_ERROR':
      return 'A correction error occurred while updating the summary.'
    default:
      // For unknown/unhandled codes, default message:
      return 'An unexpected error occurred. Please try again.'
  }
}

/**
 * A standardized error handler for verification routes.
 * Logs the correlation ID, returns an error response with that ID in details.
 */
export function handleVerificationRouteError(
  error: unknown,
  correlationId: string,
  defaultMessage = 'Verification route failed'
) {
  // For in-depth error logging or Sentry integration, you can place it here
  console.error(`[${correlationId}] Verification route error:`, error)

  // Attempt to unwrap our known errors
  if (error instanceof ApplicationError) {
    const userMsg = mapVerificationErrorToMessage(error)
    return {
      message: error.message || defaultMessage,
      code: error.code || 'VERIFICATION_ERROR',
      details: {
        correlationId,
        ...error.data,
      },
      status: error.statusCode,
      userMessage: userMsg,
    }
  }

  // Otherwise treat as unknown
  return {
    message: defaultMessage,
    code: 'UNKNOWN_ERROR',
    details: {
      correlationId,
    },
    status: 500,
    userMessage: 'An unexpected error occurred. Please try again.',
  }
}