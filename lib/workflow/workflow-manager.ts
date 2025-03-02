import type { ProcessingStatus } from '@/lib/processing/types/base'
import type { Database } from '@/lib/supabase'
/**
 * Database Workflow Service
 *
 * Simplified utilities for tracking workflow state in the database
 */
import { createBrowserClient } from '@/lib/supabase/clients'
import type { WorkflowStep } from '@/lib/workflow/types'

// Type alias for database workflow step enum
type DBWorkflowStep = Database['public']['Enums']['workflow_step']

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
    const supabase = createBrowserClient()
    
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
        `[WorkflowService] Step '${step}' cannot be stored in database. Recording in metadata only.`
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
    console.error('[WorkflowService] Error updating workflow state:', error)
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
 * Create a workflow in the database
 *
 * @param userId User ID who owns the workflow
 * @param initialStep Initial workflow step
 * @param metadata Initial metadata
 * @returns Created workflow ID
 */
export async function createWorkflow(
  userId: string,
  initialStep: WorkflowStep = 'idle',
  metadata: Record<string, any> = {}
): Promise<string | null> {
  try {
    const supabase = createBrowserClient()
    
    // Determine if the step is valid for the database
    const step = isDbWorkflowStep(initialStep)
      ? initialStep as DBWorkflowStep
      : 'idle' as DBWorkflowStep
      
    // Insert the workflow
    const { data, error } = await supabase
      .from('workflow_states')
      .insert({
        user_id: userId,
        current_step: step,
        metadata: {
          ...metadata,
          ...(initialStep !== step ? { appStep: initialStep } : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      })
      .select('id')
      .single()
      
    if (error) {
      console.error('[WorkflowService] Error creating workflow:', error)
      return null
    }
    
    return data?.id || null
  } catch (error) {
    console.error('[WorkflowService] Error creating workflow:', error)
    return null
  }
}

/**
 * Get current workflow state
 *
 * @param workflowId Workflow ID
 * @returns Workflow state or null if not found
 */
export async function getWorkflowState(
  workflowId: string
): Promise<{ step: WorkflowStep; metadata: Record<string, any> } | null> {
  try {
    const supabase = createBrowserClient()
    
    const { data, error } = await supabase
      .from('workflow_states')
      .select('current_step, metadata')
      .eq('id', workflowId)
      .single()
      
    if (error || !data) {
      console.error('[WorkflowService] Error fetching workflow:', error)
      return null
    }
    
    // Convert database step to app step if needed
    const step = data.metadata?.appStep || data.current_step
    
    return {
      step: step as WorkflowStep,
      metadata: data.metadata || {}
    }
  } catch (error) {
    console.error('[WorkflowService] Error fetching workflow:', error)
    return null
  }
}

// Export service methods
export const workflowService = {
  updateWorkflowState,
  createWorkflow,
  getWorkflowState
}