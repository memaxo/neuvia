/**
 * Workflow State Management Utility
 * 
 * Centralized functions for managing workflow state updates across services
 */
import { createBrowserClient } from '@/lib/supabase/clients';
import type { Database } from '@/lib/supabase';
import type { 
  WorkflowStep, 
  WorkflowContext, 
  DBWorkflowStep, 
  ExtendedWorkflowStep 
} from '@/lib/processing/types/workflow';
import type { ProcessingStatus } from '@/lib/processing/types/base';

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Phase progress callback type
 */
export type PhaseProgressCallback = (phase: string, progress: number) => void;

/**
 * Status update callback type
 */
export type StatusUpdateCallback = (status: ProcessingStatus) => void;

/**
 * Success callback type
 */
export type SuccessCallback<T> = (result: T) => void;

/**
 * Error callback type 
 */
export type ErrorCallback = (error: string) => void;

/**
 * Common options interface for workflow operations
 */
export interface WorkflowOptions<T = any> {
  /**
   * User ID performing the operation
   */
  userId?: string;
  
  /**
   * Progress callback
   */
  onProgress?: ProgressCallback | PhaseProgressCallback;
  
  /**
   * Status update callback
   */
  onStatusUpdate?: StatusUpdateCallback;
  
  /**
   * Success callback
   */
  onSuccess?: SuccessCallback<T>;
  
  /**
   * Error callback
   */
  onError?: ErrorCallback;
}

/**
 * Database workflow step mapping
 * Maps our internal WorkflowStep types to the database enum values
 */
const DB_WORKFLOW_STEP_MAP: Record<WorkflowStep, DBWorkflowStep | null> = {
  // Common steps (from database)
  'idle': 'idle',
  'complete': 'complete',
  
  // App-specific steps that need mapping
  'error': null, // Not a valid DB value
  
  // Document processing specific
  'extraction': 'extracting', // Map to DB value
  'extracting': 'extracting',
  'verification': 'verification',
  'research': null, // Not a valid DB value
  'report_generation': 'report_generation',
  
  // Chat specific
  'uploading': 'uploading',
  'chat_started': 'chat_started',
  'chat_in_progress': 'chat_in_progress',
  'chat_completed': 'chat_completed',
  'chat_error': 'chat_error',
  'report_presentation': null // Not a valid DB value
};

/**
 * Workflow State Manager
 */
class WorkflowManager {
  private supabase = createBrowserClient();
  
  /**
   * Update workflow state
   * 
   * @param workflowId Workflow ID
   * @param step Current workflow step
   * @param metadata Additional metadata
   * @returns Updated workflow state
   */
  async updateWorkflowState(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!workflowId) return;
    
    try {
      // Use the mapping to convert internal step values to database values
      const dbStep = DB_WORKFLOW_STEP_MAP[step];
      
      // Only update if we have a valid DB step
      if (dbStep !== null) {
        await this.supabase
          .from('workflow_states')
          .update({
            current_step: dbStep,
            metadata: {
              ...metadata,
              originalStep: step, // Store the original step for reference
              updatedAt: new Date().toISOString()
            }
          })
          .eq('id', workflowId);
      } else {
        console.warn(`[WorkflowManager] Step '${step}' cannot be stored in database. Recording in metadata only.`);
        // Still update metadata but don't change the step
        await this.supabase
          .from('workflow_states')
          .update({
            metadata: {
              ...metadata,
              appStep: step, // Store the app-only step in metadata
              updatedAt: new Date().toISOString()
            }
          })
          .eq('id', workflowId);
      }
    } catch (error) {
      console.error('[WorkflowManager] Error updating workflow state:', error);
    }
  }
  
  /**
   * Report progress
   * 
   * @param options Workflow options
   * @param phase Current phase
   * @param progress Progress value (0-100)
   */
  reportProgress(
    options?: WorkflowOptions,
    phase?: string,
    progress?: number
  ): void {
    if (!options?.onProgress) return;
    
    try {
      if (typeof options.onProgress === 'function') {
        if (progress !== undefined) {
          // Determine callback type by parameter count
          if (options.onProgress.length === 1) {
            // Single argument progress callback
            (options.onProgress as ProgressCallback)(progress);
          } else if (options.onProgress.length === 2) {
            // Two argument progress callback
            (options.onProgress as PhaseProgressCallback)(phase || 'progress', progress);
          }
        }
      }
    } catch (error) {
      console.error('[WorkflowManager] Error reporting progress:', error);
    }
  }
  
  /**
   * Report status update
   * 
   * @param options Workflow options
   * @param status Processing status
   */
  reportStatusUpdate(
    options?: WorkflowOptions,
    status?: ProcessingStatus
  ): void {
    if (!options?.onStatusUpdate || !status) return;
    
    try {
      options.onStatusUpdate(status);
    } catch (error) {
      console.error('[WorkflowManager] Error reporting status update:', error);
    }
  }
  
  /**
   * Report success
   * 
   * @param options Workflow options
   * @param result Success result
   */
  reportSuccess<T>(
    options?: WorkflowOptions<T>,
    result?: T
  ): void {
    if (!options?.onSuccess || !result) return;
    
    try {
      options.onSuccess(result);
    } catch (error) {
      console.error('[WorkflowManager] Error reporting success:', error);
    }
  }
  
  /**
   * Report error
   * 
   * @param options Workflow options
   * @param error Error message or object
   */
  reportError(
    options?: WorkflowOptions,
    error?: unknown
  ): void {
    if (!options?.onError) return;
    
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      options.onError(errorMessage);
    } catch (error) {
      console.error('[WorkflowManager] Error reporting error:', error);
    }
  }
  
  /**
   * Handle operation with workflow state updates
   * 
   * @param workflowId Workflow ID
   * @param currentStep Current workflow step
   * @param operation Operation to perform
   * @param options Workflow options
   * @returns Operation result
   */
  async handleWorkflowOperation<T>(
    workflowId: string | null | undefined,
    currentStep: WorkflowStep,
    operation: () => Promise<T>,
    options?: WorkflowOptions<T>
  ): Promise<T> {
    try {
      // Update workflow state if ID provided
      if (workflowId) {
        await this.updateWorkflowState(workflowId, currentStep, { status: 'started' });
      }
      
      // Perform the operation
      const result = await operation();
      
      // Update workflow state on completion
      if (workflowId) {
        await this.updateWorkflowState(workflowId, currentStep, { 
          status: 'completed',
          completedAt: new Date().toISOString()
        });
      }
      
      // Report success
      this.reportSuccess(options, result);
      
      return result;
    } catch (error) {
      console.error(`[WorkflowManager] Error in ${currentStep} operation:`, error);
      
      // Update workflow state on error
      if (workflowId) {
        await this.updateWorkflowState(workflowId, currentStep, { 
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          errorAt: new Date().toISOString()
        });
      }
      
      // Report error
      this.reportError(options, error);
      
      throw error;
    }
  }
  
  /**
   * Create a workflow context object
   * Helper method for consistent workflow context creation
   */
  createWorkflowContext(
    workflowId: string | null | undefined,
    step: WorkflowStep,
    stepDescription?: string
  ): WorkflowContext {
    return {
      workflowId: workflowId || null,
      step,
      stepDescription
    };
  }
}

// Export singleton instance
export const workflowManager = new WorkflowManager(); 