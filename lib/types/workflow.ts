/**
 * @fileoverview Canonical workflow types for the entire application
 * 
 
 * from various sources into a cohesive system.
 */

import type { UUID, Timestamp } from './base'

// ==========================================================================
// Core Workflow Types
// ==========================================================================

/**
 * Unified workflow step type for the entire application
 *
 * This type directly extends the database workflow_step enum with additional
 * application-specific steps. This ensures compatibility with the database
 * while supporting app-only operations.
 */
export enum WorkflowStep {
  // Core states
  IDLE = 'idle',
  ERROR = 'error',
  COMPLETE = 'complete',

  // Upload flow
  UPLOADING = 'uploading',
  EXTRACTING = 'extracting',

  // Verification flow
  VERIFICATION = 'verification',
  VERIFICATION_PENDING = 'verification_pending',
  VERIFICATION_IN_PROGRESS = 'verification_in_progress',
  VERIFICATION_COMPLETED = 'verification_completed',
  VERIFICATION_FAILED = 'verification_failed',

  // Report flow
  REPORT_GENERATION = 'report_generation',
  REPORT_PRESENTATION = 'report_presentation',

  // Chat flow
  CHAT_STARTED = 'chat_started',
  CHAT_IN_PROGRESS = 'chat_in_progress',
  CHAT_COMPLETED = 'chat_completed',

  // Research flow
  RESEARCH = 'research',
}

/**
 * Processing phases for status tracking
 */
export enum ProcessingPhase {
  INITIALIZATION = 'initialization',
  UPLOADING = 'uploading',
  EXTRACTION = 'extraction',
  EXTRACTION_COMPLETED = 'extraction_completed',
  ANALYSIS = 'analysis',
  VERIFICATION = 'verification',
  CORRECTION = 'correction',
  RESEARCH = 'research',
  REPORT_GENERATION = 'report_generation',
  COMPLETION = 'completion',
  ERROR = 'error',
}

/**
 * Workflow transition for state machine validation
 */
export interface WorkflowTransition {
  /**
   * Source workflow step
   */
  from: WorkflowStep

  /**
   * Target workflow step
   */
  to: WorkflowStep

  /**
   * Whether this transition can include additional metadata
   */
  allowData?: boolean

  /**
   * Whether this transition requires additional metadata
   */
  requireData?: boolean

  /**
   * Human-readable description of this transition
   */
  description?: string
}

/**
 * Workflow state interface representing the current state of a workflow
 *
 * This is the source of truth for workflow state throughout the application.
 */
export interface WorkflowState {
  /**
   * Current workflow step
   */
  currentStep: WorkflowStep

  /**
   * Progress indicator (0-100)
   */
  progress: number

  /**
   * Current processing phase within the step
   */
  phase?: ProcessingPhase

  /**
   * Error message if any
   */
  error?: string | null

  /**
   * Additional metadata specific to this workflow state
   */
  metadata?: Record<string, unknown>

  /**
   * Timestamp when this state was created/updated
   */
  timestamp: Timestamp
}

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
   * Start time of the current operation
   */
  startedAt?: Timestamp

  /**
   * Estimated completion time
   */
  estimatedCompletionAt?: Timestamp

  /**
   * Error message if any
   */
  error?: string | null
}

// ==========================================================================
// Message Types
// ==========================================================================

/**
 * Message type - categorizes messages for specialized handling
 */
export enum MessageType {
  SUMMARY = 'summary', // Contains summary content to be verified
  VERIFICATION_REQUEST = 'verification_request', // Requests verification of content
  CORRECTION = 'correction', // Contains a correction to previous content
  PROGRESS = 'progress', // Progress update for a long-running operation
  RESEARCH = 'research', // Research content from external sources
  REPORT = 'report', // Formal report content
  CHAT = 'chat', // Regular chat message
  SYSTEM = 'system', // System notification or status message
  ERROR = 'error', // Error message
}

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
  contentVersionId?: UUID

  /**
   * Legacy version ID - will be standardized to contentVersionId
   * @deprecated Use contentVersionId instead
   */
  summaryVersionId?: UUID

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
     * Start timestamp
     */
    startedAt?: Timestamp

    /**
     * Estimated completion time
     */
    estimatedCompletionAt?: Timestamp
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
  documentId?: UUID

  /**
   * Associated patient ID if relevant
   */
  patientId?: UUID

  /**
   * Source documents if message contains referenced content
   */
  sourceDocuments?: UUID[]

  /**
   * Custom metadata specific to this message
   * This allows for extensibility without changing the interface
   */
  [key: string]: unknown
}

