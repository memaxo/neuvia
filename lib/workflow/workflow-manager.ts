import type { ProcessingStatus } from '@/lib/processing/types/base'
import type { Database } from '@/lib/supabase'
import logger from '@/lib/logger'
import { ExternalServiceError, NotFoundError, normalizeError } from '@/lib/errors'

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
  if (!workflowId) return;

  const moduleLogger = logger.withMetadata({
    module: 'WorkflowService',
    method: 'updateWorkflowState',
    workflowId,
    step
  });

  try {
    moduleLogger.info('Updating workflow state');
    const supabase = createBrowserClient();
    
    // Check if the step is a valid database step
    const isDbStep = isDbWorkflowStep(step);

    if (isDbStep) {
      const { error } = await supabase
        .from('workflow_states')
        .update({
          current_step: step as DBWorkflowStep, // Cast to database enum type
          metadata: {
            ...metadata,
            updatedAt: new Date().toISOString(),
          },
        })
        .eq('id', workflowId);
        
      if (error) {
        throw new ExternalServiceError({
          message: `Failed to update workflow state: ${error.message}`,
          code: 'WORKFLOW_UPDATE_FAILED',
          service: 'Database',
          data: { workflowId, step },
          cause: error
        });
      }
    } else {
      moduleLogger.warn(
        `Step '${step}' cannot be stored in database. Recording in metadata only.`,
        { step }
      );
      
      // Use a default DB step (idle) and store the actual step in metadata
      const { error } = await supabase
        .from('workflow_states')
        .update({
          current_step: 'idle' as DBWorkflowStep, // Use a default
          metadata: {
            ...metadata,
            appStep: step, // Store the app-only step in metadata
            updatedAt: new Date().toISOString(),
          },
        })
        .eq('id', workflowId);
        
      if (error) {
        throw new ExternalServiceError({
          message: `Failed to update workflow state: ${error.message}`,
          code: 'WORKFLOW_UPDATE_FAILED',
          service: 'Database',
          data: { workflowId, step },
          cause: error
        });
      }
    }
    
    moduleLogger.info('Workflow state updated successfully');
  } catch (error) {
    const normalizedError = normalizeError(error);
    moduleLogger.error('Error updating workflow state', {}, normalizedError);
    throw normalizedError;
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
): Promise<string> {
  const moduleLogger = logger.withMetadata({
    module: 'WorkflowService',
    method: 'createWorkflow',
    userId,
    initialStep
  });

  try {
    moduleLogger.info('Creating new workflow');
    const supabase = createBrowserClient();
    
    // Determine if the step is valid for the database
    const step = isDbWorkflowStep(initialStep)
      ? initialStep as DBWorkflowStep
      : 'idle' as DBWorkflowStep;
      
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
      .single();
      
    if (error) {
      throw new ExternalServiceError({
        message: `Failed to create workflow: ${error.message}`,
        code: 'WORKFLOW_CREATE_FAILED',
        service: 'Database',
        data: { userId, initialStep },
        cause: error
      });
    }
    
    if (!data?.id) {
      throw new ExternalServiceError({
        message: 'Workflow created but no ID returned',
        code: 'WORKFLOW_ID_MISSING',
        service: 'Database',
        data: { userId, initialStep }
      });
    }
    
    moduleLogger.info('Workflow created successfully', { workflowId: data.id });
    return data.id;
    
  } catch (error) {
    const normalizedError = normalizeError(error);
    moduleLogger.error('Error creating workflow', {}, normalizedError);
    throw normalizedError;
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
): Promise<{ step: WorkflowStep; metadata: Record<string, any> }> {
  const moduleLogger = logger.withMetadata({
    module: 'WorkflowService',
    method: 'getWorkflowState',
    workflowId
  });

  try {
    moduleLogger.info('Fetching workflow state');
    const supabase = createBrowserClient();
    
    const { data, error } = await supabase
      .from('workflow_states')
      .select('current_step, metadata')
      .eq('id', workflowId)
      .single();
      
    if (error) {
      throw new ExternalServiceError({
        message: `Failed to fetch workflow: ${error.message}`,
        code: 'WORKFLOW_FETCH_FAILED',
        service: 'Database',
        data: { workflowId },
        cause: error
      });
    }
    
    if (!data) {
      throw new NotFoundError({
        message: 'Workflow not found',
        resource: 'Workflow',
        code: 'WORKFLOW_NOT_FOUND',
        data: { workflowId }
      });
    }
    
    // Convert database step to app step if needed
    const step = data.metadata?.appStep || data.current_step;
    
    moduleLogger.info('Workflow state retrieved successfully', { 
      currentStep: step,
      hasMetadata: !!data.metadata
    });
    
    return {
      step: step as WorkflowStep,
      metadata: data.metadata || {}
    };
  } catch (error) {
    const normalizedError = normalizeError(error);
    moduleLogger.error('Error fetching workflow state', {}, normalizedError);
    throw normalizedError;
  }
}

// Export service methods
export const workflowService = {
  updateWorkflowState,
  createWorkflow,
  getWorkflowState
}