/**
 * @fileoverview Canonical workflow types for the entire application
 * 
 * This file focuses on workflow steps and transitions, unifying them with
 * verification flows where relevant. Verification-specific domain definitions
 * are imported from lib/types/verification to ensure consistency across the app.
 */

import type { UUID, Timestamp } from './base'
import type {
  VerificationMetadata as CanonicalVerificationMetadata} from '@/lib/types/verification';
import { VerificationStatus } from '@/lib/types/verification'
import type { Database } from '@/lib/types/database'

// ==========================================================================
// Workflow Steps - DB vs. Domain
// ==========================================================================

/**
 * DB-defined workflow steps from the Database schema.
 * These match `Database['public']['Enums']['workflow_step']`.
 *
 * IMPORTANT: When adding new steps to the database enum, they must be added here
 * to maintain consistency across the system.
 */
export type DbWorkflowStep = Database['public']['Enums']['workflow_step']

/**
 * Additional domain-only workflow steps not stored in the DB enum.
 * Use these for app-level logic that doesn't map directly to the DB step enum.
 *
 * These steps are used only in application logic and are mapped to DB steps
 * when persisting to the database.
 */
export enum DomainOnlyWorkflowStep {
  // Report presentation step
  REPORT_PRESENTATION = 'report_presentation',
  
  // Research-related steps
  RESEARCH = 'research',
  RESEARCH_ANALYSIS = 'research_analysis',
  RESEARCH_QUERY = 'research_query',
  RESEARCH_SUMMARIZATION = 'research_summarization',
  
  // Document-specific steps
  DOCUMENT_ANALYSIS = 'document_analysis',
  DOCUMENT_FORMATTING = 'document_formatting',
  DOCUMENT_INDEXING = 'document_indexing',
  DOCUMENT_PREVIEW = 'document_preview',
  
  // Additional verification steps
  VERIFICATION_CORRECTION = 'verification_correction',
  VERIFICATION_REVIEW = 'verification_review',
  
  // Error states
  ERROR = 'error',
  RECOVERABLE_ERROR = 'recoverable_error',
  PERMANENT_ERROR = 'permanent_error',
}

/**
 * A union of DB-backed steps and domain-only steps.
 * This is the canonical type to use throughout the application.
 *
 * Use `WorkflowStepMapper.toDatabaseStep(...)` and `WorkflowStepMapper.toDomainStep(...)`
 * to safely convert between domain steps and DB enum values when needed.
 */
export type WorkflowStep = DbWorkflowStep | DomainOnlyWorkflowStep

// ==========================================================================
// Canonical Workflow Step Constants
// ==========================================================================

/**
 * Canonical workflow step constants for shared usage across the application.
 * Always use these constants instead of string literals to ensure type safety
 * and consistency.
 */