// ==========================================================================
// Verification Types
// ==========================================================================

/**
 * Verification status type used throughout the application
 */
export enum VerificationStatusType {
  PENDING = 'pending', // Waiting for verification to begin
  IN_PROGRESS = 'in_progress', // Verification is actively being performed
  COMPLETED = 'completed', // Verification has been successfully completed
  FAILED = 'failed', // Verification has failed or been rejected
}

/**
 * Core correction entry for tracking changes during verification
 */
export interface CorrectionEntry {
  /**
   * Unique identifier for this correction
   */
  id: UUID

  /**
   * The text of the correction request
   */
  text: string

  /**
   * Timestamp when the correction was made
   */
  timestamp: Timestamp

  /**
   * Optional user ID who made the correction
   */
  userId?: UUID
}

/**
 * Version entry for tracking content changes in verification items
 */
export interface VersionHistoryEntry {
  /**
   * Unique identifier for this version
   */
  id: UUID

  /**
   * Content at this version
   */
  content: string

  /**
   * Timestamp of the change
   */
  timestamp: Timestamp

  /**
   * User who made the change (if applicable)
   */
  userId?: UUID

  /**
   * Optional reason for the change
   */
  reason?: string
}

/**
 * Canonical verification item that represents content requiring verification
 */
export interface VerificationItem {
  /**
   * Unique identifier for this verification item
   */
  id: UUID

  /**
   * Title/label for this verification item
   */
  title: string

  /**
   * Description of what needs to be verified
   */
  description?: string

  /**
   * Category of this verification item (e.g., "demographics", "diagnosis", "medications")
   */
  category?: string

  /**
   * Path or key that identifies this item within a larger data structure
   */
  path?: string

  /**
   * The original content extracted from the document
   */
  originalContent: string

  /**
   * The current content after any corrections
   */
  currentContent: string

  /**
   * Whether this item has been verified by a user
   */
  isVerified: boolean

  /**
   * Whether this item has been modified during verification
   */
  isModified: boolean

  /**
   * Confidence score for the extraction (0-1)
   * Higher values indicate higher confidence in the extraction
   */
  confidence?: number

  /**
   * History of content changes
   */
  changeHistory: VersionHistoryEntry[]

  /**
   * Metadata for this verification item
   */
  metadata?: Record<string, unknown>

  /**
   * Optional source location in the original document
   */
  source?: {
    /**
     * Document ID this item was extracted from
     */
    documentId: UUID

    /**
     * Page number where this content appears
     */
    page?: number

    /**
     * Section in the document where this content appears
     */
    section?: string

    /**
     * Start position in the document (character offset)
     */
    startPosition?: number

    /**
     * End position in the document (character offset)
     */
    endPosition?: number
  }
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
  originalSummaryId: UUID

  /**
   * ID of the current version being verified
   */
  currentVersionId: UUID

  /**
   * Number of corrections applied
   */
  correctionCount: number

  /**
   * Timestamp when the content was verified
   */
  verifiedAt?: Timestamp

  /**
   * User ID who verified the content
   */
  verifiedBy?: UUID

  /**
   * History of corrections applied
   */
  corrections: CorrectionEntry[]

  /**
   * Extracted document data - can be any structured data
   * that requires verification
   */
  extractedData?: unknown

  /**
   * Timestamp when verification started
   */
  startedAt?: Timestamp

  /**
   * Timestamp of last update
   */
  lastUpdated?: Timestamp

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
 * Options for the verification process
 */
export interface VerificationOptions {
  /**
   * Whether verification is required to proceed
   * If false, the system can auto-approve if needed
   */
  isRequired: boolean

  /**
   * Timeout for verification (in milliseconds)
   * After this time, the system will take the action specified
   * by autoApproveOnTimeout
   */
  timeoutMs?: number

  /**
   * Whether to auto-approve after timeout
   * If true, the system will automatically approve after the timeout
   * If false, the system will mark as failed after the timeout
   */
  autoApproveOnTimeout?: boolean

  /**
   * User ID performing verification
   */
  userId?: UUID

  /**
   * Threshold for confidence scores that require verification
   * Items with confidence below this value will be flagged for verification
   * Value should be between 0 and 1
   */
  confidenceThreshold?: number

