/**
 * @fileoverview Core chat types for the application
 *
 * This file defines the chat-specific types for the application.
 * It imports canonical types from workflow/types.ts as the source of truth
 * and extends them with chat-specific needs.
 *
 * IMPORTANT: This file should NOT define duplicates of types already defined in
 * lib/workflow/types.ts or lib/processing/types/verification/index.ts.
 * Instead, it should import and re-export those types.
 */

// Import from both workflow hooks and Zustand store
import type { useProcessingWorkflow } from '@/lib/hooks/use-processing-workflow'
import type { useChatStore } from '@/stores/chat-store'

// Import core workflow and verification types
import type {
  VerificationOptions as BaseVerificationOptions,
  VerificationItem,
  VerificationResult,
} from '@/lib/processing/types/verification'

// Import canonical workflow types
import type {
  CorrectionEntry,
  MessageMetadata as WorkflowMessageMetadata,
  MessageType,
  VerificationMetadata,
  VerificationStatusType,
  WorkflowStep,
  ProcessingPhase,
} from '@/lib/workflow/types'

// Import utility functions as values
import {
  isMessageOfType,
  isVerificationMessage,
  isSummaryMessage as isSummaryMetadata,
  isCorrectionMessage as isCorrectionMetadata,
  isProgressMessage as isProgressMetadata,
  isResearchMessage as isResearchMetadata,
  isReportMessage as isReportMetadata,
} from '@/lib/workflow/types'

// Import AI SDK types
import type { Message as AIMessage } from 'ai'

// Import for document types
import type { ExtractedDocument } from '@/lib/processing/types/extraction'
import type {
  ResearchResult,
  ResearchDocument,
} from '@/lib/processing/types/research'
import type { ReportDocument } from '@/lib/types/report'

// Re-export core types for easier importing
export type {
  CorrectionEntry,
  MessageType,
  VerificationMetadata,
  VerificationStatusType,
  WorkflowStep,
  ProcessingPhase,
  VerificationItem,
  VerificationResult,
}

// Export individual utility functions
export {
  isMessageOfType,
  isVerificationMessage,
  isSummaryMetadata,
  isCorrectionMetadata,
  isProgressMetadata,
  isResearchMetadata,
  isReportMetadata,
}

// Use the canonical MessageMetadata from workflow types
export type MessageMetadata = WorkflowMessageMetadata

// Extend VerificationOptions with items for backward compatibility
export interface VerificationOptions extends BaseVerificationOptions {
  /**
   * Optional array of verification items
   */
  items?: VerificationItem[]
}

export type ChatMode =
  | 'default' // Regular chat interaction
  | 'patient_summary' // Patient summary generation and verification
  | 'research' // Research assistant mode
  | 'diagnosis' // Diagnosis support mode
  | 'verification' // Verification-specific mode

// Research and report related types
export interface ResearchOptions {
  depth?: 'basic' | 'comprehensive' | 'expert'
  sources?: boolean
  latestOnly?: boolean
}

export interface ReportFormat {
  format: 'markdown' | 'pdf' | 'docx' | 'html' | 'json'
  style?: 'clinical' | 'academic' | 'simplified'
  metadataInFooter?: boolean
}

/**
 * Legacy message interface
 *
 * @deprecated Use ChatMessage with MessageMetadata instead
 */
export interface Message extends AIMessage {
  metadata?: {
    documentId?: string
    title?: string
    isReport?: boolean
    isResearch?: boolean
    researchOptions?: ResearchOptions
    reportFormat?: ReportFormat
    verificationStatus?: 'pending' | 'verified' | 'rejected'
    sourceDocuments?: string[]
    [key: string]: unknown
  }
}

/**
 * Check if a message is a report
 *
 * @deprecated Use isReportMessageMetadata or isMessageOfType(metadata, 'report') instead
 */
export function isReportMessage(message: ChatMessage): boolean {
  return Boolean(message.metadata?.isReport)
}

/**
 * Check if a message is a research message
 *
 * @deprecated Use isResearchMessageMetadata or isMessageOfType(metadata, 'research') instead
 */
export function isResearchMessage(message: ChatMessage): boolean {
  return Boolean(message.metadata?.isResearch)
}

/**
 * Check if a message has verification metadata
 */
export function hasVerificationMetadata(message: ChatMessage): boolean {
  return (
    message.metadata !== undefined &&
    typeof message.metadata === 'object' &&
    message.metadata !== null &&
    ('verificationStatus' in message.metadata ||
      'isVerificationRequest' in message.metadata)
  )
}

/**
 * Chat System Types
 *
 * Definitions for chat interface components, state management, and
 * integrations with the verification workflow.
 */

