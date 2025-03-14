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
import { getDomainConcurrencyConfig } from '../domain/domain-concurrency-config'

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
  conflictStrategy?: 'fail' | 'force' | 'merge' | 'append' | 'field-specific';
  
  /** Expected timestamp for optimistic concurrency control */
  expectedTimestamp?: string;
  
  /** Whether to log the transition event */
  logEvent?: boolean;
  
  /** Transaction ID for tracking operations */
  transactionId?: string;
  
  /** Domain name for domain-specific conflict resolution */
  domain?: string;
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
        domain,
        expectedTimestamp,
        logEvent = true,
        transactionId = crypto.randomUUID()
      } = options;
      
      // Get domain-specific conflict strategy if domain is provided
      let conflictStrategy = options.conflictStrategy;
      if (domain && !conflictStrategy) {
        const domainConfig = getDomainConcurrencyConfig(domain);
        conflictStrategy = domainConfig.defaultStrategy;
      } else if (!conflictStrategy) {
        conflictStrategy = 'fail'; // Default to fail-safe if no domain or explicit strategy
      }
      
      // Log domain-specific strategy being used
      this.logger.debug('Using conflict strategy for state transition', {
        domain,
        conflictStrategy,
        fromStep,
        toStep
      });
      
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
        toStep,
        domain // Include domain in metadata for traceability
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
            transactionId,
            domain // Include domain in event data
          }
        );
      }
      
      // Map domain-specific strategies to repository strategies
      let repoStrategy: 'fail' | 'force' | 'merge';
      if (conflictStrategy === 'field-specific' || conflictStrategy === 'append') {
        repoStrategy = 'merge'; // Both field-specific and append use merge at the repo level
      } else if (conflictStrategy === 'pessimistic' || conflictStrategy === 'optimistic') {
        repoStrategy = 'fail'; // Pessimistic and optimistic use fail at the repo level (with expectedTimestamp)
      } else {
        repoStrategy = conflictStrategy as any;
      }
      
      // Update state with concurrency control
      return await workflowRepository.updateWorkflowState(
        workflowId,
        toStep,
        transitionMetadata,
        {
          expectedTimestamp,
          conflictStrategy: repoStrategy,
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
   * Handle workflow error with domain-specific error states
   * Maps errors to the appropriate domain-specific error step based on the current context
   */
  async handleError(
    workflowId: string,
    error: unknown,
    fallbackErrorStep: WorkflowStep,
    errorDetails: Record<string, unknown> = {}
  ): Promise<WorkflowState> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorTimestamp = new Date().toISOString();
      const transactionId = crypto.randomUUID();
      
      // Get current workflow state to determine context
      let currentState;
      try {
        currentState = await workflowRepository.getWorkflowState(workflowId);
      } catch (stateError) {
        // If we can't get the state, continue with fallback error step
        this.logger.warn('Unable to get workflow state during error handling', { 
          workflowId, 
          error: stateError instanceof Error ? stateError.message : String(stateError) 
        });
      }
      
      const currentStep = currentState?.currentStep || fallbackErrorStep;
      
      // Check if the error is related to concurrency issues
      const isConcurrencyError = 
        errorMessage.includes('conflict') || 
        errorMessage.includes('concurrency') || 
        errorMessage.includes('optimistic lock') ||
        errorDetails.reason === 'concurrency_conflict';
      
      // Use domain from error details, metadata, or infer from step name
      const domainName = errorDetails.domain as string || 
                       currentState?.metadata?.domain as string || 
                       this.getDomainFromStep(currentStep);
      
      // Get appropriate error step for the domain
      let targetErrorStep: WorkflowStep;
      
      if (domainName) {
        // Get domain-specific configuration for error handling
        const domainConfig = getDomainConcurrencyConfig(domainName);
        
        this.logger.debug('Using domain-specific error handling', { 
          workflowId, 
          domain: domainName,
          currentStep
        });
        
        // Domain-specific error mapping
        if (domainName === 'Chat') {
          targetErrorStep = 'chat_error';
        } else if (domainName === 'Verification') {
          targetErrorStep = 'verification_failed';
        } else if (domainName === 'Document') {
          targetErrorStep = 'document_error';
        } else if (domainName === 'Report') {
          targetErrorStep = 'report_generation_error';
        } else if (domainName === 'Research') {
          targetErrorStep = 'research_error';
        } else {
          // Use fallback if domain doesn't have a specific error step
          targetErrorStep = fallbackErrorStep;
        }
      } else if (isConcurrencyError) {
        // For concurrency errors without domain context, use generic error
        targetErrorStep = DomainOnlyWorkflowStep.ERROR;
        errorDetails = {
          ...errorDetails,
          errorType: 'concurrency_conflict',
          conflictTimestamp: errorTimestamp
        };
      } else {
        // Use fallback error step if no domain context available
        targetErrorStep = fallbackErrorStep;
      }
      
      // Enhance error details with domain information if available
      if (domainName) {
        errorDetails = {
          ...errorDetails,
          domain: domainName
        };
      }
      
      // Log error with enhanced context
      this.logger.error('Handling workflow error with domain context', {
        workflowId,
        error: errorMessage,
        domain: domainName,
        currentStep,
        targetErrorStep
      });
      
      // Log error event with enhanced domain context
      await workflowEventSourcing.appendEvent(
        workflowId,
        'error_occurred',
        {
          error: errorMessage,
          step: currentStep,
          targetErrorStep,
          details: errorDetails,
          timestamp: errorTimestamp,
          transactionId,
          domain: domainName
        }
      );
      
      // Try to recover to the appropriate error state
      const recovered = await workflowRepository.recoverState(
        workflowId,
        targetErrorStep,
        {
          error: errorMessage,
          errorDetails,
          errorTimestamp,
          previousStep: currentStep,
          transactionId,
          errorType: errorDetails.errorType || 'domain_error',
          domain: domainName
        }
      );
      
      if (!recovered) {
        // Fall back to direct update if recovery failed
        await workflowRepository.updateWorkflowState(
          workflowId,
          targetErrorStep,
          {
            error: errorMessage,
            errorDetails,
            errorTimestamp,
            previousStep: currentStep,
            transactionId,
            errorType: errorDetails.errorType || 'domain_error',
            domain: domainName
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
      
      // Determine fallback error state based on current step context if we can
      let fallbackErrorStep: WorkflowStep = DomainOnlyWorkflowStep.ERROR;
      if (errorDetails.domain === 'Chat' || errorDetails.domain === 'chat') {
        fallbackErrorStep = 'chat_error';
      } else if (errorDetails.domain === 'Verification' || errorDetails.domain === 'verification') {
        fallbackErrorStep = 'verification_failed';
      }
      
      // Return minimal state with appropriate error step
      return {
        currentStep: fallbackErrorStep,
        progress: 0,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          errorDetails,
          errorTimestamp: new Date().toISOString(),
          previousStep: errorDetails.currentStep as string || 'unknown'
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
   * validateTransition is the single canonical method for checking transitions.
   * Do not replicate or introduce separate validation in workflow-service.ts.
   * 
   * This is the authoritative source of validation logic for workflow state transitions.
   * Any changes to transition rules should happen here and only here.
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

    return {
      isValid: true,
      transition,
    };
  }
  
  /**
   * Infer domain from workflow step name
   */
  private getDomainFromStep(step: WorkflowStep): string | undefined {
    if (step.startsWith('chat_')) {
      return 'Chat';
    } else if (step.startsWith('verification_')) {
      return 'Verification';
    } else if (step.startsWith('document_') || step === 'uploading' || step === 'extracting') {
      return 'Document';
    } else if (step.startsWith('report_') || step === 'report_generation') {
      return 'Report';
    } else if (step.startsWith('research_')) {
      return 'Research';
    }
    return undefined;
  }
}

// Export singleton instance
export const workflowStateManager = new WorkflowStateManager();