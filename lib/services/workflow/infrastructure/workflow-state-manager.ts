/**
 * @fileoverview Workflow State Manager
 * 
 * Manages workflow state transitions with transaction support and concurrency control.
 * Provides a centralized mechanism for state changes that ensures consistency
 * and proper validation.
 */

import { workflowRepository } from './workflow-repository'
import { workflowEventSourcing } from './workflow-event-source'
import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { ALLOWED_TRANSITIONS, DomainOnlyWorkflowStep } from '@/lib/types/workflow'

import type { 
  WorkflowStep, 
  WorkflowTransition,
  ProcessingPhase,
  WorkflowState
} from '@/lib/types/workflow'

/**
 * Options for state transitions
 */
export interface TransitionOptions {
  /** Skip validation of transitions */
  skipValidation?: boolean;
  
  /** Force update even if validation fails */
  forceUpdate?: boolean;
  
  /** Strategy for handling conflicts */
  conflictStrategy?: 'fail' | 'force' | 'merge';
  
  /** Expected timestamp for optimistic concurrency control */
  expectedTimestamp?: string;
  
  /** Whether to log the transition event */
  logEvent?: boolean;
  
  /** Transaction ID for tracking operations */
  transactionId?: string;
}

/**
 * Options for progress updates
 */
export interface ProgressOptions {
  /** Current workflow step */
  currentStep?: WorkflowStep;
  
  /** Whether to notify users about progress */
  notifyUsers?: boolean;
  
  /** Transaction ID for tracking operations */
  transactionId?: string;
}

/**
 * Manages workflow state transitions and concurrency
 */
export class WorkflowStateManager {
  private readonly logger = logger.withMetadata({ module: 'WorkflowStateManager' });
  
