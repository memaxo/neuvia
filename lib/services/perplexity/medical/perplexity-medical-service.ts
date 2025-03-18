import type { ResearchOptions, ResearchResult } from '@/lib/types/research'
import type { RunnableConfig } from '@langchain/core/runnables'
import { PerplexityMedicalError } from '../error/perplexity-errors'
import { PerplexityBaseService } from '../core/perplexity-base-service'
import researchConfig from '@/lib/config/research'

const DEFAULT_DEBUG = researchConfig.debug

/**
 * Service for performing medical diagnosis operations with Perplexity API
 * 
 * LangGraph Integration:
 * This service is designed to be used as a node in a LangGraph workflow
 * for medical diagnosis and patient data analysis.
 */
export class PerplexityMedicalService extends PerplexityBaseService {
  // Implement abstract method
  protected getServiceName(): string {
    return 'PerplexityMedicalService'
  }

  /**
   * Perform medical diagnosis using Perplexity API
   */
  async performMedicalDiagnosis(
    query: string,
    patientData: string,
    options?: Omit<ResearchOptions, 'isMedicalDiagnosis' | 'patientData'>,
    config?: RunnableConfig
  ): Promise<ResearchResult> {
    const moduleLogger = this.createModuleLogger('performMedicalDiagnosis', query, options)

    if (options?.debug ?? DEFAULT_DEBUG) {
      moduleLogger.debug('Performing medical diagnosis', { query })
    }

    // Combine options with medical diagnosis specifics
    const medicalOptions: ResearchOptions = {
      ...options,
      isMedicalDiagnosis: true,
      patientData,
      researchType: 'medical_diagnosis',
      depth: options?.depth || 'comprehensive'
    }

    // Check cache first
    const cachedResult = this.getCachedResult(query, medicalOptions)
    if (cachedResult) {
      return cachedResult
    }

    // Use the retry mechanism for the API call
    return this.withRetry(async () => {
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
        const formattedResult = this.formatResult(chainResult, medicalOptions, true)

        // Cache the result for future use
        this.cacheResult(query, medicalOptions, formattedResult)

        return formattedResult
      } catch (error) {
        this.handleServiceError(error, query, medicalOptions, PerplexityMedicalError)
        throw error // This line should never be reached due to handleServiceError, but TypeScript doesn't know that
      }
    }, 3, 1000, PerplexityMedicalError)
  }
  
  /**
   * Analyze patient medical records and generate insights
   */
  async analyzePatientRecords(
    patientData: string,
    analysisPrompt: string,
    options?: Omit<ResearchOptions, 'isMedicalDiagnosis' | 'patientData'>,
    config?: RunnableConfig
  ): Promise<ResearchResult> {
    // Construct a query from the analysis prompt
    const query = `Analyze the following patient data: ${analysisPrompt}`;
    
    // Use the medical diagnosis function with the constructed query
    return this.performMedicalDiagnosis(query, patientData, options, config);
  }
}

// Export singleton instance
export const perplexityMedicalService = new PerplexityMedicalService()