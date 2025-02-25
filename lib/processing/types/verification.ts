import type { DocumentBase } from './base';
import type { ExtractedDocument } from './extraction';

/**
 * Status of a verification process
 */
export interface VerificationStatus {
  /**
   * Whether the item is verified
   */
  isVerified: boolean;
  
  /**
   * When the verification occurred
   */
  verifiedAt: Date;
  
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
 * An item that needs verification
 */
export interface VerificationItem {
  /**
   * Unique identifier for the verification item
   */
  id: string;
  
  /**
   * Section of the document this item belongs to
   */
  section: string;
  
  /**
   * Display label for the item
   */
  label?: string;
  
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
 * A document that has gone through verification
 */
export interface VerifiedDocument extends DocumentBase {
  /**
   * The original extracted document
   */
  extractedDocument: ExtractedDocument;
  
  /**
   * Verification items for the document
   */
  verificationItems: VerificationItem[];
  
  /**
   * The verified data (after corrections)
   */
  verifiedData: Record<string, any>;
  
  /**
   * Overall verification status
   */
  verificationStatus: VerificationStatus;
} 