/**
 * @fileoverview Canonical verification types
 *
 * This file serves as the single source of truth for verification-related types.
 * It defines the core verification interfaces, status types, and helper functions
 * used across the verification system.
 */
import type { DocumentType } from './document'
import type { UUID, Timestamp, BaseEntity } from './base'

// Import verification types from the schemas
import type {
  VerificationStatus,
  VerificationItem,
  VerificationMetadata,
  VerificationOptions,
  VerificationResult,
} from '@/lib/schemas/verification'

// Export verification types from schemas
export type {
  VerificationStatus,
  VerificationItem,
  VerificationMetadata,
  VerificationOptions,
  VerificationResult,
}

// Define VerificationStatusType (aliasing VerificationStatus for clarity)
export type VerificationStatusType = VerificationStatus

/**
 * Type guard for VerificationItem
 */
export function isVerificationItem(value: unknown): value is VerificationItem {
  if (value === null || value === undefined || typeof value !== 'object')
    return false

  const item = value as Record<string, unknown>

  const hasValidId = typeof item.id === 'string'
  const hasValidTitle = typeof item.title === 'string'
  const hasValidContent = typeof item.content === 'string'
  const hasValidStatus =
    typeof item.status === 'string' &&
    ['pending', 'verified', 'rejected', 'needs_correction'].includes(
      item.status
    )

  // Optional fields
  const hasValidCorrection =
    item.correction === undefined || typeof item.correction === 'string'
  const hasValidReason =
    item.reason === undefined || typeof item.reason === 'string'
  const hasValidVerifiedBy =
    item.verifiedBy === undefined || typeof item.verifiedBy === 'string'
  const hasValidVerifiedAt =
    item.verifiedAt === undefined ||
    item.verifiedAt instanceof Date ||
    (typeof item.verifiedAt === 'string' && !isNaN(Date.parse(item.verifiedAt)))
  const hasValidMetadata =
    item.metadata === undefined ||
    (typeof item.metadata === 'object' && item.metadata !== null)

  return (
    hasValidId &&
    hasValidTitle &&
    hasValidContent &&
    hasValidStatus &&
    hasValidCorrection &&
    hasValidReason &&
    hasValidVerifiedBy &&
    hasValidVerifiedAt &&
    hasValidMetadata
  )
}

/**
 * Type guard for VerificationMetadata
 */
export function isVerificationMetadata(
  value: unknown
): value is VerificationMetadata {
  if (value === null || value === undefined || typeof value !== 'object')
    return false

  const metadata = value as Record<string, unknown>

  const hasValidStatus =
    typeof metadata.verificationStatus === 'string' &&
    ['pending', 'verified', 'rejected', 'needs_correction'].includes(
      metadata.verificationStatus
    )

  // Optional fields
  const hasValidOriginalId =
    metadata.originalSummaryId === undefined ||
    typeof metadata.originalSummaryId === 'string'
  const hasValidVersionId =
    metadata.currentVersionId === undefined ||
    typeof metadata.currentVersionId === 'string'
  const hasValidCount =
    metadata.correctionCount === undefined ||
    (typeof metadata.correctionCount === 'number' &&
      metadata.correctionCount >= 0 &&
      Number.isInteger(metadata.correctionCount))

  // Check corrections array
  interface CorrectionItem {
    id: string
    text: string
    timestamp: Date | string
  }

  const hasValidCorrections =
    metadata.corrections === undefined ||
    (Array.isArray(metadata.corrections) &&
      metadata.corrections.every((c: unknown) => {
        if (typeof c !== 'object' || c === null) return false
        const correction = c as Partial<CorrectionItem>
        return (
          typeof correction.id === 'string' &&
          typeof correction.text === 'string' &&
          (correction.timestamp instanceof Date ||
            (typeof correction.timestamp === 'string' &&
              !isNaN(Date.parse(correction.timestamp))))
        )
      }))

  const hasValidDocId =
    metadata.documentId === undefined || typeof metadata.documentId === 'string'
  const hasValidPatientId =
    metadata.patientId === undefined || typeof metadata.patientId === 'string'

  return (
    hasValidStatus &&
    hasValidOriginalId &&
    hasValidVersionId &&
    hasValidCount &&
    hasValidCorrections &&
    hasValidDocId &&
    hasValidPatientId
  )
}

/**
 * Type guard for VerificationResult
 */
export function isVerificationResult(
  value: unknown
): value is VerificationResult {
  if (value === null || value === undefined || typeof value !== 'object')
    return false

  const result = value as Record<string, unknown>

  const hasValidVerified = typeof result.isVerified === 'boolean'
  const hasValidItems =
    Array.isArray(result.items) &&
    result.items.every((item: unknown) => isVerificationItem(item))

  // Optional fields
  const hasValidReason =
    result.rejectionReason === undefined ||
    typeof result.rejectionReason === 'string'
  const hasValidMetadata =
    result.metadata === undefined || isVerificationMetadata(result.metadata)

  return hasValidVerified && hasValidItems && hasValidReason && hasValidMetadata
}

/**
 * Base verified document interface with common properties
 */
export interface BaseVerifiedDocument extends BaseEntity {
  /**
   * Original document ID
   */
  originalDocumentId: UUID

  /**
   * User ID who verified the document
   */
  verifiedBy?: UUID

