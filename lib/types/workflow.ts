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
 */
export type DbWorkflowStep = Database['public']['Enums']['workflow_step']

/**
 * Additional domain-only workflow steps not stored in the DB enum.
 * Use these for app-level logic that doesn't map directly to the DB step enum.
 */
export enum DomainOnlyWorkflowStep {
  REPORT_PRESENTATION = 'report_presentation',
  RESEARCH = 'research',
  ERROR = 'error',
}

/**
 * A union of DB-backed steps and any domain-only steps that do not appear in the DB enum.
 * Use `toDbWorkflowStep(...)` and `fromDbWorkflowStep(...)` to safely convert
 * between domain steps and DB enum values.
 */
export type WorkflowStep = DbWorkflowStep | DomainOnlyWorkflowStep

/**
 * Convert a domain WorkflowStep to the corresponding database enum if possible.
 * For domain-only steps, return a suitable fallback.
 */
export function toDbWorkflowStep(step: WorkflowStep): DbWorkflowStep {
  switch (step) {
    case DomainOnlyWorkflowStep.REPORT_PRESENTATION:
      // No direct DB equivalent; fallback to 'complete' or your choice:
      return 'complete'
    case DomainOnlyWorkflowStep.RESEARCH:
      // Not in DB enum, pick a fallback:
      return 'chat_in_progress'
    case DomainOnlyWorkflowStep.ERROR:
      // DB has 'chat_error', which might serve as an "error" fallback:
      return 'chat_error'
    default:
      // Step is already a valid DbWorkflowStep
      return step
  }
}

/**
 * Convert a DB workflow step to the domain WorkflowStep union.
 * If you have domain-only logic, interpret as needed.
 * For now, we directly return the DB step unless we want to map 'chat_error' => DomainOnlyWorkflowStep.ERROR, etc.
 */
