import { ChatState, ChatAction, initialChatState, ChatMode } from '@/lib/chat/types';
import type { WorkflowStep } from '@/lib/workflow/types';

/**
 * Reducer function to handle chat state transitions
 */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'INITIALIZE_CHAT':
      return {
        ...state,
        chatId: action.payload.chatId
      };
      
    case 'RESET_CHAT':
      return {
        ...initialChatState,
        chatId: state.chatId // Preserve chatId
      };
      
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error
      };
      
    case 'ADD_MESSAGE':
      const newMessage = 'id' in action.payload.message
        ? action.payload.message
        : {
            ...action.payload.message,
            id: crypto.randomUUID()
          };
          
      return {
        ...state,
        messages: [...state.messages, newMessage]
      };
      
    case 'UPDATE_MESSAGES':
      return {
        ...state,
        messages: action.payload.messages
      };
      
    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload.mode,
        // Reset verification state if changing away from verification
        verification: action.payload.mode !== 'verification' && state.verification.isInVerificationMode
          ? {
              ...state.verification,
              isInVerificationMode: false
            }
          : state.verification
      };

    case 'START_VERIFICATION':
      const timestamp = new Date().toISOString();
      const summaryId = crypto.randomUUID();
      
      return {
        ...state,
        mode: 'verification',
        verification: {
          ...state.verification,
          isInVerificationMode: true,
          currentSummary: action.payload.content,
          verificationStatus: 'in_progress',
          summaryVersions: [
            ...state.verification.summaryVersions,
            { 
              id: summaryId, 
              content: action.payload.content, 
              timestamp 
            }
          ]
        }
      };
      
    case 'SUBMIT_CORRECTION':
      return {
        ...state,
        verification: {
          ...state.verification,
          verificationStatus: 'in_progress'
        }
      };
      
    case 'COMPLETE_VERIFICATION':
      return {
        ...state,
        verification: {
          ...state.verification,
          verificationStatus: 'completed',
          isInVerificationMode: false
        }
      };
      
    case 'START_REPORT_GENERATION':
      return {
        ...state,
        mode: 'report_generation'
      };

    case 'COMPLETE_REPORT_GENERATION':
      return {
        ...state,
        mode: 'default' // Return to default chat mode
      };
      
    case 'UPDATE_PROGRESS':
      // Find and update the progress of a specific message
      return {
        ...state,
        messages: state.messages.map(msg => 
          msg.id === action.payload.messageId 
            ? {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  progressValue: action.payload.progress,
                  progressPhase: action.payload.phase
                }
              }
            : msg
        )
      };
      
    case 'UPDATE_WORKFLOW_STEP':
      return {
        ...state,
        // Update mode based on workflow step if appropriate
        mode: mapWorkflowStepToChatMode(action.payload.step, state.mode)
      };
      
    default:
      return state;
  }
}

/**
 * Helper to map workflow steps to chat modes
 */
function mapWorkflowStepToChatMode(step: WorkflowStep, currentMode: ChatMode): ChatMode {
  switch (step) {
    case 'verification':
      return 'verification';
    case 'report_generation':
      return 'report_generation';
    case 'error':
      return currentMode; // Preserve current mode on error
    case 'idle':
    case 'extraction':
    case 'complete':
    default:
      // Only switch mode if it was tied to a workflow step
      if (currentMode === 'verification' || currentMode === 'report_generation') {
        return 'default';
      }
      return currentMode;
  }
} 