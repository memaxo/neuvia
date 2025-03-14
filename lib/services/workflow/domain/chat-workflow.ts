/**
 * @fileoverview Chat Workflow Processor
 * 
 * Handles all chat-related workflow operations including:
 * - Chat session management
 * - Message processing
 * - Integration with other workflows
 */

import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowRepository } from '../infrastructure/workflow-repository'
import { BaseWorkflowProcessor } from '../base/base-workflow-processor'
import { Result } from '../error/result'

import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow'
import type { WorkflowProcessOptions } from '../base/base-workflow-processor'

/**
 * Chat message interface
 */
export interface ChatMessage {
  /** Message ID */
  id: string;
  /** Message content */
  content: string;
  /** Message role (user, assistant, system) */
  role: 'user' | 'assistant' | 'system';
  /** Message timestamps */
  timestamp: string;
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chat message input for processing
 */
export interface ChatMessageInput {
  /** Chat ID */
  chatId: string;
  /** Message content */
  message: string;
  /** User ID */
  userId: string;
  /** Message role (defaults to 'user') */
  role?: 'user' | 'assistant' | 'system';
  /** Model to use */
  model?: string;
  /** Patient ID */
  patientId?: string;
  /** Document ID */
  documentId?: string;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
}

/**
 * Chat session result
 */
export interface ChatSessionResult {
  /** Chat ID */
  chatId: string;
  /** User ID */
  userId: string;
  /** Whether operation was successful */
  success: boolean;
  /** Current chat messages */
  messages?: ChatMessage[];
  /** Session metadata */
  metadata: Record<string, unknown>;
  /** Error message if operation failed */
  error?: string;
}

/**
 * Chat start options
 */
export interface ChatStartOptions {
  /** User ID */
  userId: string;
  /** Initial metadata */
  initialMetadata?: Record<string, unknown>;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Transaction ID */
  transactionId?: string;
}

/**
 * Chat workflow processor
 */
export class ChatWorkflow extends BaseWorkflowProcessor<ChatMessageInput | ChatStartOptions, ChatSessionResult> {
  constructor() {
    super('Chat', 'chat_error');
  }
  
