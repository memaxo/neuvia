import { langChainCore } from '@/lib/langchain/core'
import type { LangChainCore } from '@/lib/langchain/core'
import type { ResearchOptions, ResearchResult } from '@/lib/types/research'
import logger from '@/lib/logger'
import { withRetry } from '@/lib/utils/retry'
import type { RunnableConfig } from '@langchain/core/runnables'
import { PerplexityChainFactory } from '../chains/chain-factory'
import { ResearchErrorHandler } from '../error/error-handler'
import { perplexityCacheService, PerplexityCacheService } from '../cache/perplexity-cache-service'
import { ApplicationError } from '@/lib/errors'
import { ValidationError } from '@/lib/errors/verification-errors'
import { ResearchType } from '@/lib/types/research'
import researchConfig from '@/lib/config/research'

// Default debug flag
const DEFAULT_DEBUG = researchConfig.debug

/**
 * Abstract base class for all Perplexity services
 * 
 * This class provides common functionality shared across all Perplexity service implementations:
 * - Standard dependency injection
 * - Standardized logging
 * - Caching integration
 * - Error handling
 * - Retry logic
 * 
 * Designed for easy integration with LangGraph nodes
 */
export abstract class PerplexityBaseService {
  protected readonly langChain: LangChainCore
  protected readonly logger: typeof logger
  protected readonly chainFactory: PerplexityChainFactory
  protected readonly errorHandler: ResearchErrorHandler
  protected readonly cacheService: PerplexityCacheService

  constructor(
    langChainProvider?: LangChainCore,
    loggerInstance?: typeof logger,
    cacheService?: PerplexityCacheService,
    errorHandler?: ResearchErrorHandler
  ) {
    this.langChain = langChainProvider || langChainCore
    this.logger = loggerInstance || logger
    this.cacheService = cacheService || perplexityCacheService
    this.errorHandler = errorHandler || new ResearchErrorHandler(this.logger)
    this.chainFactory = new PerplexityChainFactory(this.langChain, this.logger)
  }

  /**
   * Create a logger with standard metadata for the specific service
   */
  protected createModuleLogger(
    method: string,
    query: string,
    options?: ResearchOptions
  ) {
    return this.logger.withMetadata({
      module: this.getServiceName(),
      method,
      model: options?.model ?? researchConfig.providers.perplexity.model,
      depth: options?.depth ?? 'standard',
      query: query.length > 50 ? `${query.substring(0, 50)}...` : query,
    })
  }

  /**
   * Get the service name for logging
   * Subclasses should override this with their specific service name
   */
  protected abstract getServiceName(): string;

  /**
   * Check cache for existing results
   */
  protected getCachedResult(
    query: string,
    options?: ResearchOptions
  ): ResearchResult | null {
    return this.cacheService.getCachedResult(query, options)
  }

  /**
   * Cache a research result
   */
  protected cacheResult(
    query: string,
    options: ResearchOptions | undefined,
    result: ResearchResult
  ): void {
    this.cacheService.cacheResult(query, options, result)
  }

  /**
   * Execute an operation with standardized retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    errorType?: typeof ApplicationError
  ): Promise<T> {
    return withRetry(operation, {
      maxRetries,
      baseDelay,
      retryCondition: (error) => {
        // Don't retry validation errors
        if (error instanceof ValidationError) {
          return false;
        }
        return true;
      },
      onError: (error, attempt) => {
        this.logger.warn(`Retry attempt ${attempt} after error`, {}, error)
      }
    })
  }

  /**
   * Format a standard research result
   */
  protected formatResult(
    chainResult: any,
    options?: ResearchOptions,
    isMedicalDiagnosis: boolean = false
  ): ResearchResult {
    return {
      text: chainResult.text,
      sources: chainResult.sources || [],
      summary: chainResult.summary,
      keyFindings: chainResult.keyFindings,
      timestamp: new Date(),
      confidence: isMedicalDiagnosis ? 0.9 : 0.85,
      modelName: options?.model ?? researchConfig.providers.perplexity.model,
    }
  }

  /**
   * Handle errors in a consistent way
   */
  protected handleServiceError(
    error: unknown,
    query: string, 
    options?: ResearchOptions,
    errorType?: typeof ApplicationError
  ): never {
    // Log the error
    this.errorHandler.handleResearchError(query, options, error)

    // If a specific error type is provided, throw that
    if (errorType) {
      throw new errorType(
        `Research operation failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }

    // Re-throw the original error
    throw error
  }
}