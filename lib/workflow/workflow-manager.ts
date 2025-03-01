import type { ProcessingStatus } from '@/lib/processing/types/base'
import type { Database } from '@/lib/supabase'
/**
 * Workflow State Management Utility
 *
 * Centralized functions for managing workflow state updates across services
 */
import { createBrowserClient } from '@/lib/supabase/clients'
import type { WorkflowStep } from '@/lib/workflow/types'

// Type alias for database workflow step enum
type DBWorkflowStep = Database['public']['Enums']['workflow_step']

/**
 * Workflow context for operations
 */
export interface WorkflowContext {
  /**
   * Workflow ID for database tracking
   */
  workflowId?: string | null

  /**
   * Current workflow step
   */
  step: WorkflowStep

  /**
   * Custom step description for UI display
   */
  stepDescription?: string
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: number) => void

/**
 * Phase progress callback type
 */
export type PhaseProgressCallback = (phase: string, progress: number) => void

/**
 * Status update callback type
 */
export type StatusUpdateCallback = (status: ProcessingStatus) => void

/**
 * Success callback type
 */
export type SuccessCallback<T> = (result: T) => void

/**
 * Error callback type
 */
export type ErrorCallback = (error: string) => void

/**
 * Common options interface for workflow operations
 */
export interface WorkflowOptions<T = any> {
  /**
   * User ID performing the operation
   */
  userId?: string

  /**
   * Progress callback
   */
  onProgress?: ProgressCallback | PhaseProgressCallback

  /**
   * Status update callback
   */
  onStatusUpdate?: StatusUpdateCallback

  /**
   * Success callback
   */
  onSuccess?: SuccessCallback<T>

  /**
   * Error callback
   */
  onError?: ErrorCallback
}

/**
 * Directly exposed utilities for workflow integration
 * These functions are designed to be used by the chat context
 */
// Supabase client for database operations
const supabase = createBrowserClient()

/**
 * Update workflow state in the database
 *
 * @param workflowId Workflow ID
 * @param step Current workflow step
 * @param metadata Additional metadata
 * @returns Updated workflow state
 */
export async function updateWorkflowState(
  workflowId: string,
  step: WorkflowStep,
  metadata: Record<string, any> = {}
): Promise<void> {
  if (!workflowId) return

  try {
    // Check if the step is a valid database step
    const isDbStep = isDbWorkflowStep(step)

    if (isDbStep) {
      await supabase
        .from('workflow_states')
        .update({
          current_step: step as DBWorkflowStep, // Cast to database enum type
          metadata: {
            ...metadata,
            updatedAt: new Date().toISOString(),
          },
        })
        .eq('id', workflowId)
    } else {
      console.warn(
        `[WorkflowManager] Step '${step}' cannot be stored in database. Recording in metadata only.`
      )
      // Use a default DB step (idle) and store the actual step in metadata
      await supabase
        .from('workflow_states')
        .update({
          current_step: 'idle' as DBWorkflowStep, // Use a default
          metadata: {
            ...metadata,
            appStep: step, // Store the app-only step in metadata
            updatedAt: new Date().toISOString(),
          },
        })
        .eq('id', workflowId)
    }
  } catch (error) {
    console.error('[WorkflowManager] Error updating workflow state:', error)
  }
}

/**
 * Helper method to determine if a step is directly storable in the database
 */
function isDbWorkflowStep(step: WorkflowStep): step is DBWorkflowStep {
  const dbSteps: DBWorkflowStep[] = [
    'idle',
    'uploading',
    'extracting',
    'verification',
    'report_generation',
    'complete',
    'chat_started',
    'chat_in_progress',
    'chat_completed',
    'chat_error',
  ]
  return dbSteps.includes(step as DBWorkflowStep)
}

/**
 * Report progress
 *
 * @param options Workflow options
 * @param phase Current phase
 * @param progress Progress value (0-100)
 */
export function reportProgress(
  options?: WorkflowOptions,
  phase?: string,
  progress?: number
): void {
  if (!options?.onProgress) return

  try {
    if (typeof options.onProgress === 'function') {
      if (progress !== undefined) {
        // Determine callback type by parameter count
        if (options.onProgress.length === 1) {
          // Single argument progress callback
          ;(options.onProgress as ProgressCallback)(progress)
        } else if (options.onProgress.length === 2) {
          // Two argument progress callback
          ;(options.onProgress as PhaseProgressCallback)(
            phase || 'progress',
            progress
          )
        }
      }
    }
  } catch (error) {
    console.error('[WorkflowManager] Error reporting progress:', error)
  }
}

/**
 * Report status update
 *
 * @param options Workflow options
 * @param status Processing status
 */
