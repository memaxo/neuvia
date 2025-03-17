import { RAGIndexingError } from '@/lib/services/rag/error/rag-errors'
import { ragIndexingService } from '@/lib/services/rag/indexing/rag-indexing-service'
import { DocumentDatabaseService } from '@/lib/services/document/storage/document-database-service'
import type { WorkflowState } from '@/workflow/state/workflow-state'

/**
 * LangGraph node for indexing documents in the RAG system
 * 
 * This node processes a document to create RAG chunks and embeddings
 * for later retrieval.
 * 
 * @param state Current workflow state
 * @returns Partial state update with indexing results
 */
export const documentIndexingNode = async (state: WorkflowState): Promise<Partial<WorkflowState>> => {
  // Get the document ID from state
  const documentId = state.documentId
  
  if (!documentId) {
    throw new RAGIndexingError('Document ID required for indexing')
  }
  
  try {
    // Get document service
    const documentService = new DocumentDatabaseService()
    
    // Retrieve document
    const document = await documentService.getDocumentById(documentId)
    
    if (!document) {
      throw new RAGIndexingError(`Document not found: ${documentId}`)
    }
    
    // Index document
    await ragIndexingService.indexDocument(document, {
      chunkSize: state.indexingOptions?.chunkSize,
      chunkOverlap: state.indexingOptions?.chunkOverlap,
      embeddingModel: state.indexingOptions?.embeddingModel
    })
    
    // Return updated state
    return {
      document,
      documentProcessing: {
        ...state.documentProcessing,
        indexingStatus: 'completed',
        indexingComplete: true,
        lastUpdated: new Date().toISOString()
      }
    }
  } catch (error) {
    // If error occurred, update state with error information
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