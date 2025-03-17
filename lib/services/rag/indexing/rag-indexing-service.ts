import { supabaseClient } from '@/lib/supabase/client'
import type { DocumentType } from '@/lib/types/document'
import type { DocumentChunk, DocumentChunkMetadata, IndexingOptions } from '@/lib/types/rag'
import { RAGIndexingError } from '../error/rag-errors'
import logger from '@/lib/logger'
import { langChainCore } from '@/lib/langchain/core'
import type { LangChainCore } from '@/lib/langchain/core'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { withRetry } from '@/lib/utils/retry'

// Default configuration
const DEFAULT_CHUNK_SIZE = 1000
const DEFAULT_CHUNK_OVERLAP = 200
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-ada-002'

/**
 * Service for indexing documents in the RAG system
 * 
 * This service focuses on turning documents into indexed, embedded chunks
 * ready for retrieval. It handles the chunking, metadata extraction,
 * and embedding generation.
 */
export class RAGIndexingService {
  private readonly supabase
  private readonly logger: typeof logger
  private readonly langChain: LangChainCore
  
  constructor(
    loggerInstance?: typeof logger,
    langChainInstance?: LangChainCore
  ) {
    this.supabase = supabaseClient
    this.logger = loggerInstance || logger
    this.langChain = langChainInstance || langChainCore
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
      
      // Split document into chunks
      const chunks = await this.splitIntoChunks(
        document.content,
        document.id,
        metadata,
        options
      )
      
      moduleLogger.debug('Document split into chunks', {
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
  private extractDocumentMetadata(document: DocumentType): DocumentChunkMetadata {
    // Base metadata from document
    const metadata: DocumentChunkMetadata = {
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
   * Split a document into chunks
   * 
   * @param text Document text to split
   * @param documentId Document ID
   * @param metadata Document metadata
   * @param options Chunking options
   * @returns Array of document chunks
   */
  private async splitIntoChunks(
    text: string,
    documentId: string,
    metadata: DocumentChunkMetadata,
    options?: IndexingOptions
  ): Promise<DocumentChunk[]> {
    try {
      // Configure the text splitter
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: options?.chunkSize || DEFAULT_CHUNK_SIZE,
        chunkOverlap: options?.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
        separators: ['\n\n', '\n', '. ', ' ', ''],
      })
      
      // Split text
      const textChunks = await splitter.splitText(text)
      
      // Convert to DocumentChunk objects
      const documentChunks: DocumentChunk[] = textChunks.map((content, index) => ({
        documentId,
        chunkIndex: index,
        content,
        metadata: {
          ...metadata,
          position: {
            start: text.indexOf(content),
            end: text.indexOf(content) + content.length
          }
        }
      }))
      
      return documentChunks
    } catch (error) {
      throw new RAGIndexingError(
        `Failed to split document into chunks: ${error instanceof Error ? error.message : String(error)}`,
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
   * Store chunks in the database
   * 
   * @param chunks Chunks to store
   */
  private async storeChunks(chunks: DocumentChunk[]): Promise<void> {
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
   * Generate embeddings for chunks
   * 
   * @param chunks Chunks to generate embeddings for
   * @param embeddingModel Embedding model to use
   */
  private async generateEmbeddings(
    chunks: DocumentChunk[],
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

// Export singleton instance
export const ragIndexingService = new RAGIndexingService()