export const WorkflowSteps = {
  // Core workflow steps
  IDLE: 'idle' as const satisfies WorkflowStep,
  UPLOADING: 'uploading' as const satisfies WorkflowStep,
  EXTRACTING: 'extracting' as const satisfies WorkflowStep,
  VERIFICATION: 'verification' as const satisfies WorkflowStep,
  REPORT_GENERATION: 'report_generation' as const satisfies WorkflowStep,
  COMPLETE: 'complete' as const satisfies WorkflowStep,
  
  // Verification-specific steps
  VERIFICATION_PENDING: 'verification_pending' as const satisfies WorkflowStep,
  VERIFICATION_IN_PROGRESS: 'verification_in_progress' as const satisfies WorkflowStep,
  VERIFICATION_COMPLETED: 'verification_completed' as const satisfies WorkflowStep,
  VERIFICATION_FAILED: 'verification_failed' as const satisfies WorkflowStep,
  
  // Chat-specific steps
  CHAT_STARTED: 'chat_started' as const satisfies WorkflowStep,
  CHAT_IN_PROGRESS: 'chat_in_progress' as const satisfies WorkflowStep,
  CHAT_COMPLETED: 'chat_completed' as const satisfies WorkflowStep,
  CHAT_ERROR: 'chat_error' as const satisfies WorkflowStep,
  
  // Domain-only steps
  REPORT_PRESENTATION: DomainOnlyWorkflowStep.REPORT_PRESENTATION,
  RESEARCH: DomainOnlyWorkflowStep.RESEARCH,
  RESEARCH_ANALYSIS: DomainOnlyWorkflowStep.RESEARCH_ANALYSIS,
  RESEARCH_QUERY: DomainOnlyWorkflowStep.RESEARCH_QUERY,
  RESEARCH_SUMMARIZATION: DomainOnlyWorkflowStep.RESEARCH_SUMMARIZATION,
  DOCUMENT_ANALYSIS: DomainOnlyWorkflowStep.DOCUMENT_ANALYSIS,
  DOCUMENT_FORMATTING: DomainOnlyWorkflowStep.DOCUMENT_FORMATTING,
  DOCUMENT_INDEXING: DomainOnlyWorkflowStep.DOCUMENT_INDEXING,
  DOCUMENT_PREVIEW: DomainOnlyWorkflowStep.DOCUMENT_PREVIEW,
  VERIFICATION_CORRECTION: DomainOnlyWorkflowStep.VERIFICATION_CORRECTION,
  VERIFICATION_REVIEW: DomainOnlyWorkflowStep.VERIFICATION_REVIEW,
  ERROR: DomainOnlyWorkflowStep.ERROR,
  RECOVERABLE_ERROR: DomainOnlyWorkflowStep.RECOVERABLE_ERROR,
  PERMANENT_ERROR: DomainOnlyWorkflowStep.PERMANENT_ERROR,
} as const;

// Type to represent all possible workflow step values
export type WorkflowStepValue = typeof WorkflowSteps[keyof typeof WorkflowSteps];

/**
 * Safely convert a string to a WorkflowStep
 * @param step String representation of a workflow step
 * @returns A validated WorkflowStep or 'idle' as fallback
 */
export function toWorkflowStep(step: string): WorkflowStep {
  // Check if it's a value in the WorkflowSteps object
  const allSteps = Object.values(WorkflowSteps);
  if (allSteps.includes(step as WorkflowStepValue)) {
    return step as WorkflowStep;
  }
  
  // Check if it's a DbWorkflowStep
  const dbSteps = Object.values(DbWorkflowStep);
  if (dbSteps.includes(step as DbWorkflowStep)) {
    return step as WorkflowStep;
  }
  
  // Check if it's a DomainOnlyWorkflowStep
  const domainSteps = Object.values(DomainOnlyWorkflowStep);
  if (domainSteps.includes(step as DomainOnlyWorkflowStep)) {
    return step as WorkflowStep;
  }
  
  // Default to idle
  console.warn(`Unknown workflow step: ${step}, defaulting to '${WorkflowSteps.IDLE}'`);
  return WorkflowSteps.IDLE;
}

/**
 * Check if a workflow step is valid
 * @param step Step to validate
 * @returns Whether the step is valid
 */
export function isValidWorkflowStep(step: string): boolean {
  return Object.values(WorkflowSteps).includes(step as WorkflowStepValue) ||
         Object.values(DbWorkflowStep).includes(step as DbWorkflowStep) ||
         Object.values(DomainOnlyWorkflowStep).includes(step as DomainOnlyWorkflowStep);
}

/**
 * Get a display-friendly name for a workflow step
 * @param step The workflow step
 * @returns Human-readable step name
 */