/**
 * Enhanced chat message that extends AI SDK Message with our metadata
 *
 * This is the canonical message type that should be used throughout the application.
 * It integrates with the workflow system via the MessageMetadata type.
 */
export interface ChatMessage extends AIMessage {
  /**
   * Message metadata for advanced functionality
   */
  metadata?: MessageMetadata
}

/**
 * Chat session state
 */
export interface ChatSessionState {
  /**
   * Current chat ID
   */
  chatId: string | null

  /**
   * Chat messages
   */
  messages: ChatMessage[]

  /**
   * Current chat mode
   */
  mode: ChatMode

  /**
   * Whether a response is being generated
   */
  isLoading: boolean

  /**
   * Current workflow step
   */
  workflowStep: WorkflowStep

  /**
   * Current verification state (if in verification mode)
   */
  verification?: {
    /**
     * Items being verified
     */
    items: VerificationItem[]

    /**
     * Verification metadata
     */
    metadata: VerificationMetadata

    /**
     * Original content being verified
     */
    originalContent?: string

    /**
     * Current content after any corrections
     */
    currentContent?: string
  }

  /**
   * Error message if any
   */
  error?: string | null
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
      isCorrection?: boolean
      metadata?: MessageMetadata
    }
  ) => Promise<void>

  /**
   * Add a message to the chat (from any source)
   */
  addMessage: (message: ChatMessage | Omit<ChatMessage, 'id'>) => void

  /**
   * Start verification of content
   */
  startVerification: (
    content: string,
    options?: VerificationOptions
  ) => Promise<void>

  /**
   * Submit a correction to content being verified
   */
  submitCorrection: (correction: string) => Promise<void>

  /**
   * Complete verification
   */
  completeVerification: (isApproved: boolean) => Promise<VerificationResult>

  /**
   * Set the chat mode
   */
  setChatMode: (mode: ChatMode) => void

  /**
   * Clear all messages
   */
  clearMessages: () => void

  /**
   * Reset the chat to initial state
   */
  resetChat: () => void
}

/**
 * Chat context interface
 */
export interface ChatContextValue
  extends ChatSessionState,
    ChatContextMethods {}

/**
 * Extended Chat Context with Verification Support
 *
 * This extends the base chat context with verification-specific
 * methods and properties for managing the verification workflow.
 */
export interface ExtendedChatContextType
  extends Omit<ChatContextValue, 'verification'> {
  /**
   * Verification state
   */
  verification: {
    /**
     * Whether the chat is currently in verification mode
     */
    isInVerificationMode: boolean

    /**
     * The current summary being verified
     */
    currentSummary: string | null

    /**
     * History of summary versions
     *
     * @deprecated Use SummaryVersion[] type instead
     */
    summaryVersions: Array<{
      /**
       * Version ID
       */
      id: string

      /**
       * Summary content
       */
      content: string

      /**
       * Timestamp
       */
      timestamp: string
    }>

    /**
     * Current verification status
     */
    verificationStatus: VerificationStatusType

    /**
     * Items that require verification
     */
    verificationItems: VerificationItem[]

    /**
     * Verification metadata
     */
    metadata?: VerificationMetadata

    /**
     * Original content being verified
     */
    originalContent?: string

    /**
     * Current content after any corrections
     */
    currentContent?: string
  }

  /**
   * Add a system message
   */
  addSystemMessage: (
    content: string,
    type?: string,
    metadata?: MessageMetadata
  ) => ChatMessage

  /**
   * Post a summary for verification
   */
  postSummaryMessage: (summary: string) => ChatMessage

  /**
   * Handle corrections to a verified summary
   */
  handleCorrectionMessage: (correction: string) => Promise<void>

  /**
   * Update summary after a correction
   */
  updateSummaryAfterCorrection: (newSummary: string) => ChatMessage

  /**
   * Complete the verification process
   */
  confirmVerification: () => Promise<VerificationResult>

  /**
   * Update progress indicators in progress messages
   */
  updateExtractionProgress: (
    messageId: string,
    progress: number,
    phase: string,
    replace?: boolean
  ) => void

  /**
   * Access to the workflow context
   */
  workflow: ExtendedWorkflowResult

  /**
   * Generate a report
   */
  generateReport: () => Promise<void>

  /**
   * Format a report with specified format
   */
  formatReport: (format: ReportFormat) => Promise<void>

  /**
   * Report generation state
   */
  reportGeneration?: {
    isComplete: boolean
    format: ReportFormat | null

    /**
     * ID of the generated report
     */
    reportId?: string
  }
}

