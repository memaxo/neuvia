import { supabaseClient } from '@/lib/supabase/client'
import type { DocumentType } from '@/lib/types/document'
import type { IndexingOptions } from '@/lib/types/rag'
import type { RAGChunk } from '@/lib/types/chunk'
import { RAGIndexingError } from '../error/rag-errors'
import logger from '@/lib/logger'
import { langChainCore } from '@/lib/langchain/core'
import type { LangChainCore } from '@/lib/langchain/core'
import { withRetry } from '@/lib/utils/retry'
import { ChunkingService, DEFAULT_RAG_CHUNKING_OPTIONS } from '@/lib/services/document/chunking/chunking-service'
import { DocumentDatabaseService } from '@/lib/services/document/storage/document-database-service'

// Default configuration
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-ada-002'

/**
 * Service for indexing documents in the RAG system
 * 
 * This service focuses on turning documents into indexed, embedded chunks
 * ready for retrieval. It handles the metadata extraction and embedding generation,
 * while delegating chunking to the unified ChunkingService.
 */
export class RAGIndexingService {
  private readonly supabase
  private readonly logger: typeof logger
  private readonly langChain: LangChainCore
  private readonly chunkingService: ChunkingService
  
  constructor(
    loggerInstance?: typeof logger,
    langChainInstance?: LangChainCore,
    chunkingService?: ChunkingService
  ) {
    this.supabase = supabaseClient
    this.logger = loggerInstance || logger
    this.langChain = langChainInstance || langChainCore
    this.chunkingService = chunkingService || new ChunkingService()
  }
  