  /**
   * Transition workflow from one step to another
   */
  async transitionState(
    workflowId: string,
    fromStep: WorkflowStep,
    toStep: WorkflowStep,
    metadata: Record<string, unknown> = {},
    options: TransitionOptions = {}
  ): Promise<WorkflowState> {
    try {
      const {
        skipValidation = false,
        forceUpdate = false,
        conflictStrategy = 'pessimistic',
        expectedTimestamp,
        logEvent = true,
        transactionId = crypto.randomUUID()
      } = options;
      
      // Validate transition if not skipped
      if (!skipValidation && !forceUpdate) {
        const validationResult = this.validateTransition(fromStep, toStep, metadata);
        
        if (!validationResult.isValid) {
          throw new ApplicationError({
            message: validationResult.error || 'Invalid state transition',
            code: 'INVALID_TRANSITION',
            data: {
              fromStep,
              toStep,
              details: validationResult.details,
              transition: validationResult.transition
            }
          });
        }
      }
      
      // Prepare transition metadata
      const transitionMetadata = {
        ...metadata,
        transitionTimestamp: new Date().toISOString(),
        transactionId,
        fromStep,
        toStep
      };
      
      // Log transition event if requested
      if (logEvent) {
        await workflowEventSourcing.appendEvent(
          workflowId,
          'step_changed',
          {
            fromStep,
            toStep,
            reason: metadata.reason,
            timestamp: transitionMetadata.transitionTimestamp,
            transactionId
          }
        );
      }
      
      // Update state with concurrency control
      return await workflowRepository.updateWorkflowState(
        workflowId,
        toStep,
        transitionMetadata,
        {
          expectedTimestamp,
          conflictStrategy: conflictStrategy as any,
          skipValidation,
          forceUpdate
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('State transition failed', {
        workflowId,
        fromStep,
        toStep,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `State transition failed: ${normalizedError.message}`,
        code: normalizedError.code || 'TRANSITION_FAILED',
        data: {
          workflowId,
          fromStep,
          toStep,
          originalError: normalizedError
        }
      });
    }
  }
  
  /**
   * Update workflow progress
   */
  async updateProgress(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase,
    options: ProgressOptions = {}
  ): Promise<WorkflowState> {
    try {
      const {
        currentStep,
        notifyUsers = true,
        transactionId = crypto.randomUUID()
      } = options;
      
      // Update progress through repository
      const success = await workflowRepository.updateProgress(
        workflowId,
        progress,
        phase,
        currentStep,
        notifyUsers
      );
      
      if (!success) {
        throw new Error('Failed to update progress');
      }
      
      // Log progress event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'progress_updated',
        {
          progress,
          phase: phase.toString(),
          step: currentStep,
          timestamp: new Date().toISOString(),
          transactionId
        }
      );
      
      // Return updated state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        throw new Error('Failed to retrieve updated workflow state');
      }
      
      return state;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Progress update failed', {
        workflowId,
        progress,
        phase,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Progress update failed: ${normalizedError.message}`,
        code: 'PROGRESS_UPDATE_FAILED',
        data: {
          workflowId,
          progress,
          phase: phase.toString(),
          originalError: normalizedError
        }
      });
    }
  }
  
  /**
   * Handle workflow error with proper state transition
   */
  async handleError(
    workflowId: string,
    error: unknown,
    currentStep: WorkflowStep,
    errorDetails: Record<string, unknown> = {}
  ): Promise<WorkflowState> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorTimestamp = new Date().toISOString();
      const transactionId = crypto.randomUUID();
      
      // Log error event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'error_occurred',
        {
          error: errorMessage,
          step: currentStep,
          details: errorDetails,
          timestamp: errorTimestamp,
          transactionId
        }
      );
      
      // Try to recover to error state
      const recovered = await workflowRepository.recoverState(
        workflowId,
        DomainOnlyWorkflowStep.ERROR,
        {
          error: errorMessage,
          errorDetails,
          errorTimestamp,
          previousStep: currentStep,
          transactionId
        }
      );
      
      if (!recovered) {
        // Fall back to direct update if recovery failed
        await workflowRepository.updateWorkflowState(
          workflowId,
          DomainOnlyWorkflowStep.ERROR,
          {
            error: errorMessage,
            errorDetails,
            errorTimestamp,
            previousStep: currentStep,
            transactionId
          },
          { forceUpdate: true }
        );
      }
      
      // Return updated state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        throw new Error('Failed to retrieve error state');
      }
      
      return state;
    } catch (err) {
      // Don't throw from error handler to avoid cascading errors
      const normalizedError = normalizeError(err);
      this.logger.error('Error handling failed', {
        workflowId,
        originalError: error instanceof Error ? error.message : String(error),
        handlerError: normalizedError.message
      });
      
      // Return minimal state with error
      return {
        currentStep: DomainOnlyWorkflowStep.ERROR,
        progress: 0,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          errorDetails,
          errorTimestamp: new Date().toISOString(),
          previousStep: currentStep
        },
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Complete workflow successfully
   */
  async completeWorkflow(
    workflowId: string,
    completionMetadata: Record<string, unknown> = {}
  ): Promise<WorkflowState> {
    try {
      const completionTimestamp = new Date().toISOString();
      const transactionId = crypto.randomUUID();
      
      // Log completion event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'workflow_completed',
        {
          timestamp: completionTimestamp,
          transactionId,
          ...completionMetadata
        }
      );
      
      // Update state to complete
      return await workflowRepository.updateWorkflowState(
        workflowId,
        'complete',
        {
          completedAt: completionTimestamp,
          transactionId,
          ...completionMetadata
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to complete workflow', {
        workflowId,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to complete workflow: ${normalizedError.message}`,
        code: 'WORKFLOW_COMPLETION_FAILED',
        data: {
          workflowId,
          originalError: normalizedError
        }
      });
    }
  }
  
  /**
   * Validate if a transition is allowed according to the state machine rules
   */
  validateTransition(
    fromStep: WorkflowStep,
    toStep: WorkflowStep,
    metadata?: Record<string, unknown>
  ): {
    isValid: boolean;
    error?: string;
    transition?: WorkflowTransition;
    details?: Record<string, unknown>;
  } {
    // Special case: if we're going from the same step to the same step, allow metadata-only updates
    if (fromStep === toStep) {
      return {
        isValid: true,
        details: { sameState: true },
      };
    }

    // Attempt to find a matching transition
    const transition = ALLOWED_TRANSITIONS.find(
      (t) => t.from === fromStep && t.to === toStep
    );
    
    if (!transition) {
      return {
        isValid: false,
        error: `Invalid transition from '${fromStep}' to '${toStep}'`,
        details: { reason: 'transition_not_allowed' },
      };
    }

    if (transition.requireData === true && !metadata) {
      return {
        isValid: false,
        error: `Transition from '${fromStep}' to '${toStep}' requires metadata`,
        transition,
        details: { reason: 'metadata_required' },
      };
    }

    if (transition.allowData !== true && metadata && Object.keys(metadata).length > 0) {
      return {
        isValid: false,
        error: `Transition from '${fromStep}' to '${toStep}' does not allow metadata`,
        transition,
        details: { reason: 'metadata_not_allowed' },
      };
    }

    // If transition is to ERROR, ensure there's some error info in metadata if required
    if (toStep === 'error' && transition.requireData === true) {
      const maybeHasError = metadata?.error;
      if (typeof maybeHasError !== 'string') {
        return {
          isValid: false,
          error: 'Error transitions require an error message in metadata',
          transition,
          details: { reason: 'missing_error_info' },
        };
      }
    }

    return { isValid: true, transition, details: {} };
  }
}

// Export singleton instance
export const workflowStateManager = new WorkflowStateManager();