export function getWorkflowStepDisplayName(step: WorkflowStep): string {
  const displayNames: Record<WorkflowStep, string> = {
    // Core steps
    [WorkflowSteps.IDLE]: 'Idle',
    [WorkflowSteps.UPLOADING]: 'Uploading',
    [WorkflowSteps.EXTRACTING]: 'Extracting',
    [WorkflowSteps.VERIFICATION]: 'Verification',
    [WorkflowSteps.REPORT_GENERATION]: 'Report Generation',
    [WorkflowSteps.COMPLETE]: 'Complete',
    
    // Verification-specific steps
    [WorkflowSteps.VERIFICATION_PENDING]: 'Verification Pending',
    [WorkflowSteps.VERIFICATION_IN_PROGRESS]: 'Verification In Progress',
    [WorkflowSteps.VERIFICATION_COMPLETED]: 'Verification Completed',
    [WorkflowSteps.VERIFICATION_FAILED]: 'Verification Failed',
    
    // Chat-specific steps
    [WorkflowSteps.CHAT_STARTED]: 'Chat Started',
    [WorkflowSteps.CHAT_IN_PROGRESS]: 'Chat In Progress',
    [WorkflowSteps.CHAT_COMPLETED]: 'Chat Completed',
    [WorkflowSteps.CHAT_ERROR]: 'Chat Error',
    
    // Domain-only steps
    [WorkflowSteps.REPORT_PRESENTATION]: 'Report Presentation',
    [WorkflowSteps.RESEARCH]: 'Research',
    [WorkflowSteps.RESEARCH_ANALYSIS]: 'Research Analysis',
    [WorkflowSteps.RESEARCH_QUERY]: 'Research Query',
    [WorkflowSteps.RESEARCH_SUMMARIZATION]: 'Research Summarization',
    [WorkflowSteps.DOCUMENT_ANALYSIS]: 'Document Analysis',
    [WorkflowSteps.DOCUMENT_FORMATTING]: 'Document Formatting',
    [WorkflowSteps.DOCUMENT_INDEXING]: 'Document Indexing',
    [WorkflowSteps.DOCUMENT_PREVIEW]: 'Document Preview',
    [WorkflowSteps.VERIFICATION_CORRECTION]: 'Verification Correction',
    [WorkflowSteps.VERIFICATION_REVIEW]: 'Verification Review',
    [WorkflowSteps.ERROR]: 'Error',
    [WorkflowSteps.RECOVERABLE_ERROR]: 'Recoverable Error',
    [WorkflowSteps.PERMANENT_ERROR]: 'Permanent Error',
  };
  
  return displayNames[step] || String(step).replace(/_/g, ' ').split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

// ==========================================================================
// Core Workflow Types
// ==========================================================================

/**
 * Processing phases for status tracking, which can be used in conjunction with
 * a given WorkflowStep. For example, if step='extracting', phase might be "readingFile".
 */
export enum ProcessingPhase {
  INITIALIZATION = 'initialization',
  UPLOADING = 'uploading',
  EXTRACTION = 'extraction',
  EXTRACTION_COMPLETED = 'extraction_completed',
  ANALYSIS = 'analysis',
  VERIFICATION = 'verification',
  VERIFICATION_PENDING = 'verification_pending',
  VERIFICATION_COMPLETION = 'verification_completion',
  VERIFICATION_PROCESSING = 'verification_processing',
  VERIFICATION_REJECTION = 'verification_rejection',
  CORRECTION = 'correction',
  RESEARCH = 'research',
  REPORT_GENERATION = 'report_generation',
  REPORT_FORMATTING = 'report_formatting',
  REPORT_PREVIEW = 'report_preview',
  PROCESSING = 'processing',
  FINALIZATION = 'finalization',
  CHAT_PROCESSING = 'chat_processing',
  COMPLETION = 'completion',
  ERROR = 'error',
  UPLOAD = 'upload',
}

/**
 * Workflow transition for state machine validation
 */
export interface WorkflowTransition {
  from: WorkflowStep
  to: WorkflowStep
  allowData?: boolean
  requireData?: boolean
  description?: string
}

/**
 * Workflow state interface representing the current state of a workflow.
 * This is intended for short-term in-memory or ephemeral usage. The database
 * records might store a superset of fields.
 */
export interface WorkflowState {
  currentStep: WorkflowStep
  progress: number
  phase?: ProcessingPhase
  error?: string | null
  metadata?: Record<string, unknown>
  timestamp: Timestamp
}

/**
 * Processing status for workflow operations, which some flows use for reporting
 * progress in real-time to the UI. Not all workflows rely on this.
 */
export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'success' | 'error'
  progress: number
  phase: ProcessingPhase
  startedAt?: Timestamp
  estimatedCompletionAt?: Timestamp
  error?: string | null
}

