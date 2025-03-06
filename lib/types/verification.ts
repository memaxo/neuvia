/**
 * @fileoverview Single source of truth for all verification-related types.
 * Consolidates:
 * - verification-service-types.ts
 * - existing domain definitions
 * - references to database-driven types, if needed
 *
 * This ensures a consistent schema across TypeScript types, Zod schemas, and OpenAPI.
 */

import type { UUID, Timestamp, BaseEntity } from './base'
import type { Database } from '@/lib/types/database'

// -----------------------------------------------------------------------------
// Verification status and core domain
// -----------------------------------------------------------------------------

/**
 * Describes the overall status of a verification process.
 *
 * - pending: Verification not yet started or awaiting user confirmation
 * - inProgress: Verification is actively underway
 * - completed: Verification has been successfully completed
 * - failed: Verification was rejected or otherwise failed
 */
export enum VerificationStatus {
  pending = 'pending',
  inProgress = 'inProgress',
  completed = 'completed',
  failed = 'failed',
}

/**
 * Maps a DB workflow_step to a domain VerificationStatus.
 */
export function dbToVerificationStatus(dbStatus: Database['public']['Enums']['workflow_step']): VerificationStatus {
  switch (dbStatus) {
    case 'verification_in_progress':
      return VerificationStatus.inProgress
    case 'verification_completed':
      return VerificationStatus.completed
    case 'verification_failed':
      return VerificationStatus.failed
    case 'verification_pending':
      return VerificationStatus.pending
    default:
      // Fallback to 'pending'
      return VerificationStatus.pending
  }
}

/**
 * Maps a domain VerificationStatus to the corresponding DB workflow_step enum value.
 */
