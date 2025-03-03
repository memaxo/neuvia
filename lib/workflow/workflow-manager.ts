import type { ProcessingStatus } from '@/lib/processing/types/base'
import type { Database } from '@/lib/supabase'
import logger from '@/lib/logger'
import {
  ExternalServiceError,
  NotFoundError,
  ValidationError,
  SystemError,
  ApplicationError,
  normalizeError,
} from '@/lib/errors'

/**
 * Workflow State Machine Manager
 *
 * Provides centralized management of workflow state transitions,
 * validation, and persistence to the database.
 */
import { createBrowserClient } from '@/lib/supabase/clients'
import {
  ALLOWED_TRANSITIONS,
  type WorkflowStep,
  type WorkflowTransition,
  type ProcessingPhase,
} from './types'
import { apiClient } from '@/lib/api/client/api-client'

// Type alias for database workflow step enum
type DBWorkflowStep = Database['public']['Enums']['workflow_step']

/**
 * Update workflow state in the database
 *
 * @param workflowId Workflow ID
 * @param step Current workflow step
 * @param metadata Additional metadata
 * @param options Additional options for the update
 * @returns Updated workflow state
 * @throws {ValidationError} If required parameters are missing
 * @throws {NotFoundError} If the workflow does not exist
 * @throws {ExternalServiceError} If database operations fail
 * @throws {WorkflowStateError} If the transition is invalid
 */
