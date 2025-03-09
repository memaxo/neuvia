import crypto from 'crypto'
import { getDefaultConfig } from '@/lib/langchain/config'
import {
  type DocumentMetadata,
  DocumentMetadataSchema,
  type DocumentSearchResult,
} from '@/lib/schemas/document-types'
import type { Database } from '@/lib/supabase'
import { createAdminClient } from '@/lib/supabase/clients'
import { ApplicationError, ExternalServiceError, NotFoundError, SystemError, ValidationError } from '@/lib/errors'
import logger from '@/lib/logger'
/**
 * Supabase Vector Store Implementation
 *
 * Enhanced implementation of LangChain's SupabaseVectorStore for document storage and retrieval
 */
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase'
import { Document } from '@langchain/core/documents'
import { mistral } from '@ai-sdk/mistral'
import type { Embeddings } from '@langchain/core/embeddings'
import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Match documents function parameter type from the database
type MatchDocumentsParams = {
  query_embedding: string
  match_threshold: number
  match_count: number
  patient_id?: string
}

/**
 * Enhanced Supabase Vector Store
 * Extends LangChain's SupabaseVectorStore with additional functionality
 */
export class EnhancedSupabaseVectorStore extends SupabaseVectorStore {
  constructor(
    private readonly embeddingModel: Embeddings,
    private readonly supabaseClient: SupabaseClient<Database>,
    private readonly config: {
      tableName: keyof Database['public']['Tables']
      queryName: keyof Database['public']['Functions']
      embeddingColumnName: string
      metadataColumnName: string
    }
  ) {
    super(embeddingModel, {
      client: supabaseClient,
      tableName: config.tableName,
      queryName: config.queryName,
    })
  }