// ==========================================================================
// Message Types
// ==========================================================================

export enum MessageType {
  SUMMARY = 'summary',
  VERIFICATION_REQUEST = 'verification_request',
  CORRECTION = 'correction',
  PROGRESS = 'progress',
  RESEARCH = 'research',
  REPORT = 'report',
  CHAT = 'chat',
  SYSTEM = 'system',
  ERROR = 'error',
}

export interface MessageMetadata {
  type?: MessageType

  isSummary?: boolean
  isVerificationRequest?: boolean
  isCorrection?: boolean
  isProgress?: boolean
  isResearch?: boolean
  isReport?: boolean
  isSystem?: boolean
  isError?: boolean

  contentVersionId?: UUID
  summaryVersionId?: UUID

  progress?: {
    value: number
    phase: string
    startedAt?: Timestamp
    estimatedCompletionAt?: Timestamp
  }

  progressValue?: number
  progressPhase?: string

  verificationMetadata?: CanonicalVerificationMetadata

  documentId?: UUID
  patientId?: UUID
  sourceDocuments?: UUID[]

  [key: string]: unknown
}

export function getMessageType(
  metadata?: MessageMetadata
): MessageType | undefined {
  if (!metadata) return undefined
  if (metadata.type !== undefined && metadata.type !== null) return metadata.type
  if (metadata.isVerificationRequest === true) return MessageType.VERIFICATION_REQUEST
  if (metadata.isSummary === true) return MessageType.SUMMARY
  if (metadata.isCorrection === true) return MessageType.CORRECTION
  if (metadata.isProgress === true) return MessageType.PROGRESS
  if (metadata.isResearch === true) return MessageType.RESEARCH
  if (metadata.isReport === true) return MessageType.REPORT
  if (metadata.isSystem === true) return MessageType.SYSTEM
  if (metadata.isError === true) return MessageType.ERROR
  return MessageType.CHAT
}

export function isMessageOfType(
  metadata: MessageMetadata | undefined,
  type: MessageType
): boolean {
  if (!metadata) return false
  return getMessageType(metadata) === type
}

// ==========================================================================
// Verification Flow Integration
// ==========================================================================

export function isVerificationComplete(
  metadata?: CanonicalVerificationMetadata
): boolean {
  return metadata?.verification_status === VerificationStatus.completed
}

export function isVerificationInProgress(
  metadata?: CanonicalVerificationMetadata
): boolean {
  return metadata?.verification_status === VerificationStatus.inProgress
}

export function isVerificationPending(
  metadata?: CanonicalVerificationMetadata
): boolean {
  return metadata?.verification_status === VerificationStatus.pending
}

export function isVerificationFailed(
  metadata?: CanonicalVerificationMetadata
): boolean {
  return metadata?.verification_status === VerificationStatus.failed
}

/**
 * Convert a WorkflowStep into the closest matching VerificationStatus.
 * By default, we treat non-verification steps as 'pending'.
 */
export function workflowStepToVerificationStatus(step: WorkflowStep): VerificationStatus {
  switch (step) {
    case WorkflowSteps.VERIFICATION_IN_PROGRESS:
      return VerificationStatus.inProgress
    case WorkflowSteps.VERIFICATION_COMPLETED:
      return VerificationStatus.completed
    case WorkflowSteps.VERIFICATION_FAILED:
      return VerificationStatus.failed
    case WorkflowSteps.VERIFICATION_PENDING:
      return VerificationStatus.pending
    case WorkflowSteps.VERIFICATION:
      // Legacy step
      return VerificationStatus.inProgress
    default:
      return VerificationStatus.pending
  }
}

/**
 * Convert a VerificationStatus to the corresponding WorkflowStep.
 */
export function verificationStatusToWorkflowStep(status: VerificationStatus): WorkflowStep {
  switch (status) {
    case VerificationStatus.inProgress:
      return WorkflowSteps.VERIFICATION_IN_PROGRESS
    case VerificationStatus.completed:
      return WorkflowSteps.VERIFICATION_COMPLETED
    case VerificationStatus.failed:
      return WorkflowSteps.VERIFICATION_FAILED
    case VerificationStatus.pending:
    default:
      return WorkflowSteps.VERIFICATION_PENDING
  }
}