export function reportStatusUpdate(
  options?: WorkflowOptions,
  status?: ProcessingStatus
): void {
  if (!options?.onStatusUpdate || !status) return

  try {
    options.onStatusUpdate(status)
  } catch (error) {
    console.error('[WorkflowManager] Error reporting status update:', error)
  }
}

/**
 * Report success
 *
 * @param options Workflow options
 * @param result Success result
 */
export function reportSuccess<T>(
  options?: WorkflowOptions<T>,
  result?: T
): void {
  if (!options?.onSuccess || !result) return

  try {
    options.onSuccess(result)
  } catch (error) {
    console.error('[WorkflowManager] Error reporting success:', error)
  }
}

/**
 * Report error
 *
 * @param options Workflow options
 * @param error Error message or object
 */
export function reportError(options?: WorkflowOptions, error?: unknown): void {
  if (!options?.onError) return

  try {
    const errorMessage = error instanceof Error ? error.message : String(error)
    options.onError(errorMessage)
  } catch (error) {
    console.error('[WorkflowManager] Error reporting error:', error)
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
export async function handleWorkflowOperation<T>(
  workflowId: string | null | undefined,
  currentStep: WorkflowStep,
  operation: () => Promise<T>,
  options?: WorkflowOptions<T>
): Promise<T> {
  try {
    // Update workflow state if ID provided
    if (workflowId) {
      await updateWorkflowState(workflowId, currentStep, { status: 'started' })
    }

    // Perform the operation
    const result = await operation()

    // Update workflow state on completion
    if (workflowId) {
      await updateWorkflowState(workflowId, currentStep, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
    }

    // Report success
    reportSuccess(options, result)

    return result
  } catch (error) {
    console.error(`[WorkflowManager] Error in ${currentStep} operation:`, error)

    // Update workflow state on error
    if (workflowId) {
      await updateWorkflowState(workflowId, currentStep, {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        errorAt: new Date().toISOString(),
      })
    }

    // Report error
    reportError(options, error)

    throw error
  }
}

/**
 * Create a workflow context object
 * Helper method for consistent workflow context creation
 */
export function createWorkflowContext(
  workflowId: string | null | undefined,
  step: WorkflowStep,
  stepDescription?: string
): WorkflowContext {
  return {
    workflowId: workflowId || null,
    step,
    stepDescription,
  }
}

/**
 * Workflow State Manager
 * @deprecated Use the direct exported functions instead
 */
class WorkflowManager {
  private supabase = createBrowserClient()

  /**
   * Update workflow state
   * @deprecated Use the exported updateWorkflowState function instead
   */
  async updateWorkflowState(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    return updateWorkflowState(workflowId, step, metadata)
  }

  /**
   * Helper method to determine if a step is directly storable in the database
   * @deprecated Use the exported isDbWorkflowStep function instead
   */
  private isDbWorkflowStep(step: WorkflowStep): step is DBWorkflowStep {
    return isDbWorkflowStep(step)
  }

  /**
   * Report progress
   * @deprecated Use the exported reportProgress function instead
   */
  reportProgress(
    options?: WorkflowOptions,
    phase?: string,
    progress?: number
  ): void {
    return reportProgress(options, phase, progress)
  }

  /**
   * Report status update
   * @deprecated Use the exported reportStatusUpdate function instead
   */
  reportStatusUpdate(
    options?: WorkflowOptions,
    status?: ProcessingStatus
  ): void {
    return reportStatusUpdate(options, status)
  }

  /**
   * Report success
   * @deprecated Use the exported reportSuccess function instead
   */
  reportSuccess<T>(options?: WorkflowOptions<T>, result?: T): void {
    return reportSuccess(options, result)
  }

  /**
   * Report error
   * @deprecated Use the exported reportError function instead
   */
  reportError(options?: WorkflowOptions, error?: unknown): void {
    return reportError(options, error)
  }

  /**
   * Handle operation with workflow state updates
   * @deprecated Use the exported handleWorkflowOperation function instead
   */
  async handleWorkflowOperation<T>(
    workflowId: string | null | undefined,
    currentStep: WorkflowStep,
    operation: () => Promise<T>,
    options?: WorkflowOptions<T>
  ): Promise<T> {
    return handleWorkflowOperation(workflowId, currentStep, operation, options)
  }

  /**
   * Create a workflow context object
   * @deprecated Use the exported createWorkflowContext function instead
   */
  createWorkflowContext(
    workflowId: string | null | undefined,
    step: WorkflowStep,
    stepDescription?: string
  ): WorkflowContext {
    return createWorkflowContext(workflowId, step, stepDescription)
  }
}

// Export singleton instance for backward compatibility
export const workflowManager = new WorkflowManager()