  /**
   * Index a document in the RAG system
   * 
   * @param document The document to index
   * @param options Indexing options
   * @returns ID of the indexed document
   */
  async indexDocument(
    document: DocumentType,
    options?: IndexingOptions
  ): Promise<string> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGIndexingService',
      method: 'indexDocument',
      documentId: document.id,
      documentType: document.documentType
    })
    
    try {
      moduleLogger.info('Indexing document', {
        title: document.title,
        patientId: document.patientId
      })
      
      // Validate document
      if (!document.id || !document.content) {
        throw new RAGIndexingError('Document ID and content are required for indexing')
      }
      
      // Extract metadata
      const metadata = this.extractDocumentMetadata(document)
      
      // Check if document already has chunks from extraction
      let chunks: RAGChunk[] = []
      
      if (document.chunks && document.chunks.length > 0 && document.id) {
        moduleLogger.info('Using existing chunks from document extraction', {
          chunkCount: document.chunks.length,
          documentId: document.id
        })
        
        // Convert extraction chunks to RAG chunks
        chunks = this.chunkingService.convertExtractionChunksToRAG(
          document.chunks,
          document.id,
          metadata
        )
      } else {
        // Get chunking options for RAG
        const chunkingOptions = {
          chunkSize: options?.chunkSize || DEFAULT_RAG_CHUNKING_OPTIONS.chunkSize,
          chunkOverlap: options?.chunkOverlap || DEFAULT_RAG_CHUNKING_OPTIONS.chunkOverlap,
          preserveMetadata: true,
          strategy: 'semantic',
          domain: 'rag'
        }
        
        // Use chunking service to split document
        chunks = await this.chunkingService.createRAGChunks(
          document.content,
          document.id,
          metadata,
          chunkingOptions,
          document.structuredData
        )
      }
      
      moduleLogger.debug('Document prepared for indexing', {
        chunkCount: chunks.length,
        documentId: document.id
      })
      
      // Clear existing chunks if any (for reindexing)
      await this.deleteExistingChunks(document.id)
      
      // Store chunks in database
      await this.storeChunks(chunks)
      
      // Generate embeddings for chunks
      await this.generateEmbeddings(chunks, options?.embeddingModel)
      
      moduleLogger.info('Document indexed successfully', {
        documentId: document.id,
        chunkCount: chunks.length
      })
      
      return document.id
    } catch (error) {
      moduleLogger.error('Failed to index document', {}, error)
      throw new RAGIndexingError(
        `Failed to index document: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Reindex an existing document
   * 
   * @param documentId ID of the document to reindex
   * @param options Indexing options
   * @returns ID of the reindexed document
   */
  async reindexDocument(
    documentId: string,
    options?: IndexingOptions
  ): Promise<string> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGIndexingService',
      method: 'reindexDocument',
      documentId
    })
    
    try {
      moduleLogger.info('Reindexing document', { documentId })
      
      // Get document from database
      const { data: document, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()
      
      if (error) {
        throw new RAGIndexingError(`Failed to retrieve document: ${error.message}`)
      }
      
      if (!document) {
        throw new RAGIndexingError(`Document not found: ${documentId}`)
      }
      
      // Convert to DocumentType
      const documentData: DocumentType = {
        id: document.id,
        title: document.title,
        content: document.content,
        patientId: document.patient_id,
        documentType: document.document_type,
        createdAt: new Date(document.created_at),
        status: document.status,
        metadata: document.metadata || {}
      }
      
      // Index document
      return await this.indexDocument(documentData, options)
    } catch (error) {
      moduleLogger.error('Failed to reindex document', {}, error)
      throw new RAGIndexingError(
        `Failed to reindex document: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Delete the index for a document
   * 
   * @param documentId ID of the document to delete
   */
  async deleteDocumentIndex(documentId: string): Promise<void> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGIndexingService',
      method: 'deleteDocumentIndex',
      documentId
    })
    
    try {
      moduleLogger.info('Deleting document index', { documentId })
      
      await this.deleteExistingChunks(documentId)
      
      moduleLogger.info('Document index deleted successfully', { documentId })
    } catch (error) {
      moduleLogger.error('Failed to delete document index', {}, error)
      throw new RAGIndexingError(
        `Failed to delete document index: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Extract metadata from a document
   * 
   * @param document The document to extract metadata from
   * @returns Extracted metadata
   */
  private extractDocumentMetadata(document: DocumentType): Record<string, any> {
    // Base metadata from document
    const metadata: Record<string, any> = {
      documentType: document.documentType,
      documentDate: document.metadata?.date || document.createdAt,
    }
    
    // Add any additional metadata from document.metadata
    if (document.metadata) {
      Object.entries(document.metadata).forEach(([key, value]) => {
        if (key !== 'date' && value !== undefined) {
          metadata[key] = value
        }
      })
    }
    
    return metadata
  }
  
  /**
   * Store chunks in the database
   * 
   * @param chunks Chunks to store
   */
  async storeChunks(chunks: RAGChunk[]): Promise<void> {
    try {
      // Prepare chunks for database
      const dbChunks = chunks.map(chunk => ({
        document_id: chunk.documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        metadata: chunk.metadata
      }))
      
      // Store in database in batches
      const batchSize = 100
      for (let i = 0; i < dbChunks.length; i += batchSize) {
        const batch = dbChunks.slice(i, i + batchSize)
        
        const { error } = await this.supabase
          .from('document_chunks')
          .insert(batch)
        
        if (error) {
          throw new RAGIndexingError(`Failed to store chunks: ${error.message}`)
        }
      }
    } catch (error) {
      throw new RAGIndexingError(
        `Failed to store chunks: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Store and generate embeddings for pre-chunked documents
   * 
   * @param chunks Document chunks
   * @param options Indexing options
   * @returns Document ID
   */
  async storeAndEmbedChunks(
    chunks: RAGChunk[],
    options?: {
      embeddingModel?: string
    }
  ): Promise<string> {
    if (!chunks.length) {
      throw new RAGIndexingError('No chunks provided for indexing')
    }
    
    const documentId = chunks[0].documentId
    
    try {
      // Clear existing chunks if any
      await this.deleteExistingChunks(documentId)
      
      // Store chunks in database
      await this.storeChunks(chunks)
      
      // Generate embeddings for chunks
      await this.generateEmbeddings(chunks, options?.embeddingModel)
      
      return documentId
    } catch (error) {
      throw new RAGIndexingError(
        `Failed to store and embed chunks: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Delete existing chunks for a document
   * 
   * @param documentId Document ID
   */
  private async deleteExistingChunks(documentId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId)
      
      if (error) {
        throw new RAGIndexingError(`Failed to delete existing chunks: ${error.message}`)
      }
    } catch (error) {
      throw new RAGIndexingError(
        `Failed to delete existing chunks: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Generate embeddings for chunks
   * 
   * @param chunks Chunks to generate embeddings for
   * @param embeddingModel Embedding model to use
   */
  private async generateEmbeddings(
    chunks: RAGChunk[],
    embeddingModel: string = DEFAULT_EMBEDDING_MODEL
  ): Promise<void> {
    try {
      // Get chunk IDs from database to ensure we have the correct IDs
      const { data: dbChunks, error } = await this.supabase
        .from('document_chunks')
        .select('id, document_id, chunk_index, content')
        .eq('document_id', chunks[0].documentId)
        .order('chunk_index', { ascending: true })
      
      if (error) {
        throw new RAGIndexingError(`Failed to retrieve chunk IDs: ${error.message}`)
      }
      
      // Create embedding model
      const embeddings = this.langChain.createEmbeddings({ model: embeddingModel })
      
      // Generate embeddings in batches
      const batchSize = 20
      for (let i = 0; i < dbChunks.length; i += batchSize) {
        const batch = dbChunks.slice(i, i + batchSize)
        
        // Generate embeddings with retry
        const embeddingVectors = await withRetry(
          () => embeddings.embedDocuments(batch.map(chunk => chunk.content)),
          {
            maxRetries: 3,
            baseDelay: 1000
          }
        )
        
        // Update chunks with embeddings
        for (let j = 0; j < batch.length; j++) {
          const { error: updateError } = await this.supabase
            .from('document_chunks')
            .update({ embedding: embeddingVectors[j] })
            .eq('id', batch[j].id)
          
          if (updateError) {
            throw new RAGIndexingError(`Failed to update chunk with embedding: ${updateError.message}`)
          }
        }
      }
    } catch (error) {
      throw new RAGIndexingError(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
}

/**
 * Index a document from workflow state
 * 
 * This method handles both the domain logic of document indexing
 * and the workflow state transformations, following the pattern
 * of domain services being responsible for both concerns.
 * 
 * @param state Current workflow state
 * @returns Partial state update with indexing results
 */
async indexDocumentFromWorkflowState(state: any): Promise<Partial<any>> {
  // Configure logger
  const moduleLogger = this.logger.withMetadata({
    module: 'RAGIndexingService',
    method: 'indexDocumentFromWorkflowState',
    workflowId: state.workflowId
  })
  
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
    
    // Check if document has extraction chunks
    if (document.extractedData?.chunks && document.extractedData.chunks.length > 0) {
      moduleLogger.info('Using existing chunks from document extraction for indexing', {
        documentId,
        chunkCount: document.extractedData.chunks.length
      })
      
      // Add chunks to the document object for the RAG indexing service to use
      document.chunks = document.extractedData.chunks
    }
    
    // Run the indexing operation
    await this.indexDocument(document, {
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
    // Log the error
    moduleLogger.error('Failed to index document', { documentId }, error)
    
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

// Export singleton instance
export const ragIndexingService = new RAGIndexingService()