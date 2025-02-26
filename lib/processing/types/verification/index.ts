/**
 * Centralized verification types
 * All verification-related types and interfaces are defined or re-exported here
 */

import type { DocumentBase } from '../base';
import type { DocumentType } from '../index';
import type { ExtractedDocument } from '../extraction';
import type { Json } from '@/lib/supabase';

/**
 * Re-export ExtractedDocument for verification components
 */
export { type ExtractedDocument };

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
export function dateToISOString(date: Date): string {
  return date.toISOString();
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
 * Get metadata in database-compatible format
 * @param metadata Object to convert to JSON-compatible format
 * @returns Database-compatible metadata object
 */
export function getDbCompatibleMetadata(metadata: Record<string, any>): Json {
  // Replace Date objects with ISO strings
  return JSON.parse(JSON.stringify(metadata, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }));
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