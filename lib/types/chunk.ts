/**
 * Unified Chunk Types
 * 
 * This file provides a centralized definition of document chunk-related types
 * to ensure consistency across extraction and RAG functionality.
 */
import type { UUID } from './base'

/**
 * Base document chunk interface
 * Common properties shared by all chunk types
 */
export interface BaseChunk {
  /**
   * Text content of the chunk
   */
  content: string

  /**
   * Index position within document chunks
   */
  chunkIndex: number

  /**
   * Base metadata shared by all chunks
   */
  metadata?: Record<string, any>
}

/**
 * Extraction chunk used during document processing
 */
export interface ExtractionChunk extends BaseChunk {
  /**
   * Page number where this chunk appears
   */
  pageNumber?: number

  /**
   * Confidence score for the extracted text
   */
  confidence?: number

  /**
   * Section or heading name
   */
  section?: string

  /**
   * Whether this chunk contains tabular data
   */
  isTable?: boolean
}

/**
 * RAG chunk used for retrieval and embeddings
 */
export interface RAGChunk extends BaseChunk {
  /**
   * Unique identifier for the chunk
   */
  id?: UUID
  
  /**
   * Reference to the parent document
   */
  documentId: string
  
  /**
   * Metadata specific to RAG
   */
  metadata: {
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
     * Any additional metadata
     */
    [key: string]: any
  }
  
  /**
   * Vector embedding of the chunk
   */
  embedding?: number[]
  
  /**
   * When the chunk was created
   */
  createdAt?: Date
}

/**
 * Options for chunking
 */
export interface ChunkingOptions {
  /**
   * Size of each chunk in characters
   */
  chunkSize: number
  
  /**
   * Overlap between chunks in characters
   */
  chunkOverlap: number
  
  /**
   * Whether to preserve metadata during chunking
   */
  preserveMetadata: boolean
  
  /**
   * Chunking strategy to use
   */
  strategy: 'size' | 'semantic' | 'section'
  
  /**
   * Domain specific use case for chunking
   */
  domain?: 'extraction' | 'rag' | 'general'
}

/**
 * Convert ExtractionChunk to RAGChunk
 * @param chunk Extraction chunk to convert
 * @param documentId ID of the document
 * @param additionalMetadata Additional metadata to include
 * @returns RAG compatible chunk
 */
export function extractionChunkToRAGChunk(
  chunk: ExtractionChunk, 
  documentId: string, 
  additionalMetadata: Record<string, any> = {}
): RAGChunk {
  return {
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    documentId,
    metadata: {
      ...additionalMetadata,
      ...(chunk.metadata || {}),
      pageNumber: chunk.pageNumber,
      section: chunk.section,
      confidence: chunk.confidence,
      isTable: chunk.isTable
    }
  }
}