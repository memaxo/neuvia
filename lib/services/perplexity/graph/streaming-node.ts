import { StateGraph, Step } from '@langchain/langgraph'
import { perplexityStreamingService } from '../streaming/perplexity-streaming-service'
import { PerplexityStreamingError } from '../error/perplexity-errors'
import { RunnableConfig } from '@langchain/core/runnables'
import logger from '@/lib/logger'
import type { ResearchOptions, ResearchResult } from '@/lib/types/research'

/**
 * LangGraph node for performing streaming research operations
 * 
 * This node integrates with the PerplexityStreamingService to perform
 * streaming research operations within a LangGraph workflow.
 * 
 * Note: This is a special node that returns a stream. To handle it properly
 * in a LangGraph workflow, you'll need to use the streaming capabilities
 * of LangGraph.
 */
export async function streamingResearchNode(
  state: {
    query: string;
    options?: ResearchOptions;
    config?: RunnableConfig;
    streamingResults?: ReadableStream<any>;
    errors?: string[];
  },
  config?: RunnableConfig
): Promise<Step> {
  const moduleLogger = logger.withMetadata({
    module: 'StreamingResearchNode',
    query: state.query,
  })

  moduleLogger.debug('Starting streaming research node', { 
    options: state.options 
  })

  try {
    // Get the streaming research result
    const stream = await perplexityStreamingService.performStreamingResearch(
      state.query,
      state.options,
      config || state.config
    )

    // Return the updated state with the streaming result
    return {
      result: {
        ...state,
        streamingResults: stream,
      }
    }
  } catch (error) {
    moduleLogger.error('Streaming research node failed', {}, error)
    
    // Add error to state
    return {
      result: {
        ...state,
        errors: [
          ...(state.errors || []),
          error instanceof Error ? error.message : String(error)
        ]
      },
      // If we want to trigger an error handler branch
      next: "error_handler" 
    }
  }
}

/**
 * Helper function to process streaming results and convert them to regular results
 * This is useful for workflows that need to work with the final research results
 */
export async function processStreamingResultsNode(
  state: {
    streamingResults: ReadableStream<any>;
    results?: ResearchResult[];
    errors?: string[];
  }
): Promise<Step> {
  const moduleLogger = logger.withMetadata({
    module: 'ProcessStreamingResultsNode',
  })

  moduleLogger.debug('Processing streaming results')

  try {
    // Create a reader for the stream
    const reader = state.streamingResults.getReader()
    
    let finalResult: ResearchResult | null = null
    
    // Read the stream
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        break
      }
      
      // If this is the final complete result, save it
      if (value.type === 'complete') {
        finalResult = value.content
      }
      
      // If it's an error, add it to the errors array
      if (value.type === 'error') {
        return {
          result: {
            ...state,
            errors: [
              ...(state.errors || []),
              value.content
            ]
          },
          next: "error_handler"
        }
      }
    }
    
    // If we got a final result, add it to the results array
    if (finalResult) {
      return {
        result: {
          ...state,
          results: [...(state.results || []), finalResult],
        }
      }
    } else {
      // If we didn't get a final result, add an error
      return {
        result: {
          ...state,
          errors: [
            ...(state.errors || []),
            "No final result found in stream"
          ]
        },
        next: "error_handler"
      }
    }
  } catch (error) {
    moduleLogger.error('Processing streaming results failed', {}, error)
    
    // Add error to state
    return {
      result: {
        ...state,
        errors: [
          ...(state.errors || []),
          error instanceof Error ? error.message : String(error)
        ]
      },
      next: "error_handler"
    }
  }
}