// lib/workflow/types.ts
import type { Database } from '@/lib/supabase';

/**
 * Unified workflow step type for the entire application
 * 
 * This type directly extends the database workflow_step enum with additional application-specific steps.
 * This ensures we maintain compatibility with the database while supporting app-only operations.
 */
export type WorkflowStep = 
  // All database-defined workflow steps
  | Database['public']['Enums']['workflow_step']
  // Application-specific extensions
  | 'research'            // Research phase 
  | 'report_presentation' // Report presentation
  // Verification substates - these now match the database enum values
  | 'verification_pending'      // Waiting for user to verify
  | 'verification_in_progress'  // User is reviewing/correcting
  | 'verification_completed'    // User has completed verification 
  | 'verification_failed'       // Verification failed
  | 'error';              // General error state

/**
 * Processing phases for status tracking
 */
export type ProcessingPhase =
  | 'initialization'
  | 'uploading'
  | 'extraction'
  | 'analysis'
  | 'verification'
  | 'correction'
  | 'research'
  | 'report_generation'
  | 'completion'
  | 'extraction_completed'  // Added to match the phase used in patient-summary.ts
  | 'error';

/**
 * Workflow state interface representing the current state of a workflow
 */
export interface WorkflowState {
  step: WorkflowStep;
  progress: number;
  phase?: ProcessingPhase;
  error?: string | null;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Verification status type for chat-based verification
 */
export type VerificationStatusType = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Verification metadata for tracking the verification process
 */
export interface VerificationMetadata {
  /**
   * Current verification status
   */
  verificationStatus: VerificationStatusType;
  
  /**
   * ID of the original summary
   */
  originalSummaryId: string;
  
  /**
   * ID of the current version being verified
   */
  currentVersionId: string;
  
  /**
   * Number of corrections applied
   */
  correctionCount: number;
  
  /**
   * Timestamp when the summary was verified
   */
  verifiedAt?: string;
  
  /**
   * User ID who verified the summary
   */
  verifiedBy?: string;
  
  /**
   * History of corrections applied
   */
  corrections: Array<{
    /**
     * Correction ID
     */
    id: string;
    
    /**
     * Correction text
     */
    text: string;
    
    /**
     * Timestamp when correction was made
     */
    timestamp: string;
  }>;

  /**
   * Extracted document data
   */
  extractedData?: any;
  
  /**
   * Timestamp when verification started
   */
  startedAt?: string;
  
  /**
   * Timestamp of last update
   */
  lastUpdated?: string;
}

/**
 * Message metadata for chat-based verification
 */
export interface MessageMetadata {
  /**
   * Whether this message contains a summary
   */
  isSummary?: boolean;
  
  /**
   * Whether this message is requesting verification
   */
  isVerificationRequest?: boolean;
  
  /**
   * Whether this message is a correction to a summary
   */
  isCorrection?: boolean;
  
  /**
   * Whether this message is a progress update
   */
  isProgress?: boolean;
  
  /**
   * ID of the summary version this message refers to
   */
  summaryVersionId?: string;
  
  /**
   * Progress value (0-100) for progress messages
   */
  progressValue?: number;
  
  /**
   * Current phase for progress messages
   */
  progressPhase?: string;
  
  /**
   * Reference to verification metadata if applicable
   */
  verificationMetadata?: VerificationMetadata;
  
  /**
   * Custom metadata specific to this message
   */
  [key: string]: any;
}

/**
 * Union type helpers for message type checking
 */
export const isVerificationMessage = (metadata?: MessageMetadata): boolean => 
  metadata?.isVerificationRequest === true;

export const isSummaryMessage = (metadata?: MessageMetadata): boolean => 
  metadata?.isSummary === true;

export const isCorrectionMessage = (metadata?: MessageMetadata): boolean => 
  metadata?.isCorrection === true;

export const isProgressMessage = (metadata?: MessageMetadata): boolean => 
  metadata?.isProgress === true;

/**
 * Verification status helper functions
 */
export const isVerificationComplete = (metadata?: VerificationMetadata): boolean => 
  metadata?.verificationStatus === 'completed';

export const isVerificationInProgress = (metadata?: VerificationMetadata): boolean => 
  metadata?.verificationStatus === 'in_progress';

export const isVerificationPending = (metadata?: VerificationMetadata): boolean => 
  metadata?.verificationStatus === 'pending';

export const isVerificationFailed = (metadata?: VerificationMetadata): boolean => 
  metadata?.verificationStatus === 'failed';

/**
 * Options for workflow operations
 */
export interface WorkflowOptions<T = any> {
  workflowId?: string;
  onProgress?: (progress: number, phase?: string) => void;
  onStatusUpdate?: (status: string) => void;
  onSuccess?: (result: T) => void;
  onError?: (error: string) => void;
}

/**
 * Options specific to verification workflows
 */
export interface VerificationWorkflowOptions extends WorkflowOptions {
  /**
   * Original summary ID
   */
  originalSummaryId: string;
  
  /**
   * User ID performing verification
   */
  verifiedBy?: string;
  
  /**
   * Maximum time allowed for verification (in milliseconds)
   */
  timeoutMs?: number;
  
  /**
   * Whether to automatically mark as verified after timeout
   */
  autoVerifyOnTimeout?: boolean;
}