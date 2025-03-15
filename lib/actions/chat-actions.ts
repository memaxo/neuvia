import type {
  ChatAction,
  ChatMode,
  ReportOptions,
} from '@/lib/chat/types'
import type { ChatMessage } from '@/lib/types/chat'
import type { VerificationOptions } from '@/lib/processing/types/verification'
import type { WorkflowStep } from '@/lib/workflow/types'

/**
 * Type-safe action creators for chat actions.
 *
 * All action creators follow a consistent structure:
 * {
 *   type: string,
 *   payload: { data: { ... } },
 *   meta: { errorCode?: string }
 * }
 *
 * Error codes follow the same naming conventions as in the error modules.
 */
export const chatActions = {
  initializeChat: (chatId: string): ChatAction => ({
    type: 'INITIALIZE_CHAT',
    payload: { data: { chatId } },
    meta: {}
  }),

  resetChat: (): ChatAction => ({
    type: 'RESET_CHAT',
    payload: { data: {} },
    meta: {}
  }),

  setLoading: (isLoading: boolean): ChatAction => ({
    type: 'SET_LOADING',
    payload: { data: { isLoading } },
    meta: {}
  }),

  setError: (error: string | null, errorCode?: string): ChatAction => ({
    type: 'SET_ERROR',
    payload: { data: { error } },
    meta: { errorCode: errorCode || '' }
  }),

  addMessage: (message: ChatMessage | Omit<ChatMessage, 'id'>): ChatAction => ({
    type: 'ADD_MESSAGE',
    payload: { data: { message } },
    meta: {}
  }),

  updateMessages: (messages: Message[]): ChatAction => ({
    type: 'UPDATE_MESSAGES',
    payload: { data: { messages } },
    meta: {}
  }),

  setMode: (mode: ChatMode): ChatAction => ({
    type: 'SET_MODE',
    payload: { data: { mode } },
    meta: {}
  }),

  startVerification: (
    content: string,
    options?: VerificationOptions
  ): ChatAction => ({
    type: 'START_VERIFICATION',
    payload: { data: { content, options } },
    meta: {}
  }),

  submitCorrection: (correction: string): ChatAction => ({
    type: 'SUBMIT_CORRECTION',
    payload: { data: { correction } },
    meta: {}
  }),

  completeVerification: (isApproved: boolean): ChatAction => ({
    type: 'COMPLETE_VERIFICATION',
    payload: { data: { isApproved } },
    meta: {}
  }),

  startReportGeneration: (reportOptions?: ReportOptions): ChatAction => ({
    type: 'START_REPORT_GENERATION',
    payload: { data: { reportOptions } },
    meta: {}
  }),

  completeReportGeneration: (report: any): ChatAction => ({
    type: 'COMPLETE_REPORT_GENERATION',
    payload: { data: { report } },
    meta: {}
  }),

  updateProgress: (
    messageId: string,
    progress: number,
    phase: string
  ): ChatAction => ({
    type: 'UPDATE_PROGRESS',
    payload: { data: { messageId, progress, phase } },
    meta: {}
  }),

  updateWorkflowStep: (step: WorkflowStep): ChatAction => ({
    type: 'UPDATE_WORKFLOW_STEP',
    payload: { data: { step } },
    meta: {}
  }),
}