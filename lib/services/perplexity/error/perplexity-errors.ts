import { ApplicationError } from '@/lib/errors'

/**
 * Error thrown during general Perplexity research operations
 */
export class PerplexityResearchError extends ApplicationError {
  constructor(message: string, cause?: Error) {
    super('PERPLEXITY_RESEARCH_ERROR', message, cause)
  }
}

/**
 * Error thrown during medical diagnosis operations
 */
export class PerplexityMedicalError extends ApplicationError {
  constructor(message: string, cause?: Error) {
    super('PERPLEXITY_MEDICAL_ERROR', message, cause)
  }
}

/**
 * Error thrown during cache operations
 */
export class PerplexityCacheError extends ApplicationError {
  constructor(message: string, cause?: Error) {
    super('PERPLEXITY_CACHE_ERROR', message, cause)
  }
}

/**
 * Error thrown during streaming research operations
 */
export class PerplexityStreamingError extends ApplicationError {
  constructor(message: string, cause?: Error) {
    super('PERPLEXITY_STREAMING_ERROR', message, cause)
  }
}