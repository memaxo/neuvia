import researchConfig from '@/lib/config/research'
import { langChainCore } from '@/lib/langchain/core'
import type { LangChainCore } from '@/lib/langchain/core'
import type { ResearchOptions, ResearchResult, ResearchSource } from '@/lib/types/research'
import logger from '@/lib/logger'
import type { RunnableConfig } from '@langchain/core/runnables'
import { PerplexityChainFactory } from '../chains/chain-factory'
import { ResearchTextParser } from '../parsers/research-text-parser'
import { PerplexityStreamingError } from '../error/perplexity-errors'
import { perplexityCacheService } from '../cache/perplexity-cache-service'

/**
 * Service for performing streaming research operations with Perplexity API
 * 
 * This service focuses solely on streaming research functionality, without any
 * workflow orchestration or progress tracking logic.
 */
export class PerplexityStreamingService {
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
   * Perform streaming research with real-time results
   * 
   * @param query The research query
   * @param options Optional research parameters
   * @param config Optional LangChain config
   * @returns ReadableStream of partial results
   */
  async performStreamingResearch(
    query: string,
    options?: ResearchOptions,
    config?: RunnableConfig
  ): Promise<ReadableStream> {
    const moduleLogger = this.logger.withMetadata({
      module: 'PerplexityStreamingService',
      method: 'performStreamingResearch',
      query,
    })

    moduleLogger.info('Starting streaming research', {
      model: options?.model ?? researchConfig.providers.perplexity.model,
    })

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
            chain = await this.chainFactory.createMedicalDiagnosisChain(
              options,
              config
            )
          } else {
            // Standard research chain
            chain = await this.chainFactory.createChainForAction(
              options?.researchType || 'standard',
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
          perplexityCacheService.cacheResult(query, options, finalResult)
          
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
          
          throw new PerplexityStreamingError(
            `Streaming research failed: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : undefined
          )
        }
      }.bind(this),
    })
  }
}

// Export singleton instance
export const perplexityStreamingService = new PerplexityStreamingService()