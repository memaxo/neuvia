import { RAGRetrievalError } from '@/lib/services/rag/error/rag-errors'
import { ragRetrievalService } from '@/lib/services/rag/retrieval/rag-retrieval-service'
import type { WorkflowState } from '@/workflow/state/workflow-state'

import logger from '@/lib/logger'

/**
 * LangGraph node for retrieving relevant context from documents
 * 
 * This node takes a query from the current message and retrieves
 * relevant document chunks for use in RAG. It now delegates to the
 * RAG retrieval service for both domain logic and state transformations,
 * following the pattern of domain services being the single source of truth.
 * 
 * @param state Current workflow state
 * @returns Partial state update with retrieved context
 */
export const contextRetrievalNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  // Configure logger
  const nodeLogger = logger.withMetadata({
    module: 'contextRetrievalNode',
    workflowId: state.workflowId
  })
  
  // Initialize progress tracking
  const initialState: Partial<WorkflowState> = {
    retrievalStatus: 'in-progress',
    retrievalStartTime: new Date().toISOString()
  }
  
  try {
    // Log start of retrieval at orchestration level
    nodeLogger.info('Starting context retrieval', {
      messageId: state.currentMessage?.id,
      workflowId: state.workflowId
    })
    
    // Delegate to domain service for both retrieval and state transformation
    const result = await ragRetrievalService.retrieveContextFromWorkflowState(state)
    
    // Return result from domain service
    return result
  } catch (error) {
    // Log the error at the orchestration level
    nodeLogger.error('Error in context retrieval node', { 
      workflowId: state.workflowId,
      messageId: state.currentMessage?.id
    }, error)
    
    // If error occurred, update state with error information
    return {
      ragContext: {
        error: error instanceof Error ? error.message : String(error),
        retrievalTimestamp: new Date().toISOString()
      },
      retrievalStatus: 'error'
    }
  }
}