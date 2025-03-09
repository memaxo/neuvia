import researchConfig from '@/lib/config/research'
import { langChainCore } from '@/lib/langchain/core'
import type { LangChainCore } from '@/lib/langchain/core'
import type {
  ResearchOptions,
  ResearchResult,
  ResearchSource,
} from '@/lib/types/research'
import { createWorkflowCallbacks, runWithWorkflow } from '@/lib/utils/langchain'
import logger from '@/lib/logger'
import {
  ExternalServiceError,
  normalizeError,
  SystemError
} from '@/lib/errors'
import { ValidationError } from '@/lib/errors/verification-errors'
import { withRetry } from '@/lib/utils/retry'
import { RunnableBranch } from '@langchain/core/runnables'
import type { RunnableConfig } from '@langchain/core/runnables'

// Import types and our new utility classes
import type {
  PerplexitySource,
  PerplexityCompletion,
  ParsedResearchOutput
} from '@/lib/types/perplexity'
import { PerplexityChainFactory } from './chains/chain-factory'
import { ResearchTextParser } from './parsers/research-text-parser'
import { ResearchErrorHandler } from './error/error-handler'

/**
 * Unified Perplexity Service
 *
 * Single entry point for all Perplexity API interactions across the application.
 * 
 * @description
 * The PerplexityService provides a standardized interface for performing deep
 * research operations using the Perplexity API via LangChain integration.
 * It supports various research types including medical diagnosis, general research,
 * and offers features like result caching, error handling, and retry logic.
 * 
 * @example
 * ```ts
 * // Perform general research
 * const result = await perplexityService.performDeepResearch(
 *   "What are the latest treatments for diabetes?",
 *   { depth: "comprehensive" }
 * );
 * 
 * // Perform medical diagnosis
 * const diagnosis = await perplexityService.performMedicalDiagnosis(
 *   "What is the likely diagnosis?",
 *   patientSummary,
 *   { temperature: 0.2 }
 * );
 * ```
 */

/**
 * Helper function to get URL from source object or string
 */
function getSourceUrl(source: PerplexitySource | string): string {
  if (typeof source === 'string') {
    return source
  }

  return source.url
}

// Default debug flag - use research config for consistency
const DEFAULT_DEBUG = researchConfig.debug

/**
 * PerplexityService class - the single source of truth for all Perplexity API interactions
 */
export class PerplexityService {
  // Add a cache for research results
  private readonly researchCache = new Map<
    string,
    { result: ResearchResult; timestamp: Date }
  >()
  
  private readonly langChain: LangChainCore
  private readonly logger: typeof logger
  private readonly chainFactory: PerplexityChainFactory
  private readonly errorHandler: ResearchErrorHandler

  constructor(
    langChainProvider?: LangChainCore,
    loggerInstance?: typeof logger
  ) {
    this.langChain = langChainProvider || langChainCore
    this.logger = loggerInstance || logger
    this.chainFactory = new PerplexityChainFactory(this.langChain, this.logger)
    this.errorHandler = new ResearchErrorHandler(this.logger)
  }

  /**
   * Get a unique cache key for a research query and options
   */
  private getCacheKey(
    query: string,
    options?: ResearchOptions
  ): string {
    return `${query}|${JSON.stringify(options)}`
  }

  /**
   * Get a cached research result if available and not expired
   */
  private getCachedResult(
    query: string,
    options?: ResearchOptions
  ): ResearchResult | null {
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
      return null
    }

