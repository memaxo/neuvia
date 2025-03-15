import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { createBrowserClient } from '@/lib/supabase/clients'
import type { 
  ChatMessage,
  Message,
  MessageMetadata,
  ChatMessageType 
} from '@/lib/types/chat'
import { 
  createSystemMessage,
  createProgressMessage,
  createUserMessage,
  createAssistantMessage,
  createMessage
} from '@/lib/types/chat'
import {
  ApplicationError, 
  NotFoundError, 
  SystemError, 
  ValidationError 
} from '@/lib/errors'
import type { UUID } from '@/lib/types/base'
import { CHAT_ERROR_CODES } from '@/lib/errors/error-codes'
import { ProcessingPhase } from '@/lib/types/workflow'
import logger from '@/lib/logger'
import { Result } from '../workflow/error/result'

/**
 * Database representation of a chat message
 */
interface DbChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * Type guard to check if a value is a valid Message
 */
export function isValidMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  
  // Use type assertion to access properties
  const msg = value as Partial<Message>;
  
  return (
    typeof msg.content === 'string' && 
    (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system' || msg.role === 'function')
  );
}

/**
 * Type guard to check if a value is a valid ChatMessage
 */
export function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!isValidMessage(value)) return false;
  
  // Additional checks for ChatMessage specifics
  const chatMsg = value as Partial<ChatMessage>;
  
  if (chatMsg.metadata !== undefined) {
    if (typeof chatMsg.metadata !== 'object' || chatMsg.metadata === null) {
      return false;
    }
  }
  
  return true;
}

/**
 * Service for managing chat persistence, retrieval, and business logic
 *
 * PHASE 1 ANALYSIS NOTES:
 * - This file encapsulates chat-specific domain logic appropriately
 * - Handles persistence, retrieval, and message processing
 * - Interacts with workflow system but keeps proper domain boundaries
 * - Should be inspected for any workflow-specific logic that may be leaking in
 * 
 * PHASE 3 IMPLEMENTATION:
 * - Added new methods to handle intent-based processing that was previously in the workflow coordinator
 * - Centralized all chat-related business logic in this service
 * - Made this the single point of entry for chat message handling and intent processing
 */
export class ChatService {
  private supabase: SupabaseClient<Database>
  private readonly logger = logger.withMetadata({ module: 'ChatService' })