export async function updateWorkflowState(
  workflowId: string,
  step: WorkflowStep,
  metadata: Record<string, any> = {},
  options: { skipValidation?: boolean; force?: boolean } = {}
): Promise<void> {
  // Create supabase client at the beginning
  const supabase = createBrowserClient()

  const moduleLogger = logger.withMetadata({
    module: 'WorkflowService',
    method: 'updateWorkflowState',
    workflowId,
    step,
  })

  try {
    // Input validation - fail fast for missing workflowId
    if (!workflowId) {
      throw new ValidationError({
        message: 'Workflow ID is required to update state',
        code: 'MISSING_WORKFLOW_ID',
        data: { providedStep: step },
      })
    }

    // UUID format validation (basic check)
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(workflowId)) {
      moduleLogger.error('Invalid workflow ID format', {
        providedId: workflowId,
      })
      throw new ValidationError({
        message: 'Invalid workflow ID format',
        code: 'INVALID_WORKFLOW_ID_FORMAT',
        data: { providedId: workflowId },
      })
    }

    // Step validation
    if (!step) {
      moduleLogger.error('Missing workflow step')
      throw new ValidationError({
        message: 'Workflow step is required',
        code: 'MISSING_WORKFLOW_STEP',
        data: { workflowId },
      })
    }

    moduleLogger.info('Updating workflow state', {
      step,
      hasMetadata: Object.keys(metadata).length > 0,
      options,
    })

    // Fetch current workflow state for validation (unless skipped)
    if (!options.skipValidation) {
      try {
        const { data: currentWorkflow, error: fetchError } = await supabase
          .from('workflow_states')
          .select('current_step, metadata')
          .eq('id', workflowId)
          .single()

        if (fetchError) {
          moduleLogger.error(
            'Error fetching current workflow state for validation',
            {
              error: fetchError.message,
            }
          )

          if (!options.force) {
            throw new ExternalServiceError({
              message: `Cannot validate workflow transition: ${fetchError.message}`,
              code: 'WORKFLOW_VALIDATION_FAILED',
              service: 'Database',
              data: { workflowId },
              cause: fetchError,
            })
          }

          moduleLogger.warn('Skipping validation due to force option', {
            fromStep: 'unknown',
            toStep: step,
          })
        } else if (currentWorkflow) {
          // Get the actual application step, which might be stored in metadata
          const currentStep = ((currentWorkflow.metadata as Record<string, any>)
            ?.appStep || currentWorkflow.current_step) as WorkflowStep

          // Validate the transition
          const validationResult = validateWorkflowTransition(
            currentStep,
            step,
            metadata
          )

          if (!validationResult.isValid && !options.force) {
            moduleLogger.error('Invalid workflow transition', {
              fromStep: currentStep,
              toStep: step,
              errorDetails: validationResult.details,
            })

            // Convert to WorkflowStateError from our error lib
            throw new WorkflowStateError(
              validationResult.error || 'Invalid workflow transition',
              { from: currentStep, to: step },
              { workflowId, details: validationResult.details, metadata }
            )
          } else if (!validationResult.isValid) {
            moduleLogger.warn('Forcing invalid workflow transition', {
              fromStep: currentStep,
              toStep: step,
              reason: validationResult.error,
            })

            // Add warning to metadata for audit purposes
            metadata._validationWarning = {
              message: validationResult.error,
              fromStep: currentStep,
              toStep: step,
              forcedAt: new Date().toISOString(),
              details: validationResult.details,
            }
          }
        }
      } catch (validationError) {
        if (validationError instanceof WorkflowStateError) {
          throw validationError
        } else if (!options.force) {
          moduleLogger.error(
            'Error during workflow validation',
            {},
            validationError
          )
          throw validationError
        } else {
          moduleLogger.warn(
            'Validation error occurred but force option enabled',
            {},
            validationError
          )
        }
      }
    } else {
      moduleLogger.warn('Skipping workflow transition validation', {
        toStep: step,
        skipValidation: true,
      })
    }

    // Proceed with updating workflow state below
    const timestamp = new Date().toISOString()
    const updateMetadata = {
      ...metadata,
      updatedAt: timestamp,
    }

    // Check if the step is a valid database step
    const isDbStep = isDbWorkflowStep(step)

    // First check if the workflow exists to provide better error messages
    const { data: existingWorkflow, error: checkError } = await supabase
      .from('workflow_states')
      .select('id')
      .eq('id', workflowId)
      .maybeSingle()

    if (checkError) {
      moduleLogger.error('Error checking workflow existence', {
        error: checkError.message,
      })

      throw new ExternalServiceError({
        message: `Failed to check workflow existence: ${checkError.message}`,
        code: 'WORKFLOW_CHECK_FAILED',
        service: 'Database',
        data: { workflowId },
        cause: checkError,
      })
    }

    if (!existingWorkflow) {
      moduleLogger.warn('Attempted to update non-existent workflow', {
        workflowId,
      })
      throw new NotFoundError({
        message: 'Workflow not found',
        resource: 'Workflow',
        code: 'WORKFLOW_NOT_FOUND',
        data: { workflowId },
      })
    }

    if (isDbStep) {
      moduleLogger.debug('Using database-compatible step', { step })
      const { error } = await supabase
        .from('workflow_states')
        .update({
          current_step: step as DBWorkflowStep, // Cast to database enum type
          metadata: updateMetadata,
          updated_at: timestamp, // Also update the database timestamp field
        })
        .eq('id', workflowId)

      if (error) {
        moduleLogger.error('Database error updating workflow', {
          error: error.message,
          code: error.code,
        })

        throw new ExternalServiceError({
          message: `Failed to update workflow state: ${error.message}`,
          code: 'WORKFLOW_UPDATE_FAILED',
          service: 'Database',
          data: { workflowId, step },
          cause: error,
        })
      }
    } else {
      moduleLogger.warn(
        `Step '${step}' cannot be stored directly in database. Using metadata.`,
        { appStep: step }
      )

      // Use a default DB step (idle) and store the actual step in metadata
      const { error } = await supabase
        .from('workflow_states')
        .update({
          current_step: 'idle' as DBWorkflowStep, // Use a default
          metadata: {
            ...updateMetadata,
            appStep: step, // Store the app-only step in metadata
          },
          updated_at: timestamp, // Also update the database timestamp field
        })
        .eq('id', workflowId)

      if (error) {
        moduleLogger.error(
          'Database error updating workflow state with app step',
          {
            error: error.message,
            code: error.code,
          }
        )

        throw new ExternalServiceError({
          message: `Failed to update workflow state: ${error.message}`,
          code: 'WORKFLOW_UPDATE_FAILED',
          service: 'Database',
          data: { workflowId, step },
          cause: error,
        })
      }
    }

    moduleLogger.info('Workflow state updated successfully', {
      updatedAt: timestamp,
    })
  } catch (error) {
    // If it's already an ApplicationError, don't wrap it again
    if (error instanceof ApplicationError) {
      moduleLogger.error(
        'Error updating workflow state',
        {
          errorType: error.name,
          errorCode: error.code,
        },
        error
      )
      throw error
    }

    // Otherwise normalize to a SystemError
    const normalizedError = normalizeError(error)
    moduleLogger.error(
      'Unexpected error updating workflow state',
      {},
      normalizedError
    )
    throw normalizedError
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
 * @throws {ValidationError} If required parameters are missing
 * @throws {ExternalServiceError} If database operations fail
 */
export async function createWorkflow(
  userId: string,
  initialStep: WorkflowStep = 'idle',
  metadata: Record<string, any> = {},
  options: { skipValidation?: boolean; force?: boolean } = {}
): Promise<string> {
  const moduleLogger = logger.withMetadata({
    module: 'WorkflowService',
    method: 'createWorkflow',
    userId,
    initialStep,
  })

  try {
    // Validate input parameters
    if (!userId) {
      moduleLogger.error('Missing user ID for workflow creation')
      throw new ValidationError({
        message: 'User ID is required to create a workflow',
        code: 'MISSING_USER_ID',
        data: { providedStep: initialStep },
      })
    }

    // Validate that the initial step is allowed to be an initial step
    if (!options.skipValidation) {
      // These are the only valid starting states
      const validInitialSteps: WorkflowStep[] = [
        'idle',
        'uploading',
        'chat_started',
        'research',
      ]

      if (!validInitialSteps.includes(initialStep) && !options.force) {
        moduleLogger.error('Invalid initial workflow step', {
          providedStep: initialStep,
        })
        throw new WorkflowStateError(
          `Step '${initialStep}' is not a valid initial workflow step`,
          { from: 'idle', to: initialStep },
          {
            allowedInitialSteps: validInitialSteps,
            userId,
          }
        )
      } else if (!validInitialSteps.includes(initialStep)) {
        moduleLogger.warn('Forcing invalid initial workflow step', {
          providedStep: initialStep,
          validSteps: validInitialSteps,
        })

        // Add warning to metadata for audit purposes
        metadata._validationWarning = {
          message: `Forced invalid initial step '${initialStep}'`,
          forcedAt: new Date().toISOString(),
          validInitialSteps,
        }
      }
    }

    moduleLogger.info('Creating new workflow', {
      hasMetadata: Object.keys(metadata).length > 0,
      options,
    })

    const supabase = createBrowserClient()

    // Determine if the step is valid for the database
    const step = isDbWorkflowStep(initialStep)
      ? (initialStep as DBWorkflowStep)
      : ('idle' as DBWorkflowStep)

    if (initialStep !== step) {
      moduleLogger.debug('Non-database step provided, using compatible step', {
        requestedStep: initialStep,
        compatibleStep: step,
      })
    }

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
        },
      })
      .select('id')
      .single()

    if (error) {
      moduleLogger.error('Database error creating workflow', {
        error: error.message,
        code: error.code,
      })

      // Handle specific database errors with appropriate error types
      if (error.code === '23505') {
        // Unique violation
        throw new ValidationError({
          message: 'A workflow already exists with this identifier',
          code: 'WORKFLOW_DUPLICATE',
          data: { userId, initialStep },
          cause: error,
        })
      } else if (error.code === '23503') {
        // Foreign key violation
        throw new ValidationError({
          message: 'Referenced user does not exist',
          code: 'USER_NOT_FOUND',
          data: { userId },
          cause: error,
        })
      } else {
        throw new ExternalServiceError({
          message: `Failed to create workflow: ${error.message}`,
          code: 'WORKFLOW_CREATE_FAILED',
          service: 'Database',
          data: { userId, initialStep },
          cause: error,
        })
      }
    }

    if (!data?.id) {
      moduleLogger.error('No workflow ID returned from successful insert')
      throw new ExternalServiceError({
        message: 'Workflow created but no ID returned',
        code: 'WORKFLOW_ID_MISSING',
        service: 'Database',
        data: { userId, initialStep },
      })
    }

    moduleLogger.info('Workflow created successfully', { workflowId: data.id })
    return data.id
  } catch (error) {
    // If it's already an ApplicationError, don't wrap it again
    if (error instanceof ApplicationError) {
      moduleLogger.error(
        'Error creating workflow',
        {
          errorType: error.name,
          errorCode: error.code,
        },
        error
      )
      throw error
    }

    // Otherwise normalize to a SystemError
    const normalizedError = normalizeError(error)
    moduleLogger.error(
      'Unexpected error creating workflow',
      {},
      normalizedError
    )
    throw normalizedError
  }
}

