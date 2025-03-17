import type { ResearchOptions, ResearchResult } from '@/lib/types/research'
import { PerplexityCacheError } from '../error/perplexity-errors'
import logger from '@/lib/logger'

/**
 * Service for managing caching of perplexity research results
 * 
 * This service provides methods for storing, retrieving, and managing cached research results
 * to avoid unnecessary API calls and improve performance.
 */
export class PerplexityCacheService {
  // Cache for research results
  private readonly researchCache = new Map<
    string,
    { result: ResearchResult; timestamp: Date }
  >()
  
  private readonly logger: typeof logger

  constructor(loggerInstance?: typeof logger) {
    this.logger = loggerInstance || logger
  }

  /**
   * Get a unique cache key for a research query and options
   */
  private getCacheKey(query: string, options?: ResearchOptions): string {
    return `${query}|${JSON.stringify(options)}`
  }

  /**
   * Get a cached research result if available and not expired
   * 
   * @param query The research query
   * @param options The research options
   * @returns The cached result or null if not found or expired
   */
  getCachedResult(
    query: string,
    options?: ResearchOptions
  ): ResearchResult | null {
    try {
      const key = this.getCacheKey(query, options)
      const cached = this.researchCache.get(key)

      // Return null if not cached or missing timestamp
      if (!cached || !cached.timestamp) {
        return null
      }

      // Calculate cache age in milliseconds
      const cacheAge = new Date().getTime() - cached.timestamp.getTime()
      if (cacheAge > 3600000) {
        // 1 hour in milliseconds
        this.logger.debug('Cache expired', { query, cacheAge })
        return null
      }

      this.logger.debug('Using cached research result', { 
        query, 
        cacheAge 
      })
      
      return cached.result
    } catch (error) {
      throw new PerplexityCacheError(
        `Failed to retrieve cached result: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Cache a research result
   * 
   * @param query The research query
   * @param options The research options
   * @param result The research result to cache
   */
  cacheResult(
    query: string,
    options: ResearchOptions | undefined,
    result: ResearchResult
  ): void {
    try {
      const key = this.getCacheKey(query, options)
      this.researchCache.set(key, { result, timestamp: new Date() })
      
      this.logger.debug('Cached research result', { query })
    } catch (error) {
      throw new PerplexityCacheError(
        `Failed to cache result: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Clear the cache or specific entries
   * 
   * @param query Optional query to clear specific entry
   * @param options Optional options to clear specific entry
   */
  clearCache(query?: string, options?: ResearchOptions): void {
    try {
      if (query && options) {
        const key = this.getCacheKey(query, options)
        this.researchCache.delete(key)
        this.logger.debug('Cleared specific cache entry', { query })
      } else {
        this.researchCache.clear()
        this.logger.debug('Cleared entire research cache')
      }
    } catch (error) {
      throw new PerplexityCacheError(
        `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
}

// Export singleton instance
export const perplexityCacheService = new PerplexityCacheService()