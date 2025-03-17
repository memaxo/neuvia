// lib/workflow/nodes/chat/response-generation-node.ts
import type { WorkflowState, WorkflowInteraction, WorkflowError } from '../../state/workflow-state';
import { ProcessingPhase } from '@/lib/types/workflow';
import { ChatMessageType } from '@/lib/types/chat';
import logger from '@/lib/logger';

// Define the return type
type PartialWorkflowState = Partial<WorkflowState>;

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
          // Safely access text length and handle confidence without assuming property exists
          const textLength = state.extractedData.text?.length || 0;
          const confidence = state.extractedData.structuredData?.confidence as number || 0.8;
          responseMessage = `Document extracted successfully. Extracted ${textLength} characters with ${Math.round(confidence * 100)}% confidence.`;
        } else {
          responseMessage = 'Please upload a document to extract text.';
        }
        break;
      
      case 'verification':
        if (state.verification?.status === 'completed') {
          responseMessage = 'The summary has been verified successfully.';
        } else if (state.verification?.status === 'in_progress') {
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
    const interaction: WorkflowInteraction = {
      id: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
      message: responseMessage,
      userId: 'system',
      role: 'assistant',
      messageType: 'assistant', // Fixed: Using string literal instead of enum
      contextual: {
        step: 'response_generation',
        intent: lastIntent as string,
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
        timestamp: new Date().toISOString(),
        domain: 'response',
        step: 'response_generation',
        recoverable: true,
        context: { error }
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