/**
 * Get current workflow state
 *
 * @param workflowId Workflow ID
 * @returns Workflow state with metadata
 * @throws {ValidationError} If the workflow ID is invalid
 * @throws {NotFoundError} If the workflow does not exist
 * @throws {ExternalServiceError} If database operations fail
 */
export async function getWorkflowState(
  workflowId: string
): Promise<{ step: WorkflowStep; metadata: Record<string, any> }> {
  const moduleLogger = logger.withMetadata({
    module: 'WorkflowService',
    method: 'getWorkflowState',
    workflowId,
  })

  try {
    // Validate input parameters
    if (!workflowId) {
      moduleLogger.error('Missing workflow ID')
      throw new ValidationError({
        message: 'Workflow ID is required',
        code: 'MISSING_WORKFLOW_ID',
      })
    }

    // UUID format validation (basic check)
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(workflowId)) {
      moduleLogger.error('Invalid workflow ID format', {
        providedId: workflowId,
      })
      throw new ValidationError({
        message: 'Invalid workflow ID format',
        code: 'INVALID_WORKFLOW_ID_FORMAT',
        data: { providedId: workflowId },
      })
    }

    moduleLogger.info('Fetching workflow state')
    const supabase = createBrowserClient()

    // Use a try/catch to handle potential Supabase client initialization errors
    try {
      const { data, error } = await supabase
        .from('workflow_states')
        .select('current_step, metadata')
        .eq('id', workflowId)
        .single()

      if (error) {
        // Distinguish between not found and other database errors
        if (error.code === 'PGRST116') {
          // PostgreSQL Resource Not Found error
          moduleLogger.warn('Workflow not found', { workflowId })
          throw new NotFoundError({
            message: 'Workflow not found',
            resource: 'Workflow',
            code: 'WORKFLOW_NOT_FOUND',
            data: { workflowId },
            cause: error,
          })
        } else {
          moduleLogger.error('Database error fetching workflow', {
            errorCode: error.code,
            errorMessage: error.message,
          })
          throw new ExternalServiceError({
            message: `Failed to fetch workflow: ${error.message}`,
            code: 'WORKFLOW_FETCH_FAILED',
            service: 'Database',
            data: { workflowId },
            cause: error,
          })
        }
      }

      if (!data) {
        moduleLogger.warn('Workflow not found (no error but no data)', {
          workflowId,
        })
        throw new NotFoundError({
          message: 'Workflow not found',
          resource: 'Workflow',
          code: 'WORKFLOW_NOT_FOUND',
          data: { workflowId },
        })
      }

      // Convert database step to app step if needed
      const step = ((data.metadata as Record<string, any>)?.appStep ||
        data.current_step) as WorkflowStep

      moduleLogger.info('Workflow state retrieved successfully', {
        currentStep: step,
        hasMetadata: !!data.metadata,
      })

      return {
        step,
        metadata:
          typeof data.metadata === 'object' && data.metadata !== null
            ? (data.metadata as Record<string, any>)
            : {},
      }
    } catch (supabaseError) {
      // If it's already an ApplicationError, just rethrow it
      if (supabaseError instanceof ApplicationError) {
        throw supabaseError
      }

      // Otherwise wrap it in an ExternalServiceError
      moduleLogger.error(
        'Error in Supabase client operation',
        {},
        supabaseError
      )
      throw new ExternalServiceError({
        message: 'Database client error',
        code: 'DB_CLIENT_ERROR',
        service: 'Database',
        data: { workflowId },
        cause: supabaseError,
      })
    }
  } catch (error) {
    // If it's already an ApplicationError, don't wrap it again
    if (error instanceof ApplicationError) {
      moduleLogger.error(
        'Error fetching workflow state',
        {
          errorType: error.name,
          errorCode: error.code,
        },
        error
      )
      throw error
    }

    // Otherwise normalize to a SystemError
    const normalizedError = normalizeError(error)
    moduleLogger.error(
      'Unexpected error fetching workflow state',
      {},
      normalizedError
    )
    throw normalizedError
  }
}