  /**
   * Add a single document to the vector store with deduplication
   *
   * @param document Document to add
   * @returns ID of the added document or existing document
   */
  async addDocument(document: Document): Promise<string> {
    const moduleLogger = logger.withMetadata({
      module: 'EnhancedSupabaseVectorStore',
      method: 'addDocument'
    })

    try {
      if (!document.pageContent) {
        moduleLogger.warn('Empty document content provided for vectorization')
        throw new ValidationError({
          message: 'Cannot vectorize document with empty content',
          code: 'EMPTY_DOCUMENT'
        })
      }

      // Validate metadata
      try {
        const validatedMetadata = DocumentMetadataSchema.partial().parse(
          document.metadata || {}
        )
      
        // Generate a content hash for deduplication
        const contentHash = crypto
          .createHash('sha256')
          .update(document.pageContent)
          .digest('hex')
  
        moduleLogger.info('Adding document to vector store', {
          contentHashPrefix: contentHash.substring(0, 8),
          contentLength: document.pageContent.length,
          hasMetadata: Object.keys(document.metadata || {}).length > 0
        })
  
        // Check if document with this hash already exists
        const { data: existingDoc, error: fetchError } = await this.supabaseClient
          .from('document_chunks')
          .select('id')
          .eq('metadata->content_hash', contentHash)
          .limit(1)
  
        if (fetchError) {
          moduleLogger.error('Error checking for existing document', {}, fetchError)
          throw new SystemError({
            message: 'Failed to check for document duplicates',
            code: 'DB_FETCH_ERROR',
            cause: fetchError
          })
        }
  
        if (existingDoc && existingDoc.length > 0) {
          // Document already exists, return its ID
          moduleLogger.info('Document already exists, returning existing ID', {
            existingId: existingDoc[0].id
          })
          return existingDoc[0].id as string
        }
  
        // Generate a unique ID for the document
        const docId = crypto.randomUUID()
  
        // Add the document through the parent class method
        await super.addDocuments([
          new Document({
            pageContent: document.pageContent,
            metadata: {
              ...validatedMetadata,
              content_hash: contentHash,
              created_at: new Date().toISOString(),
            },
          }),
        ])
  
        moduleLogger.info('Successfully added document to vector store', { docId })
        return docId
      } catch (parseError) {
        moduleLogger.error('Metadata validation error', { 
          metadataKeys: Object.keys(document.metadata || {})
        }, parseError)
        
        throw new ValidationError({
          message: 'Invalid document metadata',
          code: 'INVALID_METADATA',
          cause: parseError
        })
      }
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Already formatted appropriately, just re-throw
        throw error
      }

      moduleLogger.error('Failed to add document to vector store', {}, error)
      
      throw new SystemError({
        message: 'Failed to add document to vector store',
        code: 'VECTORIZATION_FAILED',
        cause: error
      })
    }
  }

  /**
   * Add documents to the vector store with deduplication and chunking
   *
   * @param documents Documents to add
   * @param chunkSize Optional chunk size for long documents
   * @param chunkOverlap Optional chunk overlap
   * @returns IDs of the added or existing documents
   */
  async addDocumentsWithChunking(
    documents: Document[],
    chunkSize = 1000,
    chunkOverlap = 200
  ): Promise<string[]> {
    const docIds: string[] = []

    // Process each document
    for (const doc of documents) {
      if (doc.pageContent.length <= chunkSize) {
        // Document is small enough, add as is
        const docId = await this.addDocument(doc)
        docIds.push(docId)
      } else {
        // Document is too large, chunk it
        const chunks = this.chunkDocument(doc, chunkSize, chunkOverlap)

        // Add each chunk
        for (const chunk of chunks) {
          const chunkId = await this.addDocument(chunk)
          docIds.push(chunkId)
        }
      }
    }

    return docIds
  }

  /**
   * Chunk a document into smaller documents
   *
   * @param document Document to chunk
   * @param chunkSize Size of each chunk
   * @param chunkOverlap Overlap between chunks
   * @returns Chunked documents
   */
  private chunkDocument(
    document: Document,
    chunkSize: number,
    chunkOverlap: number
  ): Document[] {
    const { pageContent, metadata } = document
    const chunks: Document[] = []

    // Simple chunking by character count
    for (let i = 0; i < pageContent.length; i += chunkSize - chunkOverlap) {
      const chunk = pageContent.slice(i, i + chunkSize)

      // Skip empty chunks
      if (!chunk.trim()) continue

      chunks.push(
        new Document({
          pageContent: chunk,
          metadata: {
            ...metadata,
            chunk_index: Math.floor(i / (chunkSize - chunkOverlap)),
            chunk_total: Math.ceil(
              pageContent.length / (chunkSize - chunkOverlap)
            ),
            is_chunk: true,
          },
        })
      )
    }

    return chunks
  }

  /**
   * Perform similarity search with filters
   *
   * @param query Search query
   * @param k Number of results to return
   * @param filter Metadata filter
   * @returns Search results with content, metadata, and similarity score
   */
  async similaritySearchWithMetadata(
    query: string,
    k = 5,
    filter?: Record<string, any>
  ): Promise<DocumentSearchResult[]> {
    const moduleLogger = logger.withMetadata({
      module: 'EnhancedSupabaseVectorStore',
      method: 'similaritySearchWithMetadata',
      limit: k,
      hasFilter: !!filter
    })

    try {
      if (!query || query.trim() === '') {
        moduleLogger.warn('Empty query provided for similarity search')
        throw new ValidationError({
          message: 'Cannot perform similarity search with empty query',
          code: 'EMPTY_QUERY',
          data: { filter }
        })
      }

      moduleLogger.info('Performing vector similarity search', {
        queryLength: query.length,
        filterKeys: filter ? Object.keys(filter) : []
      })

      // Generate embedding for the query
      try {
        const embeddings = await this.embeddingModel.embedQuery(query)

        // Convert embedding array to string for Postgres vector type
        const embeddingString = `[${embeddings.join(',')}]`

        // Create params object for the RPC call
        const params: MatchDocumentsParams = {
          query_embedding: embeddingString,
          match_count: k,
          match_threshold: 0.5,
        }

        // If we have a patient_id filter, add it to the params
        if (filter && 'patient_id' in filter) {
          params.patient_id = filter.patient_id
        }

        // Call the match_documents RPC function
        const { data: documents, error } = await this.supabaseClient.rpc(
          this.config.queryName as 'match_documents',
          params
        )

        if (error) {
          moduleLogger.error('Error in database RPC call', { rpcFunction: this.config.queryName }, error)
          throw new SystemError({
            message: 'Failed to perform similarity search',
            code: 'RPC_ERROR',
            data: { 
              function: this.config.queryName, 
              filter: filter ? JSON.stringify(filter) : undefined 
            },
            cause: error
          })
        }

        if (!documents || !Array.isArray(documents) || documents.length === 0) {
          moduleLogger.info('No matching documents found', { queryLength: query.length })
          return []
        }

        moduleLogger.info('Successfully completed similarity search', {
          resultCount: documents.length
        })

        // Format results as DocumentSearchResult[]
        return (documents as any[]).map((doc: any) => ({
          id: doc.id,
          document_id: doc.document_id,
          content: doc.content,
          metadata: doc.metadata || {},
          similarity: doc.similarity,
        }))
      } catch (embeddingError) {
        moduleLogger.error('Error generating query embedding', {}, embeddingError)
        throw new ExternalServiceError({
          message: 'Failed to generate embeddings for query',
          service: 'Embeddings Service',
          code: 'EMBEDDING_FAILED',
          data: { queryLength: query.length },
          cause: embeddingError
        })
      }
    } catch (error) {
      if (error instanceof ApplicationError) {
        // Already formatted appropriately, just re-throw
        throw error
      }

      moduleLogger.error('Failed to perform similarity search', {}, error)
      
      throw new SystemError({
        message: 'Failed to perform similarity search',
        code: 'SEARCH_FAILED',
        cause: error
      })
    }
  }

  /**
   * Delete documents by filter
   *
   * @param filter Filter to match documents to delete
   * @returns Number of deleted documents
   */
  async deleteDocuments(filter: Record<string, any>): Promise<number> {
    try {
      // Since the PostgrestBuilder for delete has limitations with complex filters,
      // we'll need a different approach - using a select first, then delete

      // First, build a select query with our filters
      let selectQuery = this.supabaseClient.from('document_chunks').select('id')

      // Apply filters
      for (const [key, value] of Object.entries(filter)) {
        if (key.startsWith('metadata.')) {
          const metadataKey = key.replace('metadata.', '')
          // For metadata JSON fields
          selectQuery = selectQuery.filter(
            `metadata->>${metadataKey}`,
            'eq',
            value
          )
        } else {
          // For regular columns
          selectQuery = selectQuery.eq(key, value)
        }
      }

      // Execute select query to get matching IDs
      const { data: matchingDocs, error: selectError } = await selectQuery

      if (selectError) {
        throw new Error(`Error selecting documents: ${selectError.message}`)
      }

      if (!matchingDocs || matchingDocs.length === 0) {
        return 0 // No matching documents found
      }

      // Extract IDs
      const ids = matchingDocs.map((doc) => doc.id)

      // Delete documents with matching IDs
      const { error: deleteError } = await this.supabaseClient
        .from('document_chunks')
        .delete()
        .in('id', ids)

      if (deleteError) {
        throw new Error(`Error deleting documents: ${deleteError.message}`)
      }

      return ids.length
    } catch (error) {
      console.error('Error in deleteDocuments:', error)
      throw error
    }
  }
}

