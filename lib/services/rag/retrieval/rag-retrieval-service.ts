import { supabaseClient } from '@/lib/supabase/client'
import type { 
  DocumentChunk, 
  DocumentSource, 
  RetrievalOptions, 
  RetrievalResult,
  RankedRetrievalResult
} from '@/lib/types/rag'
import { RAGRetrievalError } from '../error/rag-errors'
import logger from '@/lib/logger'
import { langChainCore } from '@/lib/langchain/core'
import type { LangChainCore } from '@/lib/langchain/core'
import { withRetry } from '@/lib/utils/retry'

// Default configuration
const DEFAULT_LIMIT = 10
const DEFAULT_MIN_RELEVANCE = 0.7
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-ada-002'

/**
 * Service for retrieving document chunks from the RAG system
 * 
 * This service focuses on semantic search and context retrieval
 * for RAG applications. It handles embedding queries, retrieving
 * relevant chunks, and ranking/filtering results.
 */
export class RAGRetrievalService {
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
   * Retrieve context for a query
   * 
   * @param query The search query
   * @param options Retrieval options
   * @returns Retrieved context
   */
  async retrieveContext(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGRetrievalService',
      method: 'retrieveContext',
      query
    })
    
    try {
      moduleLogger.info('Retrieving context for query', {
        queryLength: query.length,
        options
      })
      
      // Generate embeddings for the query
      const queryEmbedding = await this.generateQueryEmbedding(query)
      
      // Set default options
      const limit = options.limit || DEFAULT_LIMIT
      const minRelevance = options.minRelevance || DEFAULT_MIN_RELEVANCE
      
      // Query database using vector similarity
      const { data: results, error } = await this.supabase.rpc(
        'search_document_chunks',
        {
          query_embedding: queryEmbedding,
          match_threshold: minRelevance,
          match_count: limit,
          filter_patient_id: options.patientId,
          filter_document_type: options.documentType
        }
      )
      
      if (error) {
        throw new RAGRetrievalError(`Error searching document chunks: ${error.message}`)
      }
      
      // Map results to DocumentChunk objects
      const chunks: DocumentChunk[] = results.map(result => ({
        id: result.id,
        documentId: result.document_id,
        chunkIndex: result.chunk_index,
        content: result.content,
        metadata: result.metadata || {}
      }))
      
      // Get source document information
      const sources = await this.getSourceDocuments(chunks)
      
      const retrievalResult: RetrievalResult = {
        chunks,
        sources,
        totalMatches: chunks.length,
        averageRelevance: chunks.length > 0 
          ? results.reduce((sum, r) => sum + r.similarity, 0) / chunks.length
          : 0
      }
      
      moduleLogger.info('Retrieved context successfully', {
        chunkCount: chunks.length,
        sourceCount: sources.length
      })
      
      return retrievalResult
    } catch (error) {
      moduleLogger.error('Failed to retrieve context', {}, error)
      throw new RAGRetrievalError(
        `Failed to retrieve context: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Retrieve context specifically for a patient
   * 
   * @param patientId The patient ID
   * @param query The search query
   * @param options Additional retrieval options
   * @returns Retrieved context filtered to patient documents
   */
  async retrieveForPatient(
    patientId: string,
    query: string,
    options: Omit<RetrievalOptions, 'patientId'> = {}
  ): Promise<RetrievalResult> {
    return this.retrieveContext(query, {
      ...options,
      patientId
    })
  }
  
  /**
   * Retrieve context by document type
   * 
   * @param documentType The document type to filter by
   * @param query The search query
   * @param options Additional retrieval options
   * @returns Retrieved context filtered by document type
   */
  async retrieveByDocumentType(
    documentType: string,
    query: string,
    options: Omit<RetrievalOptions, 'documentType'> = {}
  ): Promise<RetrievalResult> {
    return this.retrieveContext(query, {
      ...options,
      documentType
    })
  }
  
  /**
   * Retrieve context by date range
   * 
   * @param startDate Start date for filtering
   * @param endDate End date for filtering
   * @param query The search query
   * @param options Additional retrieval options
   * @returns Retrieved context filtered by date range
   */
  async retrieveByDateRange(
    startDate: Date,
    endDate: Date,
    query: string,
    options: Omit<RetrievalOptions, 'dateRange'> = {}
  ): Promise<RetrievalResult> {
    return this.retrieveContext(query, {
      ...options,
      dateRange: {
        start: startDate,
        end: endDate
      }
    })
  }
  
  /**
   * Rank retrieved context by relevance
   * 
   * @param results The retrieval results to rank
   * @returns Ranked retrieval results
   */
  async rankRetrievedContext(
    results: RetrievalResult
  ): Promise<RankedRetrievalResult> {
    try {
      // Create ranked chunks array
      const rankedChunks = results.chunks.map((chunk, index) => {
        // Default similarity from order if not available
        // Higher index = lower relevance score (reversed order)
        const defaultScore = 1 - (index / Math.max(results.chunks.length, 1))
        
        return {
          chunk,
          // If we have similarity scores already, use those, otherwise use default
          relevanceScore: results.chunks[index]['similarity'] || defaultScore
        }
      })
      
      // Sort by relevance score (descending)
      rankedChunks.sort((a, b) => b.relevanceScore - a.relevanceScore)
      
      return {
        ...results,
        rankedChunks
      }
    } catch (error) {
      throw new RAGRetrievalError(
        `Failed to rank retrieved context: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Filter results by relevance threshold
   * 
   * @param results The ranked results to filter
   * @param threshold The minimum relevance threshold (0-1)
   * @returns Filtered retrieval results
   */
  async filterByRelevance(
    results: RankedRetrievalResult,
    threshold: number = DEFAULT_MIN_RELEVANCE
  ): Promise<RankedRetrievalResult> {
    try {
      // Filter ranked chunks by threshold
      const filteredRankedChunks = results.rankedChunks.filter(
        rc => rc.relevanceScore >= threshold
      )
      
      // Create filtered chunk list
      const filteredChunks = filteredRankedChunks.map(rc => rc.chunk)
      
      // Recalculate sources based on filtered chunks
      const documentIds = [...new Set(filteredChunks.map(chunk => chunk.documentId))]
      const filteredSources = results.sources.filter(
        source => documentIds.includes(source.documentId)
      )
      
      // Return filtered results
      return {
        chunks: filteredChunks,
        sources: filteredSources,
        rankedChunks: filteredRankedChunks,
        totalMatches: filteredChunks.length,
        averageRelevance: filteredRankedChunks.length > 0
          ? filteredRankedChunks.reduce((sum, rc) => sum + rc.relevanceScore, 0) / filteredRankedChunks.length
          : 0
      }
    } catch (error) {
      throw new RAGRetrievalError(
        `Failed to filter by relevance: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Generate embedding for a query
   * 
   * @param query The query to embed
   * @param embeddingModel The embedding model to use
   * @returns The query embedding vector
   */
  private async generateQueryEmbedding(
    query: string,
    embeddingModel: string = DEFAULT_EMBEDDING_MODEL
  ): Promise<number[]> {
    try {
      // Create embedding model
      const embeddings = this.langChain.createEmbeddings({ model: embeddingModel })
      
      // Generate embedding with retry
      const [embeddingVector] = await withRetry(
        () => embeddings.embedQuery(query),
        {
          maxRetries: 3,
          baseDelay: 1000
        }
      )
      
      return embeddingVector
    } catch (error) {
      throw new RAGRetrievalError(
        `Failed to generate query embedding: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Get source document information for chunks
   * 
   * @param chunks The chunks to get source documents for
   * @returns Source document information
   */
  private async getSourceDocuments(chunks: DocumentChunk[]): Promise<DocumentSource[]> {
    try {
      // Get unique document IDs
      const documentIds = [...new Set(chunks.map(chunk => chunk.documentId))]
      
      if (documentIds.length === 0) {
        return []
      }
      
      // Get document information
      const { data: documents, error } = await this.supabase
        .from('documents')
        .select('id, title, document_type, created_at, patient_id, metadata')
        .in('id', documentIds)
      
      if (error) {
        throw new RAGRetrievalError(`Failed to retrieve source documents: ${error.message}`)
      }
      
      // Count chunks for each document
      const chunkCounts = documentIds.reduce((counts, docId) => {
        counts[docId] = chunks.filter(chunk => chunk.documentId === docId).length
        return counts
      }, {} as Record<string, number>)
      
      // Map to DocumentSource objects
      return documents.map(doc => ({
        documentId: doc.id,
        title: doc.title,
        documentType: doc.document_type,
        date: doc.created_at,
        chunkCount: chunkCounts[doc.id] || 0,
        // Generate a URL to access the document
        url: `/documents/${doc.id}`
      }))
    } catch (error) {
      throw new RAGRetrievalError(
        `Failed to get source documents: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
}

/**
 * Retrieve context from a workflow state
 * 
 * This method handles both the domain logic of context retrieval
 * and the workflow state transformations, following the pattern
 * of domain services being responsible for both concerns.
 * 
 * @param state Current workflow state
 * @returns Partial state update with retrieval results
 */
async retrieveContextFromWorkflowState(state: any): Promise<Partial<any>> {
  const moduleLogger = this.logger.withMetadata({
    module: 'RAGRetrievalService',
    method: 'retrieveContextFromWorkflowState',
    workflowId: state.workflowId
  })
  
  try {
    // Get message content from state
    const messageContent = state.currentMessage?.content
    const patientId = state.patientId
    
    if (!messageContent) {
      throw new RAGRetrievalError('Message content required for context retrieval')
    }
    
    // Retrieve context
    const retrievalResult = patientId
      ? await this.retrieveForPatient(
          patientId,
          messageContent,
          {
            limit: state.retrievalOptions?.limit || 5,
            minRelevance: state.retrievalOptions?.minRelevance || 0.7,
            documentType: state.retrievalOptions?.documentType,
            includeMetadata: true
          }
        )
      : await this.retrieveContext(
          messageContent,
          {
            limit: state.retrievalOptions?.limit || 5,
            minRelevance: state.retrievalOptions?.minRelevance || 0.7,
            documentType: state.retrievalOptions?.documentType,
            includeMetadata: true
          }
        )
    
    // Rank and filter results
    const rankedResults = await this.rankRetrievedContext(retrievalResult)
    const filteredResults = await this.filterByRelevance(
      rankedResults,
      state.retrievalOptions?.minRelevance || 0.7
    )
    
    moduleLogger.info('Retrieved and ranked context successfully', {
      chunkCount: filteredResults.chunks.length,
      sourceCount: filteredResults.sources.length,
      averageRelevance: filteredResults.averageRelevance
    })
    
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
    // Log the error
    moduleLogger.error('Failed to retrieve context', {}, error)
    
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

// Export singleton instance
export const ragRetrievalService = new RAGRetrievalService()