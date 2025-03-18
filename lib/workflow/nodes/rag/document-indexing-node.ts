import { RAGIndexingError } from '@/lib/services/rag/error/rag-errors'
import { ragIndexingService } from '@/lib/services/rag/indexing/rag-indexing-service'
import type { WorkflowState } from '@/workflow/state/workflow-state'
import logger from '@/lib/logger'

/**
 * LangGraph node for indexing documents in the RAG system
 *
 * This node processes a document to create RAG chunks and embeddings
 * for later retrieval. It now delegates to the RAG indexing service
 * for both domain logic and state transformations, following the pattern
 * of domain services being the single source of truth.
 * 
 * @param state Current workflow state
 * @returns Partial state update with indexing results
 */
export const documentIndexingNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  // Configure logger
  const nodeLogger = logger.withMetadata({
    module: 'documentIndexingNode',
    workflowId: state.workflowId
  })
  
  // Initialize progress tracking
  const initialState: Partial<WorkflowState> = {
    documentProcessing: {
      ...state.documentProcessing,
      indexingStatus: 'in-progress',
      indexingStartTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }
  }
  
  try {
    // Delegate to domain service for both indexing and state transformation
    const result = await ragIndexingService.indexDocumentFromWorkflowState(state)
    
    // Return result from domain service
    return result
  } catch (error) {
    // Log the error at the orchestration level
    nodeLogger.error('Error in document indexing node', { workflowId: state.workflowId }, error)
    
    // If error occurred, return a standard error state
    return {
      documentProcessing: {
        ...state.documentProcessing,
        indexingStatus: 'error',
        indexingComplete: false,
        indexingError: error instanceof Error ? error.message : String(error),
        lastUpdated: new Date().toISOString()
      }
    }
  }
}