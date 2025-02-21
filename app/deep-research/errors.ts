/**
 * Base error class for research-related errors
 */
export class ResearchError extends Error {
  constructor(
    message: string,
    public readonly code: ResearchErrorCode,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, ResearchError.prototype);
  }

  /**
   * Creates a structured error object for logging/reporting
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      cause: this.cause instanceof Error ? this.cause.message : this.cause
    };
  }
}

/**
 * Error codes for different failure scenarios
 */
export enum ResearchErrorCode {
  // Configuration errors
  INVALID_CONFIG = "INVALID_CONFIG",
  MISSING_API_KEY = "MISSING_API_KEY",
  
  // Validation errors
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_STATE = "INVALID_STATE",
  INVALID_OUTPUT = "INVALID_OUTPUT",
  
  // External service errors
  SEARCH_FAILED = "SEARCH_FAILED",
  MODEL_ERROR = "MODEL_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  
  // Cache errors
  CACHE_ERROR = "CACHE_ERROR",
  
  // Research process errors
  RESEARCH_FAILED = "RESEARCH_FAILED",
  SECTION_FAILED = "SECTION_FAILED",
  
  // Unknown/unexpected errors
  UNKNOWN = "UNKNOWN"
}

/**
 * Configuration-related errors
 */
export class ConfigError extends ResearchError {
  constructor(message: string, cause?: unknown) {
    super(message, ResearchErrorCode.INVALID_CONFIG, cause);
  }
}

/**
 * Validation-related errors
 */
export class ValidationError extends ResearchError {
  constructor(
    message: string,
    public readonly details: unknown,
    code = ResearchErrorCode.INVALID_INPUT
  ) {
    super(message, code, details);
  }
}

/**
 * External service errors
 */
export class ExternalServiceError extends ResearchError {
  constructor(
    message: string,
    public readonly service: "search" | "model" | "cache",
    public readonly statusCode?: number,
    cause?: unknown
  ) {
    super(
      message,
      service === "search" ? ResearchErrorCode.SEARCH_FAILED :
      service === "model" ? ResearchErrorCode.MODEL_ERROR :
      ResearchErrorCode.CACHE_ERROR,
      cause
    );
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends ResearchError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, ResearchErrorCode.RATE_LIMITED);
  }
}

/**
 * Research process errors
 */
export class ResearchProcessError extends ResearchError {
  constructor(
    message: string,
    public readonly section?: string,
    cause?: unknown
  ) {
    super(
      message,
      section ? ResearchErrorCode.SECTION_FAILED : ResearchErrorCode.RESEARCH_FAILED,
      cause
    );
  }
}

/**
 * Helper to wrap unknown errors in ResearchError
 */
export function wrapError(error: unknown, defaultMessage = "An unexpected error occurred"): ResearchError {
  if (error instanceof ResearchError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new ResearchError(error.message, ResearchErrorCode.UNKNOWN, error);
  }
  
  return new ResearchError(
    typeof error === "string" ? error : defaultMessage,
    ResearchErrorCode.UNKNOWN,
    error
  );
} 