/**
 * Helper functions for chat messages
 *
 * These functions provide a convenient way to check message types
 * while maintaining backward compatibility with the legacy boolean flags.
 * They operate on ChatMessage instances rather than just metadata.
 */

/**
 * Helper function to capitalize the first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Factory function to create type guard functions for different message types
 *
 * @param messageType The type of message to check for
 * @returns A type guard function for the specified message type
 */
function createMessageTypeGuard<T extends MessageType>(messageType: T) {
  // Create the property name that would be used in metadata (e.g., 'isVerificationRequest')
  const metadataKey =
    `is${capitalizeFirst(messageType.replace(/_/g, ' ')).replace(/\s/g, '')}` as const

  // Return a type-predicate function
  return function (message: ChatMessage): message is ChatMessage & {
    metadata: { [K in typeof metadataKey]: true } | { type: T }
  } {
    return (
      isMessageOfType(message.metadata, messageType) ||
      (message.metadata !== undefined &&
        typeof message.metadata === 'object' &&
        message.metadata !== null &&
        typeof message.metadata[metadataKey] === 'boolean' &&
        message.metadata[metadataKey] === true)
    )
  }
}

/**
 * Check if a message is a verification request
 * @deprecated Use isVerificationRequestMessage instead
 */
export function isVerificationRequestMessage(
  message: ChatMessage
): message is ChatMessage & {
  metadata: { isVerificationRequest: true } | { type: 'verification_request' }
} {
  return createMessageTypeGuard('verification_request')(message)
}

/**
 * Check if a message contains a summary
 *
 * @param message The chat message to check
 * @returns True if this is a summary message
 */
export function isSummaryMessage(
  message: ChatMessage
): message is ChatMessage & {
  metadata: { isSummary: true } | { type: 'summary' }
} {
  return createMessageTypeGuard('summary')(message)
}

/**
 * Check if a message is a correction
 *
 * @param message The chat message to check
 * @returns True if this is a correction message
 */
export function isCorrectionMessage(
  message: ChatMessage
): message is ChatMessage & {
  metadata: { isCorrection: true } | { type: 'correction' }
} {
  return createMessageTypeGuard('correction')(message)
}

/**
 * Check if a message is a progress update
 *
 * @param message The chat message to check
 * @returns True if this is a progress message
 */
export function isProgressMessage(
  message: ChatMessage
): message is ChatMessage & {
  metadata: { isProgress: true } | { type: 'progress' }
} {
  return createMessageTypeGuard('progress')(message)
}

/**
 * Check if a message is a research message
 *
 * @param message The chat message to check
 * @returns True if this is a research message
 */
export function isResearchChatMessage(
  message: ChatMessage
): message is ChatMessage & {
  metadata: { isResearch: true } | { type: 'research' }
} {
  return createMessageTypeGuard('research')(message)
}

/**
 * Check if a message is a report message
 *
 * @param message The chat message to check
 * @returns True if this is a report message
 */
export function isReportChatMessage(
  message: ChatMessage
): message is ChatMessage & {
  metadata: { isReport: true } | { type: 'report' }
} {
  return createMessageTypeGuard('report')(message)
}

/**
 * Check if a message has error information
 *
 * @param message The chat message to check
 * @returns True if this is an error message
 */
export function isErrorMessage(message: ChatMessage): message is ChatMessage & {
  metadata: { isError: true } | { type: 'error' }
} {
  return createMessageTypeGuard('error')(message)
}

/**
 * Create a system message
 */