/**
 * Create a singleton instance of the Supabase Vector Store
 */
export function createSupabaseVectorStore(): EnhancedSupabaseVectorStore {
  const config = getDefaultConfig()

  // Use the admin client instead of creating a new client
  const supabaseClient = createAdminClient()

  // Create embeddings model based on available APIs
  let embeddings: Embeddings;
  
  // Prefer Gemini embeddings, fall back to Mistral if necessary
  if (config.gemini?.apiKey) {
    // Create Google embeddings model
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    
    // Create LangChain embeddings wrapper for Google
    embeddings = {
      embedQuery: async (text: string): Promise<number[]> => {
        const result = await embeddingModel.embedContent({
          content: { parts: [{ text }] },
        });
        const embedding = result.embedding.values;
        return embedding;
      },
      embedDocuments: async (documents: string[]): Promise<number[][]> => {
        const results = await Promise.all(
          documents.map(async (doc) => {
            const result = await embeddingModel.embedContent({
              content: { parts: [{ text: doc }] },
            });
            return result.embedding.values;
          })
        );
        return results;
      }
    };
  } else if (config.mistral?.apiKey) {
    // Create Mistral embeddings model (deprecated)
    logger.warn('Using deprecated Mistral embeddings - please configure Gemini API key');
    const mistralEmbeddingModel = mistral(config.mistral.embeddingModel)
    
    // Create LangChain embeddings wrapper for Mistral
    embeddings = {
      embedQuery: async (text: string): Promise<number[]> => {
        const response = await mistralEmbeddingModel.embed({ text })
        return response
      },
      embedDocuments: async (documents: string[]): Promise<number[][]> => {
        const results = await Promise.all(
          documents.map(async (doc) => {
            const response = await mistralEmbeddingModel.embed({ text: doc })
            return response
          })
        )
        return results
      }
    }
  } else {
    throw new Error("No embedding model available. Configure either Gemini or Mistral API key.");
  }

  // Create vector store
  return new EnhancedSupabaseVectorStore(embeddings, supabaseClient, {
    tableName: 'document_chunks',
    queryName: 'match_documents',
    embeddingColumnName: 'chunk_embedding',
    metadataColumnName: 'metadata',
  })
}

// Export singleton instance
export const supabaseVectorStore = createSupabaseVectorStore()