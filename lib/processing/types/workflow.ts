/**
 * Workflow types for document processing
 */
import type { ProcessingPhase } from './base';
import type { Database } from '@/lib/supabase';

/**
 * Base workflow steps from the database
 * These steps can be directly stored in the database
 */
export type DBWorkflowStep = Database['public']['Enums']['workflow_step'];

/**
 * Extended workflow steps used only in the application
 * These steps must be mapped to valid database steps before storage
 */
export type ExtendedWorkflowStep = 
  | 'error'           // General error state (mapped to chat_error or handled specially)
  | 'extraction'      // Document extraction (mapped to extracting)
  | 'research'        // Research phase (no direct DB equivalent)
  | 'report_presentation'; // Report presentation (no direct DB equivalent)

/**
 * All possible workflow steps across the application
 * 
 * This unified type ensures consistency across document processing and chat workflows,
 * combining both database-defined steps and application-specific steps
 */
export type WorkflowStep = DBWorkflowStep | ExtendedWorkflowStep;

/**
 * Document processing workflow steps
 * Subset of WorkflowStep for document-related flows
 */
export type DocumentWorkflowStep = 
  | 'idle'
  | 'extraction'
  | 'extracting'
  | 'verification'
  | 'research'
  | 'report_generation'
  | 'complete'
  | 'error';

/**
 * Chat workflow steps
 * Subset of WorkflowStep for chat-related flows
 */
export type ChatWorkflowStep = 
  | 'idle'
  | 'uploading'
  | 'extracting' 
  | 'verification'
  | 'chat_started'
  | 'chat_in_progress'
  | 'chat_completed'
  | 'chat_error'
  | 'report_generation'
  | 'report_presentation'
  | 'complete'; 

/**
 * Map workflow steps to processing phases
 * This mapping helps translate between our internal workflow steps
 * and the user-facing processing phases
 */
export const workflowStepToPhase: Record<WorkflowStep, ProcessingPhase | undefined> = {
  // Common steps
  'idle': undefined,
  'complete': undefined,
  'error': undefined,
  
  // Document processing steps
  'extraction': 'extraction',
  'extracting': 'extraction', // Map the database version to the same phase
  'verification': 'verification',
  'research': 'analysis',
  'report_generation': 'reporting',
  
  // Chat steps
  'uploading': 'extraction',
  'chat_started': 'analysis',
  'chat_in_progress': 'analysis',
  'chat_completed': 'reporting',
  'chat_error': undefined,
  'report_presentation': 'reporting'
};

/**
 * Workflow context for all operations
 * This simplifies passing workflow information throughout the system
 */
export interface WorkflowContext {
  /**
   * Workflow ID for database tracking
   */
  workflowId?: string | null;
  
  /**
   * Current workflow step
   */
  step: WorkflowStep;
  
  /**
   * Custom step description for UI display
   */
  stepDescription?: string;
}

/**
 * Workflow state for tracking document processing
 */
export interface WorkflowState {
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Start timestamp
   */
  startedAt: Date;
  
  /**
   * Current step description
   */
  currentStep?: string;
  
  /**
   * Current workflow step
   */
  step: WorkflowStep;
  
  /**
   * Error message
   */
  error?: string;
} 