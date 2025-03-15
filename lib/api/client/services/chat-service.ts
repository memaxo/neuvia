import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase';
import { createBrowserClient } from '@/lib/supabase/clients';
import type { 
  ChatMessage,
  Message,
  MessageMetadata,
  ChatMessageType
} from '@/lib/types/chat';
import { 
  createSystemMessage,
  createUserMessage,
  createAssistantMessage,
  createMessage,
  createProgressMessage
} from '@/lib/types/chat';
import {
  ApplicationError,
  NotFoundError,
  SystemError,
  ValidationError
} from '@/lib/errors';
import type { UUID } from '@/lib/types/base';
import { CHAT_ERROR_CODES } from '@/lib/errors/error-codes';
import { ProcessingPhase } from '@/lib/types/workflow';
import logger from '@/lib/logger';
import { Result } from '@/lib/services/workflow/error/result';
import { normalizeError } from '@/lib/errors';

interface DbChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export function isValidMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const msg = value as Partial<Message>;
  return (
    typeof msg.content === 'string' &&
    (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system' || msg.role === 'function')
  );
}

export function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!isValidMessage(value)) return false;
  const chatMsg = value as Partial<ChatMessage>;
  if (chatMsg.metadata !== undefined) {
    if (typeof chatMsg.metadata !== 'object' || chatMsg.metadata === null) {
      return false;
    }
  }
  return true;
}

