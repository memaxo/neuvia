import { supabaseClient } from '@/lib/supabase/client'
import type { 
  ConversationContext,
  DocumentChunk,
  DocumentSource
} from '@/lib/types/rag'
import { RAGMemoryError } from '../error/rag-errors'
import logger from '@/lib/logger'

// Default configuration
const MAX_RECENT_MESSAGES = 10
const MAX_RECENT_CHUNKS = 5
const MAX_RECENT_SOURCES = 3

/**
 * Service for managing conversation memory in the RAG system
 * 
 * This service focuses on storing and retrieving conversation context,
 * tracking source attribution, and managing memory pruning for RAG-based
 * chat interactions.
 */
export class RAGMemoryService {
  private readonly supabase
  private readonly logger: typeof logger
  
  constructor(
    loggerInstance?: typeof logger
  ) {
    this.supabase = supabaseClient
    this.logger = loggerInstance || logger
  }
  
  /**
   * Store conversation context for a chat session
   * 
   * @param chatId The chat session ID
   * @param context The conversation context to store
   */
  async storeConversationContext(
    chatId: string,
    context: ConversationContext
  ): Promise<void> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGMemoryService',
      method: 'storeConversationContext',
      chatId
    })
    
    try {
      moduleLogger.info('Storing conversation context', {
        messageCount: context.messages?.length || 0,
        chunkCount: context.recentChunks?.length || 0
      })
      
      // Check if context already exists
      const { data: existingMemory, error: fetchError } = await this.supabase
        .from('rag_memory')
        .select('id')
        .eq('chat_id', chatId)
        .maybeSingle()
      
      if (fetchError) {
        throw new RAGMemoryError(`Failed to check existing memory: ${fetchError.message}`)
      }
      
      // Ensure chatId is set in the context
      const fullContext: ConversationContext = {
        ...context,
        chatId,
        lastAccessed: new Date().toISOString()
      }
      
      if (existingMemory) {
        // Update existing context
        const { error: updateError } = await this.supabase
          .from('rag_memory')
          .update({
            context: fullContext,
            last_accessed: new Date().toISOString()
          })
          .eq('id', existingMemory.id)
        
        if (updateError) {
          throw new RAGMemoryError(`Failed to update conversation context: ${updateError.message}`)
        }
      } else {
        // Insert new context
        const { error: insertError } = await this.supabase
          .from('rag_memory')
          .insert({
            chat_id: chatId,
            context: fullContext,
            last_accessed: new Date().toISOString()
          })
        
        if (insertError) {
          throw new RAGMemoryError(`Failed to store conversation context: ${insertError.message}`)
        }
      }
      
      moduleLogger.debug('Conversation context stored successfully')
    } catch (error) {
      moduleLogger.error('Failed to store conversation context', {}, error)
      throw new RAGMemoryError(
        `Failed to store conversation context: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Retrieve conversation context for a chat session
   * 
   * @param chatId The chat session ID
   * @returns The conversation context or null if not found
   */
  async retrieveConversationContext(chatId: string): Promise<ConversationContext | null> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGMemoryService',
      method: 'retrieveConversationContext',
      chatId
    })
    
    try {
      moduleLogger.info('Retrieving conversation context', { chatId })
      
      // Get context from database
      const { data: memory, error } = await this.supabase
        .from('rag_memory')
        .select('context')
        .eq('chat_id', chatId)
        .maybeSingle()
      
      if (error) {
        throw new RAGMemoryError(`Failed to retrieve conversation context: ${error.message}`)
      }
      
      if (!memory) {
        moduleLogger.debug('No conversation context found', { chatId })
        return null
      }
      
      // Update last accessed timestamp
      await this.supabase
        .from('rag_memory')
        .update({ last_accessed: new Date().toISOString() })
        .eq('chat_id', chatId)
      
      moduleLogger.debug('Conversation context retrieved successfully')
      
      return memory.context as ConversationContext
    } catch (error) {
      moduleLogger.error('Failed to retrieve conversation context', {}, error)
      throw new RAGMemoryError(
        `Failed to retrieve conversation context: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Track source attribution for a message
   * 
   * @param messageId The message ID
   * @param sources The sources used in the message
   * @param chunks Optional document chunks used in the message
   */
  async trackSourceAttribution(
    messageId: string,
    sources: DocumentSource[],
    chunks?: DocumentChunk[]
  ): Promise<void> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGMemoryService',
      method: 'trackSourceAttribution',
      messageId
    })
    
    try {
      moduleLogger.info('Tracking source attribution', {
        sourceCount: sources.length,
        chunkCount: chunks?.length || 0
      })
      
      // Prepare attribution records
      const attributions = sources.map(source => {
        // Find matching chunk if available
        const matchingChunk = chunks?.find(chunk => chunk.documentId === source.documentId)
        
        return {
          message_id: messageId,
          document_id: source.documentId,
          chunk_id: matchingChunk?.id,
          relevance_score: source.relevanceScore || 0.0
        }
      })
      
      // Skip if no attributions
      if (attributions.length === 0) {
        return
      }
      
      // Store attributions
      const { error } = await this.supabase
        .from('source_attributions')
        .insert(attributions)
      
      if (error) {
        throw new RAGMemoryError(`Failed to track source attributions: ${error.message}`)
      }
      
      moduleLogger.debug('Source attributions tracked successfully')
    } catch (error) {
      moduleLogger.error('Failed to track source attribution', {}, error)
      throw new RAGMemoryError(
        `Failed to track source attribution: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Get source attributions for a message
   * 
   * @param messageId The message ID
   * @returns The sources attributed to the message
   */
  async getSourceAttribution(messageId: string): Promise<DocumentSource[]> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGMemoryService',
      method: 'getSourceAttribution',
      messageId
    })
    
    try {
      moduleLogger.info('Getting source attribution', { messageId })
      
      // Get attributions from database
      const { data: attributions, error } = await this.supabase
        .from('source_attributions')
        .select(`
          document_id,
          relevance_score,
          documents:document_id (
            id,
            title,
            document_type,
            created_at
          )
        `)
        .eq('message_id', messageId)
      
      if (error) {
        throw new RAGMemoryError(`Failed to get source attributions: ${error.message}`)
      }
      
      // Map to DocumentSource objects
      const sources: DocumentSource[] = attributions.map(attr => ({
        documentId: attr.document_id,
        title: attr.documents.title,
        documentType: attr.documents.document_type,
        date: attr.documents.created_at,
        relevanceScore: attr.relevance_score,
        url: `/documents/${attr.document_id}`
      }))
      
      moduleLogger.debug('Source attributions retrieved successfully', {
        sourceCount: sources.length
      })
      
      return sources
    } catch (error) {
      moduleLogger.error('Failed to get source attribution', {}, error)
      throw new RAGMemoryError(
        `Failed to get source attribution: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Prune conversation context to manage token limits
   * 
   * @param chatId The chat session ID
   * @param maxTokens Maximum tokens to keep in memory
   * @returns The pruned conversation context
   */
  async pruneConversationContext(
    chatId: string,
    maxTokens: number = 4000
  ): Promise<ConversationContext> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGMemoryService',
      method: 'pruneConversationContext',
      chatId
    })
    
    try {
      moduleLogger.info('Pruning conversation context', {
        chatId,
        maxTokens
      })
      
      // Get current context
      const context = await this.retrieveConversationContext(chatId)
      
      if (!context) {
        throw new RAGMemoryError(`Conversation context not found for chat: ${chatId}`)
      }
      
      // Prune messages (keep most recent)
      const prunedMessages = (context.messages || [])
        .slice(-MAX_RECENT_MESSAGES)
      
      // Prune chunks (keep most recent)
      const prunedChunks = (context.recentChunks || [])
        .slice(-MAX_RECENT_CHUNKS)
      
      // Prune sources (keep most recent)
      const prunedSources = (context.recentSources || [])
        .slice(-MAX_RECENT_SOURCES)
      
      // Create pruned context
      const prunedContext: ConversationContext = {
        ...context,
        messages: prunedMessages,
        recentChunks: prunedChunks,
        recentSources: prunedSources,
      }
      
      // Store pruned context
      await this.storeConversationContext(chatId, prunedContext)
      
      moduleLogger.debug('Conversation context pruned successfully', {
        messageCount: prunedMessages.length,
        chunkCount: prunedChunks.length,
        sourceCount: prunedSources.length
      })
      
      return prunedContext
    } catch (error) {
      moduleLogger.error('Failed to prune conversation context', {}, error)
      throw new RAGMemoryError(
        `Failed to prune conversation context: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
  
  /**
   * Merge two conversation contexts
   * 
   * @param mainContext The main context to merge into
   * @param newContext The new context to merge from
   * @returns The merged context
   */
  async mergeContexts(
    mainContext: ConversationContext,
    newContext: ConversationContext
  ): Promise<ConversationContext> {
    const moduleLogger = this.logger.withMetadata({
      module: 'RAGMemoryService',
      method: 'mergeContexts'
    })
    
    try {
      moduleLogger.info('Merging conversation contexts')
      
      // Merge messages, avoiding duplicates based on content + timestamp
      const seenMessages = new Set<string>()
      const mergedMessages = [...(mainContext.messages || []), ...(newContext.messages || [])]
        .filter(message => {
          // Create a unique key for the message
          const key = `${message.role}:${message.content}:${message.timestamp}`
          
          // Check if message has been seen
          if (seenMessages.has(key)) {
            return false
          }
          
          // Mark as seen
          seenMessages.add(key)
          return true
        })
        // Sort by timestamp (newest first, then reverse)
        .sort((a, b) => {
          const aTime = new Date(a.timestamp).getTime()
          const bTime = new Date(b.timestamp).getTime()
          return bTime - aTime
        })
        // Keep only most recent
        .slice(0, MAX_RECENT_MESSAGES)
        // Reverse back to chronological order
        .reverse()
      
      // Merge chunks, avoiding duplicates based on ID
      const seenChunks = new Set<string>()
      const mergedChunks = [...(mainContext.recentChunks || []), ...(newContext.recentChunks || [])]
        .filter(chunk => {
          // Skip if no ID
          if (!chunk.id) return false
          
          // Check if chunk has been seen
          if (seenChunks.has(chunk.id)) {
            return false
          }
          
          // Mark as seen
          seenChunks.add(chunk.id)
          return true
        })
        // Keep only most recent
        .slice(-MAX_RECENT_CHUNKS)
      
      // Merge sources, avoiding duplicates based on document ID
      const seenSources = new Set<string>()
      const mergedSources = [...(mainContext.recentSources || []), ...(newContext.recentSources || [])]
        .filter(source => {
          // Check if source has been seen
          if (seenSources.has(source.documentId)) {
            return false
          }
          
          // Mark as seen
          seenSources.add(source.documentId)
          return true
        })
        // Keep only most recent
        .slice(-MAX_RECENT_SOURCES)
      
      // Merge key information, with new context taking precedence
      const mergedKeyInformation = {
        ...(mainContext.keyInformation || {}),
        ...(newContext.keyInformation || {})
      }
      
      // Create merged context
      const mergedContext: ConversationContext = {
        chatId: mainContext.chatId || newContext.chatId,
        messages: mergedMessages,
        recentChunks: mergedChunks,
        recentSources: mergedSources,
        keyInformation: mergedKeyInformation,
        lastAccessed: new Date().toISOString()
      }
      
      moduleLogger.debug('Conversation contexts merged successfully', {
        messageCount: mergedMessages.length,
        chunkCount: mergedChunks.length,
        sourceCount: mergedSources.length
      })
      
      return mergedContext
    } catch (error) {
      moduleLogger.error('Failed to merge conversation contexts', {}, error)
      throw new RAGMemoryError(
        `Failed to merge conversation contexts: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      )
    }
  }
}

// Export singleton instance
export const ragMemoryService = new RAGMemoryService()