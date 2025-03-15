/**
 * @fileoverview Centralized error handling exports
 * This file serves as the main entry point for all error-related functionality,
 * bringing together exception-based and Result-based error handling approaches.
 */

// Re-export all error classes and utilities
export * from '../errors'
export * from './verification-errors'
export * from './auth-errors'
export * from './error-codes'

// Error category constants
export enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  WORKFLOW = 'workflow',
  CONCURRENCY = 'concurrency',
  TRANSACTION = 'transaction',
  DATA = 'data',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  FATAL = 'fatal'
}

/**
 * Determine error category based on the error properties and message patterns
 */
export function categorizeError(error: unknown, context?: Record<string, unknown>): ErrorCategory {
  const normalizedError = normalizeError(error)
  const message = normalizedError.message.toLowerCase()
  const code = (normalizedError.code || '').toLowerCase()
  
  // Check if error already has a category
  if (normalizedError.category) {
    try {
      // Check if the category matches our enum
      if (Object.values(ErrorCategory).includes(normalizedError.category as ErrorCategory)) {
        return normalizedError.category as ErrorCategory
      }
    } catch (e) {
      // If category is not a valid ErrorCategory, continue with normal logic
    }
  }

  // Use error code for categorization if available
  if (code) {
    if (code.includes('validation') || code.includes('invalid')) {
      return ErrorCategory.VALIDATION
    } else if (code.includes('permission') || code.includes('auth')) {
      return ErrorCategory.PERMISSION
    } else if (code.includes('timeout')) {
      return ErrorCategory.TIMEOUT
    } else if (code.includes('network') || code.includes('connection')) {
      return ErrorCategory.NETWORK
    } else if (code.includes('workflow') || code.includes('transition')) {
      return ErrorCategory.WORKFLOW
    } else if (code.includes('concurrent') || code.includes('conflict')) {
      return ErrorCategory.CONCURRENCY
    } else if (code.includes('transaction')) {
      return ErrorCategory.TRANSACTION
    } else if (code.includes('data') || code.includes('not_found')) {
      return ErrorCategory.DATA
    } else if (code.includes('system') || code.includes('internal')) {
      return ErrorCategory.SYSTEM
    }
  }

  // Check error message against patterns
  const categoryPatterns: Record<ErrorCategory, RegExp[]> = {
    [ErrorCategory.VALIDATION]: [
      /validation/i, /invalid/i, /required/i, /missing/i, /schema/i, /constraint/i
    ],
    [ErrorCategory.NETWORK]: [
      /network/i, /connection/i, /unreachable/i, /dns/i, /offline/i
    ],
    [ErrorCategory.PERMISSION]: [
      /permission/i, /unauthorized/i, /forbidden/i, /access denied/i
    ],
    [ErrorCategory.TIMEOUT]: [
      /timeout/i, /timed out/i, /too slow/i, /deadline exceeded/i
    ],
    [ErrorCategory.WORKFLOW]: [
      /workflow/i, /transition/i, /state/i, /step/i
    ],
    [ErrorCategory.CONCURRENCY]: [
      /concurrent/i, /conflict/i, /optimistic/i, /lock/i, /race condition/i
    ],
    [ErrorCategory.TRANSACTION]: [
      /transaction/i, /rollback/i, /commit/i
    ],
    [ErrorCategory.DATA]: [
      /data/i, /database/i, /query/i, /record/i, /not found/i
    ],
    [ErrorCategory.SYSTEM]: [
      /system/i, /internal/i, /server/i, /runtime/i, /memory/i
    ],
    [ErrorCategory.UNKNOWN]: [
      /.*/
    ]
  }

  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    // Skip the UNKNOWN category for now
    if (category === ErrorCategory.UNKNOWN) continue

    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return category as ErrorCategory
      }
    }
  }

  // Default to UNKNOWN
  return ErrorCategory.UNKNOWN
}

/**
 * Determine severity level based on error category
 */
export function determineSeverity(category: ErrorCategory): ErrorSeverity {
  switch (category) {
    case ErrorCategory.VALIDATION:
      return ErrorSeverity.LOW

    case ErrorCategory.NETWORK:
    case ErrorCategory.TIMEOUT:
    case ErrorCategory.WORKFLOW:
    case ErrorCategory.CONCURRENCY:
      return ErrorSeverity.MEDIUM

    case ErrorCategory.PERMISSION:
    case ErrorCategory.DATA:
    case ErrorCategory.TRANSACTION:
      return ErrorSeverity.HIGH

    case ErrorCategory.SYSTEM:
      return ErrorSeverity.FATAL

    case ErrorCategory.UNKNOWN:
    default:
      return ErrorSeverity.HIGH
  }
}

// Import from the root errors file
import { normalizeError } from '../errors'
export { normalizeError }

/**
 * Convert between ApplicationError and ResultError formats
 */
export function applicationErrorToResultError(error: import('../errors').ApplicationError): {
  message: string
  code: string
  details?: Record<string, unknown>
  category?: string
} {
  return {
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    details: error.data,
    category: error.category
  }
}

/**
 * Convert a Zod error to our ValidationError format
 */
import { ValidationError } from './verification-errors'
import type { ZodError } from 'zod'

export function zodErrorToValidationError(
  error: ZodError,
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