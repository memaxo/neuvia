import { ApplicationError, normalizeError } from '@/lib/errors';
import logger from '@/lib/logger';
import { Result } from '../error/result';
import { workflowRepository } from '../infrastructure/workflow-repository';
import { workflowEventSourcing } from '../infrastructure/workflow-event-source';
import { workflowStateManager } from '../infrastructure/workflow-state-manager';
import { transactionExecutor } from '../transaction/transaction-executor';

import type {
  WorkflowDefinition,
  WorkflowAction,
  StateNode,
  Transition,
} from './workflow-definition';
import type { WorkflowStep } from '@/lib/types/workflow';

/**
 * Interface representing current workflow state
 */
export interface WorkflowInstance<TContext extends Record<string, any> = Record<string, any>> {
  id: string;
  definitionId: string;
  currentState: WorkflowStep;
  context: TContext;
  history: Array<{
    state: WorkflowStep;
    action: WorkflowAction;
    timestamp: string;
  }>;
  version: string;
  timestamp: string;
}

/**
 * Options for workflow transitions
 */
export interface TransitionOptions {
  transactionId?: string;
  userId?: string;
  skipValidation?: boolean;
  logEvent?: boolean;
}

/**
 * Workflow engine responsible for executing workflow definitions
 * 
 * PHASE 1 ANALYSIS NOTES:
 * - This file has a clear separation of concerns, focusing only on workflow state management
 * - It correctly delegates business decisions to workflow definitions
 * - No significant domain logic found that would need to be extracted
 * - The engine focuses on the "when" and "what" of state transitions, not the "how" of domain operations
 */
export class WorkflowEngine {
  private readonly logger = logger.withMetadata({ module: 'WorkflowEngine' });
  private definitions: Map<string, WorkflowDefinition> = new Map();
  
  /**
   * Register a workflow definition with the engine
   */
  registerWorkflow<TContext extends Record<string, any>>(
    definition: WorkflowDefinition<TContext>
  ): void {
    this.definitions.set(definition.id, definition);
    this.logger.info(`Registered workflow definition: ${definition.id}`, {
      workflow: definition.name,
      version: definition.version,
      states: Object.keys(definition.states).length
    });
  }
  
