import { StateGraph, Step } from '@langchain/langgraph'
import { perplexityResearchService } from '../research/perplexity-research-service'
import { PerplexityResearchError } from '../error/perplexity-errors'
import { RunnableConfig } from '@langchain/core/runnables'
import logger from '@/lib/logger'
import type { ResearchOptions, ResearchResult } from '@/lib/types/research'

/**
 * LangGraph node for performing research operations
 * 
 * This node integrates with the PerplexityResearchService to perform
 * research operations within a LangGraph workflow.
 */
export async function researchNode(
  state: {
    query: string;
    options?: ResearchOptions;
    config?: RunnableConfig;
    results?: ResearchResult[];
    errors?: string[];
  },
  config?: RunnableConfig
): Promise<Step> {
  const moduleLogger = logger.withMetadata({
    module: 'ResearchNode',
    query: state.query,
  })

  moduleLogger.debug('Starting research node', { 
    options: state.options 
  })

  try {
    // Perform the research operation
    const result = await perplexityResearchService.performResearch(
      state.query,
      state.options,
      config || state.config
    )

    // Return the updated state with the research result
    return {
      result: {
        ...state,
        results: [...(state.results || []), result],
      }
    }
  } catch (error) {
    moduleLogger.error('Research node failed', {}, error)
    
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
 * LangGraph node for performing comprehensive research
 */
export async function comprehensiveResearchNode(
  state: {
    query: string;
    options?: Omit<ResearchOptions, 'researchType'>;
    config?: RunnableConfig;
    results?: ResearchResult[];
    errors?: string[];
  },
  config?: RunnableConfig
): Promise<Step> {
  const moduleLogger = logger.withMetadata({
    module: 'ComprehensiveResearchNode',
    query: state.query,
  })

  moduleLogger.debug('Starting comprehensive research node', { 
    options: state.options 
  })

  try {
    // Perform comprehensive research
    const result = await perplexityResearchService.performComprehensiveResearch(
      state.query,
      state.options,
      config || state.config
    )

    // Return the updated state with the research result
    return {
      result: {
        ...state,
        results: [...(state.results || []), result],
      }
    }
  } catch (error) {
    moduleLogger.error('Comprehensive research node failed', {}, error)
    
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
 * LangGraph node for performing literature review
 */
export async function literatureReviewNode(
  state: {
    query: string;
    options?: Omit<ResearchOptions, 'researchType'>;
    config?: RunnableConfig;
    results?: ResearchResult[];
    errors?: string[];
  },
  config?: RunnableConfig
): Promise<Step> {
  const moduleLogger = logger.withMetadata({
    module: 'LiteratureReviewNode',
    query: state.query,
  })

  moduleLogger.debug('Starting literature review node', { 
    options: state.options 
  })

  try {
    // Perform literature review
    const result = await perplexityResearchService.performLiteratureReview(
      state.query,
      state.options,
      config || state.config
    )

    // Return the updated state with the research result
    return {
      result: {
        ...state,
        results: [...(state.results || []), result],
      }
    }
  } catch (error) {
    moduleLogger.error('Literature review node failed', {}, error)
    
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