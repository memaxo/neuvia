import { useState, useCallback } from 'react';
import { useWorkflow } from '../use-workflow';
import { useWorkflowErrorHandler } from '../workflow-error-handler';
import { normalizeError } from '@/lib/errors';
import { ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow';

import type { WorkflowStep } from '@/lib/types/workflow';

/**
 * Common hook options
 */
export interface CommonHookOptions {
  /** User ID */
  userId?: string;
  
  /** Chat ID */
  chatId?: string | null;
  
  /** Initial workflow step */
  initialStep?: WorkflowStep;
}

/**
 * Domain-specific hook actions
 */
export interface DomainActions<TInput, TResult, TState> {
  /** Domain name for logging */
  domainName: string;
  
  /** Initial workflow step */
  initialStep: WorkflowStep;
  
  /** Get initial domain state */
  getInitialState: () => TState;
  
  /** Process domain action */
  processAction: (
    input: TInput,
    options: {
      workflowId: string;
      userId?: string;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
    }
  ) => Promise<TResult>;
  
  /** Create error result */
  createErrorResult: (error: Error, input: TInput) => TResult;
  
  /** Process result to update state */
  processResult?: (result: TResult, currentState: TState) => TState;
}

/**
 * Process options
 */
export interface ProcessOptions {
  /** Step to transition to before processing */
  step?: WorkflowStep;
  
  /** Step to transition to after successful processing */
  successStep?: WorkflowStep;
  
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Factory function for creating domain-specific workflow hooks
 */
export function createWorkflowHook<TInput, TResult, TState>(
  actions: DomainActions<TInput, TResult, TState>
) {
  // Return a hook function
  return function useDomainWorkflow(options: CommonHookOptions = {}) {
    // Use the base workflow hook
    const workflow = useWorkflow({
      userId: options.userId,
      chatId: options.chatId,
      initialStep: options.initialStep || actions.initialStep
    });
    
    // Use the error handler
    const errorHandler = useWorkflowErrorHandler();
    
    // Initialize domain-specific state
    const [domainState, setDomainState] = useState<TState>(actions.getInitialState());
    
    /**
     * Main process function with error handling and state updates
     */
    const process = useCallback(async (
      input: TInput,
      options: ProcessOptions = {}
    ): Promise<TResult> => {
      try {
        if (!workflow.workflowId) {
          throw new Error('Workflow not initialized. Make sure userId is provided.');
        }
        
        // Update workflow step if provided
        if (options.step) {
          await workflow.updateStep(options.step, {
            ...options.metadata,
            startedAt: new Date().toISOString()
          });
        }
        
        // Progress callback
        const progressCallback = options.onProgress
          ? (progress: number, phase: ProcessingPhase) => {
              workflow.updateProgress(progress, phase);
              options.onProgress!(progress, phase);
            }
          : (progress: number, phase: ProcessingPhase) => {
              workflow.updateProgress(progress, phase);
            };
        
        // Process using domain-specific action
        const result = await actions.processAction(
          input,
          {
            workflowId: workflow.workflowId,
            userId: options.userId,
            onProgress: progressCallback
          }
        );
        
        // Update domain state if needed
        if (actions.processResult) {
          setDomainState(actions.processResult(result, domainState));
        }
        
        // Update workflow step if success step provided
        if (options.successStep) {
          await workflow.updateStep(options.successStep, {
            completedAt: new Date().toISOString()
          });
        }
        
        return result;
      } catch (err) {
        const error = normalizeError(err);
        
        // Handle error using workflow service
        await workflow.updateStep(DomainOnlyWorkflowStep.ERROR, {
          error: error.message,
          errorTimestamp: new Date().toISOString(),
        });
        
        // Log error properly
        await errorHandler.handleError(
          err,
          options.step || workflow.state.currentStep,
          {
            previousStep: workflow.state.currentStep,
            details: { input },
            showToast: true,
            workflowId: workflow.workflowId
          }
        );
        
        // Return error result
        return actions.createErrorResult(error, input);
      }
    }, [workflow, errorHandler, domainState, options.userId]);
    
    /**
     * Reset to initial state
     */
    const reset = useCallback(async (): Promise<void> => {
      // Reset domain state
      setDomainState(actions.getInitialState());
      
      // Reset workflow state
      await workflow.updateStep(actions.initialStep, {
        resetAt: new Date().toISOString()
      });
    }, [workflow, actions]);
    
    // Return combined hook
    return {
      ...workflow,
      ...domainState,
      process,
      reset
    };
  };
}