export function verificationStatusToDb(status: VerificationStatus): Database['public']['Enums']['workflow_step'] {
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

/**
 * Checks if a given value is a valid VerificationStatus.
 *
 * @param value - Any unknown value
 * @returns True if the value is one of the VerificationStatus enum members
 */
export function isVerificationStatus(value: unknown): value is VerificationStatus {
  return (
    value === VerificationStatus.pending ||
    value === VerificationStatus.inProgress ||
    value === VerificationStatus.completed ||
    value === VerificationStatus.failed
  )
}

/**
 * A version history entry for an individual VerificationItem.
 */
export interface VersionHistoryEntry {
  /**
   * Unique identifier for this version (often a UUID).
   */
  id: string

  /**
   * Content at this version in time.
   */
  content: string

  /**
   * When this version was created (ISO date string).
   */
  timestamp: Timestamp

  /**
   * Which user (if any) made this version.
   */
  userId?: UUID

  /**
   * Optional reason for the change.
   */
  reason?: string
}

/**
 * Represents a single item requiring verification within a document or summary.
 */
export interface VerificationItem {
  /**
   * Unique identifier for this verification item (e.g., a UUID).
   */
  id: string

  /**
   * Title or label describing this item (e.g., "Patient Name").
   */
  title: string

  /**
   * Optional descriptive text about what needs to be verified.
   */
  description?: string

  /**
   * The original unmodified content extracted from a document or source.
   */
  originalContent: string

  /**
   * The current content after any corrections or modifications.
   */
  currentContent: string

  /**
   * Indicates if the user has verified this item.
   */
  isVerified: boolean

  /**
   * Whether this item was changed from its originalContent.
   */
  isModified: boolean

  /**
   * A record of all versions of content (and who changed them) for auditing.
   */
  changeHistory: VersionHistoryEntry[]

  /**
   * Arbitrary metadata (confidence scores, location in document, etc.)
   */
  metadata?: Record<string, unknown>
}

/**
 * Records a single correction or change to the verified content.
 */
export interface CorrectionEntry {
  /**
   * Unique ID for the correction entry.
   */
  id: string

  /**
   * The text of the correction request.
   */
  text: string

  /**
   * When the correction was submitted (ISO date string).
   */
  timestamp: Timestamp

  /**
   * Which user (if any) submitted the correction.
   */
  userId?: UUID
}

/**
 * Describes additional metadata for the entire verification process.
 */
export interface VerificationMetadata {
  /**
   * Current verification status: pending, inProgress, completed, or failed.
   */
  verification_status: VerificationStatus

  /**
   * ID of the original summary or document version being verified.
   */
  originalSummaryId: string

  /**
   * ID of the current version under verification.
   */
  currentVersionId: string

  /**
   * How many corrections have been made overall.
   */
  correctionCount: number

  /**
   * When the content was verified, if verificationStatus is completed.
   */
  verifiedAt?: Timestamp

  /**
   * Which user verified the content (if available).
   */
  verifiedBy?: UUID

  /**
   * All corrections that have occurred, if any.
   */
  corrections: CorrectionEntry[]

  /**
   * Arbitrary data extracted from the document for verification.
   */
  extractedData?: unknown

  /**
   * When verification started (ISO date string).
   */
  startedAt?: Timestamp

  /**
   * When verification metadata was last updated (ISO date string).
   */
  lastUpdated?: Timestamp

  /**
   * Optional overall confidence or reliability measure.
   */
  confidenceScore?: number

  /**
   * If verificationStatus is failed, an optional reason for rejection.
   */
  rejectionReason?: string
}

/**
 * The final outcome of the entire verification process.
 */
export interface VerificationResult {
  /**
   * Whether the verification process has concluded.
   */
  isCompleted: boolean

  /**
   * Indicates if the content was approved. If false but isCompleted is true,
   * verification was effectively rejected or deemed invalid.
   */
  isApproved: boolean

  /**
   * The list of items involved in verification, with their final states.
   */
  items: VerificationItem[]

  /**
   * The timestamp of verification completion.
   */
  completedAt: Timestamp

  /**
   * Which user (if any) completed verification.
   */
  completedBy?: UUID

  /**
   * Approximate time spent verifying, in milliseconds.
   */
  verificationTime?: number

  /**
   * Summary of changes made during verification (optional).
   */
  changeSummary?: {
    totalItems: number
    modifiedItems: number
    approvedWithoutChanges: number
    failedItems: number
  }

  /**
   * If verification was rejected, a reason for rejection.
   */
  rejectionReason?: string

  /**
   * Additional metadata capturing the process details.
   */
  verificationMetadata: VerificationMetadata
}

/**
 * Extended VerificationItem with additional fields for database storage
 */
export interface ExtendedVerificationItem extends VerificationItem {
  /**
   * Current verification status
   */
  status?: string;
  
  /**
   * Content after verification
   */
  content?: string;
  
  /**
   * Correction text if any
   */
  correction?: string;
  
  /**
   * Reason for correction or verification
   */
  reason?: string;
  
  /**
   * User who verified this item
   */
  verifiedBy?: UUID;
  
  /**
   * When this item was verified
   */
  verifiedAt?: Timestamp;
}

/**
 * Verified document with complete metadata and items
 */
export interface VerifiedDocument extends BaseEntity {
  /**
   * Original document ID
   */
  originalDocumentId: string;
  
  /**
   * User who verified the document
   */
  verifiedBy?: string;
  
  /**
   * When the document was verified
   */
  verifiedAt: string;
  
  /**
   * Verification items
   */
  verificationItems: VerificationItem[];
  
  /**
   * Verification status
   */
  verificationStatus: VerificationStatus;
  
  /**
   * Verification metadata
   */
  verificationMetadata: VerificationMetadata;
  
  /**
   * Document type information
   */
  documentType: any; // Using any to avoid circular imports
  
  /**
   * Patient ID
   */
  patientId?: string;
  
  /**
   * Verified data content
   */
  verifiedData: {
    content: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
}

// -----------------------------------------------------------------------------
// Options, requests, and results from the now-deprecated verification-service-types
// -----------------------------------------------------------------------------

/**
 * Generic result type used by verification operations.
 */
export interface VerificationServiceResult<T> {
  /**
   * Whether the operation was successful
   */
  success: boolean

  /**
   * Data returned from the operation
   */
  data: T

  /**
   * Optional error information if the operation failed
   */
  error?: {
    message: string
    code: string
    details?: Record<string, any>
  }

  /**
   * Timestamp of the operation
   */
  timestamp: string
}

/**
 * Options for generating verification for a document
 */
export interface GenerateVerificationOptions {
  /**
   * The document to be verified
   */
  document: Record<string, any>

  /**
   * The workflow ID for this verification
   */
  workflowId?: string

  /**
   * Optional ID of message associated with this verification
   */
  messageId?: string

  /**
   * Optional ID for the generated summary
   */
  summaryId?: string
}

/**
 * Options for submitting a correction
 */
export interface SubmitCorrectionOptions {
  /**
   * The correction text provided by the user
   */
  correction: string

  /**
   * The current summary content being corrected
   */
  currentSummary: string

  /**
   * The workflow ID associated with this correction
   */
  workflowId?: string

  /**
   * Optional ID of the message associated with this correction
   */
  messageId?: string
}

/**
 * Options for processing a correction
 */
export interface ProcessCorrectionOptions {
  /**
   * The correction text
   */
  correction: string

  /**
   * The current summary content
   */
  currentSummary: string

  /**
   * The workflow ID associated with this correction
   */
  workflowId?: string

  /**
   * Optional ID of message associated with this correction
   */
  messageId?: string
}

/**
 * Options for finalizing the verification result (e.g., approving or rejecting).
 */
export interface CompleteVerificationOptions {
  /**
   * The ID used to identify the workflow or patient
   */
  workflowId: string

  /**
   * Whether verification was approved
   */
  isApproved: boolean

  /**
   * Optional items involved in the final update
   */
  items?: VerificationItem[]

  /**
   * Optional user comments
   */
  comments?: string
}

// -----------------------------------------------------------------------------
// Type guards
// -----------------------------------------------------------------------------

/**
 * Check if a value is a VerificationItem
 */
export function isVerificationItem(value: unknown): value is VerificationItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>

  const hasString = (prop: string) => typeof item[prop] === 'string'
  const hasBool = (prop: string) => typeof item[prop] === 'boolean'
  if (!hasString('id') || !hasString('title')) return false
  if (!hasString('originalContent') || !hasString('currentContent')) return false
  if (!hasBool('isVerified') || !hasBool('isModified')) return false
  if (!Array.isArray(item.changeHistory)) return false

  return true
}

/**
 * Check if a value is VerificationMetadata
 */
export function isVerificationMetadata(value: unknown): value is VerificationMetadata {
  if (!value || typeof value !== 'object') return false
  const metadata = value as Record<string, unknown>

  if (!metadata.verificationStatus || !isVerificationStatus(metadata.verificationStatus)) {
    return false
  }
  if (typeof metadata.originalSummaryId !== 'string') return false
  if (typeof metadata.currentVersionId !== 'string') return false
  if (typeof metadata.correctionCount !== 'number') return false
  if (!Array.isArray(metadata.corrections)) return false

  return true
}

/**
 * Check if a value is VerificationResult
 */
export function isVerificationResult(value: unknown): value is VerificationResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>

  if (typeof result.isCompleted !== 'boolean') return false
  if (typeof result.isApproved !== 'boolean') return false
  if (!Array.isArray(result.items)) return false
  if (!result.verificationMetadata || !isVerificationMetadata(result.verificationMetadata)) {
    return false
  }
  return true
}

/**
 * Convert verification metadata to a database-compatible format
 * Ensures that all properties are properly serialized for database storage
 *
 * @param metadata - Any metadata object to convert
 * @returns Database compatible metadata object
 */
export function getDbCompatibleMetadata(metadata: Record<string, any>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  
  // Process each key in the metadata
  for (const [key, value] of Object.entries(metadata)) {
    // Handle dates and convert to ISO strings
    if (value instanceof Date) {
      result[key] = value.toISOString()
    }
    // Handle nested objects
    else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = getDbCompatibleMetadata(value as Record<string, any>)
    }
    // Handle arrays by mapping each item
    else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        item !== null && typeof item === 'object'
          ? getDbCompatibleMetadata(item as Record<string, any>)
          : item
      )
    }
    // Keep primitives as is
    else {
      result[key] = value
    }
  }
  
  return result
}