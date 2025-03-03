/**
 * Centralized verification types
 * 
 * This file contains all verification-related types and interfaces.
 * It imports canonical types from /lib/workflow/types.ts when available
 * and defines specific verification-related types that aren't already defined.
 * 
 * IMPORTANT: For core workflow types (WorkflowStep, VerificationMetadata, etc.)
 * always import from /lib/workflow/types.ts rather than defining duplicates here.
 */

import type { Json } from '@/lib/supabase'
import type {
  CorrectionEntry,
  MessageMetadata,
  VerificationMetadata,
  VerificationStatusType,
  WorkflowStep
} from '@/lib/workflow/types'
import type { DocumentBase, DocumentType } from '../base'
import type {
  DocumentMetadata,
  ExtractedDocument as OriginalExtractedDocument,
} from '../extraction'

// Re-export canonical workflow types for convenience
export type {
  VerificationMetadata,
  VerificationStatusType,
  CorrectionEntry,
  WorkflowStep
}

/**
 * Flexible date type for UI and database compatibility
 */
export type FlexibleDate = Date | string

/**
 * Modified ExtractedDocument that accepts both Date and string formats
 * for compatibility with UI components and database storage
 */
export interface VerificationExtractedDocument
  extends Omit<OriginalExtractedDocument, 'createdAt'> {
  /**
   * Creation timestamp as Date or ISO string
   */
  createdAt: FlexibleDate
}

// For backwards compatibility, also export as ExtractedDocument
// Eventually this should be removed and all code updated to use VerificationExtractedDocument
export type ExtractedDocument = VerificationExtractedDocument

/**
 * Status of a verification process
 */
export interface VerificationStatus {
  /**
   * Whether the item is verified
   */
  isVerified: boolean

  /**
   * When the verification occurred (ISO string format for database compatibility)
   */
  verifiedAt: string

  /**
   * Optional corrections to the original data
   */
  corrections?: Record<string, string>

  /**
   * User who performed the verification (if applicable)
   */
  verifiedBy?: string
}

/**
 * Version entry for tracking content changes in verification items
 */
export interface VersionHistoryEntry {
  /**
   * Unique identifier for this version
   */
  id: string

  /**
   * Content at this version
   */
  content: string

  /**
   * Timestamp of the change (ISO format)
   */
  timestamp: string

  /**
   * User who made the change (if applicable)
   */
  userId?: string
  
  /**
   * Optional reason for the change
   */
  reason?: string
}

/**
 * Canonical verification item that represents content requiring verification
 * 
 * This is the primary verification item interface to use throughout the application.
 * It provides a consistent structure for verification workflow.
 */
export interface VerificationItem {
  /**
   * Unique identifier for this verification item
   */
  id: string

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
  metadata?: Record<string, any>
  
  /**
   * Optional source location in the original document
   */
  source?: {
    /**
     * Document ID this item was extracted from
     */
    documentId: string
    
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
 * Legacy base verification item interface
 * @deprecated Use VerificationItem instead
 */
export interface BaseVerificationItem {
  id: string
  section: string
  key: string
  value: any
  confidence: number
  isVerified: boolean
  corrections?: Record<string, any>
  note?: string
}

/**
 * Options for the verification process
 * 
 * This provides configuration for verification workflows.
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
  userId?: string

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
  metadata?: Record<string, any>

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
 * 
 * This is returned by verification processes to indicate the outcome
 * of the verification workflow.
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
   * Timestamp of verification completion (ISO format)
   */
  completedAt: string

  /**
   * User who completed verification
   */
  completedBy?: string

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
 * Interface for chat messages related to verification
 */
export interface VerificationMessage {
  /**
   * Message ID
   */
  id: string

  /**
   * Message content
   */
  content: string

  /**
   * Message role (system, user, assistant)
   */
  role: 'system' | 'user' | 'assistant'

  /**
   * Whether this message is a verification request
   */
  isVerificationRequest?: boolean

  /**
   * Whether this message contains summary content
   */
  isSummary?: boolean

  /**
   * Whether this message is a correction
   */
  isCorrection?: boolean

  /**
   * Metadata for this message
   */
  metadata: MessageMetadata

  /**
   * Creation timestamp
   */
  createdAt: Date | string
}

/**
 * Base verified document interface
 */
export interface BaseVerifiedDocument {
  /**
   * The original extracted document ID
   */
  extractedDocumentId: string

  /**
   * Creation timestamp (ISO string format for database compatibility)
   */
  createdAt: string

  /**
   * Patient ID
   */
  patientId?: string

  /**
   * Document type information
   */
  documentType: DocumentType

  /**
   * Verification items
   */
  verificationItems: VerificationItem[]

  /**
   * The verified data (after corrections)
   */
  verifiedData: Record<string, any>

  /**
   * Original extraction data
   */
  originalData: any

  /**
   * Overall verification status
   */
  verificationStatus: VerificationStatus
}

/**
 * Enhanced verified document with additional UI properties
 */
export interface VerifiedDocument extends BaseVerifiedDocument {
  /**
   * Unique identifier
   */
  id: string

  /**
   * Optional UI state for verification tracking
   */
  _uiState?: {
    /**
     * Whether all verification steps are completed in the UI
     */
    isUIVerificationComplete?: boolean

    /**
     * Timestamp when the verification was completed in the UI
     */
    uiVerifiedAt?: string
  }
}

/**
 * Convert a JS Date to an ISO string for database storage
 * @param date Date object to convert
 * @returns ISO string representation
 */
export function dateToISOString(date: Date | string): string {
  if (date instanceof Date) {
    return date.toISOString()
  }
  return date
}

/**
 * Convert an ISO string from the database to a Date object
 * @param isoString ISO string to convert
 * @returns Date object
 */
export function isoStringToDate(isoString: string): Date {
  return new Date(isoString)
}

/**
 * Ensure a value is a Date object
 * @param value Date or string to ensure is a Date
 * @returns Date object
 */
export function ensureDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value
  }
  return new Date(value)
}