export class ChatService {
  private supabase: SupabaseClient<Database>;
  private readonly logger = logger.withMetadata({ module: 'ChatService' });

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient();
  }

  async createChat(
    userId: string,
    initialMetadata: Record<string, unknown> = {}
  ): Promise<Result<UUID>> {
    if (!userId) {
      return Result.failure('User ID is required to create a chat', CHAT_ERROR_CODES.CREATION_FAILED, { userId });
    }
    try {
      const timestamp = new Date().toISOString();
      const { data, error } = await this.supabase
        .from('chats')
        .insert({
          user_id: userId,
          metadata: { ...initialMetadata, createdAt: timestamp, updatedAt: timestamp }
        })
        .select('id')
        .single();
      if (error) {
        return Result.failure(`Error creating chat: ${error.message}`, CHAT_ERROR_CODES.CREATION_FAILED, { userId, supabaseError: error });
      }
      if (!data) {
        return Result.failure('Chat creation did not return data', CHAT_ERROR_CODES.CREATION_FAILED, { userId });
      }
      return Result.success(data.id as UUID);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to create chat', { userId, error: normalizedError.message });
      return Result.failure(`Failed to create chat: ${normalizedError.message}`, normalizedError.code || CHAT_ERROR_CODES.CREATION_FAILED, { userId, originalError: normalizedError });
    }
  }

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
          created_at: message.createdAt ? new Date(message.createdAt).toISOString() : new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) {
        throw new SystemError({ message: `Error sending message: ${error.message}`, code: CHAT_ERROR_CODES.MESSAGE_FAILED, cause: error, data: { chatId } });
      }
      if (!data) {
        throw new SystemError({ message: 'Message save did not return data', code: CHAT_ERROR_CODES.MESSAGE_FAILED, data: { chatId } });
      }
      this.updateChatLastActivity(chatId).catch(err => {
        this.logger.warn('Failed to update chat activity', { chatId, error: err instanceof Error ? err.message : String(err) });
      });
      return data.id as UUID;
    });
  }

  private getMessageValidationErrors(message: unknown): string | null {
    if (!message || typeof message !== 'object') {
      return 'Message must be an object';
    }
    const msg = message as Partial<Message>;
    if (typeof msg.content !== 'string') {
      return 'Message content must be a string';
    }
    if (!(msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system' || msg.role === 'function')) {
      return 'Message role must be user, assistant, system, or function';
    }
    if (msg.metadata !== undefined && (typeof msg.metadata !== 'object' || msg.metadata === null)) {
      return 'Message metadata must be an object if provided';
    }
    return null;
  }

  async saveMessages(messages: Message[], chatId: UUID): Promise<Result<number>> {
    try {
      if (!chatId) {
        throw new ValidationError({ message: 'Chat ID is required to save messages', code: 'CHAT_MESSAGES_MISSING_CHAT_ID' });
      }
      if (!Array.isArray(messages)) {
        throw new ValidationError({ message: 'Messages must be an array', code: 'CHAT_MESSAGES_INVALID_FORMAT', data: { chatId } });
      }
      if (messages.length === 0) {
        return Result.success(0);
      }
      for (let i = 0; i < messages.length; i++) {
        const errMsg = this.getMessageValidationErrors(messages[i]);
        if (errMsg) {
          throw new ValidationError({ message: `Message at index ${i} is invalid: ${errMsg}`, code: 'CHAT_MESSAGE_INVALID', data: { chatId, messageIndex: i } });
        }
      }
      const messagesToInsert = messages.map(msg => ({
        chat_id: chatId,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata || {},
        created_at: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
      }));
      const { data, error } = await this.supabase
        .from('chat_messages')
        .insert(messagesToInsert)
        .select('id');
      if (error) {
        throw new SystemError({ message: `Error saving messages batch: ${error.message}`, code: 'CHAT_MESSAGES_SAVE_FAILED', cause: error, data: { chatId, messageCount: messages.length } });
      }
      await this.updateChatLastActivity(chatId).catch(err => {
        this.logger.warn('Failed to update chat activity', { chatId, error: err instanceof Error ? err.message : String(err) });
      });
      return Result.success(data?.length || 0);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return Result.failure(error.message, error.code, error.data);
      }
      throw new SystemError({ message: `Failed to save messages batch: ${error instanceof Error ? error.message : String(error)}`, code: 'CHAT_MESSAGES_SAVE_FAILED', cause: error, data: { chatId, messageCount: messages.length } });
    }
  }

  private dbMessageToMessage(dbMessage: DbChatMessage): Message {
    return {
      id: dbMessage.id,
      role: dbMessage.role,
      content: dbMessage.content,
      createdAt: new Date(dbMessage.created_at),
      metadata: dbMessage.metadata || {},
    };
  }

  async getChatMessages(chatId: UUID): Promise<Result<Message[]>> {
    if (!chatId) {
      return Result.failure('Chat ID is required to get messages', 'CHAT_MESSAGES_MISSING_CHAT_ID', { chatId });
    }
    try {
      const { data: chatData, error: chatError } = await this.supabase
        .from('chats')
        .select('id')
        .eq('id', chatId)
        .single();
      if (chatError && chatError.code === 'PGRST116') {
        return Result.failure(`Chat with ID ${chatId} not found`, 'CHAT_NOT_FOUND', { chatId, resource: 'Chat' });
      }
      if (chatError) {
        return Result.failure(`Error checking chat existence: ${chatError.message}`, 'CHAT_FETCH_ERROR', { chatId, supabaseError: chatError });
      }
      const { data, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (error) {
        return Result.failure(`Error fetching chat messages: ${error.message}`, 'CHAT_MESSAGES_FETCH_FAILED', { chatId, supabaseError: error });
      }
      const messages = (data || []).map(msg => this.dbMessageToMessage(msg as DbChatMessage));
      return Result.success(messages);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to fetch chat messages', { chatId, error: normalizedError.message });
      return Result.failure(`Failed to fetch chat messages: ${normalizedError.message}`, normalizedError.code || 'CHAT_MESSAGES_FETCH_FAILED', { chatId, originalError: normalizedError });
    }
  }

  async updateChatLastActivity(chatId: UUID): Promise<Result<void>> {
    try {
      if (!chatId) {
        return Result.failure('Chat ID is required to update last activity', 'CHAT_ACTIVITY_MISSING_ID');
      }
      const { error, count } = await this.supabase
        .from('chats')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', chatId);
      if (error) {
        return Result.failure(`Error updating chat activity: ${error.message}`, 'CHAT_ACTIVITY_UPDATE_FAILED', { chatId });
      }
      if (count === 0) {
        return Result.failure(`Chat with ID ${chatId} not found`, 'CHAT_NOT_FOUND', { chatId });
      }
      return Result.success(undefined);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to update chat last activity', { chatId, error: normalizedError.message });
      return Result.failure(`Failed to update chat last activity: ${normalizedError.message}`, normalizedError.code || 'CHAT_ACTIVITY_UPDATE_FAILED', { chatId });
    }
  }

  async updateChatMetadata(chatId: UUID, metadata: Record<string, unknown>): Promise<Result<void>> {
    try {
      if (!chatId) {
        throw new ValidationError({ message: 'Chat ID is required to update metadata', code: 'CHAT_METADATA_MISSING_ID' });
      }
      if (!metadata || typeof metadata !== 'object' || metadata === null) {
        throw new ValidationError({ message: 'Metadata must be a valid object', code: 'CHAT_METADATA_INVALID', data: { chatId } });
      }
      const { data: existingData, error: fetchError } = await this.supabase
        .from('chats')
        .select('metadata')
        .eq('id', chatId)
        .single();
      if (fetchError && fetchError.code === 'PGRST116') {
        throw new NotFoundError({ message: `Chat with ID ${chatId} not found`, resource: 'Chat', code: 'CHAT_NOT_FOUND', data: { chatId } });
      }
      if (fetchError) {
        throw new SystemError({ message: `Error fetching existing chat metadata: ${fetchError.message}`, code: 'CHAT_METADATA_FETCH_FAILED', cause: fetchError, data: { chatId } });
      }
      const existingMetadata = existingData?.metadata || {};
      const timestamp = new Date().toISOString();
      const { error, count } = await this.supabase
        .from('chats')
        .update({ metadata: { ...existingMetadata, ...metadata, updatedAt: timestamp }, last_activity_at: timestamp })
        .eq('id', chatId);
      if (error) {
        throw new SystemError({ message: `Error updating chat metadata: ${error.message}`, code: 'CHAT_METADATA_UPDATE_FAILED', cause: error, data: { chatId } });
      }
      if (count === 0) {
        throw new NotFoundError({ message: `Chat with ID ${chatId} not found or was deleted during update`, resource: 'Chat', code: 'CHAT_NOT_FOUND_DURING_UPDATE', data: { chatId } });
      }
      return Result.success(undefined);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return Result.failure(error.message, error.code, error.data);
      }
      const normalizedError = normalizeError(error);
      return Result.failure(`Failed to update chat metadata: ${normalizedError.message}`, normalizedError.code || 'CHAT_METADATA_UPDATE_FAILED', { chatId });
    }
  }

  async archiveChat(chatId: UUID): Promise<Result<void>> {
    try {
      if (!chatId) {
        throw new ValidationError({ message: 'Chat ID is required to archive a chat', code: 'CHAT_ARCHIVE_MISSING_ID' });
      }
      const timestamp = new Date().toISOString();
      const { error, count } = await this.supabase
        .from('chats')
        .update({ is_archived: true, archived_at: timestamp, last_activity_at: timestamp })
        .eq('id', chatId);
      if (error) {
        throw new SystemError({ message: `Error archiving chat: ${error.message}`, code: 'CHAT_ARCHIVE_FAILED', cause: error, data: { chatId } });
      }
      if (count === 0) {
        throw new NotFoundError({ message: `Chat with ID ${chatId} not found`, resource: 'Chat', code: 'CHAT_NOT_FOUND', data: { chatId } });
      }
      return Result.success(undefined);
    } catch (error) {
      const normalizedError = normalizeError(error);
      return Result.failure(`Failed to archive chat: ${normalizedError.message}`, normalizedError.code || 'CHAT_ARCHIVE_FAILED', { chatId });
    }
  }

  async deleteChat(chatId: UUID): Promise<Result<void>> {
    try {
      if (!chatId) {
        throw new ValidationError({ message: 'Chat ID is required to delete a chat', code: 'CHAT_DELETE_MISSING_ID' });
      }
      const { data: chatData, error: checkError } = await this.supabase
        .from('chats')
        .select('id')
        .eq('id', chatId)
        .single();
      if (checkError && checkError.code === 'PGRST116') {
        throw new NotFoundError({ message: `Chat with ID ${chatId} not found`, resource: 'Chat', code: 'CHAT_NOT_FOUND', data: { chatId } });
      }
      if (checkError) {
        throw new SystemError({ message: `Error checking chat existence: ${checkError.message}`, code: 'CHAT_DELETE_CHECK_FAILED', cause: checkError, data: { chatId } });
      }
      const { error: messagesError } = await this.supabase
        .from('chat_messages')
        .delete()
        .eq('chat_id', chatId);
      if (messagesError) {
        throw new SystemError({ message: `Error deleting chat messages: ${messagesError.message}`, code: 'CHAT_MESSAGES_DELETE_FAILED', cause: messagesError, data: { chatId } });
      }
      const { error: chatError, count } = await this.supabase
        .from('chats')
        .delete()
        .eq('id', chatId);
      if (chatError) {
        throw new SystemError({ message: `Error deleting chat: ${chatError.message}`, code: 'CHAT_DELETE_FAILED', cause: chatError, data: { chatId } });
      }
      if (count === 0) {
        throw new NotFoundError({ message: `Chat with ID ${chatId} not found or was already deleted`, resource: 'Chat', code: 'CHAT_NOT_FOUND_DURING_DELETE', data: { chatId } });
      }
      return Result.success(undefined);
    } catch (error) {
      const normalizedError = normalizeError(error);
      return Result.failure(`Failed to delete chat: ${normalizedError.message}`, normalizedError.code || 'CHAT_DELETE_FAILED', { chatId });
    }
  }

  async updateMessage(messageId: UUID, updates: Partial<Omit<Message, 'id'>>): Promise<Result<void>> {
    try {
      if (!messageId) {
        throw new ValidationError({ message: 'Message ID is required to update a message', code: 'MESSAGE_UPDATE_MISSING_ID' });
      }
      if (!updates || typeof updates !== 'object') {
        throw new ValidationError({ message: 'Updates must be a valid object', code: 'MESSAGE_UPDATE_INVALID', data: { messageId } });
      }
      const updateObject: Record<string, unknown> = {};
      if (updates.content !== undefined) {
        if (typeof updates.content !== 'string') {
          throw new ValidationError({ message: 'Message content must be a string', code: 'MESSAGE_UPDATE_INVALID_CONTENT', data: { messageId } });
        }
        updateObject.content = updates.content;
      }
      if (updates.metadata !== undefined) {
        const { data: currentMessage, error: fetchError } = await this.supabase
          .from('chat_messages')
          .select('metadata')
          .eq('id', messageId)
          .single();
        if (fetchError && fetchError.code === 'PGRST116') {
          throw new NotFoundError({ message: `Message with ID ${messageId} not found`, resource: 'Message', code: 'MESSAGE_NOT_FOUND', data: { messageId } });
        }
        if (fetchError) {
          throw new SystemError({ message: `Error fetching message metadata: ${fetchError.message}`, code: 'MESSAGE_METADATA_FETCH_FAILED', cause: fetchError, data: { messageId } });
        }
        updateObject.metadata = { ...(currentMessage?.metadata || {}), ...updates.metadata };
      }
      if (Object.keys(updateObject).length > 0) {
        const { error, count } = await this.supabase
          .from('chat_messages')
          .update(updateObject)
          .eq('id', messageId);
        if (error) {
          throw new SystemError({ message: `Error updating message: ${error.message}`, code: 'MESSAGE_UPDATE_FAILED', cause: error, data: { messageId } });
        }
        if (count === 0) {
          throw new NotFoundError({ message: `Message with ID ${messageId} not found or was deleted during update`, resource: 'Message', code: 'MESSAGE_NOT_FOUND_DURING_UPDATE', data: { messageId } });
        }
      }
      return Result.success(undefined);
    } catch (error) {
      const normalizedError = normalizeError(error);
      return Result.failure(`Failed to update message: ${normalizedError.message}`, normalizedError.code || 'MESSAGE_UPDATE_FAILED', { messageId });
    }
  }

  async searchMessages(query: string, chatId?: UUID, limit = 20): Promise<Result<Message[]>> {
    try {
      if (!query || typeof query !== 'string') {
        throw new ValidationError({ message: 'Search query is required and must be a string', code: 'MESSAGE_SEARCH_INVALID_QUERY' });
      }
      if (query.length < 2) {
        throw new ValidationError({ message: 'Search query must be at least 2 characters', code: 'MESSAGE_SEARCH_QUERY_TOO_SHORT' });
      }
      const actualLimit = Math.min(Math.max(1, limit), 100);
      let supabaseQuery = this.supabase
        .from('chat_messages')
        .select('*')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(actualLimit);
      if (chatId) {
        supabaseQuery = supabaseQuery.eq('chat_id', chatId);
      }
      const { data, error } = await supabaseQuery;
      if (error) {
        throw new SystemError({ message: `Error searching messages: ${error.message}`, code: 'MESSAGE_SEARCH_FAILED', cause: error, data: { query, chatId, limit: actualLimit } });
      }
      const messages = (data || []).map(msg => this.dbMessageToMessage(msg as DbChatMessage));
      return Result.success(messages);
    } catch (error) {
      const normalizedError = normalizeError(error);
      return Result.failure(`Failed to search messages: ${normalizedError.message}`, normalizedError.code || 'MESSAGE_SEARCH_FAILED', { query, chatId, limit });
    }
  }

  async addSystemNotification(chatId: UUID, content: string, metadata?: Record<string, any>): Promise<Result<UUID>> {
    try {
      const message = createSystemMessage(content, { ...metadata });
      const result = await this.saveMessage(message, chatId);
      if (result.isFailure()) {
        return Result.failure(result.error.message, result.error.code, result.error.details);
      }
      return Result.success(message.id);
    } catch (error) {
      this.logger.error('Failed to add system notification', { chatId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to add system notification', 'SYSTEM_NOTIFICATION_FAILED', { chatId });
    }
  }

  async processCorrectionMessage(message: string, chatId: string, workflowId: string, verificationId: string, userId: string): Promise<Result<string>> {
    try {
      const corrections = this.parseCorrectionData(message);
      if (!corrections || Object.keys(corrections).length === 0) {
        return Result.failure('No valid corrections found in message', 'CORRECTION_NOT_FOUND');
      }
      const processingMessage = createProgressMessage('Processing your corrections...', 0, 'correction_processing');
      const saveResult = await this.saveMessage(processingMessage, chatId as UUID);
      if (saveResult.isFailure()) {
        return Result.failure(saveResult.error.message, saveResult.error.code, saveResult.error.details);
      }
      const processingMessageId = processingMessage.id;
      const updateProgressResult = await this.updateMessageProgress(processingMessageId, 50, 'correction_verification');
      if (updateProgressResult.isFailure()) {
        return Result.failure(updateProgressResult.error.message, updateProgressResult.error.code, updateProgressResult.error.details);
      }
      const summaryContent = `I've updated the information with your corrections:\n\n${Object.entries(corrections).map(([field, value]) => \`- \${field}: \${value}\`).join('\n')}`;
      const summaryMessage = createMessage('assistant', summaryContent, ChatMessageType.SUMMARY, { correctionData: corrections });
      const saveSummaryResult = await this.saveMessage(summaryMessage, chatId as UUID);
      if (saveSummaryResult.isFailure()) {
        return Result.failure(saveSummaryResult.error.message, saveSummaryResult.error.code, saveSummaryResult.error.details);
      }
      const summaryMessageId = summaryMessage.id;
      const completeProgressResult = await this.updateMessageProgress(processingMessageId, 100, 'correction_complete');
      if (completeProgressResult.isFailure()) {
        return Result.failure(completeProgressResult.error.message, completeProgressResult.error.code, completeProgressResult.error.details);
      }
      return Result.success(summaryMessageId);
    } catch (error) {
      this.logger.error('Error processing correction message', { chatId, workflowId, verificationId, error: error instanceof Error ? error.message : String(error) });
      const normalizedError = normalizeError(error);
      return Result.failure(normalizedError.message, normalizedError.code || 'CORRECTION_PROCESSING_FAILED');
    }
  }

  async updateMessageProgress(messageId: string, progress: number, phase: string): Promise<Result<boolean>> {
    try {
      if (!messageId) throw new Error('Message ID is required');
      await this.updateMessage(messageId as UUID, { metadata: { progress: { value: progress, phase, updatedAt: new Date().toISOString() } } });
      return Result.success(true);
    } catch (error) {
      this.logger.error('Failed to update message progress', { messageId, progress, phase, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to update message progress', 'MESSAGE_PROGRESS_UPDATE_FAILED');
    }
  }

  async addProgressMessage(chatId: UUID, phase: string): Promise<Result<UUID>> {
    try {
      const message = createProgressMessage(`Processing your ${phase} request...`, 10, phase);
      const result = await this.saveMessage(message, chatId);
      if (result.isFailure()) {
        return Result.failure(result.error.message, result.error.code, result.error.details);
      }
      return Result.success(message.id);
    } catch (error) {
      this.logger.error('Failed to create progress message', { chatId, phase, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to create progress message', 'PROGRESS_MESSAGE_FAILED', { chatId, phase });
    }
  }

  async completeProgressMessage(chatId: UUID, messageId: UUID): Promise<Result<boolean>> {
    try {
      const updateResult = await this.updateMessageProgress(messageId, 100, ProcessingPhase.COMPLETION.toString());
      if (updateResult.isFailure()) return updateResult;
      setTimeout(async () => {
        await this.updateMessage(messageId, { content: 'Request processed successfully.', metadata: { type: 'system', completed: true, completedAt: new Date().toISOString() } });
      }, 500);
      return Result.success(true);
    } catch (error) {
      this.logger.error('Failed to complete progress message', { chatId, messageId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to complete progress message', 'PROGRESS_MESSAGE_COMPLETE_FAILED');
    }
  }

  async createWelcomeMessage(chatId: UUID): Promise<Result<UUID>> {
    try {
      const message = createAssistantMessage('Hello! How can I help you today?', { type: ChatMessageType.SYSTEM, isWelcomeMessage: true });
      const result = await this.saveMessage(message, chatId);
      if (result.isFailure()) {
        return Result.failure(result.error.message, result.error.code, result.error.details);
      }
      return Result.success(message.id);
    } catch (error) {
      this.logger.error('Failed to create welcome message', { chatId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to create welcome message', 'WELCOME_MESSAGE_FAILED', { chatId });
    }
  }

  async getMessagesByEntity(entityType: string, entityId: string): Promise<Result<Message[]>> {
    try {
      if (!entityType || !entityId) throw new Error('Entity type and ID are required');
      const { data, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .filter(`metadata->${entityType}_id`, 'eq', entityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const messages = (data || []).map(msg => this.dbMessageToMessage(msg as DbChatMessage));
      return Result.success(messages);
    } catch (error) {
      this.logger.error('Failed to get messages by entity', { entityType, entityId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure(`Failed to get messages by entity: ${error instanceof Error ? error.message : String(error)}`, 'MESSAGE_BY_ENTITY_FAILED', { entityType, entityId });
    }
  }

  async getWorkflowIdForChat(chatId: UUID): Promise<Result<string | null>> {
    try {
      if (!chatId) throw new Error('Chat ID is required');
      const { data, error } = await this.supabase
        .from('workflow_states')
        .select('id')
        .eq('chat_id', chatId)
        .maybeSingle();
      if (error) throw error;
      return Result.success(data?.id || null);
    } catch (error) {
      this.logger.error('Failed to get workflow ID for chat', { chatId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure(`Failed to get workflow ID for chat: ${error instanceof Error ? error.message : String(error)}`, 'WORKFLOW_ID_FETCH_FAILED', { chatId });
    }
  }

  async createChatWithWorkflow(userId: string, initialMetadata: Record<string, unknown> = {}): Promise<Result<{ chatId: UUID; workflowId: string }>> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      const chatResult = await this.createChat(userId, initialMetadata);
      if (chatResult.isFailure()) return Result.failure(chatResult.error.message, chatResult.error.code, chatResult.error.details);
      const chatId = chatResult.value;
      const timestamp = new Date().toISOString();
      const { data, error } = await this.supabase
        .from('workflow_states')
        .insert({
          user_id: userId,
          chat_id: chatId,
          current_step: 'idle',
          metadata: { initializedAt: timestamp, ...initialMetadata }
        })
        .select('id')
        .single();
      if (error) throw error;
      if (!data) throw new Error('Failed to create workflow state');
      return Result.success({ chatId, workflowId: data.id });
    } catch (error) {
      this.logger.error('Failed to create chat with workflow', { userId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure(`Failed to create chat with workflow: ${error instanceof Error ? error.message : String(error)}`, 'CHAT_WITH_WORKFLOW_FAILED', { userId });
    }
  }

  async generateAssistantResponse(message: string, options: { workflowId: string; chatId: string; context: Record<string, any>; model?: string; patientId?: string; documentId?: string; userId: string; }): Promise<string> {
    try {
      const isResearchModeActive = options.context.isResearchModeActive;
      const isVerificationModeActive = options.context.isVerificationModeActive;
      const isReportModeActive = options.context.isReportModeActive;
      const currentTime = new Date().toLocaleTimeString();
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
      return `This is a simulated assistant response to: "${message}".
      
I'm using the ${options.model || 'default'} model. The current time is ${currentTime}.
      
Here are some details from the context:
${options.patientId ? \`- Patient ID: \${options.patientId}\` : ''}
${options.documentId ? \`- Document ID: \${options.documentId}\` : ''}
      
Is there anything else you'd like to know?`;
    } catch (error) {
      this.logger.error('Error generating assistant response', { workflowId: options.workflowId, chatId: options.chatId, error: error instanceof Error ? error.message : String(error) });
      return `I apologize, but I encountered an error while processing your request. Please try again.`;
    }
  }

  async processIntent(intentType: string, workflowContext: Record<string, any>, context: { workflowId: string; chatId: string; message: string; userId: string; patientId?: string; documentId?: string; }): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string; }> {
    const moduleLogger = this.logger.withMetadata({ method: 'processIntent', intentType, chatId: context.chatId, workflowId: context.workflowId });
    moduleLogger.info('Processing chat intent', { messagePreview: context.message.substring(0, 50), userId: context.userId });
    try {
      const { verificationService } = await import('@/lib/services/verification/verification-service');
      const { reportService } = await import('@/lib/services/report/report-service');
      const { researchService } = await import('@/lib/services/research/research-service');
      switch (intentType) {
        case 'verify_confirm':
          if (workflowContext.verificationId) {
            const verificationResult = await verificationService.completeVerification(context.workflowId, true, { userId: context.userId, verificationId: workflowContext.verificationId });
            if (verificationResult.success) {
              await this.notifyChatOfVerification(context.chatId, 'completed', workflowContext.verificationId);
            }
            return { success: verificationResult.success, data: verificationResult.data, error: verificationResult.message };
          }
          return { success: false, error: 'No verification ID found in context' };
        case 'verify_correct':
          if (workflowContext.verificationId && workflowContext.corrections) {
            const correctionResult = await verificationService.processCorrection({ workflowId: context.workflowId, userId: context.userId, verificationId: workflowContext.verificationId, corrections: workflowContext.corrections, correctionText: context.message });
            if (correctionResult.success) {
              await this.processCorrectionMessage(context.message, context.chatId, context.workflowId, workflowContext.verificationId, context.userId);
            }
            return { success: correctionResult.success, data: correctionResult.data, error: correctionResult.message };
          }
          return { success: false, error: 'Missing verification ID or corrections in context' };
        case 'research_request': {
          const researchResult = await researchService.executeResearch({ userId: context.userId, query: workflowContext.query || context.message, patientId: context.patientId, workflowId: context.workflowId, includeCitations: true });
          if (researchResult.success) {
            await this.handleResearchCompletion(context.chatId, researchResult.data.researchId, researchResult.data.content);
          }
          return { success: researchResult.success, data: researchResult.data, error: researchResult.error?.message };
        }
        case 'generate_report':
          if (workflowContext.documentId || workflowContext.verificationId || context.documentId) {
            const reportResult = await reportService.generateReport({ userId: context.userId, documentId: workflowContext.documentId || context.documentId, patientId: context.patientId, verificationId: workflowContext.verificationId, workflowId: context.workflowId });
            if (reportResult.success) {
              await this.handleReportCompletion(context.chatId, reportResult.data.reportId, reportResult.data.summary);
            }
            return { success: reportResult.success, data: reportResult.data, error: reportResult.error?.message };
          }
          return { success: false, error: 'Missing document or verification ID in context' };
        case 'regular_message':
        default: {
          const msg = createMessage('user', context.message, ChatMessageType.CHAT);
          const messageResult = await this.saveMessage(msg, context.chatId);
          return { success: messageResult.isSuccess(), data: { messageId: messageResult.isSuccess() ? messageResult.value : undefined } };
        }
      }
    } catch (error) {
      moduleLogger.error('Failed to process chat intent', { error });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private parseCorrectionData(message: string): Record<string, string> {
    const corrections: Record<string, string> = {};
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

  async notifyChatOfVerification(chatId: UUID, verificationStatus: 'pending' | 'completed' | 'failed', verificationId: string): Promise<Result<UUID>> {
    try {
      let content = '';
      let messageType: ChatMessageType = ChatMessageType.SYSTEM;
      switch (verificationStatus) {
        case 'pending':
          content = 'Verification is pending. Please review the information and confirm if it\'s correct.';
          break;
        case 'completed':
          content = 'Verification completed successfully!';
          break;
        case 'failed':
          content = 'Verification failed. Please try again or contact support.';
          messageType = ChatMessageType.ERROR;
          break;
      }
      const result = await this.addSystemNotification(chatId, content, { type: messageType, verificationStatus, verificationId });
      return result;
    } catch (error) {
      this.logger.error('Failed to notify chat of verification', { chatId, verificationStatus, verificationId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to notify chat of verification', 'NOTIFY_VERIFICATION_FAILED', { chatId });
    }
  }

  async handleReportCompletion(chatId: UUID, reportId: string, summary?: string): Promise<Result<UUID | null>> {
    try {
      await this.addSystemNotification(chatId, 'Report generated successfully.', { type: ChatMessageType.SYSTEM, reportId, reportGenerated: true, generatedAt: new Date().toISOString() });
      if (summary) {
        const messageId = crypto.randomUUID();
        const summaryMsg: ChatMessage = {
          id: messageId,
          role: 'assistant',
          content: `Here's a summary of the generated report:\n\n${summary}`,
          createdAt: new Date().toISOString(),
          type: ChatMessageType.REPORT,
          metadata: { type: ChatMessageType.REPORT, isReport: true, reportId, format: 'markdown' }
        };
        const saveResult = await this.saveMessage(summaryMsg, chatId);
        if (saveResult.isFailure()) {
          return Result.failure(saveResult.error.message, saveResult.error.code, saveResult.error.details);
        }
        return Result.success(messageId);
      }
      return Result.success(null);
    } catch (error) {
      this.logger.error('Failed to handle report completion', { chatId, reportId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to handle report completion', 'REPORT_COMPLETION_FAILED', { chatId, reportId });
    }
  }

  async handleResearchCompletion(chatId: UUID, researchId: string, findings: string): Promise<Result<UUID | null>> {
    try {
      const messageId = crypto.randomUUID();
      const researchMsg: ChatMessage = {
        id: messageId,
        role: 'assistant',
        content: findings || 'Research completed. Here are the findings:',
        createdAt: new Date().toISOString(),
        type: ChatMessageType.RESEARCH,
        metadata: { type: ChatMessageType.RESEARCH, researchId, researchCompleted: true, completedAt: new Date().toISOString() }
      };
      const saveResult = await this.saveMessage(researchMsg, chatId);
      if (saveResult.isFailure()) {
        return Result.failure(saveResult.error.message, saveResult.error.code, saveResult.error.details);
      }
      return Result.success(messageId);
    } catch (error) {
      this.logger.error('Failed to handle research completion', { chatId, researchId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to handle research completion', 'RESEARCH_COMPLETION_FAILED', { chatId, researchId });
    }
  }

  async updateMessageProgress(messageId: string, progress: number, phase: string): Promise<Result<boolean>> {
    try {
      if (!messageId) throw new Error('Message ID is required');
      await this.updateMessage(messageId as UUID, { metadata: { progress: { value: progress, phase, updatedAt: new Date().toISOString() } } });
      return Result.success(true);
    } catch (error) {
      this.logger.error('Failed to update message progress', { messageId, progress, phase, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to update message progress', 'MESSAGE_PROGRESS_UPDATE_FAILED');
    }
  }

  async addProgressMessage(chatId: UUID, phase: string): Promise<Result<UUID>> {
    try {
      const message = createProgressMessage(`Processing your ${phase} request...`, 10, phase);
      const result = await this.saveMessage(message, chatId);
      if (result.isFailure()) {
        return Result.failure(result.error.message, result.error.code, result.error.details);
      }
      return Result.success(message.id);
    } catch (error) {
      this.logger.error('Failed to create progress message', { chatId, phase, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to create progress message', 'PROGRESS_MESSAGE_FAILED', { chatId, phase });
    }
  }

  async completeProgressMessage(chatId: UUID, messageId: UUID): Promise<Result<boolean>> {
    try {
      const updateResult = await this.updateMessageProgress(messageId, 100, ProcessingPhase.COMPLETION.toString());
      if (updateResult.isFailure()) return updateResult;
      setTimeout(async () => {
        await this.updateMessage(messageId, { content: 'Request processed successfully.', metadata: { type: 'system', completed: true, completedAt: new Date().toISOString() } });
      }, 500);
      return Result.success(true);
    } catch (error) {
      this.logger.error('Failed to complete progress message', { chatId, messageId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to complete progress message', 'PROGRESS_MESSAGE_COMPLETE_FAILED');
    }
  }

  async createWelcomeMessage(chatId: UUID): Promise<Result<UUID>> {
    try {
      const message = createAssistantMessage('Hello! How can I help you today?', { type: ChatMessageType.SYSTEM, isWelcomeMessage: true });
      const result = await this.saveMessage(message, chatId);
      if (result.isFailure()) {
        return Result.failure(result.error.message, result.error.code, result.error.details);
      }
      return Result.success(message.id);
    } catch (error) {
      this.logger.error('Failed to create welcome message', { chatId, error: error instanceof Error ? error.message : String(error) });
      return Result.failure('Failed to create welcome message', 'WELCOME_MESSAGE_FAILED', { chatId });
    }
  }
}

export const chatService = new ChatService();