// Export service methods
export const workflowService = {
  updateWorkflowState,
  createWorkflow,
  getWorkflowState,
}

/**
 * WorkflowStateError class for specific workflow transition errors
 */
export class WorkflowStateError extends Error {
  public transition: { from: WorkflowStep; to: WorkflowStep }
  public metadata?: Record<string, any>
  public readonly code: string

  constructor(
    message: string,
    transition: { from: WorkflowStep; to: WorkflowStep },
    metadata?: Record<string, any>
  ) {
    super(message)
    this.name = 'WorkflowStateError'
    this.transition = transition
    this.metadata = metadata
    this.code = 'INVALID_WORKFLOW_TRANSITION'
  }
}

/**
 * Options for workflow transitions
 */
export interface WorkflowTransitionOptions {
  /**
   * Skip validation for this transition (use with caution)
   */
  skipValidation?: boolean

  /**
   * Skip database update for this transition
   */
  skipPersistence?: boolean

  /**
   * Force transition even if metadata requirements aren't met
   */
  force?: boolean

  /**
   * Custom transition ID for logging or tracking
   */
  transitionId?: string
}

/**
 * Result of state transition validation
 */
export interface ValidationResult {
  isValid: boolean
  error?: string
  transition?: WorkflowTransition
  details?: Record<string, any>
}

