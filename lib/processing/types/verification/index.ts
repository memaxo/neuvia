/**
 * Centralized verification types
 * All verification-related types and interfaces are defined or re-exported here
 */

import type { DocumentBase, DocumentType } from '../base';
import type { ExtractedDocument as OriginalExtractedDocument, DocumentMetadata } from '../extraction';
import type { Json } from '@/lib/supabase';

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
 * Enhanced verification item with additional properties for the UI
 */
export interface VerificationItem extends BaseVerificationItem {
  /**
   * Original value before any edits
   */
  originalValue: string;
  
  /**
   * Category of the field (patient, medical, etc.)
   */
  category: string;
  
  /**
   * Whether this field is required for verification
   */
  isRequired: boolean;
  
  /**
   * Type of field (text, date, number, etc.)
   */
  fieldType?: string;
  
  /**
   * Field name in the database
   */
  fieldName?: string;
  
  /**
   * Display label for the field
   */
  label?: string;
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