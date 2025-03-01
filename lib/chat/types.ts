import type { Message as AIMessage } from 'ai';
import type { useProcessingWorkflow } from '@/lib/hooks/use-processing-workflow';
import type { 
  MessageMetadata as WorkflowMessageMetadata,
  VerificationMetadata,
  WorkflowStep 
} from '@/lib/workflow/types';
import type {
  VerificationItem,
  VerificationOptions,
  VerificationResult
} from '@/lib/processing/types/verification';

// Re-export MessageMetadata from workflow types
export type MessageMetadata = WorkflowMessageMetadata;

export type ChatMode = 
  | 'default'         // Regular chat interaction
  | 'patient_summary' // Patient summary generation and verification
  | 'research'        // Research assistant mode
  | 'diagnosis'       // Diagnosis support mode
  | 'verification';   // Verification-specific mode

// Research and report related types
export interface ResearchOptions {
  depth?: 'basic' | 'comprehensive' | 'expert';
  sources?: boolean;
  latestOnly?: boolean;
}

export interface ReportFormat {
  format: 'markdown' | 'pdf' | 'docx' | 'html' | 'json';
  style?: 'clinical' | 'academic' | 'simplified';
  metadataInFooter?: boolean;
}

// Legacy interfaces that will be replaced by the newer types below
export interface Message extends AIMessage {
  metadata?: {
    documentId?: string;
    title?: string;
    isReport?: boolean;
    isResearch?: boolean;
    researchOptions?: ResearchOptions;
    reportFormat?: ReportFormat;
    verificationStatus?: 'pending' | 'verified' | 'rejected';
    sourceDocuments?: string[];
    [key: string]: any;
  };
}

export function isReportMessage(message: Message): boolean {
  return message.metadata?.isReport === true;
}

export function isResearchMessage(message: Message): boolean {
  return message.metadata?.isResearch === true;
}

export function hasVerificationMetadata(message: Message): boolean {
  return !!message.metadata?.verificationStatus;
}

/**
 * Chat System Types
 * 
 * Definitions for chat interface components, state management, and
 * integrations with the verification workflow.
 */

/**
 * Enhanced chat message that extends AI SDK Message with our metadata
 */
export interface ChatMessage extends AIMessage {
  /**
   * Message metadata for advanced functionality
   */
  metadata?: MessageMetadata;
}

/**
 * Chat session state
 */
export interface ChatSessionState {
  /**
   * Current chat ID
   */
  chatId: string | null;
  
  /**
   * Chat messages
   */
  messages: ChatMessage[];
  
  /**
   * Current chat mode
   */
  mode: ChatMode;
  
  /**
   * Whether a response is being generated
   */
  isLoading: boolean;
  
  /**
   * Current workflow step
   */
  workflowStep: WorkflowStep;
  
  /**
   * Current verification state (if in verification mode)
   */
  verification?: {
    /**
     * Items being verified
     */
    items: VerificationItem[];
    
    /**
     * Verification metadata
     */
    metadata: VerificationMetadata;
    
    /**
     * Original content being verified
     */
    originalContent?: string;
    
    /**
     * Current content after any corrections
     */
    currentContent?: string;
  };
  
  /**
   * Error message if any
   */
  error?: string | null;
}

/**
 * Chat context methods
 */
export interface ChatContextMethods {
  /**
   * Send a user message to the chat
   */
  sendMessage: (
    message: string,
    options?: {
      isCorrection?: boolean;
      metadata?: MessageMetadata;
    }
  ) => Promise<void>;
  
  /**
   * Add a message to the chat (from any source)
   */
  addMessage: (
    message: ChatMessage | Omit<ChatMessage, 'id'>
  ) => void;
  
  /**
   * Start verification of content
   */
  startVerification: (
    content: string,
    options?: VerificationOptions
  ) => Promise<void>;
  
  /**
   * Submit a correction to content being verified
   */
  submitCorrection: (
    correction: string
  ) => Promise<void>;
  
  /**
   * Complete verification
   */
  completeVerification: (
    isApproved: boolean
  ) => Promise<VerificationResult>;
  
  /**
   * Set the chat mode
   */
  setChatMode: (mode: ChatMode) => void;
  
  /**
   * Clear all messages
   */
  clearMessages: () => void;
  
  /**
   * Reset the chat to initial state
   */
  resetChat: () => void;
}

/**
 * Chat context interface
 */
export interface ChatContextValue extends ChatSessionState, ChatContextMethods { }

/**
 * Extended Chat Context with Verification Support
 * 
 * This extends the base chat context with verification-specific
 * methods and properties for managing the verification workflow.
 */
export interface ExtendedChatContextType extends Omit<ChatContextValue, 'verification'> {
  /**
   * Verification state
   */
  verification: {
    /**
     * Whether the chat is currently in verification mode
     */
    isInVerificationMode: boolean;
    
    /**
     * The current summary being verified
     */
    currentSummary: string | null;
    
    /**
     * History of summary versions
     */
    summaryVersions: Array<{
      /**
       * Version ID
       */
      id: string;
      
      /**
       * Summary content
       */
      content: string;
      
      /**
       * Timestamp
       */
      timestamp: string;
    }>;
    
    /**
     * Current verification status
     */
    verificationStatus: 'pending' | 'in_progress' | 'completed';
    
    /**
     * Items that require verification
     */
    verificationItems: VerificationItem[];
    
    /**
     * Verification metadata
     */
    metadata?: VerificationMetadata;
    
    /**
     * Original content being verified
     */
    originalContent?: string;
    
    /**
     * Current content after any corrections
     */
    currentContent?: string;
  };
  