  /**
   * Creates a new ChatService instance
   * 
   * @param supabaseClient Optional Supabase client instance, will create one if not provided
   */
  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient()
  }

  /**
   * Create a new chat session
   * 
   * @param userId The user ID to associate with this chat
   * @param initialMetadata Optional initial metadata for the chat
   * @returns Promise resolving to Result containing the new chat ID
   */
  async createChat(
    userId: string,
    initialMetadata: Record<string, unknown> = {}
  ): Promise<Result<UUID>> {
    if (!userId) {
      return Result.failure(
        'User ID is required to create a chat',
        CHAT_ERROR_CODES.CREATION_FAILED,
        { userId }
      );
    }
    
    try {
      const timestamp = new Date().toISOString();
      
      const { data, error } = await this.supabase
        .from('chats')
        .insert({
          user_id: userId,
          metadata: {
            ...initialMetadata,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        })
        .select('id')
        .single();

      if (error) {
        return Result.failure(
          `Error creating chat: ${error.message}`,
          CHAT_ERROR_CODES.CREATION_FAILED,
          { userId, supabaseError: error }
        );
      }

      if (!data) {
        return Result.failure(
          'Chat creation did not return data',
          CHAT_ERROR_CODES.CREATION_FAILED,
          { userId }
        );
      }

      return Result.success(data.id as UUID);
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      this.logger.error('Failed to create chat', {
        userId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to create chat: ${normalizedError.message}`,
        normalizedError.code || CHAT_ERROR_CODES.CREATION_FAILED,
        { userId, originalError: normalizedError }
      );
    }
  }

  /**
   * Validation helper for messages
   * 
   * @param message The message to validate
   * @returns Validation error messages or null if valid
   */
  private getMessageValidationErrors(message: unknown): string | null {
    if (!message || typeof message !== 'object') {
      return 'Message must be an object';
    }
    
    const msg = message as Partial<Message>;
    
    if (typeof msg.content !== 'string') {
      return 'Message content must be a string';
    }
    
    if (msg.role !== 'user' && msg.role !== 'assistant' && msg.role !== 'system' && msg.role !== 'function') {
      return 'Message role must be user, assistant, system, or function';
    }
    
    if (msg.metadata !== undefined && (typeof msg.metadata !== 'object' || msg.metadata === null)) {
      return 'Message metadata must be an object if provided';
    }
    
    return null;
  }

  /**
   * Save a message to the database
   * 
   * @param message The message to save
   * @param chatId The chat ID to associate with this message
   * @returns Promise resolving to the message ID, or null if save failed
   * @throws {ValidationError} If the message is invalid
   * @throws {SystemError} If the save operation fails
   */
  async saveMessage(message: Message, chatId: UUID): Promise<Result<UUID>> {
    if (!chatId) {
      return Result.failure('Chat ID is required to save a message', CHAT_ERROR_CODES.MESSAGE_FAILED);
    }
    
    const validationError = this.getMessageValidationErrors(message);
    if (validationError) {
      return Result.failure(validationError, CHAT_ERROR_CODES.MESSAGE_FAILED, { chatId });
    }
    
    return Result.tryAsync(async () => {
      const { data, error } = await this.supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          role: message.role,
          content: message.content,
          metadata: message.metadata || {},
          created_at: message.createdAt?.toISOString() || new Date().toISOString(),
        })
        .select('id')
        .single();
      
      if (error) {
        throw new SystemError({
            const normalizedError = normalizeError(error);
            console.error('Error sending message:', normalizedError.message);
          code: CHAT_ERROR_CODES.MESSAGE_FAILED,
          cause: error,
          data: { chatId }
        });
      }
      
      if (!data) {
        throw new SystemError({
          message: 'Message save did not return data',
          code: CHAT_ERROR_CODES.MESSAGE_FAILED,
          data: { chatId }
        });
      }
      
      // Update chat's last activity timestamp; ignore errors if update fails
      this.updateChatLastActivity(chatId).catch(activityError => {
        console.warn('Failed to update chat activity:', activityError);
      });
      
      return data.id as UUID;
    });
  }

  /**
   * Save multiple messages in a batch
   * 
   * @param messages Array of messages to save
   * @param chatId The chat ID to associate with these messages
   * @returns Promise resolving to the number of messages saved
   * @throws {ValidationError} If any message is invalid
   * @throws {SystemError} If the save operation fails
   */
  async saveMessages(messages: Message[], chatId: UUID): Promise<number> {
    try {
      if (!chatId) {
        throw new ValidationError({
          message: 'Chat ID is required to save messages',
          code: 'CHAT_MESSAGES_MISSING_CHAT_ID'
        });
      }
      
      if (!Array.isArray(messages)) {
        throw new ValidationError({
          message: 'Messages must be an array',
          code: 'CHAT_MESSAGES_INVALID_FORMAT',
          data: { chatId }
        });
      }
      
      if (messages.length === 0) {
        return 0;
      }
      
      // Validate all messages
      for (let i = 0; i < messages.length; i++) {
        const validationError = this.getMessageValidationErrors(messages[i]);
        if (validationError) {
          throw new ValidationError({
            message: `Message at index ${i} is invalid: ${validationError}`,
            code: 'CHAT_MESSAGE_INVALID',
            data: { chatId, messageIndex: i }
          });
        }
      }

      const messagesToInsert = messages.map(msg => ({
        chat_id: chatId,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata || {},
        created_at: msg.createdAt?.toISOString() || new Date().toISOString(),
      }));

      const { data, error } = await this.supabase
        .from('chat_messages')
        .insert(messagesToInsert)
        .select('id');

      if (error) {
        throw new SystemError({
          message: `Error saving messages batch: ${error.message}`,
          code: 'CHAT_MESSAGES_SAVE_FAILED',
          cause: error,
          data: { chatId, messageCount: messages.length }
        });
      }

      // Update chat's last activity timestamp
      try {
        await this.updateChatLastActivity(chatId);
      } catch (activityError) {
        // Log but don't fail the operation if updating activity fails
        console.warn('Failed to update chat activity:', activityError);
      }

      return data?.length || 0;
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new SystemError({
        message: `Failed to save messages batch: ${error instanceof Error ? error.message : String(error)}`,
        code: 'CHAT_MESSAGES_SAVE_FAILED',
        cause: error,
        data: { chatId, messageCount: messages.length }
      });
    }
  }

  /**
   * Converts a database message to an application Message
   * 
   * @param dbMessage The database message object
   * @returns A properly formatted Message object
   */
  private dbMessageToMessage(dbMessage: DbChatMessage): Message {
    return {
      id: dbMessage.id,
      role: dbMessage.role,
      content: dbMessage.content,
      createdAt: new Date(dbMessage.created_at),
      metadata: dbMessage.metadata || {},
    };
  }

  /**
   * Get all messages for a chat
   * 
   * @param chatId The chat ID to get messages for
   * @returns Promise resolving to Result containing an array of messages
   */
  async getChatMessages(chatId: UUID): Promise<Result<Message[]>> {
    if (!chatId) {
      return Result.failure(
        'Chat ID is required to get messages',
        'CHAT_MESSAGES_MISSING_CHAT_ID',
        { chatId }
      );
    }

    try {
      // First check if chat exists
      const { data: chatData, error: chatError } = await this.supabase
        .from('chats')
        .select('id')
        .eq('id', chatId)
        .single();
        
      if (chatError && chatError.code === 'PGRST116') {
        return Result.failure(
          `Chat with ID ${chatId} not found`,
          'CHAT_NOT_FOUND',
          { chatId, resource: 'Chat' }
        );
      }
      
      if (chatError) {
        return Result.failure(
          `Error checking chat existence: ${chatError.message}`,
          'CHAT_FETCH_ERROR',
          { chatId, supabaseError: chatError }
        );
      }

      const { data, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        return Result.failure(
          `Error fetching chat messages: ${error.message}`,
          'CHAT_MESSAGES_FETCH_FAILED',
          { chatId, supabaseError: error }
        );
      }

      const messages = (data || []).map(msg => this.dbMessageToMessage(msg as DbChatMessage));
      return Result.success(messages);
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      this.logger.error('Failed to fetch chat messages', {
        chatId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to fetch chat messages: ${normalizedError.message}`,
        normalizedError.code || 'CHAT_MESSAGES_FETCH_FAILED',
        { chatId, originalError: normalizedError }
      );
    }
  }
  
  /**
   * Legacy method to maintain backward compatibility
   * @deprecated Use getChatMessages() which returns Result<Message[]>
   */
  async fetchChatMessagesLegacy(chatId: UUID): Promise<Message[]> {
    return wrapWithResult(
      () => this.getChatMessages(chatId),
      `Failed to fetch chat messages for chat ${chatId}`,
      'CHAT_MESSAGES_FETCH_FAILED',
      { chatId }
    );
  }

  /**
   * Update chat's last activity timestamp
   * 
   * @param chatId The chat ID to update
   * @returns Promise that resolves when the update is complete
   * @throws {ValidationError} If chatId is not provided
   * @throws {NotFoundError} If the chat doesn't exist
   * @throws {SystemError} If the update fails
   */
  async updateChatLastActivity(chatId: UUID): Promise<void> {
    try {
      if (!chatId) {
        throw new ValidationError({
          message: 'Chat ID is required to update last activity',
          code: 'CHAT_ACTIVITY_MISSING_ID'
        });
      }

      const { error, count } = await this.supabase
        .from('chats')
        .update({
          last_activity_at: new Date().toISOString()
        })
        .eq('id', chatId);

      if (error) {
        throw new SystemError({
          message: `Error updating chat activity: ${error.message}`,
          code: 'CHAT_ACTIVITY_UPDATE_FAILED',
          cause: error,
          data: { chatId }
        });
      }
      
      if (count === 0) {
        throw new NotFoundError({
          message: `Chat with ID ${chatId} not found`,
          resource: 'Chat',
          code: 'CHAT_NOT_FOUND',
          data: { chatId }
        });
      }
    } catch (error) {
      // We don't want to throw here as this is an auxiliary operation
      // But we should log it properly for debugging
      if (error instanceof ApplicationError) {
        console.warn(`[ChatService] ${error.code}: ${error.message}`);
      } else {
        console.warn('Failed to update chat last activity:', 
          error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Update chat metadata
   * 
   * @param chatId The chat ID to update
   * @param metadata The metadata to merge with existing metadata
   * @returns Promise that resolves when the update is complete
   * @throws {ValidationError} If chatId is not provided or metadata is invalid
   * @throws {NotFoundError} If the chat doesn't exist
   * @throws {SystemError} If the update fails
   */
  async updateChatMetadata(
    chatId: UUID,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      if (!chatId) {
        throw new ValidationError({
          message: 'Chat ID is required to update metadata',
          code: 'CHAT_METADATA_MISSING_ID'
        });
      }
      
      if (!metadata || typeof metadata !== 'object' || metadata === null) {
        throw new ValidationError({
          message: 'Metadata must be a valid object',
          code: 'CHAT_METADATA_INVALID',
          data: { chatId }
        });
      }

      // First get existing metadata
      const { data: existingData, error: fetchError } = await this.supabase
        .from('chats')
        .select('metadata')
        .eq('id', chatId)
        .single();

      if (fetchError && fetchError.code === 'PGRST116') {
        throw new NotFoundError({
          message: `Chat with ID ${chatId} not found`,
          resource: 'Chat',
          code: 'CHAT_NOT_FOUND',
          data: { chatId }
        });
      }
      
      if (fetchError) {
        throw new SystemError({
          message: `Error fetching existing chat metadata: ${fetchError.message}`,
          code: 'CHAT_METADATA_FETCH_FAILED',
          cause: fetchError,
          data: { chatId }
        });
      }

      const existingMetadata = existingData?.metadata || {};
      const timestamp = new Date().toISOString();
      
      // Merge with new metadata
      const { error, count } = await this.supabase
        .from('chats')
        .update({
          metadata: {
            ...existingMetadata,
            ...metadata,
            updatedAt: timestamp
          },
          last_activity_at: timestamp
        })
        .eq('id', chatId);
        
      if (error) {
        throw new SystemError({
          message: `Error updating chat metadata: ${error.message}`,
          code: 'CHAT_METADATA_UPDATE_FAILED',
          cause: error,
          data: { chatId }
        });
      }
      
      if (count === 0) {
        throw new NotFoundError({
          message: `Chat with ID ${chatId} not found or was deleted during update`,
          resource: 'Chat',
          code: 'CHAT_NOT_FOUND_DURING_UPDATE',
          data: { chatId }
        });
      }
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new SystemError({
        message: `Failed to update chat metadata: ${error instanceof Error ? error.message : String(error)}`,
        code: 'CHAT_METADATA_UPDATE_FAILED',
        cause: error,
        data: { chatId }
      });
    }
  }

  /**
   * Archive a chat
   * 
   * @param chatId The chat ID to archive
   * @returns Promise that resolves when the chat is archived
   * @throws {ValidationError} If chatId is not provided
   * @throws {NotFoundError} If the chat doesn't exist
   * @throws {SystemError} If the archiving fails
   */
  async archiveChat(chatId: UUID): Promise<void> {
    try {
      if (!chatId) {
        throw new ValidationError({
          message: 'Chat ID is required to archive a chat',
          code: 'CHAT_ARCHIVE_MISSING_ID'
        });
      }

      const timestamp = new Date().toISOString();
      const { error, count } = await this.supabase
        .from('chats')
        .update({
          is_archived: true,
          archived_at: timestamp,
          // Also update last activity for consistency
          last_activity_at: timestamp
        })
        .eq('id', chatId);

      if (error) {
        throw new SystemError({
          message: `Error archiving chat: ${error.message}`,
          code: 'CHAT_ARCHIVE_FAILED',
          cause: error,
          data: { chatId }
        });
      }
      
      if (count === 0) {
        throw new NotFoundError({
          message: `Chat with ID ${chatId} not found`,
          resource: 'Chat',
          code: 'CHAT_NOT_FOUND',
          data: { chatId }
        });
      }
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new SystemError({
        message: `Failed to archive chat: ${error instanceof Error ? error.message : String(error)}`,
        code: 'CHAT_ARCHIVE_FAILED',
        cause: error,
        data: { chatId }
      });
    }
  }

  /**
   * Delete a chat and its messages
   * 
   * @param chatId The chat ID to delete
   * @returns Promise that resolves when the chat is deleted
   * @throws {ValidationError} If chatId is not provided
   * @throws {NotFoundError} If the chat doesn't exist
   * @throws {SystemError} If the deletion fails
   */
  async deleteChat(chatId: UUID): Promise<void> {
    try {
      if (!chatId) {
        throw new ValidationError({
          message: 'Chat ID is required to delete a chat',
          code: 'CHAT_DELETE_MISSING_ID'
        });
      }
      
      // First check if chat exists
      const { data: chatData, error: checkError } = await this.supabase
        .from('chats')
        .select('id')
        .eq('id', chatId)
        .single();
        
      if (checkError && checkError.code === 'PGRST116') {
        throw new NotFoundError({
          message: `Chat with ID ${chatId} not found`,
          resource: 'Chat',
          code: 'CHAT_NOT_FOUND',
          data: { chatId }
        });
      }
      
      if (checkError) {
        throw new SystemError({
          message: `Error checking chat existence: ${checkError.message}`,
          code: 'CHAT_DELETE_CHECK_FAILED',
          cause: checkError,
          data: { chatId }
        });
      }

      // First delete all messages in the chat
      const { error: messagesError } = await this.supabase
        .from('chat_messages')
        .delete()
        .eq('chat_id', chatId);

      if (messagesError) {
        throw new SystemError({
          message: `Error deleting chat messages: ${messagesError.message}`,
          code: 'CHAT_MESSAGES_DELETE_FAILED',
          cause: messagesError,
          data: { chatId }
        });
      }

      // Then delete the chat itself
      const { error: chatError, count } = await this.supabase
        .from('chats')
        .delete()
        .eq('id', chatId);

      if (chatError) {
        throw new SystemError({
          message: `Error deleting chat: ${chatError.message}`,
          code: 'CHAT_DELETE_FAILED',
          cause: chatError,
          data: { chatId }
        });
      }
      
      if (count === 0) {
        throw new NotFoundError({
          message: `Chat with ID ${chatId} not found or was already deleted`,
          resource: 'Chat',
          code: 'CHAT_NOT_FOUND_DURING_DELETE',
          data: { chatId }
        });
      }
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new SystemError({
        message: `Failed to delete chat: ${error instanceof Error ? error.message : String(error)}`,
        code: 'CHAT_DELETE_FAILED',
        cause: error,
        data: { chatId }
      });
    }
  }

  /**
   * Update a specific message
   * 
   * @param messageId The ID of the message to update
   * @param updates The updates to apply to the message
   * @returns Promise that resolves when the update is complete
   * @throws {ValidationError} If messageId is not provided or updates are invalid
   * @throws {NotFoundError} If the message doesn't exist
   * @throws {SystemError} If the update fails
   */
  async updateMessage(
    messageId: UUID,
    updates: Partial<Omit<Message, 'id'>>
  ): Promise<void> {
    try {
      if (!messageId) {
        throw new ValidationError({
          message: 'Message ID is required to update a message',
          code: 'MESSAGE_UPDATE_MISSING_ID'
        });
      }
      
      if (!updates || typeof updates !== 'object') {
        throw new ValidationError({
          message: 'Updates must be a valid object',
          code: 'MESSAGE_UPDATE_INVALID',
          data: { messageId }
        });
      }

      const updateObject: Record<string, unknown> = {};

      // Validate content if provided
      if (updates.content !== undefined) {
        if (typeof updates.content !== 'string') {
          throw new ValidationError({
            message: 'Message content must be a string',
            code: 'MESSAGE_UPDATE_INVALID_CONTENT',
            data: { messageId }
          });
        }
        updateObject.content = updates.content;
      }

      // Handle metadata updates
      if (updates.metadata !== undefined) {
        if (typeof updates.metadata !== 'object' || updates.metadata === null) {
          throw new ValidationError({
            message: 'Message metadata must be a valid object',
            code: 'MESSAGE_UPDATE_INVALID_METADATA',
            data: { messageId }
          });
        }
        
        // Get current metadata first to merge
        const { data: currentMessage, error: fetchError } = await this.supabase
          .from('chat_messages')
          .select('metadata')
          .eq('id', messageId)
          .single();

        if (fetchError && fetchError.code === 'PGRST116') {
          throw new NotFoundError({
            message: `Message with ID ${messageId} not found`,
            resource: 'Message',
            code: 'MESSAGE_NOT_FOUND',
            data: { messageId }
          });
        }
        
        if (fetchError) {
          throw new SystemError({
            message: `Error fetching message metadata: ${fetchError.message}`,
            code: 'MESSAGE_METADATA_FETCH_FAILED',
            cause: fetchError,
            data: { messageId }
          });
        }

        updateObject.metadata = {
          ...(currentMessage?.metadata || {}),
          ...updates.metadata
        };
      }

      // Only update if there are changes to make
      if (Object.keys(updateObject).length > 0) {
        const { error, count } = await this.supabase
          .from('chat_messages')
          .update(updateObject)
          .eq('id', messageId);
          
        if (error) {
          throw new SystemError({
            message: `Error updating message: ${error.message}`,
            code: 'MESSAGE_UPDATE_FAILED',
            cause: error,
            data: { messageId }
          });
        }
        
        if (count === 0) {
          throw new NotFoundError({
            message: `Message with ID ${messageId} not found or was deleted during update`,
            resource: 'Message',
            code: 'MESSAGE_NOT_FOUND_DURING_UPDATE',
            data: { messageId }
          });
        }
      }
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new SystemError({
        message: `Failed to update message: ${error instanceof Error ? error.message : String(error)}`,
        code: 'MESSAGE_UPDATE_FAILED',
        cause: error,
        data: { messageId }
      });
    }
  }

  /**
   * Search for messages with specific content
   * 
   * @param query The search query
   * @param chatId Optional chat ID to restrict search to
   * @param limit Maximum number of results to return
   * @returns Promise resolving to an array of matching messages
   * @throws {ValidationError} If query is not provided or invalid
   * @throws {SystemError} If the search fails
   */
  async searchMessages(
    query: string,
    chatId?: UUID,
    limit = 20
  ): Promise<Message[]> {
    try {
      if (!query || typeof query !== 'string') {
        throw new ValidationError({
          message: 'Search query is required and must be a string',
          code: 'MESSAGE_SEARCH_INVALID_QUERY'
        });
      }
      
      if (query.length < 2) {
        throw new ValidationError({
          message: 'Search query must be at least 2 characters',
          code: 'MESSAGE_SEARCH_QUERY_TOO_SHORT'
        });
      }

      // Validate limit
      const actualLimit = Math.min(Math.max(1, limit), 100); // Between 1 and 100
      
      let supabaseQuery = this.supabase
        .from('chat_messages')
        .select('*')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(actualLimit);

      // Add chat ID filter if provided
      if (chatId) {
        supabaseQuery = supabaseQuery.eq('chat_id', chatId);
      }

      const { data, error } = await supabaseQuery;

      if (error) {
        throw new SystemError({
          message: `Error searching messages: ${error.message}`,
          code: 'MESSAGE_SEARCH_FAILED',
          cause: error,
          data: { query, chatId, limit: actualLimit }
        });
      }

      return (data || []).map(msg => this.dbMessageToMessage(msg as DbChatMessage));
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new SystemError({
        message: `Failed to search messages: ${error instanceof Error ? error.message : String(error)}`,
        code: 'MESSAGE_SEARCH_FAILED',
        cause: error,
        data: { query, chatId, limit }
      });
    }
  }
  
  /**
   * Creates a new ChatMessage with unique ID
   * 
   * @param content The message content
   * @param role The message role
   * @param metadata Optional message metadata
   * @returns A new ChatMessage instance
   */
  createChatMessage(
    content: string,
    role: 'user' | 'assistant' | 'system' | 'function',
    metadata?: MessageMetadata
): ChatMessage {
    if (role === 'user') {
      return createUserMessage(content, metadata);
    } else if (role === 'assistant') {
      return createAssistantMessage(content, metadata);
    } else if (role === 'system') {
      return createSystemMessage(content, metadata);
    } else {
      return createMessage(role, content, ChatMessageType.CHAT, metadata);
    }
}
  
  /**
   * Update a message's progress
   *
   * @param messageId The message ID to update
   * @param progress The progress value (0-100)
   * @param phase The processing phase
   * @returns Promise resolving to true if successful, false otherwise
   */
  async updateMessageProgress(
    messageId: string,
    progress: number,
    phase: string
  ): Promise<boolean> {
    try {
      if (!messageId) {
        throw new Error('Message ID is required');
      }
      
      await this.updateMessage(
        messageId as UUID,
        {
          metadata: {
            progress: {
              value: progress,
              phase,
              updatedAt: new Date().toISOString()
            }
          }
        }
      );
      
      return true;
    } catch (error) {
      this.logger.error('Failed to update message progress', {
        messageId,
        progress,
        phase,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }
  
  /**
   * Add a system notification message
   *
   * @param chatId The chat ID
   * @param content The message content
   * @param metadata Optional metadata
   * @returns The created message ID, or null if failed
   */
  async addSystemNotification(
    chatId: UUID,
    content: string,
    metadata?: Record<string, any>
  ): Promise<UUID | null> {
    try {
      const message = createSystemMessage(content, {
        ...metadata
      });
      await this.saveMessage(message, chatId);
      return message.id;
    } catch (error) {
      this.logger.error('Failed to add system notification', {
        chatId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  }
  
  /**
   * Add a workflow progress message
   *
   * @param chatId The chat ID
   * @param content The message content
   * @param progress The progress value (0-100)
   * @param phase The processing phase
   * @returns The created message ID, or null if failed
   */
  async addProgressMessage(
    chatId: UUID,
    content: string,
    progress: number,
    phase: string
  ): Promise<UUID | null> {
    try {
        const userMessage = createUserMessage(content, { isCorrection, ...metadata });
        store.addMessage(userMessage);
  }
  
  /**
   * Get all messages for a specific entity (document, patient, etc.)
   *
   * @param entityType The entity type (document, patient, etc.)
   * @param entityId The entity ID
   * @returns Promise resolving to an array of messages
   */
  async getMessagesByEntity(
    entityType: string,
    entityId: string
  ): Promise<Message[]> {
    try {
      if (!entityType || !entityId) {
        throw new Error('Entity type and ID are required');
      }
      
      const { data, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .filter(`metadata->${entityType}_id`, 'eq', entityId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      return (data || []).map(msg => this.dbMessageToMessage(msg as any));
    } catch (error) {
      this.logger.error('Failed to get messages by entity', {
        entityType,
        entityId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw new Error(`Failed to get messages by entity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get workflow ID for a chat
   *
   * @param chatId The chat ID
   * @returns Promise resolving to the workflow ID, or null if not found
   */
  async getWorkflowIdForChat(chatId: UUID): Promise<string | null> {
    try {
      if (!chatId) {
        throw new Error('Chat ID is required');
      }
      
      const { data, error } = await this.supabase
        .from('workflow_states')
        .select('id')
        .eq('chat_id', chatId)
        .maybeSingle();
      
      if (error) throw error;
      
      return data?.id || null;
    } catch (error) {
      this.logger.error('Failed to get workflow ID for chat', {
        chatId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }
  
  /**
   * Create a new chat with a linked workflow
   *
   * @param userId The user ID
   * @param initialMetadata Optional initial metadata
   * @returns Promise resolving to an object with chat ID and workflow ID
   */
  async createChatWithWorkflow(
    userId: string,
    initialMetadata: Record<string, unknown> = {}
  ): Promise<{ chatId: UUID; workflowId: string } | null> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Start transaction
      // Create chat
      const chatId = await this.createChat(userId, initialMetadata);
      
      if (!chatId) {
        throw new Error('Failed to create chat');
      }
      
      // Create workflow state linked to the chat
      const { data, error } = await this.supabase
        .from('workflow_states')
        .insert({
          user_id: userId,
          chat_id: chatId,
          current_step: 'idle',
          metadata: {
            initializedAt: new Date().toISOString(),
            ...initialMetadata
          }
        })
        .select('id')
        .single();
      
      if (error) throw error;
      
      if (!data) {
        throw new Error('Failed to create workflow state');
      }
      
      return {
        chatId,
        workflowId: data.id
      };
    } catch (error) {
      this.logger.error('Failed to create chat with workflow', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }

  /**
   * Generate assistant response based on context
   * 
   * @param message User message
   * @param options Options including context and model
   * @returns Generated assistant response text
   */
  async generateAssistantResponse(
    message: string,
    options: {
      workflowId: string;
      chatId: string;
      context: Record<string, any>;
      model?: string;
      patientId?: string;
      documentId?: string;
      userId: string;
    }
  ): Promise<string> {
    try {
      // Check for specific contexts that would alter the response
      const isResearchModeActive = options.context.isResearchModeActive;
      const isVerificationModeActive = options.context.isVerificationModeActive;
      const isReportModeActive = options.context.isReportModeActive;
      
      const currentTime = new Date().toLocaleTimeString();
      
      // Generate context-specific response based on active modes
      if (isResearchModeActive) {
        return `I'm researching your query: "${message}"
        
  Here are some findings based on my research:
  - Finding 1: This is simulated research content
  - Finding 2: Additional simulated research information
  - Finding 3: More simulated research data
  
  The research was conducted at ${currentTime} using the ${options.model || 'default'} model.
  Would you like me to explore any specific aspect in more detail?`;
      } else if (isVerificationModeActive) {
        return `I've processed your verification request: "${message}"
  
  Here's the updated verification data based on your input:
  - Updated field 1: Value after verification
  - Updated field 2: Value after verification
  - Status: Pending your confirmation
  
  Please review these updates and confirm if they're correct.`;
      } else if (isReportModeActive) {
        return `I've generated a report based on your request: "${message}"
  
  Report Summary:
  - Section 1: Key findings from the document
  - Section 2: Analysis of the data
  - Section 3: Recommendations
  
  The report was generated at ${currentTime} using the ${options.model || 'default'} model.
  Would you like me to explain any section in more detail?`;
      }
      
      // Default response for regular chat
      return `This is a simulated assistant response to: "${message}".
      
  I'm using the ${options.model || 'default'} model. The current time is ${currentTime}.
  
  Here are some details from the context:
  ${options.patientId ? `- Patient ID: ${options.patientId}` : ''}
  ${options.documentId ? `- Document ID: ${options.documentId}` : ''}
  
  Is there anything else you'd like to know?`;
    } catch (error) {
      this.logger.error('Error generating assistant response', {
        workflowId: options.workflowId,
        chatId: options.chatId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return `I apologize, but I encountered an error while processing your request. Please try again.`;
    }
  }

  /**
   * Process a correction message for verification
   * 
   * @param message The correction message
   * @param chatId The chat ID
   * @param workflowId The workflow ID
   * @param verificationId The verification ID
   * @param userId The user ID
   * @returns Promise resolving to success status and message ID
   */
  async processCorrectionMessage(
    message: string,
    chatId: string,
    workflowId: string,
    verificationId: string,
    userId: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Parse corrections from message
      const corrections = this.parseCorrectionData(message);
      if (!corrections || Object.keys(corrections).length === 0) {
        return {
          success: false,
          error: 'No valid corrections found in message'
        };
      }

      // Create a progress message indicating correction is processing
      const processingMessage = createProgressMessage(
        'Processing your corrections...',
        0,
        'correction_processing'
      );
      await this.saveMessage(processingMessage, chatId as UUID);

      // (Simulate partial verification step ~50% done)
      await this.updateMessageProgress(processingMessage.id, 50, 'verifying_corrections');

      // Summarize corrections for the final assistant message
      const summaryLines = Object.entries(corrections)
        .map(([field, value]) => `- ${field}: ${value}`)
        .join('\n');
      const updatedSummary = `I've updated the information with your corrections:\n\n${summaryLines}`;

      // Create an assistant message for the updated summary
      const summaryMessage = createAssistantMessage(updatedSummary, {
        type: 'summary',
        correctionData: corrections
      });
      await this.saveMessage(summaryMessage, chatId as UUID);

      // Mark progress as complete
      await this.updateMessageProgress(processingMessage.id, 100, 'correction_complete');

      return {
        success: true,
        messageId: summaryMessage.id
      };
    } catch (error) {
      this.logger.error('Error processing correction message', {
        chatId,
        workflowId,
        verificationId,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

      // Update verification with corrections
      // This would normally call your verification service
      await this.updateMessageProgress(processingMessageId, 50, 'correction_verification');

      // Add confirmation message with summary of changes
      import { createMessage, ChatMessageType } from '@/lib/types/chat';
      const summaryContent = `I've updated the information with your corrections:\n\n${
        Object.entries(corrections)
          .map(([field, value]) => `- ${field}: ${value}`)
          .join('\n')
      }`;
      const summaryMessage = createMessage('assistant', summaryContent, ChatMessageType.SUMMARY, { correctionData: corrections });
      await this.saveMessage(summaryMessage, chatId as UUID);

      // Update processing message to complete
      await this.updateMessageProgress(processingMessageId, 100, 'correction_complete');

      return {
        success: true,
        messageId: summaryMessageId
      };
    } catch (error) {
      this.logger.error('Error processing correction message', {
        chatId,
        workflowId,
        verificationId,
        error: error instanceof Error ? error.message : String(error)
      });

      const normalizedError = normalizeError(error);
      return {
        success: false,
        error: normalizedError.message
      };
    }
  }

  /**
   * Parse correction data from message text
   */
  private parseCorrectionData(message: string): Record<string, string> {
    const corrections: Record<string, string> = {};
    
    // Look for patterns like "field should be value" or "change field to value"
    const patterns = [
      /\b(\w+)\s+(?:should be|needs to be|must be|is actually|is)\s+(?:"([^"]+)"|'([^']+)'|([^\s,;.]+))/gi,
      /\b(?:change|update|correct|fix)\s+(\w+)\s+(?:to|as)\s+(?:"([^"]+)"|'([^']+)'|([^\s,;.]+))/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const field = match[1].toLowerCase();
        const value = match[2] || match[3] || match[4];
        if (field && value) {
          corrections[field] = value;
        }
      }
    }
    
    return corrections;
  }

  /**
   * Notify chat of verification status
   * 
   * @param chatId The chat ID
   * @param verificationStatus The verification status
   * @param verificationId The verification ID
   * @returns Promise resolving to the notification message ID or null
   */
  async notifyChatOfVerification(
    chatId: UUID,
    verificationStatus: 'pending' | 'completed' | 'failed',
    verificationId: string
  ): Promise<UUID | null> {
    try {
      let content = '';
      let messageType = 'system';
      
      switch (verificationStatus) {
        case 'pending':
          content = 'Verification is pending. Please review the information and confirm if it\'s correct.';
          break;
        case 'completed':
          content = 'Verification completed successfully!';
          break;
        case 'failed':
          content = 'Verification failed. Please try again or contact support.';
          messageType = 'error';
          break;
      }
      
      const messageId = await this.addSystemNotification(
        chatId,
        content,
        {
          type: messageType,
          verificationStatus,
          verificationId
        }
      );
      
      return messageId;
    } catch (error) {
      this.logger.error('Failed to notify chat of verification', {
        chatId,
        verificationStatus,
        verificationId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }

  /**
   * Handle report completion
   * 
   * @param chatId The chat ID
   * @param reportId The report ID
   * @param summary Report summary
   * @returns Promise resolving to the message ID or null
   */
  async handleReportCompletion(
    chatId: UUID,
    reportId: string,
    summary?: string
  ): Promise<UUID | null> {
    try {
      // First add notification that report was generated
      await this.addSystemNotification(
        chatId,
        'Report generated successfully.',
        {
          type: 'system',
          reportId,
          reportGenerated: true,
          generatedAt: new Date().toISOString()
        }
      );
      
      // Then add the summary if available
      if (summary) {
        const summaryMessage = createAssistantMessage(
          \`Here's a summary of the generated report:\n\n\${summary}\`,
          {
            type: 'report',
            reportId
          }
        );
        await this.saveMessage(summaryMessage, chatId);
        
        return summaryMessage.id;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to handle report completion', {
        chatId,
        reportId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }

  /**
   * Handle research completion
   * 
   * @param chatId The chat ID
   * @param researchId The research ID
   * @param findings Research findings
   * @returns Promise resolving to the message ID or null
   */
  async handleResearchCompletion(
    chatId: UUID,
    researchId: string,
    findings: string
  ): Promise<UUID | null> {
    try {
      // Use createAssistantMessage for the final research findings
      const researchMsg = createAssistantMessage(
        findings || 'Research completed. Here are the findings:',
        {
          type: 'research',
          researchId,
          researchCompleted: true,
          completedAt: new Date().toISOString()
        }
      );
      await this.saveMessage(researchMsg, chatId);
      const messageId = researchMsg.id;
      
      return messageId;
    } catch (error) {
      this.logger.error('Failed to handle research completion', {
        chatId,
        researchId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }
  
  /**
   * Create a progress message
   * 
   * @param chatId The chat ID
   * @param phase The processing phase
   * @returns Promise resolving to the message ID or null
   */
  async createProgressMessage(
    chatId: UUID,
    phase: string
  ): Promise<UUID | null> {
    try {
      // Use the createProgressMessage factory
      const progressMsg = createProgressMessage(
        `Processing your ${phase} request...`,
        10, // initial progress value
        phase
      );
      // Save to DB
      await this.saveMessage(progressMsg, chatId);
      return progressMsg.id;
    } catch (error) {
      this.logger.error('Failed to create progress message', {
        chatId,
        phase,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  /**
   * Complete a progress message
   * 
   * @param chatId The chat ID
   * @param messageId The message ID to complete
   * @returns Promise resolving to success status
   */
  async completeProgressMessage(
    chatId: UUID,
    messageId: UUID
  ): Promise<boolean> {
    try {
      // First update to 100% complete
      await this.updateMessageProgress(messageId, 100, ProcessingPhase.COMPLETION);
      
      // After a short delay, update it with a completion message
      setTimeout(async () => {
        await this.updateMessage(messageId, {
          content: 'Request processed successfully.',
          metadata: {
            type: 'system',
            completed: true,
            completedAt: new Date().toISOString()
          }
        });
      }, 500);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to complete progress message', {
        chatId,
        messageId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }
  
  /**
   * Create a welcome message for a new chat
   * 
   * @param chatId The chat ID
   * @returns Promise resolving to the message ID or null
   */
  async createWelcomeMessage(chatId: UUID): Promise<UUID | null> {
    try {
      const messageId = crypto.randomUUID();
      await this.saveMessage({
        id: messageId,
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        createdAt: new Date(),
        metadata: {
          type: 'chat',
          isWelcomeMessage: true
        }
      }, chatId);
      
      return messageId;
    } catch (error) {
      this.logger.error('Failed to create welcome message', {
        chatId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }
  
  /**
   * Process a correction message with corrections data
   *
   * @param chatId The chat ID
   * @param correctionData The corrections data
   * @param isCompleted Whether the correction process is completed
   * @returns Promise resolving to the message ID or null
   */
  async processCorrectionMessage(
    chatId: UUID,
    correctionData: Record<string, string>,
    isCompleted: boolean = false
  ): Promise<UUID | null> {
    try {
      // Create summary message with correction details
      const messageId = crypto.randomUUID();
      await this.saveMessage({
        id: messageId,
        role: 'assistant',
        content: `I've updated the information with your corrections:\n\n${
          Object.entries(correctionData)
            .map(([field, value]) => `- ${field}: ${value}`)
            .join('\n')
        }`,
        createdAt: new Date(),
        metadata: {
          type: 'summary',
          correctionData,
          isCompleted
        }
      }, chatId);
      
      // If completed, add prompt to confirm
      if (isCompleted) {
        await this.saveMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: "I've updated the summary based on your correction. Please review and type 'confirm' to approve, or provide more corrections.",
          createdAt: new Date(),
          metadata: {
            type: 'verification'
          }
        }, chatId);
      }
      
      return messageId;
    } catch (error) {
      this.logger.error('Failed to process correction message', {
        chatId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }
  
  /**
   * Handle an intent processing error
   * 
   * @param chatId The chat ID
   * @param error The error object
   * @param processingMessageId Optional ID of an existing processing message to update
   * @returns Promise resolving to success status
   */
  async handleIntentError(
    chatId: UUID,
    error: any,
    processingMessageId?: string | null
  ): Promise<boolean> {
    try {
      const errorMessage = error.message || 'An unknown error occurred';
      const errorCode = error.code || 'UNKNOWN_ERROR';
      const errorDetails = error.details || {};
      
      // If there was a processing message, update it with error
      if (processingMessageId) {
        await this.updateMessage(processingMessageId as UUID, {
          content: `Error: ${errorMessage}`,
          metadata: {
            type: 'error',
            errorCode,
            errorDetails
          }
        });
      } else {
        // Add new error message to chat
        await this.saveMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Error processing message: ${errorMessage}`,
          createdAt: new Date(),
          metadata: {
            type: 'error',
            errorCode,
            errorDetails
          }
        }, chatId);
      }
      
      return true;
    } catch (secondaryError) {
      this.logger.error('Failed to handle intent error', {
        chatId,
        originalError: error,
        secondaryError: secondaryError instanceof Error ? secondaryError.message : String(secondaryError)
      });
      
      return false;
    }
  }
  
  /**
   * Handle a chat error
   * 
   * @param chatId The chat ID
   * @param error The error object
   * @param prefix Optional prefix for the error message
   * @returns Promise resolving to success status
   */
  async handleChatError(
    chatId: UUID,
    error: any,
    prefix: string = 'Error processing message'
  ): Promise<boolean> {
    try {
      const normalizedError = error instanceof Error ? error : { message: String(error) };
      const errorMessage = normalizedError.message || 'An unknown error occurred';
      
      // Add error message to chat
      await this.saveMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `${prefix}: ${errorMessage}`,
        createdAt: new Date(),
        metadata: {
          type: 'error',
          errorCode: (normalizedError as any).code,
          errorDetails: (normalizedError as any).details || {}
        }
      }, chatId);
      
      return true;
    } catch (secondaryError) {
      this.logger.error('Failed to handle chat error', {
        chatId,
        originalError: error,
        secondaryError: secondaryError instanceof Error ? secondaryError.message : String(secondaryError)
      });
      
      return false;
    }
  }
  
  /**
   * Handle workflow error
   * 
   * @param chatId The chat ID
   * @param errorMetadata The error metadata
   * @returns Promise resolving to success status
   */
  async handleWorkflowError(
    chatId: UUID,
    errorMetadata: { 
      message: string; 
      category: string; 
      timestamp: string;
      recoveryPaths?: string[];
      retryable?: boolean;
      details?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    try {
      // Add error message to chat
      await this.saveMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: errorMetadata.message,
        createdAt: new Date(errorMetadata.timestamp),
        metadata: {
          type: 'error',
          errorCategory: errorMetadata.category,
          recoveryPaths: errorMetadata.recoveryPaths,
          retryable: errorMetadata.retryable,
          errorDetails: errorMetadata.details,
          errorTimestamp: errorMetadata.timestamp
        }
      }, chatId);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to handle workflow error', {
        chatId,
        errorMetadata,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }
  
  /**
   * Notify about workflow recovery
   * 
   * @param chatId The chat ID
   * @param recoveryPath The recovery path
   * @param timestamp Optional timestamp for the notification
   * @returns Promise resolving to success status
   */
  async notifyWorkflowRecovery(
    chatId: UUID,
    recoveryPath: string,
    timestamp: string = new Date().toISOString()
  ): Promise<boolean> {
    try {
      await this.saveMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Recovering workflow to ${recoveryPath.replace(/_/g, ' ')} state.`,
        createdAt: new Date(timestamp),
        metadata: {
          type: 'system',
          isRecovery: true,
          recoveryPath,
          recoveryTimestamp: timestamp
        }
      }, chatId);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to notify about workflow recovery', {
        chatId,
        recoveryPath,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }
  
  /**
   * Notify about workflow recovery failure
   * 
   * @param chatId The chat ID
   * @param error The error that occurred during recovery
   * @returns Promise resolving to success status
   */
  async notifyWorkflowRecoveryFailure(
    chatId: UUID,
    error: unknown
  ): Promise<boolean> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await this.saveMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Failed to recover workflow: ${errorMessage}`,
        createdAt: new Date(),
        metadata: {
          type: 'error',
          isError: true,
          isRecoveryFailure: true
        }
      }, chatId);
      
      return true;
    } catch (secondaryError) {
      this.logger.error('Failed to notify about workflow recovery failure', {
        chatId,
        originalError: error,
        secondaryError: secondaryError instanceof Error ? secondaryError.message : String(secondaryError)
      });
      
      return false;
    }
  }
  
  /**
   * Process chat intent based on the intent type
   * PHASE 3 IMPLEMENTATION: This method was moved from workflow-coordinator.ts to properly 
   * encapsulate business logic in the domain service.
   *
   * @param intentType The classified intent type
   * @param workflowContext The current workflow context
   * @param context Request context details including message, userId, etc.
   */
  async processIntent(
    intentType: string,
    workflowContext: Record<string, any>,
    context: {
      workflowId: string;
      chatId: string;
      message: string;
      userId: string;
      patientId?: string;
      documentId?: string;
    }
  ): Promise<{
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    const { chatIntentParser } = await import('./chat-intent-parser');
    const moduleLogger = this.logger.withMetadata({ 
      method: 'processIntent',
      intentType,
      chatId: context.chatId,
      workflowId: context.workflowId
    });
    
    moduleLogger.info('Processing chat intent', { 
      messagePreview: context.message.substring(0, 50),
      userId: context.userId
    });
    
    try {
      // Import required services
      const { verificationService } = await import('@/lib/services/verification/verification-service');
      const { reportService } = await import('@/lib/services/report/report-service');
      const { researchService } = await import('@/lib/services/research/research-service');
      
      // Process based on intent type
      switch (intentType) {
        case 'verify_confirm':
          if (workflowContext.verificationId) {
            // Delegate to verification service
            const verificationResult = await verificationService.completeVerification(
              context.workflowId,
              true, // isApproved
              {
                userId: context.userId,
                verificationId: workflowContext.verificationId
              }
            );
            
            // Handle chat notification
            if (verificationResult.success) {
              await this.notifyChatOfVerification(
                context.chatId,
                'completed',
                workflowContext.verificationId
              );
            }
            
            return {
              success: verificationResult.success,
              data: verificationResult.data,
              error: verificationResult.message
            };
          }
          return { success: false, error: 'No verification ID found in context' };
          
        case 'verify_correct':
          if (workflowContext.verificationId && workflowContext.corrections) {
            // Delegate to verification service
            const correctionResult = await verificationService.processCorrection({
              workflowId: context.workflowId,
              userId: context.userId,
              verificationId: workflowContext.verificationId,
              corrections: workflowContext.corrections,
              correctionText: context.message
            });
            
            // Handle chat-specific processing
            if (correctionResult.success) {
              await this.processCorrectionMessage(
                context.message,
                context.chatId,
                context.workflowId,
                workflowContext.verificationId,
                context.userId
              );
            }
            
            return {
              success: correctionResult.success,
              data: correctionResult.data,
              error: correctionResult.message
            };
          }
          return { success: false, error: 'Missing verification ID or corrections in context' };
          
        case 'research_request':
          // Delegate to research service
          const researchResult = await researchService.executeResearch({
            userId: context.userId,
            query: workflowContext.query || context.message,
            patientId: context.patientId,
            workflowId: context.workflowId,
            includeCitations: true
          });
          
          // Handle chat notification
          if (researchResult.success) {
            await this.handleResearchCompletion(
              context.chatId,
              researchResult.data.researchId,
              researchResult.data.content
            );
          }
          
          return {
            success: researchResult.success,
            data: researchResult.data,
            error: researchResult.error?.message
          };
          
        case 'generate_report':
          if (workflowContext.documentId || workflowContext.verificationId || context.documentId) {
            // Delegate to report service
            const reportResult = await reportService.generateReport({
              userId: context.userId,
              documentId: workflowContext.documentId || context.documentId,
              patientId: context.patientId,
              verificationId: workflowContext.verificationId,
              workflowId: context.workflowId
            });
            
            // Handle chat notification
            if (reportResult.success) {
              await this.handleReportCompletion(
                context.chatId,
                reportResult.data.reportId,
                reportResult.data.summary
              );
            }
            
            return {
              success: reportResult.success,
              data: reportResult.data,
              error: reportResult.error?.message
            };
          }
          return { success: false, error: 'Missing document or verification ID in context' };
          
        case 'regular_message':
        default:
          // Process regular message
          const messageResult = await this.processMessage(
            context.message,
            context.chatId,
            {
              userId: context.userId,
              patientId: context.patientId,
              documentId: context.documentId,
              workflowId: context.workflowId
            }
          );
          
          return {
            success: true,
            data: { messageId: messageResult.id }
          };
      }
    } catch (error) {
      moduleLogger.error('Failed to process chat intent', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Utility to handle Result pattern consistently
 *
 * This utility can be used to transition from exception-based to Result-based methods
 * while maintaining backward compatibility.
 */
export async function wrapWithResult<T>(
  operation: () => Promise<Result<T>>,
  errorMessage: string,
  errorCode: string,
  context?: Record<string, unknown>
): Promise<T> {
  const result = await operation();
  
  if (result.isSuccess()) {
    return result.value;
  }
  
  // Convert Result.failure to exception for backward compatibility
  if (isResultError(result.error)) {
    throw new ApplicationError({
      message: result.error.message,
      code: result.error.code,
      data: result.error.details || context || {}
    });
  } else {
    throw new ApplicationError({
      message: errorMessage,
      code: errorCode,
      data: context || {}
    });
  }
}

/**
 * Singleton instance of the ChatService
 */
export const chatService = new ChatService();