import { normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import type { ResearchOptions } from '@/lib/types/research'
import type { ParsedResearchOutput } from '@/lib/types/perplexity'
import { ResearchTextParser } from '../parsers/research-text-parser'

/**
 * Standardized error handler for Perplexity research operations
 */
export class ResearchErrorHandler {
  private readonly logger: typeof logger

  constructor(loggerInstance?: typeof logger) {
    this.logger = loggerInstance || logger
  }

  /**
   * Handle research errors with consistent approach
   *
   * @param query The query string that was being researched
   * @param options Research options (may be used in future for better error handling)
   * @param error The error that occurred
   */
  handleResearchError(
    query: string,
    options: ResearchOptions | undefined,
    error: unknown
  ): void {
    const normalizedError = normalizeError(error)
    
    this.logger
      .withMetadata({
        module: 'PerplexityService',
        method: 'handleResearchError',
        query,
        errorCode: normalizedError.code,
      })
      .error('Research failed', {}, normalizedError)
  }

  /**
   * Handle parsing error with detailed logging
   *
   * @param error The parsing error
   * @param text The original text that failed to parse
   * @returns A fallback parsed output
   */
  handleParsingError(
    error: unknown,
    text: string
  ): ParsedResearchOutput {
    // Create a logger with context metadata
    const moduleLogger = this.logger.withMetadata({
      module: 'PerplexityService',
      method: 'handleParsingError',
      textLength: text.length,
      errorType: error instanceof Error ? error.name : typeof error,
    })

    // Log detailed error information with structured logging
    moduleLogger.warn(
      'Structured parsing failed',
      {
        errorMessage: error instanceof Error ? error.message : String(error),
        textPreview: text.length > 200 ? `${text.substring(0, 200)}...` : text,
      },
      error
    )

    // Determine if this is likely a medical diagnosis text
    const isMedicalDiagnosis =
      text.includes('Differential Diagnosis') ||
      text.includes('Patient Summary') ||
      text.includes('Condition:') ||
      text.includes('Confidence:')

    // Return a fallback object with manually extracted information
    return {
      text,
      summary: ResearchTextParser.extractSummary(text),
      keyFindings: isMedicalDiagnosis
        ? ResearchTextParser.extractDifferentialDiagnoses(text)
        : ResearchTextParser.extractKeyFindings(text),
      sources: [], // Empty sources array, will be filled later
    }
  }
}