export function createSystemMessage(
  content: string,
  metadata?: MessageMetadata
): Omit<ChatMessage, 'id'> {
  return {
    content,
    role: 'system',
    createdAt: new Date(),
    metadata: {
      ...(metadata ?? {}),
      type: 'system',
      isSystem: true,
    },
  }
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(
  content: string,
  metadata?: MessageMetadata
): Omit<ChatMessage, 'id'> {
  return {
    content,
    role: 'assistant',
    createdAt: new Date(),
    metadata: metadata ?? {},
  }
}

/**
 * Create a user message
 */
export function createUserMessage(
  content: string,
  metadata?: MessageMetadata
): Omit<ChatMessage, 'id'> {
  return {
    content,
    role: 'user',
    createdAt: new Date(),
    metadata: metadata ?? {},
  }
}

/**
 * Result type for the useProcessingWorkflow hook
 *
 * Extended to support verification-specific methods that can
 * be integrated with the chat context.
 */
export type UseProcessingWorkflowResult = ReturnType<
  typeof useProcessingWorkflow
>

/**
 * Base interface for workflow result
 */
export interface WorkflowResult {
  // Core workflow state
  workflowStep: WorkflowStep
  error: string | null
  status: ProcessingStatus | 'idle' | 'processing' | 'success' | 'error'

  // Core workflow actions
  resetWorkflow: () => void
  processDocument: (
    file: File,
    patientId: string,
    documentType?: string,
    abortSignal?: AbortSignal
  ) => Promise<ExtractedDocument | null>

  // Document data
  extractedDocument: ExtractedDocument | null

  // Required workflow methods
  generateReport: () => Promise<void>
  formatReport: (format: ReportFormat) => Promise<void>
  completeVerification: (isApproved: boolean) => Promise<VerificationResult>
  processCorrection: (
    correctionText: string,
    currentSummary: string,
    messageId?: string
  ) => Promise<VerificationResult>

  // Optional workflow data
  researchResults?: Array<ResearchResult>
  researchDocument?: ResearchDocument | null
  reportData?: Record<string, unknown>
  formattedReport?: Record<string, unknown>
  reportDocument?: ReportDocument | null
}

/**
 * Union type for all possible workflow data types
 */
export type WorkflowData =
  | ExtractedDocument
  | ResearchDocument
  | ResearchResult
  | ReportDocument
  | Record<string, unknown>
  | null

/**
 * Extended workflow result with additional data
 */
export interface ExtendedWorkflowResult extends WorkflowResult {
  data?: WorkflowData
  chatId?: string
}

/**
 * Result type for the Zustand store
 *
 * This provides type information for components using the Zustand store
 */
export type ChatStoreState = ReturnType<typeof useChatStore.getState>

/**
 * Zustand chat store selector type helper
 */
export type ChatStoreSelector<T> = (state: ChatStoreState) => T

/**
 * Processing status for workflow operations
 */
export interface ProcessingStatus {
  /**
   * Current processing status
   */
  status: 'idle' | 'processing' | 'success' | 'error'

  /**
   * Current progress (0-100)
   */
  progress: number

  /**
   * Current processing phase
   */
  phase: ProcessingPhase

  /**
   * Start time of the current operation (ISO format)
   */
  startedAt?: string

  /**
   * Estimated completion time (ISO format)
   */
  estimatedCompletionAt?: string

  /**
   * Error message if any
   */
  error?: string | null
}

/**
 * Summary version tracking the history of content
 */
export interface SummaryVersion {
  /**
   * Unique identifier for this version
   */
  id: string

  /**
   * Content at this version
   */
  content: string

  /**
   * Timestamp for this version (ISO format)
   */
  timestamp: string

  /**
   * Optional user ID who created this version
   */
  userId?: string
}

/**
 * Verification state within the chat
 *
 * This represents the current state of content verification in the application.
 * It is the canonical interface for verification state in the chat system.
 */
export interface VerificationState {
  /**
   * Whether verification mode is active
   */
  isInVerificationMode: boolean

  /**
   * Current summary content being verified
   */
  currentSummary: string | null

  /**
   * History of summary versions
   */
  summaryVersions: SummaryVersion[]

  /**
   * Current verification status
   */
  verificationStatus: VerificationStatusType

  /**
   * Items requiring verification
   */
  verificationItems: VerificationItem[]

  /**
   * Verification metadata containing detailed state
   */
  metadata?: VerificationMetadata

  /**
   * Original content before corrections
   */
  originalContent?: string

  /**
   * Current content after any corrections
   */
  currentContent?: string
}

/**
 * Workflow state within the chat
 *
 * This represents the current workflow processing state in the application.
 * It is the canonical interface for workflow state in the chat system.
 */
export interface WorkflowState {
  /**
   * Current workflow step
   */
  currentStep: WorkflowStep

  /**
   * Current processing status
   */
  processingStatus: ProcessingStatus

  /**
   * Error message if any
   */
  workflowError: string | null

  /**
   * Additional workflow data
   *
   * This includes metadata about the current workflow state, previous steps,
   * and any processing-specific information.
   */
  data: Record<string, unknown>

  /**
   * Workflow ID for database persistence
   */
  workflowId?: string

  /**
   * Transition history for debugging
   */
  transitionHistory?: Array<{
    /**
     * Timestamp of the transition
     */
    timestamp: string

    /**
     * Source step
     */
    from: WorkflowStep

    /**
     * Target step
     */
    to: WorkflowStep

    /**
     * Metadata associated with this transition
     */
    metadata?: Record<string, unknown>
  }>
}

/**
 * Canonical chat state for the application
 *
 * This is the source of truth for chat state management.
 */
export interface ChatState {
  /**
   * Chat messages
   */
  messages: ChatMessage[]

  /**
   * Whether the chat is currently loading
   */
  isLoading: boolean

  /**
   * Error message if any
   */
  error: string | null

  /**
   * Current chat mode
   */
  mode: ChatMode

  /**
   * Current chat ID
   */
  chatId: string | null

  /**
   * Verification state
   */
  verification: VerificationState

  /**
   * Workflow state
   */
  workflow: WorkflowState

  /**
   * Report generation state
   */
  reportGeneration?: {
    /**
     * Whether report generation is complete
     */
    isComplete: boolean

    /**
     * Format of the generated report
     */
    format: ReportFormat | null

    /**
     * ID of the generated report
     */
    reportId?: string
  }
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
    verificationItems: [],
  },
  workflow: {
    currentStep: 'idle',
    processingStatus: {
      status: 'idle',
      progress: 0,
      phase: 'initialization',
    },
    workflowError: null,
    data: {},
  },
}