/**
 * Ensure a value is an ISO string
 * @param value Date or string to ensure is an ISO string
 * @returns ISO string
 */
export function ensureISOString(value: Date | string): string {
  if (typeof value === 'string') {
    return value
  }
  return value.toISOString()
}

/**
 * Get metadata in database-compatible format
 * @param metadata Object to convert to JSON-compatible format
 * @returns Database-compatible metadata object
 */
export function getDbCompatibleMetadata(metadata: Record<string, any>): Json {
  // Replace Date objects with ISO strings
  const jsonCompatible = JSON.parse(
    JSON.stringify(metadata, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString()
      }
      return value
    })
  )

  return jsonCompatible as Json
}

/**
 * Convert a standard ExtractedDocument to our flexible interface
 * @param doc Original extracted document
 * @returns Compatible extracted document
 */
export function toCompatibleExtractedDocument(
  doc: OriginalExtractedDocument | null | undefined
): ExtractedDocument | undefined {
  if (!doc) return undefined

  return {
    ...doc,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : String(doc.createdAt),
    extractedData: {
      ...doc.extractedData,
      metadata: {
        ...doc.extractedData.metadata,
        extractedAt: doc.extractedData.metadata?.extractedAt
          ? doc.extractedData.metadata.extractedAt instanceof Date
            ? doc.extractedData.metadata.extractedAt.toISOString()
            : String(doc.extractedData.metadata.extractedAt)
          : new Date().toISOString(),
      },
    },
  }
}

/**
 * Workflow step enum aligned with Supabase schema
 */
export type WorkflowStep =
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'verification'
  | 'report_generation'
  | 'complete'
  | 'chat_started'
  | 'chat_in_progress'
  | 'chat_completed'
  | 'chat_error'

/**
 * Helper functions for verification process
 * 
 * These utility functions standardize common operations related to
 * verification workflow and metadata.
 */

/**
 * Create a new verification metadata object with default values
 */
export function createVerificationMetadata(
  originalSummaryId: string,
  currentVersionId: string
): VerificationMetadata {
  return {
    verificationStatus: 'pending',
    originalSummaryId,
    currentVersionId,
    correctionCount: 0,
    corrections: [],
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
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
    ...(status === 'completed' ? { verifiedAt: now } : {}),
    ...(status === 'failed' ? { rejectionReason: metadata.rejectionReason || 'Verification failed' } : {})
  }
}

/**
 * Add a correction to verification metadata
 */
export function addCorrection(
  metadata: VerificationMetadata,
  correctionText: string,
  userId?: string
): VerificationMetadata {
  const now = new Date().toISOString()
  
  const newCorrection: CorrectionEntry = {
    id: `correction-${Date.now()}`,
    text: correctionText,
    timestamp: now,
    ...(userId ? { userId } : {})
  }

  return {
    ...metadata,
    verificationStatus: 'in_progress',
    correctionCount: metadata.correctionCount + 1,
    corrections: [...metadata.corrections, newCorrection],
    lastUpdated: now
  }
}

/**
 * Create a new verification item
 */
export function createVerificationItem(
  title: string, 
  originalContent: string,
  options?: {
    category?: string;
    confidence?: number;
    description?: string;
    documentId?: string;
  }
): VerificationItem {
  const id = `verification-item-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const now = new Date().toISOString()
  
  return {
    id,
    title,
    originalContent,
    currentContent: originalContent, // Start with original content
    isVerified: false,
    isModified: false,
    confidence: options?.confidence,
    category: options?.category,
    description: options?.description,
    changeHistory: [
      {
        id: `version-${Date.now()}`,
        content: originalContent,
        timestamp: now
      }
    ],
    metadata: {},
    ...(options?.documentId ? {
      source: {
        documentId: options.documentId
      }
    } : {})
  }
}

/**
 * Create message metadata for a verification message
 * with consistent structure
 */
export function createVerificationMessageMetadata(
  verificationMetadata: VerificationMetadata,
  isRequest: boolean = false
): MessageMetadata {
  return {
    type: isRequest ? 'verification_request' : 'summary',
    isVerificationRequest: isRequest,
    isSummary: !isRequest,
    contentVersionId: verificationMetadata.currentVersionId,
    summaryVersionId: verificationMetadata.currentVersionId, // Legacy support
    verificationMetadata
  }
}

/**
 * Create message metadata for a correction message
 * with consistent structure
 */
export function createCorrectionMessageMetadata(
  verificationMetadata: VerificationMetadata,
  contentVersionId: string
): MessageMetadata {
  return {
    type: 'correction',
    isCorrection: true,
    contentVersionId,
    summaryVersionId: contentVersionId, // Legacy support
    verificationMetadata
  }
}

/**
 * Generate a change summary from verification items
 */
export function generateChangeSummary(items: VerificationItem[]): VerificationResult['changeSummary'] {
  const totalItems = items.length
  const modifiedItems = items.filter(item => item.isModified).length
  const failedItems = items.filter(item => !item.isVerified).length
  const approvedWithoutChanges = items.filter(item => item.isVerified && !item.isModified).length
  
  return {
    totalItems,
    modifiedItems,
    failedItems,
    approvedWithoutChanges
  }
}
