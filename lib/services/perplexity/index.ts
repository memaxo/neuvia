/**
 * @file Perplexity Services Entry Point
 * 
 * This file exports all perplexity-related services, configured for integration
 * with LangGraph and other application components.
 */

// Core service exports
export { PerplexityBaseService } from './core/perplexity-base-service'

// Specialized services
export { 
  PerplexityResearchService,
  perplexityResearchService 
} from './research/perplexity-research-service'

export { 
  PerplexityMedicalService,
  perplexityMedicalService 
} from './medical/perplexity-medical-service'

export { 
  PerplexityStreamingService,
  perplexityStreamingService 
} from './streaming/perplexity-streaming-service'

// Export error types for better error handling
export * from './error/perplexity-errors'

// Export cache service
export { 
  PerplexityCacheService,
  perplexityCacheService 
} from './cache/perplexity-cache-service'

// Deprecation notice: The old perplexity-service.ts is deprecated
// in favor of the specialized services above.
// @deprecated Use specialized services instead
export { perplexityService } from './perplexity-service'