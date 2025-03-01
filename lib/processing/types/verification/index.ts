/**
 * Centralized verification types
 * All verification-related types and interfaces are defined or re-exported here
 */

import type { DocumentBase, DocumentType } from '../base';
import type { ExtractedDocument as OriginalExtractedDocument, DocumentMetadata } from '../extraction';
import type { Json } from '@/lib/supabase';
import type { 
  VerificationMetadata, 
  VerificationStatusType,
  MessageMetadata
} from '@/lib/workflow/types';

/**
 * Flexible date type for UI and database compatibility
 */
export type FlexibleDate = Date | string;

/**
 * Modified ExtractedDocument that accepts both Date and string formats
 * for compatibility with UI components and database storage
 */
export interface VerificationExtractedDocument extends Omit<OriginalExtractedDocument, 'createdAt'> {
  /**
   * Creation timestamp as Date or ISO string
   */
  createdAt: FlexibleDate;
}

// For backwards compatibility, also export as ExtractedDocument
// Eventually this should be removed and all code updated to use VerificationExtractedDocument
export type ExtractedDocument = VerificationExtractedDocument;

/**
 * Status of a verification process
 */
export interface VerificationStatus {
  /**
   * Whether the item is verified
   */
  isVerified: boolean;
  
  /**
   * When the verification occurred (ISO string format for database compatibility)
   */
  verifiedAt: string;
  
  /**
   * Optional corrections to the original data
   */
  corrections?: Record<string, string>;
  
  /**
   * User who performed the verification (if applicable)
   */
  verifiedBy?: string;
}

/**
 * Base verification item interface
 */
export interface BaseVerificationItem {
  /**
   * Unique identifier for the verification item
   */
  id: string;
  
  /**
   * Section of the document this item belongs to
   */
  section: string;
  
  /**
   * Key for the item within its section
   */
  key: string;
  
  /**
   * Original extracted value
   */
  value: any;
  
  /**
   * Confidence score for the extraction (0-1)
   */
  confidence: number;
  
  /**
   * Whether the item has been verified
   */
  isVerified: boolean;
  
  /**
   * Corrections made by the user (if any)
   */
  corrections?: Record<string, any>;
  
  /**
   * Optional explanatory note for the verification
   */
  note?: string;
}

/**
 * Verification item represents a specific content element
 * that requires verification
 */
export interface VerificationItem {
  /**
   * Unique identifier for this verification item
   */
  id: string;
  
  /**
   * Title/label for this verification item
   */
  title: string;
  
  /**
   * Description of what needs to be verified
   */
  description?: string;
  
  /**
   * The original content extracted from the document
   */
  originalContent: string;
  
  /**
   * The current content after any corrections
   */
  currentContent: string;
  
  /**
   * Whether this item has been verified by a user
   */
  isVerified: boolean;
  
  /**
   * Whether this item has been modified during verification
   */
  isModified: boolean;
  
  /**
   * History of content changes
   */
  changeHistory: Array<{
    /**
     * Version ID
     */
    id: string;
    
    /**
     * Content at this version
     */
    content: string;
    
    /**
     * Timestamp of the change
     */
    timestamp: string;
    
    /**
     * User who made the change (if applicable)
     */
    userId?: string;
  }>;
  
  /**
   * Metadata for this verification item
   */
  metadata?: Record<string, any>;
}

/**
 * Options for the verification process
 */
export interface VerificationOptions {
  /**
   * Whether verification is required
   */
  isRequired: boolean;
  
  /**
   * Timeout for verification (in milliseconds)
   */
  timeoutMs?: number;
  
  /**
   * Whether to auto-approve after timeout
   */
  autoApproveOnTimeout?: boolean;
  
  /**
   * User ID performing verification
   */
  userId?: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Verification result after user review
 */
export interface VerificationResult {
  /**
   * Whether verification was completed
   */
  isCompleted: boolean;
  
  /**
   * Whether the content was approved
   */
  isApproved: boolean;
  
  /**
   * List of verification items with their verification status
   */
  items: VerificationItem[];
  
  /**
   * Timestamp of verification completion
   */
  completedAt?: string;
  
  /**
   * User who completed verification
   */
  completedBy?: string;
  
  /**
   * Time taken for verification (in milliseconds)
   */
  verificationTime?: number;
  
  /**
   * Detailed metadata about the verification process
   */
  verificationMetadata: VerificationMetadata;
}

/**
 * Interface for chat messages related to verification
 */
export interface VerificationMessage {
  /**
   * Message ID
   */
  id: string;
  
  /**
   * Message content
   */
  content: string;
  
  /**
   * Message role (system, user, assistant)
   */
  role: 'system' | 'user' | 'assistant';
  
  /**
   * Whether this message is a verification request
   */
  isVerificationRequest?: boolean;
  
  /**
   * Whether this message contains summary content
   */
  isSummary?: boolean;
  
  /**
   * Whether this message is a correction
   */
  isCorrection?: boolean;
  
  /**
   * Metadata for this message
   */
  metadata: MessageMetadata;
  
