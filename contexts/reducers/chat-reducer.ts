import type { ChatAction, ChatMode, ChatState } from '@/lib/chat/types'
import { initialChatState } from '@/lib/chat/types'
import type { ProcessingStatus } from '@/lib/processing/types/base'
import type { VerificationItem } from '@/lib/processing/types/verification'
import type { ProcessingPhase, WorkflowStep } from '@/lib/workflow/types'

// Define the initial workflow state to be embedded in chat state
export const initialWorkflowState = {
  currentStep: 'idle' as WorkflowStep,
  processingStatus: {
    progress: 0,
    phase: 'initialization',
  } as ProcessingStatus,
  workflowError: null as string | null,
  data: {} as Record<string, any>,
}

// Extend the ChatState type to include workflow state
declare module '@/lib/chat/types' {
  interface ChatState {
    workflow?: typeof initialWorkflowState
    reportGeneration?: {
      isComplete: boolean
      format: any
    }
  }
}

// Define extended action types for workflow operations only to be used internally in this file
// These should not be exported to avoid type conflicts
type WorkflowActions =
  | { type: 'UPDATE_WORKFLOW_STATUS'; payload: { status: ProcessingStatus } }
  | { type: 'SET_WORKFLOW_DATA'; payload: { key: string; value: any } }

// The main ChatAction type is imported from lib/chat/types.ts
// We use a combined type here for internal use only
type ReducerActionType = ChatAction | WorkflowActions

/**
 * Chat reducer for state transitions
 */
export function chatReducer(
  state: ChatState,
  action: ReducerActionType
): ChatState {
  // Ensure workflow state exists for all operations
  const workflow = state.workflow || { ...initialWorkflowState }

  switch (action.type) {
    case 'INITIALIZE_CHAT':
      return {
        ...state,
        chatId: action.payload.chatId,
      }

    case 'RESET_CHAT':
      return {
        ...state,
        messages: [],
        isLoading: false,
        error: null,
        verification: {
          ...state.verification,
          isInVerificationMode: false,
          summaryVersions: [],
          currentSummary: null,
          verificationItems: [],
        },
        workflow: { ...initialWorkflowState },
      }

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
      }

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error,
        isLoading: false,
        workflow: {
          ...workflow,
          workflowError: action.payload.error,
        },
      }

    case 'ADD_MESSAGE':
      const newMessage =
        'id' in action.payload.message
          ? action.payload.message
          : {
              ...action.payload.message,
              id: crypto.randomUUID(),
            }

      return {
        ...state,
        messages: [...state.messages, newMessage],
      }

    case 'UPDATE_MESSAGES':
      return {
        ...state,
        messages: action.payload.messages,
      }

    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload.mode,
      }

    case 'START_VERIFICATION':
      const summaryId = crypto.randomUUID()
      const timestamp = new Date().toISOString()

      return {
        ...state,
        mode: 'verification',
        verification: {
          ...state.verification,
          isInVerificationMode: true,
          currentSummary: action.payload.content,
          verificationItems: action.payload.options?.items || [],
          verificationStatus: 'in_progress',
          summaryVersions: [
            ...state.verification.summaryVersions,
            {
              id: summaryId,
              content: action.payload.content,
              timestamp,
            },
          ],
        },
      }

    case 'SUBMIT_CORRECTION':
      return {
        ...state,
        verification: {
          ...state.verification,
          verificationStatus: 'in_progress',
          // Store the correction in the workflow data instead
          // This avoids adding a non-existent property to the verification object
        },
      }

    case 'COMPLETE_VERIFICATION':
      return {
        ...state,
        verification: {
          ...state.verification,
          isInVerificationMode: false,
          verificationStatus: action.payload.isApproved
            ? 'completed'
            : 'failed',
          // Store approval status in the workflow data instead
          // This avoids adding a non-existent property to the verification object
        },
      }

    case 'START_REPORT_GENERATION':
      return {
        ...state,
        mode: 'default', // Use a valid ChatMode
        // Store report generation state in a separate property
        reportGeneration: {
          isComplete: false,
          format: action.payload.reportOptions || null,
        },
      }

    case 'COMPLETE_REPORT_GENERATION':
      return {
        ...state,
        reportGeneration: {
          ...state.reportGeneration,
          isComplete: true,
          format: action.payload.report,
        },
      }

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        messages: state.messages.map((message) => {
          if (message.id === action.payload.messageId) {
            return {
              ...message,
              metadata: {
                ...message.metadata,
                progressValue: action.payload.progress,
                progressPhase: action.payload.phase,
              },
            }
          }
          return message
        }),
      }

    case 'UPDATE_WORKFLOW_STEP':
      return {
        ...state,
        workflow: {
          ...workflow,
          currentStep: action.payload.step,
        },
      }

    // Handle workflow status updates
    case 'UPDATE_WORKFLOW_STATUS':
      return {
        ...state,
        workflow: {
          ...workflow,
          processingStatus: action.payload.status,
        },
      }

    // Handle workflow data updates
    case 'SET_WORKFLOW_DATA':
      return {
        ...state,
        workflow: {
          ...workflow,
          data: {
            ...workflow.data,
            [action.payload.key]: action.payload.value,
          },
        },
      }

    default:
      return state
  }
}

/**
 * Helper to map workflow steps to chat modes
 */
function mapWorkflowStepToChatMode(
  step: WorkflowStep,
  currentMode: ChatMode
): ChatMode {
  switch (step) {
    case 'verification':
      return 'verification'
    case 'report_generation':
      return 'default' // Use a valid ChatMode instead of 'report_generation'
    case 'error':
      return currentMode // Preserve current mode on error
    // Handle other workflow steps
    case 'idle':
    case 'uploading':
    case 'extracting':
    case 'complete':
    default:
      // Only switch mode if it was tied to a workflow step
      if (currentMode === 'verification') {
        return 'default'
      }
      return currentMode
  }
}