// ==========================================================================
// Allowed Workflow Transitions
// ==========================================================================

/**
 * All allowed workflow transitions in the application.
 * This forms the basis of our state machine validation.
 *
 * When adding new workflow steps, make sure to update this array with
 * the appropriate transitions.
 */
export const ALLOWED_TRANSITIONS: WorkflowTransition[] = [
  // Initial state transitions
  {
    from: WorkflowSteps.IDLE,
    to: WorkflowSteps.UPLOADING,
    allowData: true,
    description: 'Start document upload',
  },
  {
    from: WorkflowSteps.IDLE,
    to: WorkflowSteps.CHAT_STARTED,
    allowData: true,
    description: 'Start chat without document',
  },
  {
    from: WorkflowSteps.IDLE,
    to: WorkflowSteps.RESEARCH,
    allowData: true,
    description: 'Start research mode',
  },

  // Upload flow
  {
    from: WorkflowSteps.UPLOADING,
    to: WorkflowSteps.EXTRACTING,
    allowData: true,
    description: 'Document uploaded, starting extraction',
  },
  {
    from: WorkflowSteps.UPLOADING,
    to: WorkflowSteps.ERROR,
    allowData: true,
    description: 'Upload failed',
  },
  {
    from: WorkflowSteps.EXTRACTING,
    to: WorkflowSteps.VERIFICATION,
    allowData: true,
    description: 'Extraction complete, ready for verification',
  },
  {
    from: WorkflowSteps.EXTRACTING,
    to: WorkflowSteps.VERIFICATION_PENDING,
    allowData: true,
    description: 'Extraction complete, waiting for verification',
  },
  {
    from: WorkflowSteps.EXTRACTING,
    to: WorkflowSteps.COMPLETE,
    allowData: true,
    description: 'Extraction complete, skipping verification',
  },
  {
    from: WorkflowSteps.EXTRACTING,
    to: WorkflowSteps.DOCUMENT_ANALYSIS,
    allowData: true,
    description: 'Analyzing extracted document content',
  },
  {
    from: WorkflowSteps.DOCUMENT_ANALYSIS,
    to: WorkflowSteps.VERIFICATION_PENDING,
    allowData: true,
    description: 'Analysis complete, ready for verification',
  },
  {
    from: WorkflowSteps.DOCUMENT_ANALYSIS,
    to: WorkflowSteps.COMPLETE,
    allowData: true,
    description: 'Analysis complete, skipping verification',
  },

  // Verification flow
  {
    from: WorkflowSteps.VERIFICATION,
    to: WorkflowSteps.VERIFICATION_PENDING,
    allowData: true,
    description: 'Preparing verification',
  },
  {
    from: WorkflowSteps.VERIFICATION_PENDING,
    to: WorkflowSteps.VERIFICATION_IN_PROGRESS,
    allowData: true,
    description: 'User reviewing verification',
  },
  {
    from: WorkflowSteps.VERIFICATION_IN_PROGRESS,
    to: WorkflowSteps.VERIFICATION_COMPLETED,
    allowData: true,
    description: 'User completed verification',
  },
  {
    from: WorkflowSteps.VERIFICATION_IN_PROGRESS,
    to: WorkflowSteps.VERIFICATION_FAILED,
    allowData: true,
    description: 'Verification rejected',
  },
  {
    from: WorkflowSteps.VERIFICATION_COMPLETED,
    to: WorkflowSteps.REPORT_GENERATION,
    allowData: true,
    description: 'Starting report generation',
  },
  {
    from: WorkflowSteps.VERIFICATION_FAILED,
    to: WorkflowSteps.VERIFICATION_IN_PROGRESS,
    allowData: true,
    description: 'Retry verification',
  },

  // Report generation flow
  {
    from: WorkflowSteps.REPORT_GENERATION,
    to: WorkflowSteps.COMPLETE,
    allowData: true,
    description: 'Report generated successfully',
  },
  {
    from: WorkflowSteps.REPORT_GENERATION,
    to: WorkflowSteps.REPORT_PRESENTATION,
    allowData: true,
    description: 'Showing generated report',
  },
  {
    from: WorkflowSteps.REPORT_PRESENTATION,
    to: WorkflowSteps.COMPLETE,
    allowData: true,
    description: 'Workflow complete',
  },

  // Chat flow
  {
    from: WorkflowSteps.CHAT_STARTED,
    to: WorkflowSteps.CHAT_IN_PROGRESS,
    allowData: true,
    description: 'Processing chat message',
  },
  {
    from: WorkflowSteps.CHAT_IN_PROGRESS,
    to: WorkflowSteps.CHAT_COMPLETED,
    allowData: true,
    description: 'Chat message processed',
  },
  {
    from: WorkflowSteps.CHAT_COMPLETED,
    to: WorkflowSteps.CHAT_IN_PROGRESS,
    allowData: true,
    description: 'Processing another message',
  },

  // Research flow
  {
    from: WorkflowSteps.RESEARCH,
    to: WorkflowSteps.REPORT_GENERATION,
    allowData: true,
    description: 'Research complete, generating report',
  },

  // Complete state can transition back to several states for new operations
  {
    from: WorkflowSteps.COMPLETE,
    to: WorkflowSteps.IDLE,
    description: 'Reset workflow',
  },
  {
    from: WorkflowSteps.COMPLETE,
    to: WorkflowSteps.CHAT_IN_PROGRESS,
    allowData: true,
    description: 'Continue with chat after completion',
  },
  {
    from: WorkflowSteps.COMPLETE,
    to: WorkflowSteps.UPLOADING,
    allowData: true,
    description: 'Upload new document after completion',
  },

  // Error recovery paths
  {
    from: WorkflowSteps.ERROR,
    to: WorkflowSteps.IDLE,
    description: 'Reset after error',
  },
  {
    from: WorkflowSteps.ERROR,
    to: WorkflowSteps.UPLOADING,
    allowData: true,
    description: 'Retry upload after error',
  },
  {
    from: WorkflowSteps.ERROR,
    to: WorkflowSteps.EXTRACTING,
    allowData: true,
    description: 'Retry extraction after error',
  },
  {
    from: WorkflowSteps.ERROR,
    to: WorkflowSteps.VERIFICATION,
    allowData: true,
    description: 'Return to verification after error',
  },
  {
    from: WorkflowSteps.ERROR,
    to: WorkflowSteps.REPORT_GENERATION,
    allowData: true,
    description: 'Retry report generation after error',
  },

  // Any state can transition to error
  {
    from: WorkflowSteps.IDLE,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error in idle state',
  },
  {
    from: WorkflowSteps.UPLOADING,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error during upload',
  },
  {
    from: WorkflowSteps.EXTRACTING,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error during extraction',
  },
  {
    from: WorkflowSteps.VERIFICATION,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error during verification',
  },
  {
    from: WorkflowSteps.VERIFICATION_PENDING,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error in verification pending',
  },
  {
    from: WorkflowSteps.VERIFICATION_IN_PROGRESS,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error during verification process',
  },
  {
    from: WorkflowSteps.VERIFICATION_COMPLETED,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error after verification completion',
  },
  {
    from: WorkflowSteps.VERIFICATION_FAILED,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error after verification failed',
  },
  {
    from: WorkflowSteps.REPORT_GENERATION,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error during report generation',
  },
  {
    from: WorkflowSteps.COMPLETE,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error in completed state',
  },
  {
    from: WorkflowSteps.CHAT_STARTED,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error starting chat',
  },
  {
    from: WorkflowSteps.CHAT_IN_PROGRESS,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error during chat',
  },
  {
    from: WorkflowSteps.CHAT_COMPLETED,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error after chat completion',
  },
  {
    from: WorkflowSteps.RESEARCH,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error during research',
  },
  {
    from: WorkflowSteps.REPORT_PRESENTATION,
    to: WorkflowSteps.ERROR,
    requireData: true,
    description: 'Error during report presentation',
  },
]