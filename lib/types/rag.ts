import type { DocumentType } from './document'

/**
 * A chunk of a document used for RAG
 */
export interface DocumentChunk {
  /**
   * Unique identifier for the chunk
   */
  id?: string
  
  /**
   * Reference to the parent document
   */
  documentId: string
  
  /**
   * Index position within the document chunks
   */
  chunkIndex: number
  
  /**
   * The text content of the chunk
   */
  content: string
  
  /**
   * Metadata associated with the chunk
   */
  metadata: DocumentChunkMetadata
  
  /**
   * Vector embedding of the chunk (if generated)
   */
  embedding?: number[]
  
  /**
   * When the chunk was created
   */
  createdAt?: Date
}

/**
 * Metadata for a document chunk
 */
export interface DocumentChunkMetadata {
  /**
   * Document type (e.g., "lab_report", "clinical_note")
   */
  documentType?: string
  
  /**
   * Section of the document (e.g., "history", "diagnosis")
   */
  section?: string
  
  /**
   * Page number in the original document
   */
  pageNumber?: number
  
  /**
   * Document date if available
   */
  documentDate?: string | Date
  
  /**
   * Confidence score for the extracted text
   */
  confidence?: number
  
  /**
   * Position information (start/end position in original document)
   */
  position?: {
    start: number
    end: number
  }
  
  /**
   * Any additional metadata as key-value pairs
   */
  [key: string]: any
}

/**
 * Options for retrieval
 */
export interface RetrievalOptions {
  /**
   * Maximum number of chunks to retrieve
   */
  limit?: number
  
  /**
   * Minimum relevance score (0.0-1.0) to include
   */
  minRelevance?: number
  
  /**
   * Whether to include chunk metadata in results
   */
  includeMetadata?: boolean
  
  /**
   * Filter by document type
   */
  documentType?: string
  
  /**
   * Filter by date range
   */
  dateRange?: {
    start: Date
    end: Date
  }
  
  /**
   * Filter by section name
   */
  section?: string
  
  /**
   * Whether to rerank results
   */
  rerank?: boolean
  
  /**
   * Whether to deduplicate similar chunks
   */
  deduplicate?: boolean
}

/**
 * Result from a retrieval operation
 */
export interface RetrievalResult {
  /**
   * The chunks retrieved
   */
  chunks: DocumentChunk[]
  
  /**
   * Source document information
   */
  sources: DocumentSource[]
  
  /**
   * Total number of chunks matched
   */
  totalMatches?: number
  
  /**
   * Average relevance score
   */
  averageRelevance?: number
}

/**
 * Ranked result from a retrieval operation
 */
export interface RankedRetrievalResult extends RetrievalResult {
  /**
   * Ranked chunks with relevance scores
   */
  rankedChunks: Array<{
    chunk: DocumentChunk
    relevanceScore: number
  }>
}

/**
 * Source document information
 */
export interface DocumentSource {
  /**
   * Document ID
   */
  documentId: string
  
  /**
   * Document title
   */
  title: string
  
  /**
   * Document type
   */
  documentType?: string
  
  /**
   * When the document was created
   */
  date?: Date | string
  
  /**
   * Number of chunks from this document
   */
  chunkCount?: number
  
  /**
   * Relevance score of this document as a whole
   */
  relevanceScore?: number
  
  /**
   * URL to access the document (if applicable)
   */
  url?: string
}

/**
 * Context for a conversation in RAG memory
 */
export interface ConversationContext {
  /**
   * Chat session ID
   */
  chatId: string
  
  /**
   * Recent message history
   */
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date | string
  }>
  
  /**
   * Recently referenced chunks
   */
  recentChunks: DocumentChunk[]
  
  /**
   * Recently referenced sources
   */
  recentSources: DocumentSource[]
  
  /**
   * Key information remembered from the conversation
   */
  keyInformation?: Record<string, any>
  
  /**
   * When the context was last accessed
   */
  lastAccessed?: Date | string
}

/**
 * Indexing options for documents
 */
export interface IndexingOptions {
  /**
   * Chunk size in tokens or characters
   */
  chunkSize?: number
  
  /**
   * Chunk overlap in tokens or characters
   */
  chunkOverlap?: number
  
  /**
   * Embedding model to use
   */
  embeddingModel?: string
  
  /**
   * Whether to extract metadata from content
   */
  extractMetadata?: boolean
  
  /**
   * Whether to detect sections automatically
   */
  detectSections?: boolean
}