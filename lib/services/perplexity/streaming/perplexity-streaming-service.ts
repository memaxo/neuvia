import type { ResearchOptions, ResearchResult, ResearchSource } from '@/lib/types/research'
import type { RunnableConfig } from '@langchain/core/runnables'
import { ResearchTextParser } from '../parsers/research-text-parser'
import { PerplexityStreamingError } from '../error/perplexity-errors'
import { PerplexityBaseService } from '../core/perplexity-base-service'
import researchConfig from '@/lib/config/research'

const DEFAULT_DEBUG = researchConfig.debug

/**
 * Service for performing streaming research operations with Perplexity API
 * 
 * LangGraph Integration:
 * This service is designed to be used as a streaming node in a LangGraph workflow.
 * It can feed incremental results to subsequent nodes for progressive processing.
 */
export class PerplexityStreamingService extends PerplexityBaseService {
  // Implement abstract method
  protected getServiceName(): string {
    return 'PerplexityStreamingService'
  }

  /**
   * Perform streaming research with real-time results
   */
  async performStreamingResearch(
    query: string,
    options?: ResearchOptions,
    config?: RunnableConfig
  ): Promise<ReadableStream<any>> {
    const moduleLogger = this.createModuleLogger('performStreamingResearch', query, options)

    moduleLogger.info('Starting streaming research', {
      model: options?.model ?? researchConfig.providers.perplexity.model,
    })

    // Create a new ReadableStream for sending chunks
    return new ReadableStream({
      async start: async (controller) => {
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
            // Update accumulated text
            if (chunk.text) {
              textSoFar += chunk.text
            }

            // Extract and accumulate sources if available
            if (chunk.sources && Array.isArray(chunk.sources)) {
              sources = [...sources, ...chunk.sources]
            }

            // Extract key findings if available
            if (chunk.keyFindings && Array.isArray(chunk.keyFindings)) {
              keyFindings = [...keyFindings, ...chunk.keyFindings]
            }

            // Update summary if available
            if (chunk.summary) {
              summary = chunk.summary
            }

            // Create a partial result to send
            const partialResult = {
              type: 'partial',
              content: {
                text: chunk.text || '',
                sources: chunk.sources || [],
                keyFindings: chunk.keyFindings || [],
                summary: chunk.summary || '',
                timestamp: new Date(),
                complete: false
              }
            }

            // Send the partial result to the stream
            controller.enqueue(partialResult)
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
          this.cacheResult(query, options, finalResult)
          
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
      }
    })
  }
}

// Export singleton instance
export const perplexityStreamingService = new PerplexityStreamingService()