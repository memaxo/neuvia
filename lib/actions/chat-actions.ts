import type { ChatAction, ChatMode, Message, ReportOptions } from '@/lib/chat/types';
import type { WorkflowStep } from '@/lib/workflow/types';
import type { VerificationOptions } from '@/lib/processing/types/verification';

/**
 * Type-safe action creators for chat actions
 */
export const chatActions = {
  initializeChat: (chatId: string): ChatAction => ({
    type: 'INITIALIZE_CHAT',
    payload: { chatId }
  }),
  
  resetChat: (): ChatAction => ({
    type: 'RESET_CHAT'
  }),
  
  setLoading: (isLoading: boolean): ChatAction => ({
    type: 'SET_LOADING',
    payload: { isLoading }
  }),
  
  setError: (error: string | null): ChatAction => ({
    type: 'SET_ERROR',
    payload: { error }
  }),
  
  addMessage: (message: Message | Omit<Message, 'id'>): ChatAction => ({
    type: 'ADD_MESSAGE',
    payload: { message }
  }),
  
  updateMessages: (messages: Message[]): ChatAction => ({
    type: 'UPDATE_MESSAGES',
    payload: { messages }
  }),
  
  setMode: (mode: ChatMode): ChatAction => ({
    type: 'SET_MODE',
    payload: { mode }
  }),
  
  startVerification: (content: string, options?: VerificationOptions): ChatAction => ({
    type: 'START_VERIFICATION',
    payload: { content, options }
  }),
  
  submitCorrection: (correction: string): ChatAction => ({
    type: 'SUBMIT_CORRECTION',
    payload: { correction }
  }),
  
  completeVerification: (isApproved: boolean): ChatAction => ({
    type: 'COMPLETE_VERIFICATION',
    payload: { isApproved }
  }),
  
  startReportGeneration: (reportOptions?: ReportOptions): ChatAction => ({
    type: 'START_REPORT_GENERATION',
    payload: { reportOptions }
  }),
  
  completeReportGeneration: (report: any): ChatAction => ({
    type: 'COMPLETE_REPORT_GENERATION',
    payload: { report }
  }),
  
  updateProgress: (messageId: string, progress: number, phase: string): ChatAction => ({
    type: 'UPDATE_PROGRESS',
    payload: { messageId, progress, phase }
  }),
  
  updateWorkflowStep: (step: WorkflowStep): ChatAction => ({
    type: 'UPDATE_WORKFLOW_STEP',
    payload: { step }
  })
}; 