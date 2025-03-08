import { ApplicationError } from '@/lib/errors'
import { 
  AUTH_ERROR_CODES, 
  API_ERROR_CODES 
} from './error-codes'

/**
 * Combined error codes for auth-related errors
 */
const ERROR_CODES = {
  AUTH: {
    AUTH_REQUIRED: AUTH_ERROR_CODES.UNAUTHORIZED,
    FORBIDDEN: AUTH_ERROR_CODES.ACCESS_DENIED,
    INVALID_CREDENTIALS: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    SESSION_EXPIRED: AUTH_ERROR_CODES.SESSION_EXPIRED,
    GENERIC_ERROR: AUTH_ERROR_CODES.LOGIN_FAILED
  }
}

/**
 * Base class for user-related errors
 */
export class UserError extends ApplicationError {
  constructor({
    message,
    code = ERROR_CODES.AUTH.GENERIC_ERROR,
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
 * Authentication error for when a user is not authenticated
 */
export class AuthenticationError extends UserError {
  constructor({
    message = 'Authentication required',
    code = ERROR_CODES.AUTH.AUTH_REQUIRED,
    statusCode = 401,
    data = {},
    cause
  }: {
    message?: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
  }) {
    super({ message, code, statusCode, data, cause })
  }
}

/**
 * Authorization error for when a user does not have permission
 */
export class AuthorizationError extends UserError {
  constructor({
    message = 'You do not have permission to perform this action',
    code = ERROR_CODES.AUTH.FORBIDDEN,
    statusCode = 403,
    data = {},
    cause
  }: {
    message?: string
    code?: string
    statusCode?: number
    data?: Record<string, any>
    cause?: unknown
  }) {
    super({ message, code, statusCode, data, cause })
  }
}