  /**
   * Creation timestamp
   */
  createdAt: Date | string;
}

/**
 * Base verified document interface
 */
export interface BaseVerifiedDocument {
  /**
   * The original extracted document ID
   */
  extractedDocumentId: string;
  
  /**
   * Creation timestamp (ISO string format for database compatibility)
   */
  createdAt: string;
  
  /**
   * Patient ID
   */
  patientId?: string;
  
  /**
   * Document type information
   */
  documentType: DocumentType;
  
  /**
   * Verification items
   */
  verificationItems: VerificationItem[];
  
  /**
   * The verified data (after corrections)
   */
  verifiedData: Record<string, any>;
  
  /**
   * Original extraction data
   */
  originalData: any;
  
  /**
   * Overall verification status
   */
  verificationStatus: VerificationStatus;
}

/**
 * Enhanced verified document with additional UI properties
 */
export interface VerifiedDocument extends BaseVerifiedDocument {
  /**
   * Unique identifier
   */
  id: string;
  
  /**
   * Optional UI state for verification tracking
   */
  _uiState?: {
    /**
     * Whether all verification steps are completed in the UI
     */
    isUIVerificationComplete?: boolean;
    
    /**
     * Timestamp when the verification was completed in the UI
     */
    uiVerifiedAt?: string;
  };
}

/**
 * Convert a JS Date to an ISO string for database storage
 * @param date Date object to convert
 * @returns ISO string representation
 */
export function dateToISOString(date: Date | string): string {
  if (date instanceof Date) {
    return date.toISOString();
  }
  return date;
}

/**
 * Convert an ISO string from the database to a Date object
 * @param isoString ISO string to convert
 * @returns Date object
 */
export function isoStringToDate(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Ensure a value is a Date object
 * @param value Date or string to ensure is a Date
 * @returns Date object
 */
export function ensureDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}

/**
 * Ensure a value is an ISO string
 * @param value Date or string to ensure is an ISO string
 * @returns ISO string
 */
export function ensureISOString(value: Date | string): string {
  if (typeof value === 'string') {
    return value;
  }
  return value.toISOString();
}

/**
 * Get metadata in database-compatible format
 * @param metadata Object to convert to JSON-compatible format
 * @returns Database-compatible metadata object
 */
export function getDbCompatibleMetadata(metadata: Record<string, any>): Json {
  // Replace Date objects with ISO strings
  const jsonCompatible = JSON.parse(JSON.stringify(metadata, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }));
  
  return jsonCompatible as Json;
}

/**
 * Convert a standard ExtractedDocument to our flexible interface
 * @param doc Original extracted document
 * @returns Compatible extracted document
 */
export function toCompatibleExtractedDocument(
  doc: OriginalExtractedDocument | null | undefined
): ExtractedDocument | undefined {
  if (!doc) return undefined;
  
  return {
    ...doc,
    createdAt: doc.createdAt instanceof Date 
      ? doc.createdAt.toISOString() 
      : String(doc.createdAt),
    extractedData: {
      ...doc.extractedData,
      metadata: {
        ...doc.extractedData.metadata,
        extractedAt: doc.extractedData.metadata?.extractedAt 
          ? (doc.extractedData.metadata.extractedAt instanceof Date 
            ? doc.extractedData.metadata.extractedAt.toISOString() 
            : String(doc.extractedData.metadata.extractedAt))
          : new Date().toISOString()
      }
    }
  };
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
  | 'chat_error';

/**
 * Helper functions for verification process
 */

/**
 * Check if a verification process is complete
 */
export function isVerificationComplete(
  verificationMetadata?: VerificationMetadata
): boolean {
  return verificationMetadata?.verificationStatus === 'completed';
}

/**
 * Create a new verification metadata object
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
    corrections: []
  };
}

/**
 * Update verification status
 */
export function updateVerificationStatus(
  metadata: VerificationMetadata,
  status: VerificationStatusType
): VerificationMetadata {
  return {
    ...metadata,
    verificationStatus: status,
    ...(status === 'completed' ? { 
      verifiedAt: new Date().toISOString() 
    } : {})
  };
}

/**
 * Add a correction to verification metadata
 */
export function addCorrection(
  metadata: VerificationMetadata,
  correctionText: string
): VerificationMetadata {
  const newCorrection = {
    id: `correction-${Date.now()}`,
    text: correctionText,
    timestamp: new Date().toISOString()
  };
  
  return {
    ...metadata,
    verificationStatus: 'in_progress',
    correctionCount: metadata.correctionCount + 1,
    corrections: [...metadata.corrections, newCorrection]
  };
}

/**
 * Create message metadata for a verification message
 */
export function createVerificationMessageMetadata(
  verificationMetadata: VerificationMetadata,
  isRequest: boolean = false
): MessageMetadata {
  return {
    isVerificationRequest: isRequest,
    isSummary: !isRequest,
    summaryVersionId: verificationMetadata.currentVersionId,
    verificationMetadata
  };
}

/**
 * Create message metadata for a correction message
 */
export function createCorrectionMessageMetadata(
  verificationMetadata: VerificationMetadata,
  summaryVersionId: string
): MessageMetadata {
  return {
    isCorrection: true,
    summaryVersionId,
    verificationMetadata
  };
} 