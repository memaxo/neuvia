import { workflowMediator } from '@/lib/services/workflow/workflow-mediator';
import { workflowService } from '@/lib/services/workflow/workflow-service';
import { eventService } from '@/lib/services/event-service';
import { chatService } from '@/lib/services/chat/chat-service';
import { EVENT_TYPES } from '@/lib/types/events';
import { normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';

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
  }

  /**
   * Process a chat message and route to appropriate workflow
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
      
      // Check if this is a correction message for verification
      if (message.type === ChatMessageType.CORRECTION) {
        await this.handleCorrectionMessage(message, chatId, workflowId);
      }
      
      // Check if this is a verification confirmation
      else if (
        message.role === 'user' &&
        message.content.toLowerCase().trim() === 'confirm' &&
        this.isInVerificationState(workflowId)
      ) {
        await this.handleVerificationConfirmation(message, chatId, workflowId);
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Error processing chat message', {
        chatId,
        messageId: message.id,
        error: normalizedError
      });
      
      // Add error message to chat
      await chatService.saveMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error processing message: ${normalizedError.message}`,
        createdAt: new Date(),
        metadata: {
          type: ChatMessageType.ERROR,
          errorCode: normalizedError.code
        }
      }, chatId);
    }
  }

  /**
   * Handle a correction message for verification
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
      
      // Get the current summary from the workflow state
      const currentSummary = workflowState.metadata?.currentSummary as string;
      
      if (!currentSummary) {
        throw new Error('No current summary found in workflow state');
      }
      
      // Publish verification correction event
      await eventService.publish(EVENT_TYPES.VERIFICATION_CORRECTION, {
        workflowId,
        chatId,
        messageId: message.id,
        correction: message.content,
        currentSummary
      } as VerificationCorrectionEventPayload);
      
      // Process the correction through the workflow mediator
      const result = await workflowMediator.processCorrection(
        workflowId,
        message.content,
        currentSummary,
        message.id
      );
      
      // Add the updated summary as a message
      await chatService.saveMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.summary as string,
        createdAt: new Date(),
        metadata: {
          type: ChatMessageType.SUMMARY,
          summaryVersionId: result.summaryId
        }
      }, chatId);
      
      // Add a prompt to confirm or continue corrections
      await chatService.saveMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: "I've updated the summary based on your correction. Please review and type 'confirm' to approve, or provide more corrections.",
        createdAt: new Date(),
        metadata: {
          type: ChatMessageType.VERIFICATION
        }
      }, chatId);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Error handling correction message', {
        chatId,
        messageId: message.id,
        error: normalizedError
      });
      
      // Add error message to chat
      await chatService.saveMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error processing correction: ${normalizedError.message}`,
        createdAt: new Date(),
        metadata: {
          type: ChatMessageType.ERROR,
          errorCode: normalizedError.code
        }
      }, chatId);
    }
  }

  /**
   * Handle verification confirmation
   */
  private async handleVerificationConfirmation(
    message: ChatMessage,
    chatId: string,
    workflowId: string
  ): Promise<void> {
    this.logger.info('Handling verification confirmation', { chatId, messageId: message.id });
    
    try {
      // Publish verification confirmation event
      await eventService.publish(EVENT_TYPES.VERIFICATION_CONFIRMATION, {
        workflowId,
        chatId,
        messageId: message.id
      } as VerificationConfirmationEventPayload);
      
      // Add processing message to chat
      const processingMessageId = crypto.randomUUID();
      await chatService.saveMessage({
        id: processingMessageId,
        role: 'system',
        content: 'Processing verification confirmation...',
        createdAt: new Date(),
        metadata: {
          type: ChatMessageType.PROGRESS,
          progress: {
            value: 0,
            phase: 'verification'
          }
        }
      }, chatId);
      
      // Complete verification
      const result = await workflowMediator.completeVerification(workflowId, true);
      
      // Add success message to chat
      await chatService.saveMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: 'Verification completed successfully. Generating report...',
        createdAt: new Date(),
        metadata: {
          type: ChatMessageType.SYSTEM,
          verificationComplete: true,
          isApproved: true
        }
      }, chatId);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Error handling verification confirmation', {
        chatId,
        messageId: message.id,
        error: normalizedError
      });
      
      // Add error message to chat
      await chatService.saveMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error processing verification: ${normalizedError.message}`,
        createdAt: new Date(),
        metadata: {
          type: ChatMessageType.ERROR,
          errorCode: normalizedError.code
        }
      }, chatId);
    }
  }

  /**
   * Handle incoming chat message event
   */
  private async handleChatMessage(payload: ChatMessageEventPayload): Promise<void> {
    // This method is called when other services publish chat messages
    // Implement if needed to react to messages from other services
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
    try {
      const { data, error } = await workflowService.supabase
        .from('workflow_states')
        .select('id')
        .eq('chat_id', chatId)
        .maybeSingle();
        
      if (error || !data) {
        return null;
      }
      
      return data.id;
    } catch (error) {
      this.logger.error('Error getting workflow for chat', { chatId }, error);
      return null;
    }
  }
}

// Singleton instance
export const chatWorkflowIntegration = new ChatWorkflowIntegration();