  /**
   * Add a system message
   */
  addSystemMessage: (
    content: string,
    type?: string,
    metadata?: any
  ) => Message;
  
  /**
   * Post a summary for verification
   */
  postSummaryMessage: (
    summary: string
  ) => Message;
  
  /**
   * Handle corrections to a verified summary
   */
  handleCorrectionMessage: (
    correction: string
  ) => Promise<void>;
  
  /**
   * Update summary after a correction
   */
  updateSummaryAfterCorrection: (
    newSummary: string
  ) => Message;
  
  /**
   * Complete the verification process
   */
  confirmVerification: () => Promise<VerificationResult>;
  
  /**
   * Update progress indicators in progress messages
   */
  updateExtractionProgress: (
    messageId: string,
    progress: number,
    phase: string,
    replace?: boolean
  ) => void;
  
  /**
   * Access to the workflow context
   */
  workflow: UseProcessingWorkflowResult;
}

/**
 * Helper functions for chat messages
 */

/**
 * Check if a message is a verification request
 */
export function isVerificationRequestMessage(message: ChatMessage): boolean {
  return message.metadata?.isVerificationRequest === true;
}

/**
 * Check if a message contains a summary
 */
export function isSummaryMessage(message: ChatMessage): boolean {
  return message.metadata?.isSummary === true;
}

/**
 * Check if a message is a correction
 */
export function isCorrectionMessage(message: ChatMessage): boolean {
  return message.metadata?.isCorrection === true;
}

/**
 * Check if a message is a progress update
 */
export function isProgressMessage(message: ChatMessage): boolean {
  return message.metadata?.isProgress === true;
}

/**
 * Create a system message with metadata
 */
export function createSystemMessage(
  content: string,
  metadata?: MessageMetadata
): Omit<ChatMessage, 'id'> {
  return {
    content,
    role: 'system',
    createdAt: new Date(),
    metadata
  };
}

/**
 * Create an assistant message with metadata
 */
export function createAssistantMessage(
  content: string,
  metadata?: MessageMetadata
): Omit<ChatMessage, 'id'> {
  return {
    content,
    role: 'assistant',
    createdAt: new Date(),
    metadata
  };
}

/**
 * Create a user message with metadata
 */
export function createUserMessage(
  content: string,
  metadata?: MessageMetadata
): Omit<ChatMessage, 'id'> {
  return {
    content,
    role: 'user',
    createdAt: new Date(),
    metadata
  };
}

/**
 * Result type for the useProcessingWorkflow hook
 * 
 * Extended to support verification-specific methods that can
 * be integrated with the chat context.
 */
export interface UseProcessingWorkflowResult extends ReturnType<typeof useProcessingWorkflow> {
  /**
   * Process a correction to a summary
   */
  processCorrection?: (
    currentSummary: string,
    correctionText: string,
    messageId?: string
  ) => Promise<{
    summaryId: string;
    summary: string;
    structuredData?: any;
    correctionCount: number;
  } | null>;
  
  /**
   * Complete the verification process
   */
  completeVerification?: (
    isApproved: boolean
  ) => Promise<VerificationResult | null>;
}

/**
 * Chat reducer state management
 */

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  mode: ChatMode;
  chatId: string | null;
  verification: {
    isInVerificationMode: boolean;
    currentSummary: string | null;
    summaryVersions: Array<{id: string; content: string; timestamp: string}>;
    verificationStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
    verificationItems: VerificationItem[];
  };
}

export const initialChatState: ChatState = {
  messages: [],
  isLoading: false,
  error: null,
  mode: 'default',
  chatId: null,
  verification: {
    isInVerificationMode: false,
    currentSummary: null,
    summaryVersions: [],
    verificationStatus: 'pending',
    verificationItems: []
  }
};

/**
 * Chat action types
 */
export interface ReportOptions {
  format?: 'markdown' | 'pdf' | 'docx' | 'html' | 'json';
  includeMetadata?: boolean;
  detailLevel?: 'basic' | 'standard' | 'comprehensive';
}

export type ChatAction =
  | { type: 'INITIALIZE_CHAT'; payload: { chatId: string } }
  | { type: 'RESET_CHAT' }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } }
  | { type: 'SET_ERROR'; payload: { error: string | null } }
  | { type: 'ADD_MESSAGE'; payload: { message: Message | Omit<Message, 'id'> } }
  | { type: 'UPDATE_MESSAGES'; payload: { messages: Message[] } }
  | { type: 'SET_MODE'; payload: { mode: ChatMode } }
  | { type: 'START_VERIFICATION'; payload: { content: string; options?: VerificationOptions } }
  | { type: 'SUBMIT_CORRECTION'; payload: { correction: string } }
  | { type: 'COMPLETE_VERIFICATION'; payload: { isApproved: boolean } }
  | { type: 'START_REPORT_GENERATION'; payload: { reportOptions?: ReportOptions } }
  | { type: 'COMPLETE_REPORT_GENERATION'; payload: { report: any } }
  | { type: 'UPDATE_PROGRESS'; payload: { messageId: string; progress: number; phase: string } }
  | { type: 'UPDATE_WORKFLOW_STEP'; payload: { step: WorkflowStep } }; 