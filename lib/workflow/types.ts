// lib/workflow/types.ts
/**
 * All possible workflow steps across the application.
 * These steps represent both UI states and database states in a unified way.
 */
export type WorkflowStep = 
  // Common workflow steps
  | 'idle' 
  | 'uploading' 
  | 'extracting' 
  | 'verification'
  | 'research'
  | 'report_generation' 
  | 'report_presentation'
  | 'complete' 
  // Chat specific steps  
  | 'chat_started'
  | 'chat_in_progress' 
  | 'chat_completed' 
  | 'chat_error'
  // Error state
  | 'error';

/**
 * Workflow state interface representing the current state of a workflow
 */
export interface WorkflowState {
  step: WorkflowStep;
  progress: number;
  phase?: string;
  error?: string | null;
  metadata?: Record<string, any>;
  timestamp: Date;
}

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