    return cached.result
  }

  /**
   * Cache a research result
   */
  private cacheResult(
    query: string,
    options: ResearchOptions | undefined,
    result: ResearchResult
  ): void {
    const key = this.getCacheKey(query, options)
    this.researchCache.set(key, { result, timestamp: new Date() })
  }

  /**
   * Process raw text from Perplexity API response into a structured research result
   *
   * @param text The raw text from the Perplexity API response
   * @param completion The full completion object from the Perplexity API
   * @param isMedicalDiagnosis Whether this is a medical diagnosis request
   * @returns A structured research result
   */
  // This method is kept for future implementation of direct API integration
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async processApiResponse(
    text: string,
    completion: PerplexityCompletion,
    isMedicalDiagnosis: boolean = false
  ): Promise<ResearchResult> {
    // Try to parse the response using the structured output parser
    let parsedOutput: ParsedResearchOutput
    let sources: ResearchSource[] = []
    const keyFindings: string[] = []
    const summary: string = ''

    try {
      // Delegate to appropriate parser based on the request type
      // Actual implementation would use the parser directly
      // This is a placeholder for future integration
      parsedOutput = {
        text,
        summary: ResearchTextParser.extractSummary(text),
        keyFindings: isMedicalDiagnosis
          ? ResearchTextParser.extractDifferentialDiagnoses(text)
          : ResearchTextParser.extractKeyFindings(text),
        sources: []
      }
      sources = parsedOutput.sources
    } catch (parseError) {
      // Handle parsing error using our error handler
      parsedOutput = this.errorHandler.handleParsingError(parseError, text)

      // Extract sources from the response - either from metadata or by parsing text
      sources =
        Array.isArray(completion.sources) && completion.sources.length > 0
          ? (completion.sources
              .filter(Boolean)
              .map((source: PerplexitySource | string) => {
                if (source === null || source === undefined) return null

                return {
                  title: (typeof source === 'object' && 'title' in source) 
                    ? source.title 
                    : undefined,
                  url: getSourceUrl(source),
                  snippet: (typeof source === 'object' && 'snippet' in source)
                    ? source.snippet
                    : undefined,
                }
              })
              .filter(Boolean) as ResearchSource[])
          : ResearchTextParser.extractSourcesFromText(text)
    }

    // Create result object with more structured information
    return {
      text: parsedOutput.text || text,
      sources,
      summary: parsedOutput.summary || ResearchTextParser.extractSummary(text),
      timestamp: new Date(),
      confidence: isMedicalDiagnosis ? 0.9 : 0.85, // Higher confidence for medical diagnosis
      keyFindings: parsedOutput.keyFindings?.length
        ? parsedOutput.keyFindings
        : ResearchTextParser.extractKeyFindings(text),
    }
  }

  /**
   * Execute an async operation with retry logic
   * 
   * @deprecated Use the centralized withRetry utility from '@/lib/utils/retry' instead.
   * This method is kept for backward compatibility and delegates to the centralized utility.
   *
   * @param operation The operation to execute
   * @param maxRetries Maximum number of retries
   * @param delay Initial delay between retries (increases with each retry)
   * @returns The result of the operation
   * @throws The last error encountered if all retries fail
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    return withRetry(operation, {
      maxRetries,
      baseDelay: delay,
      retryCondition: (error) => {
        // Don't retry validation errors
        if (error instanceof ValidationError) {
          return false;
        }
        return true;
      }
    });
  }
  /**
   * Perform deep research using Perplexity API with the LangChain Runnable pattern
   *
   * @param query - The research query or question to be answered
   * @param options - Optional configuration for the research process
   * @param options.model - The specific Perplexity model to use (defaults to config value)
   * @param options.temperature - Controls randomness in response generation (0.0-1.0)
   * @param options.maxTokens - Maximum number of tokens in the response
   * @param options.depth - Research depth level ("basic", "standard", "comprehensive")
   * @param options.onProgress - Callback for tracking progress percentage (0-100)
   * @param options.isMedicalDiagnosis - Whether this is a medical diagnosis query
   * @param options.patientData - Patient data to include for medical diagnosis
   * @param debug - Whether to enable detailed debug logging
   * @param config - Additional LangChain RunnableConfig for advanced scenarios
   * 
   * @returns A structured research result object with text, sources, summary, and key findings
   * 
   * @throws {ValidationError} For invalid inputs or configuration
   * @throws {ExternalServiceError} For Perplexity API or network errors
   * @throws {SystemError} For unexpected system errors
   * 
   * @example
   * ```ts
   * const result = await perplexityService.performDeepResearch(
   *   "What are the potential implications of quantum computing on cryptography?",
   *   { 
   *     depth: "comprehensive",
   *     temperature: 0.3,
   *     onProgress: (progress) => console.log(`Research progress: ${progress}%`) 
   *   }
   * );
   * ```
   */
  async performDeepResearch(
    query: string,
    options?: ResearchOptions,
    debug: boolean = DEFAULT_DEBUG,
    config?: RunnableConfig
  ): Promise<ResearchResult> {
    const moduleLogger = this.logger.withMetadata({
      module: 'PerplexityService',
      method: 'performDeepResearch',
      isMedicalDiagnosis: !!options?.isMedicalDiagnosis,
      model: options?.model ?? researchConfig.providers.perplexity.model,
      depth: options?.depth ?? 'standard',
    })

    if (debug) {
      moduleLogger.debug('Performing deep research', {
        query,
        options,
      })
    }

    // Check cache first
    const cachedResult = this.getCachedResult(query, options)
    if (cachedResult) {
      moduleLogger.debug('Using cached research result', {
        cacheAge: new Date().getTime() - cachedResult.timestamp.getTime(),
        query,
      })
      return cachedResult
    }

    // Use the retry mechanism for the API call
    return withRetry(async () => {
      // Run with workflow to track progress
      const result = await runWithWorkflow(
        'research',
        async () => {
          // Track progress if a callback is provided
          const onProgress = options?.onProgress
          if (typeof onProgress === 'function') {
            onProgress(10) // Research started
          }

          // Use RunnableBranch to handle different research types
          const researchChain = RunnableBranch.from([
            [
              (input) => input.isMedicalDiagnosis === true,
              async (input) => {
                // Use chain factory to create medical diagnosis chain
                const diagnosisChain = await this.chainFactory.createMedicalDiagnosisChain(
                  options,
                  config
                )

                return diagnosisChain.invoke({
                  query,
                  patientData: input.patientData ?? '',
                  depth: options?.depth ?? 'comprehensive',
                })
              },
            ],
            async (_input) => {
              // Use chain factory to create standard research chain
              const standardChain = await this.chainFactory.createStandardResearchChain(
                options,
                config
              )

              return standardChain.invoke({
                query,
                depth: options?.depth ?? 'standard',
              })
            },
          ])

          // Process the chain's output
          const chainResult = await researchChain.invoke({
            query,
            isMedicalDiagnosis: options?.isMedicalDiagnosis === true,
            patientData: options?.patientData,
            depth: options?.depth ?? 'standard',
          }, config)

          // Update progress if callback exists
          if (typeof onProgress === 'function') {
            onProgress(70) // Research completed, processing results
          }

          // Format the result
          const formattedResult: ResearchResult = {
            text: chainResult.text,
            sources: chainResult.sources || [],
            summary: chainResult.summary,
            keyFindings: chainResult.keyFindings,
            timestamp: new Date(),
            confidence: options?.isMedicalDiagnosis ? 0.9 : 0.85,
            modelName:
              options?.model ?? researchConfig.providers.perplexity.model,
          }

          // Final progress update
          if (typeof onProgress === 'function') {
            onProgress(100) // Research and processing complete
          }

          // Cache the result for future use
          this.cacheResult(query, options, formattedResult)

          return formattedResult
        },
        {
          onProgress: options?.onProgress,
          onError: (error: unknown) => this.errorHandler.handleResearchError(query, options, error),
        }
      )

      return result
    }, {
      maxRetries: 3,
      baseDelay: 1000,
      retryCondition: (error) => {
        // Don't retry validation errors
        if (error instanceof ValidationError) {
          return false;
        }
        return true;
      }
    })
  }

  /**
   * Perform medical diagnosis using Perplexity API
   * Uses the verified patient data as the source of truth for analysis
   *
   * @param query - The clinical query or diagnostic question
   * @param patientData - Patient data from the verified summary
   * @param options - Optional configuration for the diagnosis process
   * @param options.model - The specific Perplexity model to use (defaults to config value)
   * @param options.temperature - Controls randomness in response generation (0.0-1.0)
   * @param options.maxTokens - Maximum number of tokens in the response
   * @param options.depth - Research depth (defaults to "comprehensive" for diagnoses)
   * @param options.onProgress - Callback for tracking progress percentage (0-100)
   * @param config - Additional LangChain RunnableConfig for advanced scenarios
   * 
   * @returns A structured diagnosis result with potential conditions, confidence levels, and sources
   * 
   * @throws {ValidationError} For invalid inputs or missing patient data
   * @throws {ExternalServiceError} For Perplexity API or network errors
   * @throws {SystemError} For unexpected system errors
   * 
   * @remarks
   * This method specifically follows medical diagnosis protocols, using a specialized prompt
   * that asks for confidence ratings and treatment recommendations for each potential diagnosis.
   * The results are formatted with differential diagnoses, evidence-based rationales, and
   * potential treatments.
   * 
   * @example
   * ```ts
   * const diagnosis = await perplexityService.performMedicalDiagnosis(
   *   "What are the most likely diagnoses for this patient?",
   *   patientSummaryData,
   *   { temperature: 0.2 }
   * );
   * 
   * console.log("Top diagnosis:", diagnosis.keyFindings[0]);
   * ```
   */
  async performMedicalDiagnosis(
    query: string,
    patientData: string,
    options?: Omit<ResearchOptions, 'isMedicalDiagnosis' | 'patientData'>,
    config?: RunnableConfig
  ): Promise<ResearchResult> {
    // Combine options with medical diagnosis specifics
    const medicalOptions: ResearchOptions = {
      ...options,
      isMedicalDiagnosis: true,
      patientData,
    }

    // Pass the config to performDeepResearch
    return this.performDeepResearch(query, medicalOptions, DEFAULT_DEBUG, config)
  }

  /**
   * Perform research using LangChain for improved structure and reasoning
   *
   * @param query - The research query or question to be answered
   * @param options - Optional configuration for the research process
   * @param options.model - The specific model to use (defaults to Perplexity's sonar-deep-research)
   * @param options.temperature - Controls randomness in response generation (0.0-1.0)
   * @param options.maxTokens - Maximum number of tokens in the response
   * @param options.depth - Research depth level ("basic", "standard", "comprehensive")
   * @param options.onProgress - Callback for tracking progress percentage (0-100)
   * @param config - Additional LangChain RunnableConfig for advanced scenarios
   *
   * @returns A structured research result with text, sources, summary, and key findings
   *
   * @throws {ValidationError} For invalid inputs or configuration
   * @throws {ExternalServiceError} For API or network errors
   * @throws {SystemError} For unexpected system errors
   *
   * @remarks
   * This method specifically uses LangChain's structured output parsing to ensure
   * consistent, well-formatted research results. It leverages the Zod schema to
   * validate and structure the AI's output.
   *
   * @example
   * ```ts
   * const result = await perplexityService.performResearchWithLangchain(
   *   "What are the environmental impacts of lithium mining?", 
   *   { depth: "comprehensive" }
   * );
   * ```
   */
  async performResearchWithLangchain(
    query: string,
    options?: ResearchOptions,
    config?: RunnableConfig
  ): Promise<ResearchResult> {
    try {
      // Use chain factory to create a standard research chain
      const chain = await this.chainFactory.createStandardResearchChain(
        {
          ...options,
          model: 'sonar-deep-research',
          temperature: options?.temperature ?? 0.3,
          maxTokens: options?.maxTokens ?? 3000,
        },
        config
      )

      // Invoke the chain
      const result = await chain.invoke({
        query,
        depth: options?.depth ?? 'standard',
      })

      // Format as ResearchResult ensuring all required fields
      return {
        ...result,
        timestamp: new Date(),
        confidence: 0.85,
        modelName: options?.model ?? 'sonar-deep-research',
      }
    } catch (error) {
      // Use error handler for consistent error handling
      this.errorHandler.handleResearchError(query, options, error)
      throw error
    }
  }

  /**
   * Perform streaming research with real-time results
   *
   * @param query Research query
   * @param options Research options
   * @param config Optional runnable config
   * @returns ReadableStream of partial results
   */
  async performStreamingResearch(
    query: string,
    options?: ResearchOptions,
    config?: RunnableConfig
  ): Promise<ReadableStream> {
    const moduleLogger = this.logger.withMetadata({
      module: 'PerplexityService',
      method: 'performStreamingResearch',
      query,
    })

    moduleLogger.info('Starting streaming research', {
      model: options?.model ?? researchConfig.providers.perplexity.model,
    })

    // Bind class methods to preserve 'this' context
    const createMedicalDiagnosisChain = this.chainFactory.createMedicalDiagnosisChain.bind(this.chainFactory)
    const createStandardResearchChain = this.chainFactory.createStandardResearchChain.bind(this.chainFactory)
    const cacheResult = this.cacheResult.bind(this)

    // Create a new ReadableStream for sending chunks
    return new ReadableStream({
      async start(controller) {
        try {
          // Determine what type of research to perform
          const isForMedicalDiagnosis = options?.isMedicalDiagnosis === true

          // Create the appropriate chain based on research type
          let chain
          if (isForMedicalDiagnosis) {
            // Medical diagnosis requires a specialized chain
            chain = await createMedicalDiagnosisChain(
              options,
              config
            )
          } else {
            // Standard research chain
            chain = await createStandardResearchChain(
              options,
              config
            )
          }

          // Set up input based on research type
          const input = {
            query,
            isMedicalDiagnosis: isForMedicalDiagnosis,
            patientData: options?.patientData ?? '',
            depth: options?.depth ?? 'standard',
          }

          // Stream the response
          const stream = await chain.stream(input, config)

          let textSoFar = ""
          let sources: ResearchSource[] = []
          let keyFindings: string[] = []
          let summary = ""

          // Process each chunk from the stream
          for await (const chunk of stream) {
            if (typeof chunk === 'string') {
              // Plain text chunk
              textSoFar += chunk
              controller.enqueue({
                type: 'text-delta',
                content: chunk
              })
            } else if (chunk && typeof chunk === 'object') {
              // Handle structured output
              if ('sources' in chunk && Array.isArray(chunk.sources)) {
                // Update sources when they come in
                sources = [...sources, ...chunk.sources]
                controller.enqueue({
                  type: 'source-delta',
                  content: chunk.sources
                })
              }
              
              if ('keyFindings' in chunk && Array.isArray(chunk.keyFindings)) {
                // Update key findings
                keyFindings = [...keyFindings, ...chunk.keyFindings]
                controller.enqueue({
                  type: 'key-findings-delta',
                  content: chunk.keyFindings
                })
              }
              
              if ('summary' in chunk && typeof chunk.summary === 'string') {
                // Update summary
                summary = chunk.summary
                controller.enqueue({
                  type: 'summary-delta',
                  content: chunk.summary
                })
              }
              
              if ('text' in chunk && typeof chunk.text === 'string') {
                // Handle text chunk
                const newText = chunk.text.slice(textSoFar.length)
                if (newText) {
                  textSoFar = chunk.text
                  controller.enqueue({
                    type: 'text-delta',
                    content: newText
                  })
                }
              }
            }
          }

          // Create a final result to cache
          const finalResult: ResearchResult = {
            text: textSoFar,
            sources,
            summary: summary || ResearchTextParser.extractSummary(textSoFar),
            keyFindings: keyFindings.length > 0 ? keyFindings : ResearchTextParser.extractKeyFindings(textSoFar),
            timestamp: new Date(),
            confidence: isForMedicalDiagnosis ? 0.9 : 0.85,
            modelName: options?.model ?? researchConfig.providers.perplexity.model,
          }
          
          // Cache the final result
          cacheResult(query, options, finalResult)
          
          // Send completion message
          controller.enqueue({
            type: 'complete',
            content: finalResult
          })
          
          controller.close()
        } catch (error) {
          // Handle and report errors
          moduleLogger.error('Error during streaming research', {}, error)
          
          controller.enqueue({
            type: 'error',
            content: error instanceof Error ? error.message : String(error)
          })
          
          controller.close()
        }
      },
    })
  }
}

// Export singleton instance
export const perplexityService = new PerplexityService()

// Export types for use in other modules
export type { ResearchOptions, ResearchResult, ResearchSource }