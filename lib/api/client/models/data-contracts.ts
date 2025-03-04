/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * AUTO-GENERATED MODELS, NOW UPDATED TO ALIGN WITH CANONICAL TYPES
 * from `lib/types/verification.ts`. Redundant or conflicting fields
 * have been pruned. Use these as needed for direct API interaction.
 * ---------------------------------------------------------------
 */

import type { VerificationStatus } from '@/lib/types/verification'

/**
 * Basic success response from the API
 */
export interface ApiSuccessResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean
  /** Response data payload */
  data: object
  /**
   * ISO timestamp of when the response was generated
   * @format date-time
   */
  timestamp: string
}

/**
 * Basic error response from the API
 */
export interface ApiErrorResponse {
  error: {
    /** Human-readable error message */
    message: string
    /** Error code for programmatic handling */
    code?: string
    /**
     * ISO timestamp of when the error occurred
     * @format date-time
     */
    timestamp: string
    /** Additional error details, varies by error type */
    details?: object
  }
}

/**
 * Mapped verification status referencing the canonical enum:
 * "pending", "inProgress", "completed", or "failed".
 */
export type VerificationStatusType = VerificationStatus

/**
 * This minimal interface references the canonical "VerificationItem".
 * For full usage, refer to the code in `lib/types/verification.ts`.
 */
export interface VerificationItem {
  id: string
  title: string
  description?: string
  originalContent: string
  currentContent: string
  isVerified: boolean
  isModified: boolean
  changeHistory: Array<{
    id: string
    content: string
    timestamp: string
    userId?: string
    reason?: string
  }>
  metadata?: Record<string, unknown>
}

/**
 * Minimal representation of verification metadata
 * referencing the canonical interface in `lib/types/verification.ts`.
 */
export interface VerificationMetadata {
  verificationStatus: VerificationStatusType
  originalSummaryId: string
  currentVersionId: string
  correctionCount: number
  verifiedAt?: string
  verifiedBy?: string
  corrections: Array<{
    id: string
    text: string
    timestamp: string
    userId?: string
  }>
  extractedData?: unknown
  startedAt?: string
  lastUpdated?: string
  confidenceScore?: number
  rejectionReason?: string
}

/**
 * Minimal representation of a verification result
 * referencing the canonical "VerificationResult" interface.
 */
export interface VerificationResult {
  isCompleted: boolean
  isApproved: boolean
  items: VerificationItem[]
  completedAt: string
  completedBy?: string
  verificationTime?: number
  changeSummary?: {
    totalItems: number
    modifiedItems: number
    approvedWithoutChanges: number
    failedItems: number
  }
  rejectionReason?: string
  verificationMetadata: VerificationMetadata
}

/**
 * In some API responses, a VerifiedDocument might be returned.
 * Align with the canonical "VerifiedDocument" logic as needed.
 * For brevity, omitted many fields here.
 */
export interface VerifiedDocument {
  id: string
  extractedDocumentId: string
  createdAt: string
  patientId?: string
  documentType?: any // Placeholder; refine if needed
  verificationItems: VerificationItem[]
  verifiedData: Record<string, unknown>
  originalData: Record<string, unknown>
  verificationStatus: {
    isVerified: boolean
    verifiedAt: string
    corrections?: Record<string, string>
    verifiedBy?: string
  }
  _uiState?: {
    isUIVerificationComplete?: boolean
    uiVerifiedAt?: string
  }
}

/**
 * Example request bodies referencing these canonical structures:
 */

/**
 * Partial request object for generating a new verification from a document
 */
export interface GenerateVerificationRequest {
  /** The document to be verified */
  document: Record<string, unknown>
  /** The workflow ID for this verification */
  workflowId?: string
  /** Optional ID of a related message */
  messageId?: string
  /** Optional ID for the generated summary */
  summaryId?: string
}

/**
 * Example response object for a successful verification generation
 */
export interface GenerateVerificationResponse {
  success: boolean
  data: {
    summaryId: string
    summary: string
    structuredData?: Record<string, unknown>
  }
  timestamp: string
}

/**
 * Example request object for correction submission
 */
export interface SubmitCorrectionRequest {
  correction: string
  currentSummary: string
  workflowId?: string
  messageId?: string
}

/**
 * Example response object for correction processing
 */
export interface CorrectionProcessedResponse {
  success: boolean
  data: {
    summaryId: string
    summary: string
    structuredData?: Record<string, unknown>
    correctionCount?: number
  }
  timestamp: string
}

/**
 * For other domain objects (Patients, Reports, etc.), see their
 * respective core definitions or code generation modules.
 */