  /**
   * Start chat session
   * @returns A Result containing ChatSessionResult if successful, or error details if failed
   */
  async startChatSession(
    workflowId: string,
    chatId: string,
    userId: string,
    initialMetadata: Record<string, unknown> = {}
  ): Promise<Result<ChatSessionResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'workflowId' }
      );
    }
    
    if (!chatId) {
      return Result.failure(
        'Chat ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'chatId' }
      );
    }
    
    if (!userId) {
      return Result.failure(
        'User ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'userId' }
      );
    }
    
    try {
      // Process the chat session start
      const result = await this.process(
        workflowId,
        {
          userId,
          initialMetadata: {
            chatId,
            sessionStartedAt: new Date().toISOString(),
            messages: [],
            ...initialMetadata
          }
        },
        {
          targetStep: 'chat_started',
          metadata: {
            chatId,
            userId,
            sessionStartedAt: new Date().toISOString(),
            messages: [],
            ...initialMetadata
          }
        }
      );
      
      return Result.success(result);
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.error('Failed to start chat session', {
        workflowId,
        chatId,
        userId,
        error: normalizedError.message
      });
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'CHAT_SESSION_START_FAILED',
        {
          workflowId,
          chatId,
          userId,
          originalError: error
        }
      );
    }
  }
  
  /**
   * Process user message
   * @returns A Result containing ChatSessionResult if successful, or error details if failed
   */
  async processMessage(
    workflowId: string,
    chatId: string,
    message: string,
    options: {
      userId: string;
      model?: string;
      patientId?: string;
      documentId?: string;
      role?: 'user' | 'assistant' | 'system';
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
      transactionId?: string;
    }
  ): Promise<Result<ChatSessionResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'workflowId' }
      );
    }
    
    if (!chatId) {
      return Result.failure(
        'Chat ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'chatId' }
      );
    }
    
    if (!message && options.role !== 'system') {
      return Result.failure(
        'Message content is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'message' }
      );
    }
    
    if (!options || !options.userId) {
      return Result.failure(
        'User ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'options.userId' }
      );
    }
    
    try {
      // Process the message
      const result = await this.process(
        workflowId,
        {
          chatId,
          message,
          userId: options.userId,
          role: options.role || 'user',
          model: options.model,
          patientId: options.patientId,
          documentId: options.documentId,
          onProgress: options.onProgress
        },
        {
          targetStep: 'chat_in_progress',
          metadata: {
            chatId,
            userId: options.userId,
            message,
            model: options.model,
            patientId: options.patientId,
            documentId: options.documentId
          },
          onProgress: options.onProgress,
          transactionId: options.transactionId
        }
      );
      
      return Result.success(result);
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.error('Failed to process chat message', {
        workflowId,
        chatId,
        userId: options.userId,
        error: normalizedError.message
      });
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'CHAT_MESSAGE_PROCESSING_FAILED',
        {
          workflowId,
          chatId,
          userId: options.userId,
          messagePreview: message?.substring(0, 50),
          originalError: error
        }
      );
    }
  }
  
  /**
   * Complete chat session
   * @returns A Result containing ChatSessionResult if successful, or error details if failed
   */
  async completeChatSession(
    workflowId: string,
    chatId: string,
    userId: string,
    summary?: string
  ): Promise<Result<ChatSessionResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'workflowId' }
      );
    }
    
    if (!chatId) {
      return Result.failure(
        'Chat ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'chatId' }
      );
    }
    
    if (!userId) {
      return Result.failure(
        'User ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'userId' }
      );
    }
    
    try {
      // Complete the chat session
      const result = await this.process(
        workflowId,
        {
          chatId,
          userId,
          message: '',
          patientId: '',
        },
        {
          targetStep: 'chat_completed',
          metadata: {
            chatId,
            userId,
            sessionCompletedAt: new Date().toISOString(),
            summary
          }
        }
      );
      
      return Result.success(result);
    } catch (error) {
      const normalizedError = normalizeError(error);
      logger.error('Failed to complete chat session', {
        workflowId,
        chatId,
        userId,
        error: normalizedError.message
      });
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'CHAT_SESSION_COMPLETION_FAILED',
        {
          workflowId,
          chatId,
          userId,
          originalError: error
        }
      );
    }
  }
  
  /**
   * Handle chat error
   * @returns A Result containing ChatSessionResult if successful, or error details if failed
   */
  async handleChatError(
    workflowId: string,
    chatId: string,
    error: Error | string,
    context?: Record<string, unknown>
  ): Promise<Result<ChatSessionResult>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'workflowId' }
      );
    }
    
    if (!chatId) {
      return Result.failure(
        'Chat ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'chatId' }
      );
    }
    
    if (!error) {
      return Result.failure(
        'Error information is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'error' }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : error;
    
    try {
      // Process the error
      const result = await this.process(
        workflowId,
        {
          chatId,
          userId: (context?.userId as string) || '',
          message: errorMessage,
          patientId: (context?.patientId as string) || ''
        },
        {
          targetStep: 'chat_error',
          metadata: {
            chatId,
            error: errorMessage,
            errorTimestamp: new Date().toISOString(),
            errorContext: context
          }
        }
      );
      
      return Result.success(result);
    } catch (processingError) {
      // Meta-error: an error occurred while handling an error
      const normalizedError = normalizeError(processingError);
      logger.error('Failed to handle chat error', {
        workflowId,
        chatId,
        originalError: errorMessage,
        processingError: normalizedError.message
      });
      
      return Result.failure(
        `Error handler failed: ${normalizedError.message}`,
        normalizedError.code || 'CHAT_ERROR_HANDLING_FAILED',
        {
          workflowId,
          chatId,
          originalError: errorMessage,
          handlerError: processingError
        }
      );
    }
  }
  
  /**
   * Get chat session - a read-only operation
   * @returns A Result containing ChatSessionResult if successful, or error details if failed
   */
  async getChatSession(
    workflowId: string,
    chatId: string
  ): Promise<Result<ChatSessionResult | null>> {
    // Validate inputs
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'workflowId' }
      );
    }
    
    if (!chatId) {
      return Result.failure(
        'Chat ID is required',
        'CHAT_INVALID_INPUT',
        { parameter: 'chatId' }
      );
    }
    
    try {
      // Get workflow state using Result.fromPromise for error handling
      const stateResult = await Result.fromPromise(
        workflowRepository.getWorkflowState(workflowId)
      );
      
      if (stateResult.isFailure()) {
        return Result.failure(
          `Failed to retrieve workflow state: ${stateResult.error.message}`,
          stateResult.error.code || 'CHAT_STATE_RETRIEVAL_FAILED',
          stateResult.error.details
        );
      }
      
      const state = stateResult.value;
      if (!state) {
        return Result.success(null);
      }
      
      // Check if chat ID matches
      if (state.metadata?.chatId !== chatId) {
        return Result.success(null);
      }
      
      // Get chat data
      const userId = state.metadata?.userId as string;
      const messages = state.metadata?.messages as ChatMessage[];
      
      // Return chat session data
      const chatSession = {
        chatId,
        userId,
        success: true,
        messages,
        metadata: {
          startedAt: state.metadata?.sessionStartedAt,
          lastMessageAt: state.metadata?.lastMessageAt,
          messageCount: messages?.length || 0,
          currentStep: state.currentStep,
          ...state.metadata
        }
      };
      
      return Result.success(chatSession);
    } catch (err) {
      const normalizedError = normalizeError(err);
      logger.error('Failed to get chat session', {
        workflowId,
        chatId,
        error: normalizedError.message
      });
      
      return Result.failure(
        normalizedError.message,
        normalizedError.code || 'CHAT_SESSION_RETRIEVAL_FAILED',
        {
          workflowId,
          chatId,
          originalError: err
        }
      );
    }
  }
  
  /**
   * Implementation of required abstract method for domain-specific processing
   */
  protected async doProcess(
    workflowId: string,
    input: ChatMessageInput | ChatStartOptions,
    currentState: WorkflowState,
    options: WorkflowProcessOptions & {
      progressCallback?: (progress: number, phase: ProcessingPhase) => void;
    }
  ): Promise<ChatSessionResult> {
    const progressCallback = options.progressCallback || (() => {});
    
    // Case 1: Starting a new chat session
    if ('initialMetadata' in input && currentState.currentStep === 'chat_started') {
      // Log session start event
      await this.logEvent(
        workflowId,
        'chat_session_started',
        {
          chatId: input.initialMetadata?.chatId,
          userId: input.userId,
          timestamp: new Date().toISOString(),
          metadata: input.initialMetadata
        }
      );
      
      // Return result
      return {
        chatId: input.initialMetadata?.chatId as string,
        userId: input.userId,
        success: true,
        messages: [],
        metadata: {
          startedAt: new Date().toISOString(),
          ...input.initialMetadata
        }
      };
    }
    // Case 2: Processing a message
    else if ('message' in input && input.message &&
             (currentState.currentStep === 'chat_started' ||
              currentState.currentStep === 'chat_in_progress' ||
              currentState.currentStep === 'chat_completed')) {
      
      // Initial progress update
      progressCallback(20, ProcessingPhase.CHAT_PROCESSING);
      
      // Get current messages
      const currentMessages: ChatMessage[] = currentState.metadata?.messages || [];
      
      // Add user message
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        content: input.message,
        role: input.role || 'user',
        timestamp: new Date().toISOString(),
        metadata: {
          userId: input.userId,
          patientId: input.patientId,
          documentId: input.documentId
        }
      };
      
      const updatedMessages = [...currentMessages, userMessage];
      
      // Update workflow state to add user message
      await workflowStateManager.updateWorkflowState(
        workflowId,
        {
          messages: updatedMessages,
          lastUserMessage: userMessage,
          lastMessageAt: userMessage.timestamp,
          transactionId: options.transactionId
        }
      );
      
      // Initial progress update
      progressCallback(50, ProcessingPhase.CHAT_PROCESSING);
      
      // Simulate assistant response
      const assistantMessageContent = this.simulateAssistantResponse(input.message, {
        model: input.model,
        patientId: input.patientId,
        documentId: input.documentId
      });
      
      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        content: assistantMessageContent,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        metadata: {
          model: input.model,
          processingTime: 1234 // ms
        }
      };
      
      // Final message list with assistant response
      const finalMessages = [...updatedMessages, assistantMessage];
      
      // Update workflow state with assistant message
      await workflowStateManager.updateWorkflowState(
        workflowId,
        {
          messages: finalMessages,
          lastAssistantMessage: assistantMessage,
          lastMessageAt: assistantMessage.timestamp,
          transactionId: options.transactionId
        }
      );
      
      // Log message processing event
      await this.logEvent(
        workflowId,
        'chat_message_processed',
        {
          chatId: input.chatId,
          userId: input.userId,
          messageId: userMessage.id,
          responseId: assistantMessage.id,
          timestamp: new Date().toISOString(),
          transactionId: options.transactionId
        }
      );
      
      // Final progress update
      progressCallback(100, ProcessingPhase.CHAT_PROCESSING);
      
      // Return result
      return {
        chatId: input.chatId,
        userId: input.userId,
        success: true,
        messages: finalMessages,
        metadata: {
          lastMessageAt: assistantMessage.timestamp,
          messageCount: finalMessages.length,
          model: input.model
        }
      };
    }
    // Case 3: Completing a chat session
    else if ('chatId' in input && currentState.currentStep === 'chat_completed') {
      // Log session completion event
      await this.logEvent(
        workflowId,
        'chat_session_completed',
        {
          chatId: input.chatId,
          userId: input.userId,
          timestamp: new Date().toISOString(),
          messageCount: (currentState.metadata?.messages as any[] || []).length,
          summary: currentState.metadata?.summary
        }
      );
      
      // Return result
      return {
        chatId: input.chatId,
        userId: input.userId,
        success: true,
        messages: currentState.metadata?.messages as ChatMessage[],
        metadata: {
          completedAt: new Date().toISOString(),
          messageCount: (currentState.metadata?.messages as any[] || []).length,
          summary: currentState.metadata?.summary
        }
      };
    }
    // Case 4: Handling a chat error
    else if ('chatId' in input && currentState.currentStep === 'chat_error') {
      // Log chat error event
      await this.logEvent(
        workflowId,
        'chat_error',
        {
          chatId: input.chatId,
          userId: input.userId,
          timestamp: new Date().toISOString(),
          error: input.message,
          context: currentState.metadata?.errorContext
        }
      );
      
      // Return result
      return {
        chatId: input.chatId,
        userId: input.userId,
        success: false,
        messages: currentState.metadata?.messages as ChatMessage[],
        metadata: {
          error: input.message,
          errorTimestamp: new Date().toISOString(),
          errorContext: currentState.metadata?.errorContext
        },
        error: input.message
      };
    }
    // Unknown/unsupported operation
    else {
      throw new ApplicationError({
        message: 'Unsupported chat operation',
        code: 'UNSUPPORTED_CHAT_OPERATION',
        data: {
          currentStep: currentState.currentStep,
          input
        }
      });
    }
  }
  
  /**
   * Implementation of required abstract method for domain-specific error handling
   * @deprecated Use Result pattern instead with Result.failure()
   */
  protected createErrorResult(
    error: ApplicationError,
    input: ChatMessageInput | ChatStartOptions
  ): ChatSessionResult {
    logger.warn(
      'createErrorResult is deprecated. Use Result.failure() instead.',
      { method: 'ChatWorkflow.createErrorResult' }
    );
    
    const chatId = 'chatId' in input ? input.chatId : '';
    
    return {
      chatId,
      userId: input.userId,
      success: false,
      metadata: {
        error: error.message,
        code: error.code || 'CHAT_ERROR',
        timestamp: new Date().toISOString()
      },
      error: error.message
    };
  }
  
  /**
   * Simulate assistant response
   */
  private simulateAssistantResponse(message: string, options: {
    model?: string;
    patientId?: string;
    documentId?: string;
  }): string {
    // In a real implementation, this would call an LLM API
    const currentTime = new Date().toLocaleTimeString();
    
    return `This is a simulated assistant response to: "${message}".
    
I'm using the ${options.model || 'default'} model. The current time is ${currentTime}.

Here are some details from the context:
${options.patientId ? `- Patient ID: ${options.patientId}` : ''}
${options.documentId ? `- Document ID: ${options.documentId}` : ''}

Is there anything else you'd like to know?`;
  }
}

// Export singleton instance
export const chatWorkflow = new ChatWorkflow();