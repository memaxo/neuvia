import { ragMemoryService } from '@/lib/services/rag/memory/rag-memory-service'
import { RAGMemoryError } from '@/lib/services/rag/error/rag-errors'
import type { WorkflowState } from '@/workflow/state/workflow-state'
import type { DocumentSource } from '@/lib/types/rag'

/**
 * LangGraph node for tracking source attribution
 * 
 * This node tracks which documents were used to generate a response
 * for future reference and transparency.
 * 
 * @param state Current workflow state
 * @returns Partial state update with source attribution
 */
export const sourceAttributionNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  // Get the necessary state
  const messageId = state.messageId
  const ragContext = state.ragContext
  const assistantResponse = state.assistantResponse
  
  // Skip if no message ID or no sources
  if (!messageId || !ragContext?.sources || !assistantResponse?.content) {
    return {
      attributionStatus: 'skipped',
      attributionTimestamp: new Date().toISOString()
    }
  }
  
  try {
    // Get sources to track
    const sources: DocumentSource[] = ragContext.sources
    
    // Skip if no sources
    if (!sources || sources.length === 0) {
      return {
        attributionStatus: 'skipped',
        attributionTimestamp: new Date().toISOString()
      }
    }
    
    // Track sources
    await ragMemoryService.trackSourceAttribution(
      messageId,
      sources,
      ragContext.retrievedChunks
    )
    
    // Return updated state
    return {
      attributionStatus: 'completed',
      attributionTimestamp: new Date().toISOString(),
      attribution: {
        messageId,
        sourceCount: sources.length,
        sources: sources.map(source => ({
          documentId: source.documentId,
          title: source.title
        }))
      }
    }
  } catch (error) {
    // If error occurred, update state with error information
    return {
      attributionStatus: 'error',
      attributionError: error instanceof Error ? error.message : String(error),
      attributionTimestamp: new Date().toISOString()
    }
  }
}