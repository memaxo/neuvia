// Export RAG services
export { ragIndexingService, RAGIndexingService } from './indexing/rag-indexing-service'
export { ragRetrievalService, RAGRetrievalService } from './retrieval/rag-retrieval-service'
export { ragMemoryService, RAGMemoryService } from './memory/rag-memory-service'

// Re-export types
export type {
  DocumentChunk,
  DocumentChunkMetadata,
  DocumentSource,
  RetrievalOptions,
  RetrievalResult,
  RankedRetrievalResult,
  ConversationContext,
  IndexingOptions
} from '@/lib/types/rag'

// Export error types
export {
  RAGError,
  RAGIndexingError,
  RAGRetrievalError,
  RAGMemoryError
} from './error/rag-errors'