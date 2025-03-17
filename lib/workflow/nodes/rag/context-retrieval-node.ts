import { RAGRetrievalError } from '@/lib/services/rag/error/rag-errors'
import { ragRetrievalService } from '@/lib/services/rag/retrieval/rag-retrieval-service'
import type { WorkflowState } from '@/workflow/state/workflow-state'

/**
 * LangGraph node for retrieving relevant context from documents
 * 
 * This node takes a query from the current message and retrieves
 * relevant document chunks for use in RAG.
 * 
 * @param state Current workflow state
 * @returns Partial state update with retrieved context
 */
export const contextRetrievalNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  // Get message content from state
  const messageContent = state.currentMessage?.content
  const patientId = state.patientId
  
  if (!messageContent) {
    throw new RAGRetrievalError('Message content required for context retrieval')
  }
  
  try {
    // Retrieve context
    const retrievalResult = patientId
      ? await ragRetrievalService.retrieveForPatient(
          patientId,
          messageContent,
          {
            limit: state.retrievalOptions?.limit || 5,
            minRelevance: state.retrievalOptions?.minRelevance || 0.7,
            documentType: state.retrievalOptions?.documentType,
            includeMetadata: true
          }
        )
      : await ragRetrievalService.retrieveContext(
          messageContent,
          {
            limit: state.retrievalOptions?.limit || 5,
            minRelevance: state.retrievalOptions?.minRelevance || 0.7,
            documentType: state.retrievalOptions?.documentType,
            includeMetadata: true
          }
        )
    
    // Rank and filter results
    const rankedResults = await ragRetrievalService.rankRetrievedContext(retrievalResult)
    const filteredResults = await ragRetrievalService.filterByRelevance(
      rankedResults,
      state.retrievalOptions?.minRelevance || 0.7
    )
    
    // Return updated state
    return {
      ragContext: {
        retrievedChunks: filteredResults.chunks,
        sources: filteredResults.sources,
        totalMatches: filteredResults.totalMatches,
        averageRelevance: filteredResults.averageRelevance,
        retrievalTimestamp: new Date().toISOString()
      },
      retrievalStatus: 'completed'
    }
  } catch (error) {
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