export function fromDbWorkflowStep(dbStep: DbWorkflowStep): WorkflowStep {
  switch (dbStep) {
    case 'chat_error':
      return DomainOnlyWorkflowStep.ERROR
    default:
      return dbStep
  }
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
  CORRECTION = 'correction',
  RESEARCH = 'research',
  REPORT_GENERATION = 'report_generation',
  REPORT_FORMATTING = 'report_formatting',
  COMPLETION = 'completion',
  ERROR = 'error',
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
 * @deprecated Consider using mappers for consistent bidirectional conversion
 */
export function workflowStepToVerificationStatus(step: WorkflowStep): VerificationStatus {
  switch (step) {
    case 'verification_in_progress':
      return VerificationStatus.inProgress
    case 'verification_completed':
      return VerificationStatus.completed
    case 'verification_failed':
      return VerificationStatus.failed
    case 'verification_pending':
      return VerificationStatus.pending
    case 'verification':
      // Legacy step
      return VerificationStatus.inProgress
    default:
      return VerificationStatus.pending
  }
}

/**
 * Convert a VerificationStatus to the corresponding WorkflowStep if applicable.
 * @deprecated Consider using mappers for consistent bidirectional conversion
 */
export function verificationStatusToWorkflowStep(status: VerificationStatus): WorkflowStep {
  switch (status) {
    case VerificationStatus.inProgress:
      return 'verification_in_progress'
    case VerificationStatus.completed:
      return 'verification_completed'
    case VerificationStatus.failed:
      return 'verification_failed'
    case VerificationStatus.pending:
    default:
      return 'verification_pending'
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
    from: 'idle',
    to: 'uploading',
    allowData: true,
    description: 'Start document upload',
  },
  {
    from: 'idle',
    to: 'chat_started',
    allowData: true,
    description: 'Start chat without document',
  },
  {
    from: 'idle',
    to: DomainOnlyWorkflowStep.RESEARCH,
    allowData: true,
    description: 'Start research mode',
  },

  // Upload flow
  {
    from: 'uploading',
    to: 'extracting',
    allowData: true,
    description: 'Document uploaded, starting extraction',
  },
  {
    from: 'extracting',
    to: 'verification',
    allowData: true,
    description: 'Extraction complete, ready for verification',
  },
  {
    from: 'extracting',
    to: 'verification_pending',
    allowData: true,
    description: 'Extraction complete, waiting for verification',
  },

  // Verification flow
  {
    from: 'verification',
    to: 'verification_pending',
    allowData: true,
    description: 'Preparing verification',
  },
  {
    from: 'verification_pending',
    to: 'verification_in_progress',
    allowData: true,
    description: 'User reviewing verification',
  },
  {
    from: 'verification_in_progress',
    to: 'verification_completed',
    allowData: true,
    description: 'User completed verification',
  },
  {
    from: 'verification_in_progress',
    to: 'verification_failed',
    allowData: true,
    description: 'Verification rejected',
  },
  {
    from: 'verification_completed',
    to: 'report_generation',
    allowData: true,
    description: 'Starting report generation',
  },
  {
    from: 'verification_failed',
    to: 'verification_in_progress',
    allowData: true,
    description: 'Retry verification',
  },

  // Report generation flow
  {
    from: 'report_generation',
    to: 'complete',
    allowData: true,
    description: 'Report generated successfully',
  },
  {
    from: 'report_generation',
    to: DomainOnlyWorkflowStep.REPORT_PRESENTATION,
    allowData: true,
    description: 'Showing generated report',
  },
  {
    from: DomainOnlyWorkflowStep.REPORT_PRESENTATION,
    to: 'complete',
    allowData: true,
    description: 'Workflow complete',
  },

  // Chat flow
  {
    from: 'chat_started',
    to: 'chat_in_progress',
    allowData: true,
    description: 'Processing chat message',
  },
  {
    from: 'chat_in_progress',
    to: 'chat_completed',
    allowData: true,
    description: 'Chat message processed',
  },
  {
    from: 'chat_completed',
    to: 'chat_in_progress',
    allowData: true,
    description: 'Processing another message',
  },

  // Research flow
  {
    from: DomainOnlyWorkflowStep.RESEARCH,
    to: 'report_generation',
    allowData: true,
    description: 'Research complete, generating report',
  },

  // Complete state can transition back to several states for new operations
  {
    from: 'complete',
    to: 'idle',
    description: 'Reset workflow',
  },
  {
    from: 'complete',
    to: 'chat_in_progress',
    allowData: true,
    description: 'Continue with chat after completion',
  },
  {
    from: 'complete',
    to: 'uploading',
    allowData: true,
    description: 'Upload new document after completion',
  },

  // Error recovery paths
  {
    from: DomainOnlyWorkflowStep.ERROR,
    to: 'idle',
    description: 'Reset after error',
  },
  {
    from: DomainOnlyWorkflowStep.ERROR,
    to: 'uploading',
    allowData: true,
    description: 'Retry upload after error',
  },
  {
    from: DomainOnlyWorkflowStep.ERROR,
    to: 'extracting',
    allowData: true,
    description: 'Retry extraction after error',
  },
  {
    from: DomainOnlyWorkflowStep.ERROR,
    to: 'verification',
    allowData: true,
    description: 'Return to verification after error',
  },
  {
    from: DomainOnlyWorkflowStep.ERROR,
    to: 'report_generation',
    allowData: true,
    description: 'Retry report generation after error',
  },

  // Any state can transition to error
  {
    from: 'idle',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error in idle state',
  },
  {
    from: 'uploading',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error during upload',
  },
  {
    from: 'extracting',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error during extraction',
  },
  {
    from: 'verification',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error during verification',
  },
  {
    from: 'verification_pending',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error in verification pending',
  },
  {
    from: 'verification_in_progress',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error during verification process',
  },
  {
    from: 'verification_completed',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error after verification completion',
  },
  {
    from: 'verification_failed',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error after verification failed',
  },
  {
    from: 'report_generation',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error during report generation',
  },
  {
    from: 'complete',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error in completed state',
  },
  {
    from: 'chat_started',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error starting chat',
  },
  {
    from: 'chat_in_progress',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error during chat',
  },
  {
    from: 'chat_completed',
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error after chat completion',
  },
  {
    from: DomainOnlyWorkflowStep.RESEARCH,
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error during research',
  },
  {
    from: DomainOnlyWorkflowStep.REPORT_PRESENTATION,
    to: DomainOnlyWorkflowStep.ERROR,
    requireData: true,
    description: 'Error during report presentation',
  },
]