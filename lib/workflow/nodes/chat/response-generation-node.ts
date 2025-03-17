// lib/workflow/nodes/chat/response-generation-node.ts
import { WorkflowState, PartialWorkflowState } from '@/workflow/state/workflow-state';
import { ProcessingPhase } from '@/lib/types/workflow';
import { ChatMessageType } from '@/lib/types/chat';
import logger from '@/lib/logger';

export async function responseGenerationNode(
  state: WorkflowState
): Promise<PartialWorkflowState> {
  const moduleLogger = logger.withMetadata({
    node: 'responseGenerationNode',
    threadId: state.threadId,
  });

  try {
    moduleLogger.info('Generating response');
    
    let responseMessage = '';
    const lastIntent = state.context?.lastIntent || 'general_chat';
    
    // Generate response based on current state and intent
    switch (lastIntent) {
      case 'document_extraction':
        if (state.extractedData) {
          responseMessage = `Document extracted successfully. Extracted ${state.extractedData.text.length} characters with ${Math.round(state.extractedData.confidence * 100)}% confidence.`;
        } else {
          responseMessage = 'Please upload a document to extract text.';
        }
        break;
      
      case 'verification':
        if (state.verification.status === 'completed') {
          responseMessage = 'The summary has been verified successfully.';
        } else if (state.verification.status === 'in_progress') {
          responseMessage = 'Please confirm if the summary is accurate or provide corrections.';
        } else {
          responseMessage = 'No summary available for verification.';
        }
        break;
      
      // Additional cases for other intents...
      
      default:
        responseMessage = 'How can I assist you with your medical documents today?';
        break;
    }
    
    // Add response to interaction history
    const interaction = {
      timestamp: new Date().toISOString(),
      message: responseMessage,
      userId: 'system',
      role: 'assistant',
      messageType: ChatMessageType.ASSISTANT,
      contextual: {
        step: 'response_generation',
        intent: lastIntent,
      },
    };
    
    const interactionHistory = state.interactionHistory || [];
    
    // Return updated state
    return {
      interactionHistory: [...interactionHistory, interaction],
      progress: {
        currentStep: 'response_generation',
        percentage: 100,
        phase: ProcessingPhase.COMPLETION,
        isCompleted: true,
      },
    };
  } catch (error) {
    // Error handling
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'RESPONSE_GENERATION_ERROR',
        step: 'response_generation',
        timestamp: new Date().toISOString(),
        recoverable: true,
      },
      progress: {
        currentStep: 'error',
        percentage: state.progress?.percentage || 0,
        phase: ProcessingPhase.ERROR,
        isCompleted: false,
      },
    };
  }
}