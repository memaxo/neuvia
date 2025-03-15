import { workflowCoordinator } from '@/lib/services/workflow/coordination/workflow-coordinator';
import { workflowService } from '@/lib/services/workflow/workflow-service';
import { workflowEngine } from '@/lib/services/workflow/coordination/workflow-engine';
import { eventService } from '@/lib/services/event-service';
import { chatService } from '@/lib/services/chat/chat-service';
import { chatIntentParser } from '@/lib/services/chat/chat-intent-parser';
import { EVENT_TYPES } from '@/lib/types/events';
import { normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';
import { ProcessingPhase } from '@/lib/types/workflow';

import type {
  ChatMessage,
  ChatMessageType
} from '@/lib/types/chat';
import type { UUID } from '@/lib/types/base';
import type {
  ChatMessageEventPayload,
  VerificationCorrectionEventPayload,
  VerificationConfirmationEventPayload
} from '@/lib/types/events';

/**
 * Chat Workflow Integration
 *
 * Provides integration between chat interactions and workflow processes.
 * Handles chat messages and forwards them to appropriate workflow steps.
 * Now uses the workflow engine and chat intent parser for better orchestration.
 */
export class ChatWorkflowIntegration {
  private readonly logger = logger.withMetadata({ module: 'ChatWorkflowIntegration' });

  constructor() {
    this.logger.info('ChatWorkflowIntegration initialized');
    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    // Listen for chat message events
    eventService.subscribe(
      EVENT_TYPES.CHAT_MESSAGE_CREATED,
      this.handleChatMessage.bind(this)
    );
    
    // Listen for workflow events
    eventService.subscribe(
      EVENT_TYPES.WORKFLOW_STATE_CHANGED,
      this.handleWorkflowStateChanged.bind(this)
    );
    
    // Listen for verification events
    eventService.subscribe(
      EVENT_TYPES.VERIFICATION_COMPLETED,
      this.handleVerificationCompleted.bind(this)
    );
    
    // Listen for report events
    eventService.subscribe(
      EVENT_TYPES.REPORT_GENERATED,
      this.handleReportGenerated.bind(this)
    );
    
    // Listen for research events
    eventService.subscribe(
      EVENT_TYPES.RESEARCH_COMPLETED,
      this.handleResearchCompleted.bind(this)
    );
  }

  /**
   * Process a chat message and route to appropriate workflow
   * Now delegating UI/messaging concerns to chatService
   *
   * @param message Chat message
   * @param chatId Chat ID
   * @param workflowId Workflow ID
   */
  async processChatMessage(
    message: ChatMessage,
    chatId: string,
    workflowId: string
  ): Promise<void> {
    try {
      // Get current workflow state to determine context
      const workflowState = await workflowService.getWorkflowState(workflowId);
      
      if (!workflowState) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      // Extract context info for intent processing
      const userId = workflowState.metadata?.userId as string || '';
      const patientId = workflowState.metadata?.patientId as string;
      const documentId = workflowState.metadata?.documentId as string;
      const verificationId = workflowState.metadata?.verificationId as string;
      const reportId = workflowState.metadata?.reportId as string;
      
      // Publish chat message event
      await eventService.publish(EVENT_TYPES.CHAT_MESSAGE_CREATED, {
        chatId,
        messageId: message.id,
        message: {
          role: message.role,
          content: message.content,
          metadata: message.metadata
        }
      } as ChatMessageEventPayload);
      
      // Generate transaction ID for tracking
      const transactionId = crypto.randomUUID();
      
      // Parse intent from message
      const { intent, action } = chatIntentParser.processMessage(
        message.content,
        {
          chatId,
          userId,
          patientId,
          documentId,
          verificationId,
          reportId,
          transactionId,
          metadata: message.metadata as Record<string, unknown>
        },
        workflowState.currentStep as string
      );
      
      this.logger.info('Processing chat message with intent', {
        chatId,
        workflowId,
        messageId: message.id,
        intentType: intent.intentType,
        confidence: intent.confidence,
        actionType: action.type
      });
      
      // Determine if this is a process that needs progress tracking
      const needsProgress = ['VERIFY_CONFIRM', 'VERIFY_CORRECT', 'VERIFY_REJECT', 'START_RESEARCH', 'GENERATE_REPORT'].includes(action.type);
      
      // Delegate the UI handling to chatService
      const processingMessageId = needsProgress ? 
        await chatService.createProgressMessage(chatId, action.type.toLowerCase()) : null;
      
      // PHASE 3 IMPLEMENTATION:
      // Process the intent directly through the chat service
      // instead of going through the compatibility layer
      const result = await chatService.processIntent(
        intent.intentType,
        {
          ...workflowState.metadata,
          workflowId,
          currentState: workflowState.currentStep
        },
        {
          workflowId,
          chatId,
          message: message.content,
          userId,
          patientId,
          documentId
        }
      );
      
      // Convert result to compatible format for backward compatibility
      const compatResult = {
        isSuccess: () => result.success,
        isFailure: () => !result.success,
        error: result.error ? { 
          message: result.error,
          code: 'INTENT_PROCESSING_ERROR'
        } : undefined,
        value: result.data
      };
      
      // Delegate result handling to chatService
      if (result.success) {
        if (processingMessageId) {
          await chatService.completeProgressMessage(chatId, processingMessageId);
        }
        
        this.logger.info('Chat message processed successfully', {
          chatId,
          workflowId,
          messageId: message.id,
          intentType: intent.intentType
        });
      } else {
        await chatService.handleIntentError(
          chatId, 
          { message: result.error, code: 'INTENT_PROCESSING_ERROR' }, 
          processingMessageId
        );
        
        this.logger.error('Error processing chat intent', {
          chatId,
          workflowId,
          messageId: message.id,
          intentType: intent.intentType,
          error: result.error
        });
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Error processing chat message', {
        chatId,
        messageId: message.id,
        error: normalizedError
      });
      
      // Delegate error handling to chatService
      await chatService.handleChatError(chatId, normalizedError);
    }
  }

  /**
   * Handle a correction message for verification
   * Refactored to delegate chat UI to chatService
   */
  private async handleCorrectionMessage(
    message: ChatMessage,
    chatId: string,
    workflowId: string
  ): Promise<void> {
    this.logger.info('Handling correction message', { chatId, messageId: message.id });
    
    try {
      // Get the current workflow state
      const workflowState = await workflowService.getWorkflowState(workflowId);
      
      if (!workflowState) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      // Get the verification ID from the workflow state
      const verificationId = workflowState.metadata?.verificationId as string;
      
      if (!verificationId) {
        throw new Error('No verification ID found in workflow state');
      }
      
      // Get userId from metadata
      const userId = workflowState.metadata?.userId as string;
      if (!userId) {
        throw new Error('No user ID found in workflow state');
      }
      
      // Parse corrections from message
      const corrections = chatIntentParser.parseIntent(message.content).data?.corrections;
      if (!corrections || corrections.length === 0) {
        throw new Error('No corrections found in message');
      }
      
      // Convert corrections to object format
      const correctionData = corrections.reduce((acc, { field, value }) => {
        acc[field] = value;
        return acc;
      }, {} as Record<string, string>);
      
      // Publish verification correction event
      await eventService.publish(EVENT_TYPES.VERIFICATION_CORRECTION, {
        workflowId,
        chatId,
        messageId: message.id,
        correction: message.content,
        correctionData
      } as VerificationCorrectionEventPayload);
      
      // Delegate creating progress message to chatService
      const processingMessageId = await chatService.createProgressMessage(chatId, 'correction');
      
      // Send VERIFY_CORRECT action to workflow engine
      const actionResult = await workflowEngine.sendAction(
        workflowId,
        {
          type: 'VERIFY_CORRECT',
          payload: {
            verificationId,
            chatId,
            message: message.content,
            corrections: correctionData
          },
          meta: {
            userId
          }
        }
      );
      
      if (actionResult.isFailure()) {
        throw new Error(`Failed to process correction: ${actionResult.error.message}`);
      }
      
      // Delegate progress update to chatService
      await chatService.updateMessageProgress(processingMessageId, 50, ProcessingPhase.VERIFICATION);
      
      // Process the correction through workflow coordinator for the actual backend work
      const result = await workflowCoordinator.processVerificationCorrection(
        workflowId,
        verificationId,
        correctionData,
        {
          userId,
          userComments: message.content
        }
      );
      
      // Delegate completing progress to chatService
      await chatService.updateMessageProgress(processingMessageId, 100, ProcessingPhase.VERIFICATION_COMPLETION);
      
      // Delegate message creation to chatService
      await chatService.processCorrectionMessage(
        chatId,
        correctionData,
        true // isCompleted
      );
      
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Error handling correction message', {
        chatId,
        workflowId,
        messageId: message.id,
        errorCode: normalizedError.code,
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Set workflow to error state
      try {
        await workflowEngine.sendAction(
          workflowId,
          {
            type: 'PROCESS_ERROR',
            payload: {
              error: normalizedError.message,
              code: normalizedError.code,
              chatId,
              message: `Error processing correction: ${normalizedError.message}`
            }
          }
        );
      } catch (actionError) {
        this.logger.warn('Failed to send error action', { workflowId }, actionError);
      }
      
      // Delegate error handling to chatService
      await chatService.handleChatError(
        chatId, 
        normalizedError, 
        'Error processing correction'
      );
    }
  }

  /**
   * Handle verification confirmation
   * Refactored to delegate chat UI to chatService
   */
  private async handleVerificationConfirmation(
    message: ChatMessage,
    chatId: string,
    workflowId: string
  ): Promise<void> {
    this.logger.info('Handling verification confirmation', { chatId, messageId: message.id });
    
    try {
      // Get the current workflow state
      const workflowState = await workflowService.getWorkflowState(workflowId);
      
      if (!workflowState) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      // Get verification ID from workflow state
      const verificationId = workflowState.metadata?.verificationId as string;
      
      if (!verificationId) {
        throw new Error('No verification ID found in workflow state');
      }
      
      // Get userId from metadata
      const userId = workflowState.metadata?.userId as string;
      if (!userId) {
        throw new Error('No user ID found in workflow state');
      }
      
      // Publish verification confirmation event
      await eventService.publish(EVENT_TYPES.VERIFICATION_CONFIRMATION, {
        workflowId,
        chatId,
        messageId: message.id,
        verificationId
      } as VerificationConfirmationEventPayload);
      
      // Delegate creating progress message to chatService
      const processingMessageId = await chatService.createProgressMessage(chatId, 'verification');
      
      // Send VERIFY_CONFIRM action to workflow engine
      const actionResult = await workflowEngine.sendAction(
        workflowId,
        {
          type: 'VERIFY_CONFIRM',
          payload: {
            verificationId,
            chatId,
            message: message.content
          },
          meta: {
            userId
          }
        }
      );
      
      if (actionResult.isFailure()) {
        throw new Error(`Failed to process confirmation: ${actionResult.error.message}`);
      }
      
      // Delegate progress update to chatService
      await chatService.updateMessageProgress(processingMessageId, 50, ProcessingPhase.VERIFICATION);
      
      // Complete verification through workflow coordinator for the actual backend work
      const result = await workflowCoordinator.completeVerification(
        workflowId,
        verificationId,
        {
          userId
        }
      );
      
      // Delegate completing progress to chatService
      await chatService.updateMessageProgress(processingMessageId, 100, ProcessingPhase.VERIFICATION_COMPLETION);
      
      // Delegate message creation to chatService
      await chatService.notifyChatOfVerification(chatId, true);
      
      // Auto-start report generation if configured
      if (workflowState.metadata?.autoGenerateReport) {
        this.logger.info('Auto-initiating report generation after verification', {
          workflowId,
          chatId,
          verificationId
        });
        
        // Send GENERATE_REPORT action to workflow engine
        await workflowEngine.sendAction(
          workflowId,
          {
            type: 'GENERATE_REPORT',
            payload: {
              verificationId,
              chatId,
              documentId: workflowState.metadata?.documentId,
              patientId: workflowState.metadata?.patientId
            },
            meta: {
              userId
            }
          }
        );
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Error handling verification confirmation', {
        chatId,
        workflowId,
        messageId: message.id,
        errorCode: normalizedError.code,
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Send error action to workflow engine
      try {
        await workflowEngine.sendAction(
          workflowId,
          {
            type: 'PROCESS_ERROR',
            payload: {
              error: normalizedError.message,
              code: normalizedError.code,
              chatId,
              message: `Error processing verification: ${normalizedError.message}`
            }
          }
        );
      } catch (actionError) {
        this.logger.warn('Failed to send error action', { workflowId }, actionError);
      }
      
      // Delegate error handling to chatService
      await chatService.handleChatError(
        chatId, 
        normalizedError, 
        'Error processing verification'
      );
    }
  }

  /**
   * Start a new chat session with workflow
   */
  async startChatSession(
    userId: string,
    initialMetadata: Record<string, unknown> = {}
  ): Promise<{ chatId: string; workflowId: string } | null> {
    try {
      // Create chat and workflow
      const result = await chatService.createChatWithWorkflow(userId, initialMetadata);
      
      if (!result) {
        throw new Error('Failed to create chat with workflow');
      }
      
      const { chatId, workflowId } = result;
      
      // Initialize the workflow state by sending INITIALIZE action
      await workflowEngine.sendAction(
        workflowId,
        {
          type: 'INITIALIZE',
          payload: {
            chatId,
            userId,
            sessionStartedAt: new Date().toISOString(),
            ...initialMetadata
          },
          meta: {
            transactionId: initialMetadata.transactionId as string,
            userId
          }
        }
      );
      
      // Delegate welcome message creation to chatService
      await chatService.createWelcomeMessage(chatId);
      
      return result;
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to start chat session', {
        userId,
        error: normalizedError.message
      });
      
      return null;
    }
  }

  /**
   * Handle incoming chat message event
   */
  private async handleChatMessage(payload: ChatMessageEventPayload): Promise<void> {
    try {
      // Get workflow ID for the chat
      const workflowId = await chatService.getWorkflowIdForChat(payload.chatId);
      
      if (!workflowId) {
        this.logger.warn('No workflow found for chat', { chatId: payload.chatId });
        return;
      }
      
      // Get the message from the database
      const { data, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .eq('id', payload.messageId)
        .single();
      
      if (error || !data) {
        this.logger.warn('Message not found', { messageId: payload.messageId });
        return;
      }
      
      // Map DB message to domain model
      const message: ChatMessage = {
        id: data.id,
        role: data.role as 'user' | 'assistant' | 'system',
        content: data.content,
        createdAt: new Date(data.created_at),
        metadata: data.metadata || {},
        type: data.metadata?.type || ChatMessageType.CHAT
      };
      
      // Only process user messages
      if (message.role === 'user') {
        // Process the message
        await this.processChatMessage(message, payload.chatId, workflowId);
      }
    } catch (error) {
      this.logger.error('Error handling chat message event', {
        payload,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle workflow state change event
   */
  private async handleWorkflowStateChanged(payload: any): Promise<void> {
    try {
      const { workflowId, fromState, toState, chatId } = payload;
      
      if (!chatId) {
        return; // Not a chat-related workflow
      }
      
      this.logger.info('Workflow state changed', {
        workflowId,
        chatId,
        fromState,
        toState
      });
      
      // Add notification message for significant state transitions
      switch (toState) {
        case 'verification_pending':
          await chatService.addSystemNotification(
            chatId,
            'Ready for verification. Please review the data.',
            {
              type: ChatMessageType.SYSTEM,
              verificationStatus: 'pending'
            }
          );
          break;
          
        case 'verification_completed':
          await chatService.addSystemNotification(
            chatId,
            'Verification completed successfully.',
            {
              type: ChatMessageType.SYSTEM,
              verificationStatus: 'completed'
            }
          );
          break;
          
        case 'verification_failed':
          await chatService.addSystemNotification(
            chatId,
            'Verification failed. Please try again.',
            {
              type: ChatMessageType.ERROR,
              verificationStatus: 'failed'
            }
          );
          break;
          
        case 'report_generation':
          await chatService.addSystemNotification(
            chatId,
            'Generating report...',
            {
              type: ChatMessageType.PROGRESS,
              progress: {
                value: 10,
                phase: 'report_generation'
              }
            }
          );
          break;
          
        case 'complete':
          await chatService.addSystemNotification(
            chatId,
            'Workflow completed successfully.',
            {
              type: ChatMessageType.SYSTEM,
              completed: true,
              completedAt: new Date().toISOString()
            }
          );
          break;
          
        case 'chat_error':
        case 'error':
          const errorMessage = payload.error || 'An error occurred';
          await chatService.addSystemNotification(
            chatId,
            `Error: ${errorMessage}`,
            {
              type: ChatMessageType.ERROR,
              errorDetails: payload
            }
          );
          break;
      }
    } catch (error) {
      this.logger.error('Error handling workflow state change', {
        payload,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle verification completed event
   */
  private async handleVerificationCompleted(payload: VerificationCompletedEventPayload): Promise<void> {
    try {
      const { workflowId, chatId } = payload;
      
      if (!chatId) {
        return; // Not a chat-related verification
      }
      
      // Add notification to chat
      await chatService.addSystemNotification(
        chatId,
        'Verification completed successfully.',
        {
          type: ChatMessageType.SYSTEM,
          verificationStatus: 'completed',
          verificationId: payload.verificationId
        }
      );
    } catch (error) {
      this.logger.error('Error handling verification completed event', {
        payload,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle report generated event
   */
  private async handleReportGenerated(payload: any): Promise<void> {
    try {
      const { workflowId, reportId, chatId } = payload;
      
      if (!chatId) {
        return; // Not a chat-related report
      }
      
      // Add notification to chat
      await chatService.addSystemNotification(
        chatId,
        'Report generated successfully.',
        {
          type: ChatMessageType.SYSTEM,
          reportId,
          reportGenerated: true,
          generatedAt: new Date().toISOString()
        }
      );
      
      // Add report content summary if available
      if (payload.summary) {
        await chatService.saveMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Here's a summary of the generated report:\n\n${payload.summary}`,
          createdAt: new Date(),
          metadata: {
            type: ChatMessageType.REPORT,
            reportId
          }
        }, chatId);
      }
    } catch (error) {
      this.logger.error('Error handling report generated event', {
        payload,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle research completed event
   */
  private async handleResearchCompleted(payload: any): Promise<void> {
    try {
      const { workflowId, researchId, chatId, content } = payload;
      
      if (!chatId) {
        return; // Not a chat-related research
      }
      
      // Add research results to chat
      await chatService.saveMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: content || 'Research completed. Here are the findings:',
        createdAt: new Date(),
        metadata: {
          type: ChatMessageType.RESEARCH,
          researchId,
          researchCompleted: true,
          completedAt: new Date().toISOString()
        }
      }, chatId);
    } catch (error) {
      this.logger.error('Error handling research completed event', {
        payload,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if the workflow is currently in a verification state
   */
  private async isInVerificationState(workflowId: string): Promise<boolean> {
    try {
      const workflowState = await workflowService.getWorkflowState(workflowId);
      
      if (!workflowState) {
        return false;
      }
      
      const verificationSteps = [
        'verification',
        'verification_pending',
        'verification_in_progress'
      ];
      
      return verificationSteps.includes(workflowState.currentStep as string);
    } catch (error) {
      this.logger.error('Error checking verification state', { workflowId }, error);
      return false;
    }
  }
  
  /**
   * Get active workflow ID for a chat
   */
  async getWorkflowIdForChat(chatId: string): Promise<UUID | null> {
    return chatService.getWorkflowIdForChat(chatId);
  }
  
  /**
   * Get Supabase client for database operations
   */
  private get supabase() {
    return workflowService.supabase;
  }
}

// Singleton instance
export const chatWorkflowIntegration = new ChatWorkflowIntegration();