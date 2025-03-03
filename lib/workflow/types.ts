// lib/workflow/types.ts
/**
 * @fileoverview Core workflow types for the entire application
 * 
 * This file defines the foundational types for the workflow system.
 * All other files that need workflow types should import from here.
 */

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
 * Verification status type used throughout the application
 * 
 * This is the canonical type for verification status.
 * Use this type anywhere verification status is needed.
 */
export type VerificationStatusType =
  | 'pending'     // Waiting for verification to begin
  | 'in_progress' // Verification is actively being performed
  | 'completed'   // Verification has been successfully completed
  | 'failed'      // Verification has failed or been rejected

/**
 * Core correction entry for tracking changes during verification
 */
export interface CorrectionEntry {
  /**
   * Unique identifier for this correction
   */
  id: string

  /**
   * The text of the correction request
   */
  text: string

  /**
   * Timestamp when the correction was made (ISO format)
   */
  timestamp: string

  /**
   * Optional user ID who made the correction
   */
  userId?: string
}

/**
 * Canonical verification metadata format for tracking the verification process
 * 
 * This is the source of truth for verification metadata throughout the application.
 */
export interface VerificationMetadata {
  /**
   * Current verification status
   */
  verificationStatus: VerificationStatusType

  /**
   * ID of the original summary or content version
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
   * Timestamp when the content was verified (ISO format)
   */
  verifiedAt?: string

  /**
   * User ID who verified the content
   */
  verifiedBy?: string

  /**
   * History of corrections applied
   */
  corrections: CorrectionEntry[]

  /**
   * Extracted document data - can be any structured data
   * that requires verification
   */
  extractedData?: any

  /**
   * Timestamp when verification started (ISO format)
   */
  startedAt?: string

  /**
   * Timestamp of last update (ISO format)
   */
  lastUpdated?: string
  
  /**
   * Optional confidence score for the verification (0-1)
   */
  confidenceScore?: number
  
  /**
   * Optional reason for rejection if status is 'failed'
   */
  rejectionReason?: string
}

/**
 * Message type - categorizes messages for specialized handling
 */
export type MessageType = 
  | 'summary'              // Contains summary content to be verified
  | 'verification_request' // Requests verification of content
  | 'correction'           // Contains a correction to previous content
  | 'progress'             // Progress update for a long-running operation
  | 'research'             // Research content from external sources
  | 'report'               // Formal report content
  | 'chat'                 // Regular chat message
  | 'system'               // System notification or status message
  | 'error'                // Error message

/**
 * Canonical message metadata for the entire application
 * 
 * This is the source of truth for message metadata throughout the system.
 * It provides a consistent way to categorize and track message properties.
 */
export interface MessageMetadata {
  /**
   * Primary message type for categorization
   */
  type?: MessageType
  
  /**
   * Legacy type flags - will be deprecated in future
   * @deprecated Use the type field instead
   */
  isSummary?: boolean
  isVerificationRequest?: boolean
  isCorrection?: boolean
  isProgress?: boolean
  isResearch?: boolean
  isReport?: boolean
  isSystem?: boolean
  isError?: boolean

  /**
   * ID of the content version this message refers to
   */
  contentVersionId?: string
  
  /**
   * Legacy version ID - will be standardized to contentVersionId
   * @deprecated Use contentVersionId instead
   */
  summaryVersionId?: string

  /**
   * Progress tracking for long-running operations
   */
  progress?: {
    /**
     * Progress value (0-100)
     */
    value: number
    
    /**
     * Current processing phase
     */
    phase: string
    
    /**
     * Start timestamp (ISO format)
     */
    startedAt?: string
    
    /**
     * Estimated completion time (ISO format)
     */
    estimatedCompletionAt?: string
  }
  
  /**
   * Legacy progress fields - will be consolidated
   * @deprecated Use the progress object instead
   */
  progressValue?: number
  progressPhase?: string

  /**
   * Reference to verification metadata if applicable
   */
  verificationMetadata?: VerificationMetadata

  /**
   * Associated document ID if relevant
   */
  documentId?: string
  
  /**
   * Associated patient ID if relevant
   */
  patientId?: string
  
  /**
   * Source documents if message contains referenced content
   */
  sourceDocuments?: string[]
  
  /**
   * Custom metadata specific to this message
   * This allows for extensibility without changing the interface
   */
  [key: string]: any
}

/**
 * Message type checking utilities
 * 
 * These functions provide a consistent way to check message types
 * while supporting both the new type field and legacy boolean flags
 */
export const getMessageType = (metadata?: MessageMetadata): MessageType | undefined => {
  if (!metadata) return undefined
  
  // First check for explicit type field
  if (metadata.type) return metadata.type
  
  // Then check legacy flags
  if (metadata.isVerificationRequest) return 'verification_request'
  if (metadata.isSummary) return 'summary'
  if (metadata.isCorrection) return 'correction'
  if (metadata.isProgress) return 'progress'
  if (metadata.isResearch) return 'research'
  if (metadata.isReport) return 'report'
  if (metadata.isSystem) return 'system'
  if (metadata.isError) return 'error'
  
  // Default to regular chat message
  return 'chat'
}

export const isMessageOfType = (
  metadata: MessageMetadata | undefined,
  type: MessageType
): boolean => {
  if (!metadata) return false
  return getMessageType(metadata) === type
}

export const isVerificationMessage = (metadata?: MessageMetadata): boolean =>
  isMessageOfType(metadata, 'verification_request') || metadata?.isVerificationRequest === true

export const isSummaryMessage = (metadata?: MessageMetadata): boolean => 
  isMessageOfType(metadata, 'summary') || metadata?.isSummary === true

export const isCorrectionMessage = (metadata?: MessageMetadata): boolean =>
  isMessageOfType(metadata, 'correction') || metadata?.isCorrection === true

export const isProgressMessage = (metadata?: MessageMetadata): boolean =>
  isMessageOfType(metadata, 'progress') || metadata?.isProgress === true

export const isResearchMessage = (metadata?: MessageMetadata): boolean =>
  isMessageOfType(metadata, 'research') || metadata?.isResearch === true

export const isReportMessage = (metadata?: MessageMetadata): boolean =>
  isMessageOfType(metadata, 'report') || metadata?.isReport === true

/**
 * Verification status helper functions
 * 
 * These utilities provide a type-safe way to check verification statuses
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