/**
 * Report generation options
 */
export interface ReportOptions {
  /**
   * Output format for the report
   */
  format?: 'markdown' | 'pdf' | 'docx' | 'html' | 'json'

  /**
   * Whether to include metadata in the report
   */
  includeMetadata?: boolean

  /**
   * Level of detail to include in the report
   */
  detailLevel?: 'basic' | 'standard' | 'comprehensive'
}

/**
 * Chat action types for state management
 *
 * These actions are used with dispatch functions in components to update chat state.
 * They follow a Flux/Redux-style pattern for predictable state management.
 */
export type ChatAction =
  | { type: 'INITIALIZE_CHAT'; payload: { chatId: string } }
  | { type: 'RESET_CHAT' }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } }
  | { type: 'SET_ERROR'; payload: { error: string | null } }
  | {
      type: 'ADD_MESSAGE'
      payload: { message: ChatMessage | Omit<ChatMessage, 'id'> }
    }
  | { type: 'UPDATE_MESSAGES'; payload: { messages: ChatMessage[] } }
  | { type: 'SET_MODE'; payload: { mode: ChatMode } }
  | {
      type: 'START_VERIFICATION'
      payload: { content: string; options?: VerificationOptions }
    }
  | { type: 'SUBMIT_CORRECTION'; payload: { correction: string } }
  | { type: 'COMPLETE_VERIFICATION'; payload: { isApproved: boolean } }
  | {
      type: 'START_REPORT_GENERATION'
      payload: { reportOptions?: ReportOptions }
    }
  | {
      type: 'COMPLETE_REPORT_GENERATION'
      payload: { report: Record<string, unknown> }
    }
  | {
      type: 'UPDATE_PROGRESS'
      payload: { messageId: string; progress: number; phase: string }
    }
  | {
      type: 'UPDATE_WORKFLOW_STEP'
      payload: {
        step: WorkflowStep
        metadata?: Record<string, unknown>
      }
    }

/**
 * Constants for workflow steps
 * This provides a type-safe way to reference workflow steps
 */
export const WORKFLOW_STEPS = {
  IDLE: 'idle' as const,
  UPLOADING: 'uploading' as const,
  EXTRACTING: 'extracting' as const,
  EXTRACTION_COMPLETED: 'extraction_completed' as const,
  VERIFICATION_PENDING: 'verification_pending' as const,
  VERIFICATION_IN_PROGRESS: 'verification_in_progress' as const,
  VERIFICATION_COMPLETED: 'verification_completed' as const,
  VERIFICATION_FAILED: 'verification_failed' as const,
  RESEARCH: 'research' as const,
  REPORT_GENERATION: 'report_generation' as const,
  REPORT_PRESENTATION: 'report_presentation' as const,
  COMPLETE: 'complete' as const,
  ERROR: 'error' as const,
} as const

/**
 * Type-safe workflow step type derived from the constants
 */
export type WorkflowStepType =
  (typeof WORKFLOW_STEPS)[keyof typeof WORKFLOW_STEPS]

/**
 * Generate a random UUID for message IDs
 */
function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Add a system message
 */
export function addSystemMessage(
  content: string,
  type?: MessageType,
  metadata?: MessageMetadata
): ChatMessage {
  return {
    id: generateId(),
    content,
    role: 'system',
    createdAt: new Date(),
    metadata: {
      ...(metadata || {}),
      type: type ?? 'system',
      isSystem: true,
    },
  }
}

/**
 * Update a summary after correction
 */
export function updateSummaryAfterCorrection(newSummary: string): ChatMessage {
  return {
    id: generateId(),
    content: newSummary,
    role: 'assistant',
    createdAt: new Date(),
    metadata: {
      isSummary: true,
      isVerified: true,
    },
  }
}
