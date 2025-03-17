// Export all Perplexity services
export { perplexityResearchService, PerplexityResearchService } from './research/perplexity-research-service'
export { perplexityMedicalService, PerplexityMedicalService } from './medical/perplexity-medical-service'
export { perplexityCacheService, PerplexityCacheService } from './cache/perplexity-cache-service'
export { perplexityStreamingService, PerplexityStreamingService } from './streaming/perplexity-streaming-service'

// Re-export types
export type { ResearchOptions, ResearchResult, ResearchSource } from '@/lib/types/research'

// Export error types
export {
  PerplexityResearchError,
  PerplexityMedicalError,
  PerplexityCacheError,
  PerplexityStreamingError
} from './error/perplexity-errors'

/**
 * @deprecated Use the specific perplexity services instead of the monolithic PerplexityService
 * 
 * For general research: perplexityResearchService.performResearch()
 * For medical diagnosis: perplexityMedicalService.performMedicalDiagnosis()
 * For streaming research: perplexityStreamingService.performStreamingResearch()
 */
export { perplexityService } from './perplexity-service'