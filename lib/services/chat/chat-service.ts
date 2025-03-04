import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { createBrowserClient } from '@/lib/supabase/clients'
import type { 
  ChatMessage,
  Message,
  MessageMetadata,
  ChatMessageType 
} from '@/lib/chat/types'
import { 
  ApplicationError, 
  NotFoundError, 
  SystemError, 
  ValidationError 
} from '@/lib/errors'
import { UUID } from '@/lib/types'

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
 * Service for managing chat persistence and retrieval
 */
export class ChatService {
  private supabase: SupabaseClient<Database>

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
   * @returns Promise resolving to the new chat ID, or null if creation failed
   * @throws {SystemError} If the creation fails
   */
  async createChat(
    userId: string,
    initialMetadata: Record<string, unknown> = {}
  ): Promise<UUID | null> {
    try {
      if (!userId) {
        throw new ValidationError({
          message: 'User ID is required to create a chat',
          code: 'CHAT_MISSING_USER_ID'
        });
      }
      
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
        throw new SystemError({
          message: `Error creating chat: ${error.message}`,
          code: 'CHAT_CREATION_FAILED',
          cause: error,
          data: { userId }
        });
      }

      if (!data) {
        throw new SystemError({
          message: 'Chat creation did not return data',
          code: 'CHAT_CREATION_NO_DATA',
          data: { userId }
        });
      }

      return data.id as UUID;
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new SystemError({
        message: `Failed to create chat: ${error instanceof Error ? error.message : String(error)}`,
        code: 'CHAT_CREATION_FAILED',
        cause: error,
        data: { userId }
      });
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
  async saveMessage(message: Message, chatId: UUID): Promise<UUID | null> {
    try {
      if (!chatId) {
        throw new ValidationError({
          message: 'Chat ID is required to save a message',
          code: 'CHAT_MESSAGE_MISSING_CHAT_ID'
        });
      }
      
      // Validate message
      const validationError = this.getMessageValidationErrors(message);
      if (validationError) {
        throw new ValidationError({
          message: validationError,
          code: 'CHAT_MESSAGE_INVALID',
          data: { chatId }
        });
      }

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
          message: `Error saving message: ${error.message}`,
          code: 'CHAT_MESSAGE_SAVE_FAILED',
          cause: error,
          data: { chatId }
        });
      }

      if (!data) {
        throw new SystemError({
          message: 'Message save did not return data',
          code: 'CHAT_MESSAGE_SAVE_NO_DATA',
          data: { chatId }
        });
      }

      // Update chat's last activity timestamp
      try {
        await this.updateChatLastActivity(chatId);
      } catch (activityError) {
        // Log but don't fail the operation if updating activity fails
        console.warn('Failed to update chat activity:', activityError);
      }

      return data.id as UUID;
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new SystemError({
        message: `Failed to save message: ${error instanceof Error ? error.message : String(error)}`,
        code: 'CHAT_MESSAGE_SAVE_FAILED',
        cause: error,
        data: { chatId }
      });
    }
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
   * @returns Promise resolving to an array of messages
   * @throws {NotFoundError} If the chat doesn't exist
   * @throws {SystemError} If fetching fails
   */
  async getChatMessages(chatId: UUID): Promise<Message[]> {
    try {
      if (!chatId) {
        throw new ValidationError({
          message: 'Chat ID is required to get messages',
          code: 'CHAT_MESSAGES_MISSING_CHAT_ID'
        });
      }

      // First check if chat exists
      const { data: chatData, error: chatError } = await this.supabase
        .from('chats')
        .select('id')
        .eq('id', chatId)
        .single();
        
      if (chatError && chatError.code === 'PGRST116') {
        throw new NotFoundError({
          message: `Chat with ID ${chatId} not found`,
          resource: 'Chat',
          code: 'CHAT_NOT_FOUND',
          data: { chatId }
        });
      }
      
      if (chatError) {
        throw new SystemError({
          message: `Error checking chat existence: ${chatError.message}`,
          code: 'CHAT_FETCH_ERROR',
          cause: chatError,
          data: { chatId }
        });
      }

      const { data, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new SystemError({
          message: `Error fetching chat messages: ${error.message}`,
          code: 'CHAT_MESSAGES_FETCH_FAILED',
          cause: error,
          data: { chatId }
        });
      }

      return (data || []).map(msg => this.dbMessageToMessage(msg as DbChatMessage));
    } catch (error) {
      if (error instanceof ApplicationError) {
        throw error;
      }
      
      throw new SystemError({
        message: `Failed to fetch chat messages: ${error instanceof Error ? error.message : String(error)}`,
        code: 'CHAT_MESSAGES_FETCH_FAILED',
        cause: error,
        data: { chatId }
      });
    }
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
    return {
      id: crypto.randomUUID(),
      content,
      role,
      createdAt: new Date(),
      metadata
    };
  }
}

/**
 * Singleton instance of the ChatService
 */
export const chatService = new ChatService();