/**
 * Validate if a transition is allowed according to the state machine rules
 *
 * @param fromStep Current step
 * @param toStep Target step
 * @param metadata Optional metadata for the transition
 * @returns Validation result
 */
export function validateWorkflowTransition(
  fromStep: WorkflowStep,
  toStep: WorkflowStep,
  metadata?: Record<string, any>
): ValidationResult {
  const moduleLogger = logger.withMetadata({
    module: 'WorkflowManager',
    method: 'validateWorkflowTransition',
    fromStep,
    toStep,
  })

  moduleLogger.debug('Validating workflow transition')

  // Special case: always allow transition to the same state with metadata updates
  if (fromStep === toStep) {
    return {
      isValid: true,
      details: { sameState: true },
    }
  }

  // Find the transition in allowed transitions
  const transition = ALLOWED_TRANSITIONS.find(
    (t) => t.from === fromStep && t.to === toStep
  )

  // If transition not found, it's invalid
  if (!transition) {
    moduleLogger.warn('Invalid transition - not found in allowed transitions')
    return {
      isValid: false,
      error: `Invalid transition from '${fromStep}' to '${toStep}'`,
      details: { reason: 'transition_not_allowed' },
    }
  }

  // Check if metadata is required but not provided
  if (transition.requireData && !metadata) {
    moduleLogger.warn(
      'Invalid transition - requires metadata but none provided'
    )
    return {
      isValid: false,
      error: `Transition from '${fromStep}' to '${toStep}' requires metadata`,
      transition,
      details: { reason: 'metadata_required' },
    }
  }

  // Check if metadata is provided but not allowed
  if (metadata && !transition.allowData) {
    moduleLogger.warn('Invalid transition - metadata provided but not allowed')
    return {
      isValid: false,
      error: `Transition from '${fromStep}' to '${toStep}' does not allow metadata`,
      transition,
      details: { reason: 'metadata_not_allowed' },
    }
  }

  // Specific validation for error transitions
  if (toStep === 'error' && transition.requireData) {
    // Error transitions require error metadata
    if (!metadata?.error) {
      moduleLogger.warn('Invalid error transition - missing error information')
      return {
        isValid: false,
        error: 'Error transitions require error information in metadata',
        transition,
        details: { reason: 'missing_error_info' },
      }
    }
  }

  // Valid transition
  moduleLogger.debug('Transition validation successful')
  return {
    isValid: true,
    transition,
    details: {
      description: transition.description,
      requiresData: transition.requireData,
      allowsData: transition.allowData,
    },
  }
}