  /**
   * Timestamp when the document was verified
   */
  verifiedAt: Timestamp

  /**
   * Verification items with their statuses
   */
  verificationItems: VerificationItem[]

  /**
   * Overall verification status
   */
  verificationStatus: VerificationStatusType

  /**
   * Verification metadata
   */
  verificationMetadata: VerificationMetadata
}

/**
 * Verified document interface extending the base
 */
export interface VerifiedDocument extends BaseVerifiedDocument {
  /**
   * Document type information
   */
  documentType: DocumentType

  /**
   * Patient ID associated with this document
   */
  patientId?: UUID

  /**
   * Verification data derived from extracted data
   */
  verifiedData: {
    /**
     * Content that has been verified
     */
    content: Record<string, unknown>

    /**
     * Additional metadata about the verification
     */
    metadata: Record<string, unknown>
  }
}

/**
 * Verification summary interface for aggregate verification data
 */
export interface VerificationSummary {
  /**
   * Summary ID
   */
  id: UUID

  /**
   * Original document ID
   */
  documentId: UUID

  /**
   * Patient ID
   */
  patientId?: UUID

  /**
   * User who performed verification
   */
  verifiedBy?: UUID

  /**
   * When verification was completed
   */
  verifiedAt: Timestamp

  /**
   * Total number of items verified
   */
  totalItems: number

  /**
   * Number of items that required correction
   */
  correctedItems: number

  /**
   * Number of items approved without changes
   */
  approvedWithoutChanges: number

  /**
   * Average confidence score
   */
  averageConfidence: number

  /**
   * Time spent on verification (in milliseconds)
   */
  verificationTime: number

  /**
   * Verification metadata
   */
  metadata: Record<string, unknown>
}

/**
 * Subject being verified (patient, document, etc.)
 */
export enum VerificationSubjectType {
  PATIENT = 'patient',
  DOCUMENT = 'document',
  REPORT = 'report',
  SUMMARY = 'summary',
  OTHER = 'other',
}

/**
 * Verification request interface
 */
export interface VerificationRequest {
  /**
   * Request ID
   */
  id: UUID

  /**
   * Subject type being verified
   */
  subjectType: VerificationSubjectType

  /**
   * Subject ID being verified
   */
  subjectId: UUID

  /**
   * User ID the request is assigned to
   */
  assignedTo?: UUID

  /**
   * Organization ID the request belongs to
   */
  organizationId?: UUID

  /**
   * Current verification status
   */
  status: VerificationStatusType

  /**
   * When the request was created
   */
  createdAt: Timestamp

  /**
   * When the request was last updated
   */
  updatedAt: Timestamp

  /**
   * When the request is due
   */
  dueAt?: Timestamp

  /**
   * Priority level (1-5, 5 being highest)
   */
  priority?: number

  /**
   * Verification items to verify
   */
  items: VerificationItem[]

  /**
   * Additional request metadata
   */
  metadata?: Record<string, unknown>
}

/**
 * Verification session tracking interface
 */
export interface VerificationSession {
  /**
   * Session ID
   */
  id: UUID

  /**
   * Request ID this session is for
   */
  requestId: UUID

  /**
   * User performing verification
   */
  userId: UUID

  /**
   * Session start time
   */
  startedAt: Timestamp

  /**
   * Session end time
   */
  completedAt?: Timestamp

  /**
   * Current session status
   */
  status: 'active' | 'idle' | 'completed' | 'abandoned'

  /**
   * Items verified in this session
   */
  itemsVerified: number

  /**
   * Items corrected in this session
   */
  itemsCorrected: number

  /**
   * Time spent verifying (in milliseconds)
   */
  activeTime: number

  /**
   * Additional session metadata
   */
  metadata?: Record<string, unknown>
}

/**
 * Type to convert a verification document to database representation
 */
export function toDbVerifiedDocument(
  doc: VerifiedDocument
): Record<string, unknown> {
  return {
    id: doc.id,
    original_document_id: doc.originalDocumentId,
    verified_by: doc.verifiedBy,
    verified_at: doc.verifiedAt,
    verification_items: doc.verificationItems,
    verification_status: doc.verificationStatus,
    verification_metadata: doc.verificationMetadata,
    document_type: doc.documentType,
    patient_id: doc.patientId,
    verified_data: doc.verifiedData,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }
}

/**
 * Type to convert from database representation to verification document
 */
export function fromDbVerifiedDocument(
  doc: Record<string, unknown>
): VerifiedDocument {
  return {
    id: doc.id as UUID,
    originalDocumentId: doc.original_document_id as UUID,
    verifiedBy: doc.verified_by as UUID | undefined,
    verifiedAt: doc.verified_at as Timestamp,
    verificationItems: doc.verification_items as VerificationItem[],
    verificationStatus: doc.verification_status as VerificationStatusType,
    verificationMetadata: doc.verification_metadata as VerificationMetadata,
    documentType: doc.document_type as DocumentType,
    patientId: doc.patient_id as UUID | undefined,
    verifiedData: doc.verified_data as {
      content: Record<string, unknown>
      metadata: Record<string, unknown>
    },
    createdAt: doc.created_at as Timestamp,
    updatedAt: doc.updated_at as Timestamp,
  }
}