  /**
   * Verification mode - controls how the verification is presented
   */
  mode?: 'full' | 'selective' | 'batch' | 'automated'

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>

  /**
   * Optional verification items to include
   */
  items?: VerificationItem[]

  /**
   * When to save verification state to the database
   */
  persistenceMode?: 'immediate' | 'onComplete' | 'onApproval' | 'manual'

  /**
   * Callback when verification is complete
   */
  onVerificationComplete?: (result: VerificationResult) => void
}

/**
 * Canonical verification result after user review
 */
export interface VerificationResult {
  /**
   * Whether verification was completed (regardless of approval status)
   */
  isCompleted: boolean

  /**
   * Whether the content was approved
   * If false and isCompleted is true, the content was rejected
   */
  isApproved: boolean

  /**
   * List of verification items with their final verification status
   */
  items: VerificationItem[]

  /**
   * Timestamp of verification completion
   */
  completedAt: Timestamp

  /**
   * User who completed verification
   */
  completedBy?: UUID

  /**
   * Time taken for verification (in milliseconds)
   */
  verificationTime?: number

  /**
   * Summary of changes made during verification
   */
  changeSummary?: {
    /**
     * Total number of items
     */
    totalItems: number

    /**
     * Number of items that were modified
     */
    modifiedItems: number

    /**
     * Number of items that were approved without changes
     */
    approvedWithoutChanges: number

    /**
     * Number of items that failed verification
     */
    failedItems: number
  }

  /**
   * Reason for rejection if the verification was not approved
   */
  rejectionReason?: string

  /**
   * Detailed metadata about the verification process
   */
  verificationMetadata: VerificationMetadata
}

/**
 * Options for workflow operations
 */
export interface WorkflowOptions<T = unknown> {
  /**
   * Workflow identifier
   */
  workflowId?: string

  /**
   * Progress callback
   */
  onProgress?: (progress: number, phase?: string) => void

  /**
   * Status update callback
   */
  onStatusUpdate?: (status: string) => void

  /**
   * Success callback
   */
  onSuccess?: (result: T) => void

  /**
   * Error callback
   */
  onError?: (error: string) => void
}

/**
 * Options specific to verification workflows
 */
export interface VerificationWorkflowOptions extends WorkflowOptions {
  /**
   * Original summary ID
   */
  originalSummaryId: UUID

  /**
   * User ID performing verification
   */
  verifiedBy?: UUID

  /**
   * Maximum time allowed for verification (in milliseconds)
   */
  timeoutMs?: number

