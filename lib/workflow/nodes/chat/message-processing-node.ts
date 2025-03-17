import { WorkflowState, PartialWorkflowState } from '@/lib/workflow/state/workflow-state';
import { ProcessingPhase, WorkflowSteps } from '@/lib/types/workflow';
import { ChatMessageType, ChatIntentType } from '@/lib/types/chat';
import logger from '@/lib/logger';

/**
 * Message processing node for LangGraph workflow
 * 
 * This node receives user messages, processes them to determine intent,
 * and updates the workflow state accordingly.
 *
 * @param state Current workflow state 
 * @returns Partial workflow state with intent detection results
 */
export async function messageProcessingNode(
  state: WorkflowState
): Promise<PartialWorkflowState> {
  const moduleLogger = logger.withMetadata({
    node: 'messageProcessingNode',
    threadId: state.threadId,
    patientId: state.patientId
  });

  try {
    moduleLogger.info('Processing user message');
    
    // Ensure we have a current message to process
    if (!state.currentMessage?.content) {
      throw new Error('No message content available for processing');
    }
    
    const messageContent = state.currentMessage.content;
    
    // Detect intent from message content
    // In a more sophisticated implementation, this would use an LLM for classification
    let intent = 'general_chat';
    const lowerContent = messageContent.toLowerCase();
    
    // Rule-based intent detection
    if (lowerContent.includes('extract') || 
        lowerContent.includes('process document') ||
        lowerContent.includes('analyze document') ||
        lowerContent.includes('parse document')) {
      intent = 'document_extraction';
    } else if (lowerContent.includes('verify') || 
              lowerContent.includes('confirm') ||
              lowerContent.includes('approve')) {
      intent = 'verification';
    } else if (lowerContent.includes('correct') || 
              lowerContent.includes('change') ||
              lowerContent.includes('fix') ||
              lowerContent.includes('update information')) {
      intent = 'correction';
    } else if (lowerContent.includes('generate report') || 
              lowerContent.includes('create report') ||
              lowerContent.includes('final report')) {
      intent = 'report_generation';
    }
    
    moduleLogger.info('Intent detected', { intent });
    
    // Create interaction record for history
    const interaction = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      message: messageContent,
      userId: state.currentMessage.userId || state.userId,
      role: 'user' as const,
      messageType: ChatMessageType.CHAT,
      contextual: {
        step: WorkflowSteps.CHAT_IN_PROGRESS,
        intent
      }
    };
    
    // Get existing history or initialize empty array
    const interactionHistory = state.interactionHistory || [];
    
    // Update workflow state with detected intent and message history
    return {
      interactionHistory: [...interactionHistory, interaction],
      context: {
        ...state.context,
        lastIntent: intent,
        lastMessageTimestamp: new Date().toISOString()
      },
      progress: {
        currentStep: WorkflowSteps.CHAT_IN_PROGRESS,
        percentage: 10,
        phase: ProcessingPhase.CHAT_PROCESSING,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    };
  } catch (error) {
    // Log error and return error state
    moduleLogger.error('Message processing failed', {}, error);
    
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown message processing error',
        code: 'MESSAGE_PROCESSING_ERROR',
        step: WorkflowSteps.CHAT_IN_PROGRESS,
        timestamp: new Date().toISOString(),
        recoverable: true,
        context: {
          messageLength: state.currentMessage?.content?.length,
          error: String(error)
        }
      },
      progress: {
        currentStep: WorkflowSteps.ERROR,
        percentage: state.progress?.percentage || 0,
        phase: ProcessingPhase.ERROR,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    };
  }
}

export default messageProcessingNode; 