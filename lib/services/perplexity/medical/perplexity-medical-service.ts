import researchConfig from '@/lib/config/research'
import { langChainCore } from '@/lib/langchain/core'
import type { LangChainCore } from '@/lib/langchain/core'
import type { ResearchOptions, ResearchResult, ResearchType } from '@/lib/types/research'
import logger from '@/lib/logger'
import { withRetry } from '@/lib/utils/retry'
import type { RunnableConfig } from '@langchain/core/runnables'
import { PerplexityChainFactory } from '../chains/chain-factory'
import { PerplexityMedicalError } from '../error/perplexity-errors'
import { perplexityCacheService } from '../cache/perplexity-cache-service'

// Default debug flag
const DEFAULT_DEBUG = researchConfig.debug

/**
 * Service for performing medical diagnosis operations with Perplexity API
 * 
 * This service focuses solely on specialized medical diagnosis research,
 * without any workflow orchestration or progress tracking logic.
 */
export class PerplexityMedicalService {
  private readonly langChain: LangChainCore
  private readonly logger: typeof logger
  private readonly chainFactory: PerplexityChainFactory
  
  constructor(
    langChainProvider?: LangChainCore,
    loggerInstance?: typeof logger
  ) {
    this.langChain = langChainProvider || langChainCore
    this.logger = loggerInstance || logger
    this.chainFactory = new PerplexityChainFactory(this.langChain, this.logger)
  }

  /**
   * Perform medical diagnosis using Perplexity API
   * 
   * @param query The diagnostic query
   * @param patientData Patient data for analysis
   * @param options Optional research parameters
   * @param config Optional LangChain config
   * @returns Medical diagnosis research result
   */
  async performMedicalDiagnosis(
    query: string,
    patientData: string,
    options?: Omit<ResearchOptions, 'isMedicalDiagnosis' | 'patientData'>,
    config?: RunnableConfig
  ): Promise<ResearchResult> {
    const moduleLogger = this.logger.withMetadata({
      module: 'PerplexityMedicalService',
      method: 'performMedicalDiagnosis',
      model: options?.model ?? researchConfig.providers.perplexity.model,
    })

    if (DEFAULT_DEBUG) {
      moduleLogger.debug('Performing medical diagnosis', {
        query,
      })
    }

    // Combine options with medical diagnosis specifics
    const medicalOptions: ResearchOptions = {
      ...options,
      isMedicalDiagnosis: true,
      patientData,
      researchType: ResearchType.MEDICAL_DIAGNOSIS,
      depth: options?.depth || 'comprehensive'
    }

    // Check cache first
    const cachedResult = perplexityCacheService.getCachedResult(query, medicalOptions)
    if (cachedResult) {
      return cachedResult
    }

    // Use the retry mechanism for the API call
    return withRetry(async () => {
      try {
        // Create medical diagnosis chain
        const diagnosisChain = await this.chainFactory.createMedicalDiagnosisChain(
          medicalOptions,
          config
        )

        // Process the chain's output
        const chainResult = await diagnosisChain.invoke({
          query,
          patientData,
          depth: options?.depth ?? 'comprehensive',
        }, config)

        // Format the result
        const formattedResult: ResearchResult = {
          text: chainResult.text,
          sources: chainResult.sources || [],
          summary: chainResult.summary,
          keyFindings: chainResult.keyFindings,
          timestamp: new Date(),
          confidence: 0.9, // Higher confidence for medical diagnosis
          modelName: options?.model ?? researchConfig.providers.perplexity.model,
        }

        // Cache the result for future use
        perplexityCacheService.cacheResult(query, medicalOptions, formattedResult)

        return formattedResult
      } catch (error) {
        throw new PerplexityMedicalError(
          `Medical diagnosis failed: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : undefined
        )
      }
    }, {
      maxRetries: 3,
      baseDelay: 1000,
    })
  }
}

// Export singleton instance
export const perplexityMedicalService = new PerplexityMedicalService()