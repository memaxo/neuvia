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
import { workflowRepository } from '../infrastructure/workflow-repository'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowEventSourcing } from '../infrastructure/workflow-event-source'
import { workflowTransactionManager } from '../workflow-transaction-manager'

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'

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
 * Message processing options
 */
export interface MessageProcessingOptions {
  /** Model to use for response */
  model?: string;
  /** System prompt to use */
  systemPrompt?: string;
  /** User ID */
  userId: string;
  /** Whether to stream response */
  stream?: boolean;
  /** Patient ID if chat is for a patient */
  patientId?: string;
  /** Document ID if chat is related to a document */
  documentId?: string;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Chat workflow processor
 */
export class ChatWorkflow {
  private readonly logger = logger.withMetadata({ module: 'ChatWorkflow' });
  
  /**
   * Start chat session
   */
  async startChatSession(
    workflowId: string,
    chatId: string,
    userId: string,
    initialMetadata: Record<string, unknown> = {}
  ): Promise<ChatSessionResult> {
    try {
      // Get current state
      const existingState = await workflowRepository.getWorkflowState(workflowId);
      
      // Determine initial step
      const fromStep: WorkflowStep = existingState?.currentStep || 'idle';
      
      // Update workflow state to chat_started
      await workflowStateManager.transitionState(
        workflowId,
        fromStep,
        'chat_started',
        {
          chatId,
          userId,
          sessionStartedAt: new Date().toISOString(),
          messages: [],
          ...initialMetadata
        }
      );
      
      // Log session start event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'chat_session_started',
        {
          chatId,
          userId,
          timestamp: new Date().toISOString(),
          metadata: initialMetadata
        }
      );
      
      // Return result
      return {
        chatId,
        userId,
        success: true,
        messages: [],
        metadata: {
          startedAt: new Date().toISOString(),
          ...initialMetadata
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to start chat session', {
        workflowId,
        chatId,
        userId,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        chatId,
        userId,
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Process user message
   */
  async processMessage(
    workflowId: string,
    chatId: string,
    message: string,
    options: MessageProcessingOptions
  ): Promise<ChatSessionResult> {
    try {
      // Start transaction for message processing
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Get current state
          const currentState = await workflowRepository.getWorkflowState(workflowId);
          if (!currentState) {
            throw new Error('Workflow state not found');
          }
          
          // Ensure we have a valid chat session
          if (currentState.metadata?.chatId !== chatId) {
            throw new ApplicationError({
              message: 'Chat ID mismatch',
              code: 'CHAT_ID_MISMATCH',
              data: {
                workflowId,
                chatId,
                currentChatId: currentState.metadata?.chatId
              }
            });
          }
          
          // Determine appropriate transition based on current state
          const fromStep: WorkflowStep = currentState.currentStep;
          let toStep: WorkflowStep = 'chat_in_progress';
          
          if (fromStep === 'chat_started' || fromStep === 'idle') {
            toStep = 'chat_in_progress';
          } else if (fromStep !== 'chat_in_progress' && fromStep !== 'chat_completed' && fromStep !== 'chat_error') {
            // If coming from a non-chat state, transition to chat_in_progress
            toStep = 'chat_in_progress';
          } else {
            // Keep the current state if already in chat flow
            toStep = fromStep;
          }
          
          // Create message ID
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          
          // Get current messages
          const currentMessages: ChatMessage[] = currentState.metadata?.messages || [];
          
          // Add user message
          const userMessage: ChatMessage = {
            id: messageId,
            content: message,
            role: 'user',
            timestamp: new Date().toISOString(),
            metadata: {
              userId: options.userId,
              patientId: options.patientId,
              documentId: options.documentId
            }
          };
          
          const updatedMessages = [...currentMessages, userMessage];
          
          // Update workflow state to add user message
          await workflowStateManager.transitionState(
            workflowId,
            fromStep,
            toStep,
            {
              chatId,
              messages: updatedMessages,
              lastUserMessage: userMessage,
              lastMessageAt: userMessage.timestamp,
              transactionId
            }
          );
          
          // Initial progress update
          progressCallback(20, ProcessingPhase.CHAT_PROCESSING);
          
          // Simulate assistant response (in a real implementation, call LLM API)
          const assistantMessageContent = this.simulateAssistantResponse(message, options);
          progressCallback(50, ProcessingPhase.CHAT_PROCESSING);
          
          // Create assistant message
          const assistantMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            content: assistantMessageContent,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            metadata: {
              model: options.model,
              processingTime: 1234 // ms
            }
          };
          
          // Final message list with assistant response
          const finalMessages = [...updatedMessages, assistantMessage];
          
          // Update workflow state with assistant message
          await workflowStateManager.transitionState(
            workflowId,
            toStep,
            toStep, // Same state but updated metadata
            {
              chatId,
              messages: finalMessages,
              lastAssistantMessage: assistantMessage,
              lastMessageAt: assistantMessage.timestamp,
              transactionId
            }
          );
          
          // Final progress update
          progressCallback(100, ProcessingPhase.CHAT_PROCESSING);
          
          // Return result
          return {
            chatId,
            userId: options.userId,
            success: true,
            messages: finalMessages,
            metadata: {
              lastMessageAt: assistantMessage.timestamp,
              messageCount: finalMessages.length,
              model: options.model
            }
          };
        },
        {
          step: 'chat_in_progress',
          metadata: {
            chatId,
            userId: options.userId,
            message
          },
          onProgress: options.onProgress,
          transactionId: options.transactionId,
          recoveryStep: 'chat_in_progress'
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Message processing failed', {
        workflowId,
        chatId,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        chatId,
        userId: options.userId,
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Complete chat session
   */
  async completeChatSession(
    workflowId: string,
    chatId: string,
    userId: string,
    summary?: string
  ): Promise<ChatSessionResult> {
    try {
      // Get current state
      const currentState = await workflowRepository.getWorkflowState(workflowId);
      if (!currentState) {
        throw new Error('Workflow state not found');
      }
      
      // Ensure we have a valid chat session
      if (currentState.metadata?.chatId !== chatId) {
        throw new ApplicationError({
          message: 'Chat ID mismatch',
          code: 'CHAT_ID_MISMATCH',
          data: {
            workflowId,
            chatId,
            currentChatId: currentState.metadata?.chatId
          }
        });
      }
      
      // Determine appropriate transition based on current state
      const fromStep: WorkflowStep = currentState.currentStep;
      
      // Update workflow state to chat_completed
      await workflowStateManager.transitionState(
        workflowId,
        fromStep,
        'chat_completed',
        {
          chatId,
          userId,
          sessionCompletedAt: new Date().toISOString(),
          summary,
          sessionDuration: currentState.metadata?.sessionStartedAt 
            ? Date.now() - new Date(currentState.metadata.sessionStartedAt as string).getTime() 
            : undefined
        }
      );
      
      // Log session completion event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'chat_session_completed',
        {
          chatId,
          userId,
          timestamp: new Date().toISOString(),
          messageCount: (currentState.metadata?.messages as any[] || []).length,
          summary
        }
      );
      
      // Return result
      return {
        chatId,
        userId,
        success: true,
        messages: currentState.metadata?.messages as ChatMessage[],
        metadata: {
          completedAt: new Date().toISOString(),
          messageCount: (currentState.metadata?.messages as any[] || []).length,
          summary
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to complete chat session', {
        workflowId,
        chatId,
        userId,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        chatId,
        userId,
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Handle chat error
   */
  async handleChatError(
    workflowId: string,
    chatId: string,
    error: Error | string,
    context?: Record<string, unknown>
  ): Promise<ChatSessionResult> {
    try {
      // Get current state
      const currentState = await workflowRepository.getWorkflowState(workflowId);
      if (!currentState) {
        throw new Error('Workflow state not found');
      }
      
      // Ensure we have a valid chat session
      if (currentState.metadata?.chatId !== chatId) {
        throw new ApplicationError({
          message: 'Chat ID mismatch',
          code: 'CHAT_ID_MISMATCH',
          data: {
            workflowId,
            chatId,
            currentChatId: currentState.metadata?.chatId
          }
        });
      }
      
      const userId = currentState.metadata?.userId as string;
      const errorMessage = error instanceof Error ? error.message : error;
      
      // Update workflow state to chat_error
      await workflowStateManager.transitionState(
        workflowId,
        currentState.currentStep,
        'chat_error',
        {
          chatId,
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
          errorContext: context
        }
      );
      
      // Log chat error event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'chat_error',
        {
          chatId,
          userId,
          timestamp: new Date().toISOString(),
          error: errorMessage,
          context
        }
      );
      
      // Return result
      return {
        chatId,
        userId,
        success: false,
        messages: currentState.metadata?.messages as ChatMessage[],
        metadata: {
          error: errorMessage,
          errorTimestamp: new Date().toISOString(),
          errorContext: context
        },
        error: errorMessage
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to handle chat error', {
        workflowId,
        chatId,
        error: normalizedError.message,
        originalError: error instanceof Error ? error.message : error
      });
      
      // Return error result with original error
      return {
        chatId,
        userId: '',
        success: false,
        metadata: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Get chat session
   */
  async getChatSession(
    workflowId: string,
    chatId: string
  ): Promise<ChatSessionResult | null> {
    try {
      // Get workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        return null;
      }
      
      // Check if chat ID matches
      if (state.metadata?.chatId !== chatId) {
        return null;
      }
      
      // Get chat data
      const userId = state.metadata?.userId as string;
      const messages = state.metadata?.messages as ChatMessage[];
      
      // Return chat session data
      return {
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
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get chat session', {
        workflowId,
        chatId,
        error: normalizedError.message
      });
      return null;
    }
  }
  
  /**
   * Simulate assistant response
   */
  private simulateAssistantResponse(message: string, options: MessageProcessingOptions): string {
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