  /**
   * Create a new workflow instance
   */
  async createWorkflow<TContext extends Record<string, any>>(
    definitionId: string,
    workflowId: string,
    initialContext?: Partial<TContext>
  ): Promise<Result<WorkflowInstance<TContext>>> {
    try {
      const definition = this.getDefinition<TContext>(definitionId);
      if (!definition) {
        return Result.failure(
          `Workflow definition not found: ${definitionId}`,
          'WORKFLOW_DEFINITION_NOT_FOUND'
        );
      }
      
      // Create initial context
      const context = {
        ...definition.context.initialValue,
        ...initialContext
      };
      
      // Validate context against schema
      try {
        definition.context.schema.parse(context);
      } catch (err) {
        return Result.failure(
          `Invalid initial context: ${(err as Error).message}`,
          'INVALID_WORKFLOW_CONTEXT',
          { validationError: err }
        );
      }
      
      // Create workflow instance
      const initialState = definition.states[definition.initialState];
      const instance: WorkflowInstance<TContext> = {
        id: workflowId,
        definitionId,
        currentState: initialState.id,
        context,
        history: [],
        version: definition.version,
        timestamp: new Date().toISOString()
      };
      
      // Store in database using existing repository
      await workflowRepository.createWorkflow(
        workflowId,
        definition.initialState,
        {
          definitionId,
          domains: definition.domains,
          context: context as Record<string, unknown>,
          initializedAt: instance.timestamp,
          version: definition.version
        }
      );
      
      // Execute entry effects for initial state
      if (initialState.onEntry && initialState.onEntry.length > 0) {
        for (const effect of initialState.onEntry) {
          await effect(context as TContext, { type: 'INITIALIZE' });
        }
      }
      
      // Log initialization event
      await workflowEventSourcing.appendEvent(
        workflowId,
        'workflow_initialized',
        {
          definitionId,
          initialState: initialState.id,
          timestamp: instance.timestamp,
          domains: definition.domains
        }
      );
      
      return Result.success(instance);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to create workflow', {
        definitionId,
        workflowId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to create workflow: ${normalizedError.message}`,
        normalizedError.code || 'WORKFLOW_CREATION_FAILED',
        {
          definitionId,
          workflowId,
          ...normalizedError.data
        }
      );
    }
  }
  
  /**
   * Send an action to a workflow instance to trigger transitions
   */
  async sendAction<TContext extends Record<string, any>>(
    workflowId: string,
    action: WorkflowAction,
    options: TransitionOptions = {}
  ): Promise<Result<WorkflowInstance<TContext>>> {
    const transactionId = options.transactionId || crypto.randomUUID();
    const transactionLogger = transactionExecutor.createTransactionLogger(transactionId);
    
    try {
      // Get workflow instance from repository
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        return Result.failure(
          `Workflow not found: ${workflowId}`,
          'WORKFLOW_NOT_FOUND',
          { workflowId }
        );
      }
      
      // Get definition ID from metadata
      const definitionId = state.metadata?.definitionId as string;
      if (!definitionId) {
        return Result.failure(
          `Workflow metadata missing definitionId: ${workflowId}`,
          'INVALID_WORKFLOW_STATE',
          { workflowId }
        );
      }
      
      // Get workflow definition
      const definition = this.getDefinition<TContext>(definitionId);
      if (!definition) {
        return Result.failure(
          `Workflow definition not found: ${definitionId}`,
          'WORKFLOW_DEFINITION_NOT_FOUND',
          { definitionId, workflowId }
        );
      }
      
      // Reconstruct current workflow instance
      const context = state.metadata?.context as TContext || definition.context.initialValue;
      const instance: WorkflowInstance<TContext> = {
        id: workflowId,
        definitionId,
        currentState: state.currentStep,
        context,
        history: state.metadata?.history as any[] || [],
        version: state.metadata?.version as string || definition.version,
        timestamp: state.timestamp
      };
      
      // Get current state node
      const currentStateNode = definition.states[instance.currentState];
      if (!currentStateNode) {
        return Result.failure(
          `Invalid state in workflow instance: ${instance.currentState}`,
          'INVALID_WORKFLOW_STATE',
          { workflowId, currentState: instance.currentState }
        );
      }
      
      // Log action received
      transactionLogger.log('info', `Received action ${action.type} for workflow ${workflowId}`, {
        state: instance.currentState,
        actionType: action.type,
        transactionId
      });
      
      // Determine applicable transitions
      const transitions = currentStateNode.transitions[action.type];
      if (!transitions) {
        transactionLogger.log('warn', `No transition found for action ${action.type} in state ${instance.currentState}`, {
          availableTransitions: Object.keys(currentStateNode.transitions),
          workflowId
        });
        
        // No applicable transition - return current state unchanged
        return Result.success(instance);
      }
      
      // Convert single transition to array for consistent handling
      const transitionArray = Array.isArray(transitions) ? transitions : [transitions];
      
      // Find first applicable transition by evaluating conditions
      let targetTransition: Transition<TContext> | undefined;
      for (const transition of transitionArray) {
        if (!transition.condition || transition.condition(instance.context, action)) {
          targetTransition = transition;
          break;
        }
      }
      
      if (!targetTransition) {
        transactionLogger.log('info', 'No transition conditions satisfied', {
          action: action.type,
          state: instance.currentState
        });
        
        // No applicable transition after evaluating conditions
        return Result.success(instance);
      }
      
      // Get target state node
      const targetState = definition.states[targetTransition.target];
      if (!targetState) {
        return Result.failure(
          `Invalid target state in transition: ${targetTransition.target}`,
          'INVALID_TRANSITION_TARGET',
          { workflowId, currentState: instance.currentState, targetState: targetTransition.target }
        );
      }
      
      // Execute exit effects for current state
      if (currentStateNode.onExit && currentStateNode.onExit.length > 0) {
        for (const effect of currentStateNode.onExit) {
          await effect(instance.context, action);
        }
      }
      
      // Execute transition effects
      if (targetTransition.effects && targetTransition.effects.length > 0) {
        for (const effect of targetTransition.effects) {
          await effect(instance.context, action);
        }
      }
      
      // Execute entry effects for target state
      if (targetState.onEntry && targetState.onEntry.length > 0) {
        for (const effect of targetState.onEntry) {
          await effect(instance.context, action);
        }
      }
      
      // Update history
      const historyEntry = {
        state: targetState.id,
        action,
        timestamp: new Date().toISOString()
      };
      const updatedHistory = [...instance.history, historyEntry];
      
      // Update instance
      const updatedInstance: WorkflowInstance<TContext> = {
        ...instance,
        currentState: targetState.id,
        context: { ...instance.context },
        history: updatedHistory,
        timestamp: historyEntry.timestamp
      };
      
      // Prepare transition metadata
      const transitionMetadata = {
        fromState: instance.currentState,
        toState: targetState.id,
        action: action.type,
        transactionId,
        timestamp: historyEntry.timestamp,
        reason: action.payload?.reason,
        history: updatedHistory.slice(-10), // Keep last 10 history entries
        context: updatedInstance.context
      };
      
      // Log transition event
      if (options.logEvent !== false) {
        await workflowEventSourcing.appendEvent(
          workflowId,
          'state_transitioned',
          {
            from: instance.currentState,
            to: targetState.id,
            action: action.type,
            timestamp: historyEntry.timestamp,
            transactionId,
            domains: definition.domains
          },
          options.userId
        );
      }
      
      // Update state in repository
      await workflowStateManager.transitionState(
        workflowId,
        instance.currentState,
        targetState.id,
        {
          ...transitionMetadata,
          context: updatedInstance.context
        },
        {
          skipValidation: options.skipValidation,
          logEvent: false, // We already logged it above
          transactionId
        }
      );
      
      transactionLogger.log('info', `Transitioned from ${instance.currentState} to ${targetState.id}`, {
        workflowId,
        action: action.type,
        transactionId
      });
      
      return Result.success(updatedInstance);
    } catch (error) {
      const normalizedError = normalizeError(error);
      
      transactionLogger.log('error', `Failed to process action ${action.type}`, {
        workflowId,
        error: normalizedError.message,
        stack: normalizedError.stack
      });
      
      // Try to update workflow to error state
      try {
        const errorDomain = await this.determineErrorDomain(workflowId);
        await workflowStateManager.handleError(
          workflowId,
          normalizedError,
          'error' as WorkflowStep,
          {
            domain: errorDomain,
            action: action.type,
            transactionId,
            errorTimestamp: new Date().toISOString()
          }
        );
      } catch (stateError) {
        // Log but continue
        this.logger.error('Failed to update error state', {
          workflowId,
          originalError: normalizedError.message,
          stateError: stateError instanceof Error ? stateError.message : String(stateError)
        });
      }
      
      return Result.failure(
        `Failed to process action: ${normalizedError.message}`,
        normalizedError.code || 'ACTION_PROCESSING_FAILED',
        {
          workflowId,
          action: action.type,
          ...normalizedError.data
        }
      );
    }
  }
  
  /**
   * Get a workflow instance
   */
  async getWorkflow<TContext extends Record<string, any>>(
    workflowId: string
  ): Promise<Result<WorkflowInstance<TContext>>> {
    try {
      // Get workflow state from repository
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        return Result.failure(
          `Workflow not found: ${workflowId}`,
          'WORKFLOW_NOT_FOUND',
          { workflowId }
        );
      }
      
      // Get definition ID from metadata
      const definitionId = state.metadata?.definitionId as string;
      if (!definitionId) {
        return Result.failure(
          `Workflow metadata missing definitionId: ${workflowId}`,
          'INVALID_WORKFLOW_STATE',
          { workflowId }
        );
      }
      
      // Reconstruct workflow instance
      const instance: WorkflowInstance<TContext> = {
        id: workflowId,
        definitionId,
        currentState: state.currentStep,
        context: state.metadata?.context as TContext || {},
        history: state.metadata?.history as any[] || [],
        version: state.metadata?.version as string || '1.0.0',
        timestamp: state.timestamp
      };
      
      return Result.success(instance);
    } catch (error) {
      const normalizedError = normalizeError(error);
      this.logger.error('Failed to get workflow', {
        workflowId,
        error: normalizedError.message
      });
      
      return Result.failure(
        `Failed to get workflow: ${normalizedError.message}`,
        normalizedError.code || 'WORKFLOW_RETRIEVAL_FAILED',
        { workflowId }
      );
    }
  }
  
  /**
   * Get the current state node for a workflow
   */
  async getCurrentStateNode<TContext extends Record<string, any>>(
    workflowId: string
  ): Promise<Result<StateNode<TContext>>> {
    const workflowResult = await this.getWorkflow<TContext>(workflowId);
    if (workflowResult.isFailure()) {
      return Result.failure(
        workflowResult.error.message,
        workflowResult.error.code,
        workflowResult.error.details
      );
    }
    
    const workflow = workflowResult.value;
    const definition = this.getDefinition<TContext>(workflow.definitionId);
    if (!definition) {
      return Result.failure(
        `Workflow definition not found: ${workflow.definitionId}`,
        'WORKFLOW_DEFINITION_NOT_FOUND',
        { definitionId: workflow.definitionId }
      );
    }
    
    const stateNode = definition.states[workflow.currentState];
    if (!stateNode) {
      return Result.failure(
        `Invalid state in workflow instance: ${workflow.currentState}`,
        'INVALID_WORKFLOW_STATE',
        { workflowId, currentState: workflow.currentState }
      );
    }
    
    return Result.success(stateNode);
  }
  
  /**
   * Check if an action is valid for the current state
   */
  async canHandleAction(
    workflowId: string,
    actionType: string
  ): Promise<Result<boolean>> {
    const stateNodeResult = await this.getCurrentStateNode(workflowId);
    if (stateNodeResult.isFailure()) {
      return Result.failure(
        stateNodeResult.error.message,
        stateNodeResult.error.code,
        stateNodeResult.error.details
      );
    }
    
    const stateNode = stateNodeResult.value;
    return Result.success(actionType in stateNode.transitions);
  }
  
  /**
   * Get possible actions for the current state
   */
  async getPossibleActions(
    workflowId: string
  ): Promise<Result<string[]>> {
    const stateNodeResult = await this.getCurrentStateNode(workflowId);
    if (stateNodeResult.isFailure()) {
      return Result.failure(
        stateNodeResult.error.message,
        stateNodeResult.error.code,
        stateNodeResult.error.details
      );
    }
    
    const stateNode = stateNodeResult.value;
    return Result.success(Object.keys(stateNode.transitions));
  }
  
  /**
   * Helper to get a typed workflow definition
   */
  private getDefinition<TContext extends Record<string, any>>(
    definitionId: string
  ): WorkflowDefinition<TContext> | undefined {
    return this.definitions.get(definitionId) as WorkflowDefinition<TContext> | undefined;
  }
  
  /**
   * Determine the domain for error handling
   */
  private async determineErrorDomain(workflowId: string): Promise<string> {
    try {
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state || !state.metadata) {
        return 'Unknown';
      }
      
      // Try to get domain from metadata
      if (state.metadata.domains && Array.isArray(state.metadata.domains)) {
        return state.metadata.domains[0] as string;
      }
      
      // Try to infer from definition ID
      const definitionId = state.metadata.definitionId as string;
      if (definitionId) {
        if (definitionId.includes('document')) return 'Document';
        if (definitionId.includes('verification')) return 'Verification';
        if (definitionId.includes('report')) return 'Report';
        if (definitionId.includes('research')) return 'Research';
        if (definitionId.includes('chat')) return 'Chat';
      }
      
      // Fallback to inferring from current step
      const step = state.currentStep;
      if (step.startsWith('document_') || step === 'uploading' || step === 'extracting') {
        return 'Document';
      } else if (step.startsWith('verification_')) {
        return 'Verification';
      } else if (step.startsWith('report_')) {
        return 'Report';
      } else if (step.startsWith('research_')) {
        return 'Research';
      } else if (step.startsWith('chat_')) {
        return 'Chat';
      }
      
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine();