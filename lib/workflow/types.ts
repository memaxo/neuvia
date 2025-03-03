// lib/workflow/types.ts
import type { Database } from '@/lib/supabase'

/**
 * Unified workflow step type for the entire application
 *
 * This type directly extends the database workflow_step enum with additional application-specific steps.
 * This ensures we maintain compatibility with the database while supporting app-only operations.
 */
export type WorkflowStep =
  // All database-defined workflow steps
  | Database['public']['Enums']['workflow_step']
  // Application-specific extensions
  | 'research' // Research phase
  | 'report_presentation' // Report presentation
  // Verification substates - these now match the database enum values
  | 'verification_pending' // Waiting for user to verify
  | 'verification_in_progress' // User is reviewing/correcting
  | 'verification_completed' // User has completed verification
  | 'verification_failed' // Verification failed
  | 'error' // General error state

/**
 * Workflow transition type for state machine validation
 */
export interface WorkflowTransition {
  from: WorkflowStep
  to: WorkflowStep
  allowData?: boolean // Whether this transition can include additional metadata
  requireData?: boolean // Whether this transition requires additional metadata
  description?: string // Human-readable description of this transition
}

/**
 * All allowed workflow transitions in the application
 * This forms the basis of our state machine validation
 */
export const ALLOWED_TRANSITIONS: WorkflowTransition[] = [
  // Initial state transitions
  { from: 'idle', to: 'uploading', allowData: true, description: 'Start document upload' },
  { from: 'idle', to: 'chat_started', allowData: true, description: 'Start chat without document' },
  { from: 'idle', to: 'research', allowData: true, description: 'Start research mode' },
  
  // Upload flow
  { from: 'uploading', to: 'extracting', allowData: true, description: 'Document uploaded, starting extraction' },
  { from: 'extracting', to: 'verification', allowData: true, description: 'Extraction complete, ready for verification' },
  { from: 'extracting', to: 'verification_pending', allowData: true, description: 'Extraction complete, waiting for verification' },
  
  // Verification flow
  { from: 'verification', to: 'verification_pending', allowData: true, description: 'Preparing verification' },
  { from: 'verification_pending', to: 'verification_in_progress', allowData: true, description: 'User reviewing verification' },
  { from: 'verification_in_progress', to: 'verification_completed', allowData: true, description: 'User completed verification' },
  { from: 'verification_in_progress', to: 'verification_failed', allowData: true, description: 'Verification rejected' },
  { from: 'verification_completed', to: 'report_generation', allowData: true, description: 'Starting report generation' },
  { from: 'verification_failed', to: 'verification_in_progress', allowData: true, description: 'Retry verification' },
  
  // Report generation flow
  { from: 'report_generation', to: 'complete', allowData: true, description: 'Report generated successfully' },
  { from: 'report_generation', to: 'report_presentation', allowData: true, description: 'Showing generated report' },
  { from: 'report_presentation', to: 'complete', allowData: true, description: 'Workflow complete' },
  
  // Chat flow
  { from: 'chat_started', to: 'chat_in_progress', allowData: true, description: 'Processing chat message' },
  { from: 'chat_in_progress', to: 'chat_completed', allowData: true, description: 'Chat message processed' },
  { from: 'chat_completed', to: 'chat_in_progress', allowData: true, description: 'Processing another message' },
  
  // Research flow
  { from: 'research', to: 'report_generation', allowData: true, description: 'Research complete, generating report' },
  
  // Complete state can transition back to several states for new operations
  { from: 'complete', to: 'idle', description: 'Reset workflow' },
  { from: 'complete', to: 'chat_in_progress', allowData: true, description: 'Continue with chat after completion' },
  { from: 'complete', to: 'uploading', allowData: true, description: 'Upload new document after completion' },
  
  // Error recovery paths
  { from: 'error', to: 'idle', description: 'Reset after error' },
  { from: 'error', to: 'uploading', allowData: true, description: 'Retry upload after error' },
  { from: 'error', to: 'extracting', allowData: true, description: 'Retry extraction after error' },
  { from: 'error', to: 'verification', allowData: true, description: 'Return to verification after error' },
  { from: 'error', to: 'report_generation', allowData: true, description: 'Retry report generation after error' },
  
  // Any state can transition to error
  { from: 'idle', to: 'error', requireData: true, description: 'Error in idle state' },
  { from: 'uploading', to: 'error', requireData: true, description: 'Error during upload' },
  { from: 'extracting', to: 'error', requireData: true, description: 'Error during extraction' },
  { from: 'verification', to: 'error', requireData: true, description: 'Error during verification' },
  { from: 'verification_pending', to: 'error', requireData: true, description: 'Error in verification pending' },
  { from: 'verification_in_progress', to: 'error', requireData: true, description: 'Error during verification process' },
  { from: 'verification_completed', to: 'error', requireData: true, description: 'Error after verification completion' },
  { from: 'report_generation', to: 'error', requireData: true, description: 'Error during report generation' },
  { from: 'complete', to: 'error', requireData: true, description: 'Error in completed state' },
  { from: 'chat_started', to: 'error', requireData: true, description: 'Error starting chat' },
  { from: 'chat_in_progress', to: 'error', requireData: true, description: 'Error during chat' },
  { from: 'chat_completed', to: 'error', requireData: true, description: 'Error after chat completion' },
  { from: 'research', to: 'error', requireData: true, description: 'Error during research' },
  { from: 'report_presentation', to: 'error', requireData: true, description: 'Error during report presentation' }
]

/**
 * Processing phases for status tracking
 */
export type ProcessingPhase =
  | 'initialization'
  | 'uploading'
  | 'extraction'
  | 'analysis'
  | 'verification'
  | 'correction'
  | 'research'
  | 'report_generation'
  | 'completion'
  | 'extraction_completed' // Added to match the phase used in patient-summary.ts
  | 'error'

/**
 * Workflow state interface representing the current state of a workflow
 */
export interface WorkflowState {
  step: WorkflowStep
  progress: number
  phase?: ProcessingPhase
  error?: string | null
  metadata?: Record<string, any>
  timestamp: Date
}

/**
 * Verification status type for chat-based verification
 */
export type VerificationStatusType =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'

/**
 * Verification metadata for tracking the verification process
 */
export interface VerificationMetadata {
  /**
   * Current verification status
   */
  verificationStatus: VerificationStatusType

  /**
   * ID of the original summary
   */
  originalSummaryId: string

  /**
   * ID of the current version being verified
   */
  currentVersionId: string

  /**
   * Number of corrections applied
   */
  correctionCount: number

  /**
   * Timestamp when the summary was verified
   */
  verifiedAt?: string

  /**
   * User ID who verified the summary
   */
  verifiedBy?: string

  /**
   * History of corrections applied
   */
  corrections: Array<{
    /**
     * Correction ID
     */
    id: string

    /**
     * Correction text
     */
    text: string

    /**
     * Timestamp when correction was made
     */
    timestamp: string
  }>

  /**
   * Extracted document data
   */
  extractedData?: any

  /**
   * Timestamp when verification started
   */
  startedAt?: string

  /**
   * Timestamp of last update
   */
  lastUpdated?: string
}

/**
 * Message metadata for chat-based verification
 */
export interface MessageMetadata {
  /**
   * Whether this message contains a summary
   */
  isSummary?: boolean

  /**
   * Whether this message is requesting verification
   */
  isVerificationRequest?: boolean

  /**
   * Whether this message is a correction to a summary
   */
  isCorrection?: boolean

  /**
   * Whether this message is a progress update
   */
  isProgress?: boolean

  /**
   * ID of the summary version this message refers to
   */
  summaryVersionId?: string

  /**
   * Progress value (0-100) for progress messages
   */
  progressValue?: number

  /**
   * Current phase for progress messages
   */
  progressPhase?: string

  /**
   * Reference to verification metadata if applicable
   */
  verificationMetadata?: VerificationMetadata

  /**
   * Custom metadata specific to this message
   */
  [key: string]: any
}

/**
 * Union type helpers for message type checking
 */
export const isVerificationMessage = (metadata?: MessageMetadata): boolean =>
  metadata?.isVerificationRequest === true

export const isSummaryMessage = (metadata?: MessageMetadata): boolean =>
  metadata?.isSummary === true

export const isCorrectionMessage = (metadata?: MessageMetadata): boolean =>
  metadata?.isCorrection === true

export const isProgressMessage = (metadata?: MessageMetadata): boolean =>
  metadata?.isProgress === true

/**
 * Verification status helper functions
 */
export const isVerificationComplete = (
  metadata?: VerificationMetadata
): boolean => metadata?.verificationStatus === 'completed'

export const isVerificationInProgress = (
  metadata?: VerificationMetadata
): boolean => metadata?.verificationStatus === 'in_progress'

export const isVerificationPending = (
  metadata?: VerificationMetadata
): boolean => metadata?.verificationStatus === 'pending'

export const isVerificationFailed = (
  metadata?: VerificationMetadata
): boolean => metadata?.verificationStatus === 'failed'

/**
 * Options for workflow operations
 */
export interface WorkflowOptions<T = any> {
  workflowId?: string
  onProgress?: (progress: number, phase?: string) => void
  onStatusUpdate?: (status: string) => void
  onSuccess?: (result: T) => void
  onError?: (error: string) => void
}

/**
 * Options specific to verification workflows
 */
export interface VerificationWorkflowOptions extends WorkflowOptions {
  /**
   * Original summary ID
   */
  originalSummaryId: string

  /**
   * User ID performing verification
   */
  verifiedBy?: string

  /**
   * Maximum time allowed for verification (in milliseconds)
   */
  timeoutMs?: number

  /**
   * Whether to automatically mark as verified after timeout
   */
  autoVerifyOnTimeout?: boolean
}