  /**
   * Whether to automatically mark as verified after timeout
   */
  autoVerifyOnTimeout?: boolean
}

// ==========================================================================
// Utility Functions
// ==========================================================================

/**
 * Get the message type from metadata
 *
 * @param metadata Message metadata to check
 * @returns The message type or undefined
 */
export function getMessageType(
  metadata?: MessageMetadata
): MessageType | undefined {
  if (!metadata) return undefined

  // First check for explicit type field
  if (metadata.type !== undefined && metadata.type !== null)
    return metadata.type

  // Then check legacy flags
  if (metadata.isVerificationRequest === true)
    return MessageType.VERIFICATION_REQUEST
  if (metadata.isSummary === true) return MessageType.SUMMARY
  if (metadata.isCorrection === true) return MessageType.CORRECTION
  if (metadata.isProgress === true) return MessageType.PROGRESS
  if (metadata.isResearch === true) return MessageType.RESEARCH
  if (metadata.isReport === true) return MessageType.REPORT
  if (metadata.isSystem === true) return MessageType.SYSTEM
  if (metadata.isError === true) return MessageType.ERROR

  // Default to regular chat message
  return MessageType.CHAT
}

/**
 * Check if a message is of a specific type
 *
 * @param metadata Message metadata to check
 * @param type Type to check for
 * @returns True if the message is of the specified type
 */
export function isMessageOfType(
  metadata: MessageMetadata | undefined,
  type: MessageType
): boolean {
  if (!metadata) return false
  return getMessageType(metadata) === type
}

/**
 * Verification status checker functions for consistent status checks
 */

/**
 * Check if verification is complete
 */
export function isVerificationComplete(
  metadata?: VerificationMetadata
): boolean {
  return metadata?.verificationStatus === VerificationStatusType.COMPLETED
}

/**
 * Check if verification is in progress
 */
export function isVerificationInProgress(
  metadata?: VerificationMetadata
): boolean {
  return metadata?.verificationStatus === VerificationStatusType.IN_PROGRESS
}

/**
 * Check if verification is pending
 */
export function isVerificationPending(
  metadata?: VerificationMetadata
): boolean {
  return metadata?.verificationStatus === VerificationStatusType.PENDING
}

/**
 * Check if verification has failed
 */
export function isVerificationFailed(metadata?: VerificationMetadata): boolean {
  return metadata?.verificationStatus === VerificationStatusType.FAILED
}

/**
 * Create a new verification metadata object with default values
 */
export function createVerificationMetadata(
  originalSummaryId: UUID,
  currentVersionId: UUID
): VerificationMetadata {
  const now = new Date().toISOString()
  return {
    verificationStatus: VerificationStatusType.PENDING,
    originalSummaryId,
    currentVersionId,
    correctionCount: 0,
    corrections: [],
    startedAt: now,
    lastUpdated: now,
  }
}

/**
 * Update verification status with appropriate timestamps
 */
export function updateVerificationStatus(
  metadata: VerificationMetadata,
  status: VerificationStatusType
): VerificationMetadata {
  const now = new Date().toISOString()

  return {
    ...metadata,
    verificationStatus: status,
    lastUpdated: now,
    ...(status === VerificationStatusType.COMPLETED ? { verifiedAt: now } : {}),
    ...(status === VerificationStatusType.FAILED
      ? { rejectionReason: metadata.rejectionReason ?? 'Verification failed' }
      : {}),
  }
}

/**
 * Add a correction to verification metadata
 */
export function addCorrection(
  metadata: VerificationMetadata,
  correctionText: string,
  userId?: UUID
): VerificationMetadata {
  const now = new Date().toISOString()

  const newCorrection: CorrectionEntry = {
    id: `correction-${Date.now()}`,
    text: correctionText,
    timestamp: now,
    ...(userId !== undefined ? { userId } : {}),
  }

  return {
    ...metadata,
    verificationStatus: VerificationStatusType.IN_PROGRESS,
    correctionCount: metadata.correctionCount + 1,
    corrections: [...metadata.corrections, newCorrection],
    lastUpdated: now,
  }
}

// ==========================================================================
// Allowed Workflow Transitions
// ==========================================================================

/**
 * All allowed workflow transitions in the application
 * This forms the basis of our state machine validation
 */
export const ALLOWED_TRANSITIONS: WorkflowTransition[] = [
  // Initial state transitions
  {
    from: WorkflowStep.IDLE,
    to: WorkflowStep.UPLOADING,
    allowData: true,
    description: 'Start document upload',
  },
  {
    from: WorkflowStep.IDLE,
    to: WorkflowStep.CHAT_STARTED,
    allowData: true,
    description: 'Start chat without document',
  },
  {
    from: WorkflowStep.IDLE,
    to: WorkflowStep.RESEARCH,
    allowData: true,
    description: 'Start research mode',
  },

  // Upload flow
  {
    from: WorkflowStep.UPLOADING,
    to: WorkflowStep.EXTRACTING,
    allowData: true,
    description: 'Document uploaded, starting extraction',
  },
  {
    from: WorkflowStep.EXTRACTING,
    to: WorkflowStep.VERIFICATION,
    allowData: true,
    description: 'Extraction complete, ready for verification',
  },
  {
    from: WorkflowStep.EXTRACTING,
    to: WorkflowStep.VERIFICATION_PENDING,
    allowData: true,
    description: 'Extraction complete, waiting for verification',
  },

  // Verification flow
  {
    from: WorkflowStep.VERIFICATION,
    to: WorkflowStep.VERIFICATION_PENDING,
    allowData: true,
    description: 'Preparing verification',
  },
  {
    from: WorkflowStep.VERIFICATION_PENDING,
    to: WorkflowStep.VERIFICATION_IN_PROGRESS,
    allowData: true,
    description: 'User reviewing verification',
  },
  {
    from: WorkflowStep.VERIFICATION_IN_PROGRESS,
    to: WorkflowStep.VERIFICATION_COMPLETED,
    allowData: true,
    description: 'User completed verification',
  },
  {
    from: WorkflowStep.VERIFICATION_IN_PROGRESS,
    to: WorkflowStep.VERIFICATION_FAILED,
    allowData: true,
    description: 'Verification rejected',
  },
  {
    from: WorkflowStep.VERIFICATION_COMPLETED,
    to: WorkflowStep.REPORT_GENERATION,
    allowData: true,
    description: 'Starting report generation',
  },
  {
    from: WorkflowStep.VERIFICATION_FAILED,
    to: WorkflowStep.VERIFICATION_IN_PROGRESS,
    allowData: true,
    description: 'Retry verification',
  },

  // Report generation flow
  {
    from: WorkflowStep.REPORT_GENERATION,
    to: WorkflowStep.COMPLETE,
    allowData: true,
    description: 'Report generated successfully',
  },
  {
    from: WorkflowStep.REPORT_GENERATION,
    to: WorkflowStep.REPORT_PRESENTATION,
    allowData: true,
    description: 'Showing generated report',
  },
  {
    from: WorkflowStep.REPORT_PRESENTATION,
    to: WorkflowStep.COMPLETE,
    allowData: true,
    description: 'Workflow complete',
  },

  // Chat flow
  {
    from: WorkflowStep.CHAT_STARTED,
    to: WorkflowStep.CHAT_IN_PROGRESS,
    allowData: true,
    description: 'Processing chat message',
  },
  {
    from: WorkflowStep.CHAT_IN_PROGRESS,
    to: WorkflowStep.CHAT_COMPLETED,
    allowData: true,
    description: 'Chat message processed',
  },
  {
    from: WorkflowStep.CHAT_COMPLETED,
    to: WorkflowStep.CHAT_IN_PROGRESS,
    allowData: true,
    description: 'Processing another message',
  },

  // Research flow
  {
    from: WorkflowStep.RESEARCH,
    to: WorkflowStep.REPORT_GENERATION,
    allowData: true,
    description: 'Research complete, generating report',
  },

  // Complete state can transition back to several states for new operations
  {
    from: WorkflowStep.COMPLETE,
    to: WorkflowStep.IDLE,
    description: 'Reset workflow',
  },
  {
    from: WorkflowStep.COMPLETE,
    to: WorkflowStep.CHAT_IN_PROGRESS,
    allowData: true,
    description: 'Continue with chat after completion',
  },
  {
    from: WorkflowStep.COMPLETE,
    to: WorkflowStep.UPLOADING,
    allowData: true,
    description: 'Upload new document after completion',
  },

  // Error recovery paths
  {
    from: WorkflowStep.ERROR,
    to: WorkflowStep.IDLE,
    description: 'Reset after error',
  },
  {
    from: WorkflowStep.ERROR,
    to: WorkflowStep.UPLOADING,
    allowData: true,
    description: 'Retry upload after error',
  },
  {
    from: WorkflowStep.ERROR,
    to: WorkflowStep.EXTRACTING,
    allowData: true,
    description: 'Retry extraction after error',
  },
  {
    from: WorkflowStep.ERROR,
    to: WorkflowStep.VERIFICATION,
    allowData: true,
    description: 'Return to verification after error',
  },
  {
    from: WorkflowStep.ERROR,
    to: WorkflowStep.REPORT_GENERATION,
    allowData: true,
    description: 'Retry report generation after error',
  },

  // Any state can transition to error
  {
    from: WorkflowStep.IDLE,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error in idle state',
  },
  {
    from: WorkflowStep.UPLOADING,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error during upload',
  },
  {
    from: WorkflowStep.EXTRACTING,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error during extraction',
  },
  {
    from: WorkflowStep.VERIFICATION,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error during verification',
  },
  {
    from: WorkflowStep.VERIFICATION_PENDING,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error in verification pending',
  },
  {
    from: WorkflowStep.VERIFICATION_IN_PROGRESS,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error during verification process',
  },
  {
    from: WorkflowStep.VERIFICATION_COMPLETED,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error after verification completion',
  },
  {
    from: WorkflowStep.VERIFICATION_FAILED,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error after verification failed',
  },
  {
    from: WorkflowStep.REPORT_GENERATION,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error during report generation',
  },
  {
    from: WorkflowStep.COMPLETE,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error in completed state',
  },
  {
    from: WorkflowStep.CHAT_STARTED,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error starting chat',
  },
  {
    from: WorkflowStep.CHAT_IN_PROGRESS,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error during chat',
  },
  {
    from: WorkflowStep.CHAT_COMPLETED,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error after chat completion',
  },
  {
    from: WorkflowStep.RESEARCH,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error during research',
  },
  {
    from: WorkflowStep.REPORT_PRESENTATION,
    to: WorkflowStep.ERROR,
    requireData: true,
    description: 'Error during report presentation',
  },
]
