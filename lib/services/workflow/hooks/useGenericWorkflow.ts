import { useState, useCallback, useEffect, useReducer } from 'react'
import { WorkflowState, WorkflowStep, ProcessingPhase, DomainOnlyWorkflowStep } from '@/lib/types/workflow'
import { Result } from '@/lib/services/workflow/error/result'
import { normalizeError } from '@/lib/errors'
import { createDomainLogger } from '@/lib/services/workflow/infrastructure/workflow-processor-helpers'
import { transactionManager } from '@/lib/services/workflow/transaction/transaction-manager'
import { updateMetadataSafely } from '@/lib/services/workflow/infrastructure/workflow-processor-helpers'

/**
 * Domain actions interface that defines the contract for domain-specific logic
 *
 * @template TInput - Type of input for domain actions
 * @template TResult - Type of result from domain actions
 * @template TState - Type of domain-specific state
 */
export interface DomainActions<TInput, TResult, TState> {
  /** Domain name for logging and metadata */
  domainName: string;
  
  /** Initial workflow step */
  initialStep: WorkflowStep;
  
  // Core business logic functions
  
  /** Get initial domain state */
  getInitialState: () => TState;
  
  /** Process domain action - core business logic implementation */
  processAction: (
    input: TInput,
    options: ProcessOptions
  ) => Promise<Result<TResult>>;
  
  /** Create error result */
  createErrorResult: (error: Error, input: TInput) => TResult;
  
  /** Process result to update state */
  processResult?: (result: TResult, currentState: TState) => TState;
  
  // Advanced error handling
  
  /** Error categories for specialized handling */
  errorCategories?: Record<string, (error: Error) => boolean>;
  
  /** Error recovery strategies keyed by category */
  errorRecoveryStrategies?: Record<string, (
    error: Error,
    input: TInput,
    options: ProcessOptions
  ) => Promise<Result<TResult>>>;
  
  // Lifecycle hooks
  
  /** Hook called before processing an action */
  beforeProcess?: (input: TInput, options: ProcessOptions) => Promise<void>;
  
  /** Hook called after processing an action */
  afterProcess?: (
    result: Result<TResult>,
    input: TInput,
    options: ProcessOptions
  ) => Promise<void>;
}

/**
 * Options for processing actions
 */
export interface ProcessOptions {
  /** Workflow ID */
  workflowId: string;
  
  /** User ID */
  userId?: string;
  
  /** Step to transition to before processing */
  step?: WorkflowStep;
  
  /** Step to transition to after successful processing */
  successStep?: WorkflowStep;
  
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  
  /** Transaction ID for tracking */
  transactionId?: string;
  
  /** Retry count for the operation */
  retryCount?: number;
  
  /** Isolation level for transactions */
  isolationLevel?: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
}

/**
 * Options for the generic workflow hook
 */
export interface UseGenericWorkflowOptions {
  /** User ID */
  userId?: string;
  
  /** Chat ID */
  chatId?: string | null;
  
  /** Initial workflow step */
  initialStep?: WorkflowStep;
  
  /** Whether to auto-load workflow on initialization */
  autoLoad?: boolean;
}

/**
 * Reducer action types for state management
 */
type StateAction =
  | { type: 'SET_STATE'; payload: Partial<WorkflowState> }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PROGRESS'; payload: { progress: number; phase?: ProcessingPhase } }
  | { type: 'RESET'; payload: WorkflowStep }
  | { type: 'UPDATE_METADATA'; payload: Record<string, unknown> };

/**
 * State reducer for workflow state management
 */
function stateReducer(state: WorkflowState, action: StateAction): WorkflowState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PROGRESS':
      return {
        ...state,
        progress: action.payload.progress,
        phase: action.payload.phase || state.phase
      };
    case 'RESET':
      return {
        currentStep: action.payload,
        progress: 0,
        phase: ProcessingPhase.INITIALIZATION,
        error: null,
        metadata: {},
        timestamp: new Date().toISOString()
      };
    case 'UPDATE_METADATA':
      return {
        ...state,
        metadata: {
          ...state.metadata,
          ...action.payload
        }
      };
    default:
      return state;
  }
}

/**
 * Event emitter for workflow events
 */
class WorkflowEventEmitter {
  private listeners: Record<string, Array<(data: any) => void>> = {};
  
  /**
   * Subscribe to an event
   * @returns Function to unsubscribe
   */
  on(event: string, callback: (data: any) => void): () => void {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(callback);
    
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }
  
  /**
   * Emit an event with data
   */
  emit(event: string, data: any): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in workflow event listener for ${event}:`, error);
        }
      });
    }
  }
}

/**
 * Generic workflow hook that handles common workflow operations
 * and delegates domain-specific logic to the provided actions.
 *
 * @template TInput - Type of input for domain actions
 * @template TResult - Type of result from domain actions
 * @template TState - Type of domain-specific state
 *
 * @param actions - Domain-specific actions
 * @param options - Hook options
 * @returns Unified workflow hook with domain-specific state
 */
export function useGenericWorkflow<TInput, TResult, TState>(
  actions: DomainActions<TInput, TResult, TState>,
  options: UseGenericWorkflowOptions = {}
) {
  // Initialize state using reducer for better organization
  const [state, dispatch] = useReducer(stateReducer, {
    currentStep: options.initialStep || actions.initialStep,
    progress: 0,
    phase: ProcessingPhase.INITIALIZATION,
    error: null,
    metadata: {},
    timestamp: new Date().toISOString()
  });
  
  // Domain logger
  const logger = createDomainLogger(actions.domainName);
  
  // Event emitter for subscribable workflow events
  const [eventEmitter] = useState(() => new WorkflowEventEmitter());
  
  // Workflow ID and loading state
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Domain-specific state
  const [domainState, setDomainState] = useState<TState>(actions.getInitialState());
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  
  // Subscription cleanup
  const [cleanup, setCleanup] = useState<(() => void) | undefined>(undefined);
  
  /**
   * Load or create workflow state
   */
  const loadOrCreateWorkflowState = useCallback(async (): Promise<string | null> => {
    try {
      if (!options.userId) return null;
      
      setIsLoading(true);
      
      // Import workflowService dynamically to avoid circular dependencies
      const { workflowService } = await import('@/lib/services/workflow/workflow-service');
      
      // Get or create workflow
      const { id, data } = await workflowService.getOrCreateWorkflowForUser(
        options.userId,
        options.chatId,
        options.initialStep || actions.initialStep,
        {
          progress: 0,
          currentStep: options.initialStep || actions.initialStep,
          createdAt: new Date().toISOString(),
          domain: actions.domainName
        }
      );
      
      setWorkflowId(id);
      
      if (data) {
        dispatch({
          type: 'SET_STATE',
          payload: {
            currentStep: (data.metadata?.currentStep as WorkflowStep) || data.current_step as WorkflowStep,
            progress: typeof data.metadata?.progress === 'number' ? data.metadata.progress : 0,
            phase: data.metadata?.phase as ProcessingPhase | undefined,
            error: typeof data.metadata?.error === 'string' ? data.metadata.error : null,
            metadata: data.metadata || {},
            timestamp: data.timestamp || new Date().toISOString(),
          }
        });
        
        // Emit event
        eventEmitter.emit('workflow:loaded', { id, data });
      }
      
      setIsLoading(false);
      return id;
    } catch (error) {
      logger.error('Error loading or creating workflow state', {}, error);
      setSubscriptionError(error instanceof Error ? error.message : String(error));
      setIsLoading(false);
      return null;
    }
  }, [options.userId, options.chatId, options.initialStep, actions.initialStep, actions.domainName, eventEmitter]);
  
  /**
   * Subscribe to workflow changes
   */
  const subscribeToChanges = useCallback(async () => {
    if (!options.userId || !workflowId) return;
    
    try {
      // Import workflowService dynamically to avoid circular dependencies
      const { workflowService } = await import('@/lib/services/workflow/workflow-service');
      
      // Subscribe to workflow changes
      const channel = await workflowService.subscribeToWorkflowForUser(
        options.userId,
        options.chatId,
        (payload) => {
          try {
            const newData = payload.new;
            
            if (!newData) return;
            
            // Extract metadata
            const meta = (newData.metadata as Record<string, unknown>) ?? {};
            
            // Update workflow ID if needed
            setWorkflowId(newData.id);
            
            // Update state
            dispatch({
              type: 'SET_STATE',
              payload: {
                currentStep: (meta.currentStep as WorkflowStep) ?? (newData.current_step as WorkflowStep),
                progress: typeof meta.progress === 'number' ? meta.progress : 0,
                phase: typeof meta.phase === 'string' ? meta.phase as ProcessingPhase : undefined,
                error: typeof meta.error === 'string' ? meta.error : null,
                metadata: meta,
                timestamp: new Date(newData.updated_at).toISOString(),
              }
            });
            
            // Emit event
            eventEmitter.emit('workflow:updated', { newData, oldData: payload.old });
          } catch (err) {
            logger.error('Error processing workflow update', {}, err);
            setSubscriptionError(err instanceof Error ? err.message : String(err));
          }
        },
        (status) => {
          // Update connection status
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setSubscriptionError(null);
          } else if (status === 'CHANNEL_ERROR') {
            setIsConnected(false);
            setSubscriptionError('Connection error');
          } else if (status === 'TIMED_OUT') {
            setIsConnected(false);
            setSubscriptionError('Connection timed out');
          }
          
          // Emit event
          eventEmitter.emit('connection:status', { status });
        }
      );
      
      // Set cleanup function
      setCleanup(() => () => {
        workflowService.unsubscribeFromChannel(channel);
      });
      
      return () => {
        workflowService.unsubscribeFromChannel(channel);
      };
    } catch (error) {
      logger.error('Error subscribing to workflow changes', {}, error);
      setSubscriptionError(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }, [options.userId, options.chatId, workflowId, eventEmitter, logger]);
  
  // Effect to load/create workflow and subscribe to changes
  useEffect(() => {
    if (!options.userId || !options.autoLoad) return;
    
    // Load workflow and then subscribe
    loadOrCreateWorkflowState().then((id) => {
      if (id) {
        subscribeToChanges();
      }
    });
    
    // Cleanup subscription
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [options.userId, options.chatId, options.autoLoad, loadOrCreateWorkflowState, subscribeToChanges, cleanup]);
  
  /**
   * Update workflow step
   */
  const updateStep = useCallback(async (
    step: WorkflowStep,
    metadata?: Record<string, unknown>,
    updateOptions?: {
      conflictStrategy?: 'fail' | 'force' | 'merge';
      skipValidation?: boolean;
    }
  ): Promise<boolean> => {
    try {
      if (!workflowId) return false;
      
      // Import workflow service to avoid circular dependencies
      const { workflowService } = await import('@/lib/services/workflow/workflow-service');
      
      // Merge metadata
      const mergedMetadata = {
        ...(metadata || {}),
        currentStep: step,
        domain: actions.domainName
      };
      
      // Update local state immediately for better UX
      dispatch({
        type: 'SET_STATE',
        payload: {
          currentStep: step,
          metadata: {
            ...(state.metadata || {}),
            ...mergedMetadata
          },
          timestamp: new Date().toISOString()
        }
      });
      
      // Use conflict resolution if strategy specified
      if (updateOptions?.conflictStrategy) {
        await workflowService.updateWithConflictResolution(
          workflowId,
          step,
          mergedMetadata,
          {
            expectedTimestamp: state.timestamp,
            strategy: updateOptions.conflictStrategy
          }
        );
      } else {
        // Standard update
        await workflowService.updateWorkflowState(
          workflowId,
          step,
          mergedMetadata,
          {
            skipValidation: updateOptions?.skipValidation,
            useAtomicUpdate: true
          }
        );
      }
      
      // Log step change
      await workflowService.logWorkflowEvent(
        workflowId,
        'step_changed',
        {
          from: state.currentStep,
          to: step,
          timestamp: new Date().toISOString(),
          metadata: metadata || {},
          domain: actions.domainName
        }
      );
      
      // Emit event
      eventEmitter.emit('step:updated', { step, metadata });
      
      return true;
    } catch (error) {
      logger.error('Error updating step', {}, error);
      return false;
    }
  }, [workflowId, state, actions.domainName, eventEmitter, logger]);
  
  /**
   * Update workflow progress
   */
  const updateProgress = useCallback(async (
    progress: number,
    phase?: ProcessingPhase
  ): Promise<boolean> => {
    try {
      if (!workflowId) return false;
      
      // Import workflow service to avoid circular dependencies
      const { workflowService } = await import('@/lib/services/workflow/workflow-service');
      
      // Update local state immediately
      dispatch({
        type: 'SET_PROGRESS',
        payload: { progress, phase }
      });
      
      // Update in database
      await workflowService.updateProgress(
        workflowId,
        progress,
        phase ?? ProcessingPhase.INITIALIZATION,
        state.currentStep
      );
      
      // Emit event
      eventEmitter.emit('progress:updated', { progress, phase });
      
      return true;
    } catch (error) {
      logger.error('Error updating progress', {}, error);
      return false;
    }
  }, [workflowId, state.currentStep, eventEmitter, logger]);
  
  /**
   * Reset workflow to initial state
   */
  const reset = useCallback(async (): Promise<void> => {
    try {
      // Call domain's beforeProcess hook if available
      if (actions.beforeProcess) {
        await actions.beforeProcess({ action: 'reset' } as any, {
          workflowId: workflowId || '',
          userId: options.userId
        });
      }
      
      // Reset domain state
      setDomainState(actions.getInitialState());
      
      // Reset workflow state
      dispatch({
        type: 'RESET',
        payload: actions.initialStep
      });
      
      // Update workflow in database if available
      if (workflowId) {
        await updateMetadataSafely(
          workflowId,
          {
            resetAt: new Date().toISOString(),
            resetBy: options.userId || 'system',
            currentStep: actions.initialStep,
            domain: actions.domainName
          },
          {
            transactionId: crypto.randomUUID(),
            conflictStrategy: 'merge'
          },
          actions.domainName
        );
      }
      
      // Call domain's afterProcess hook if available
      if (actions.afterProcess) {
        await actions.afterProcess(
          Result.success({} as TResult),
          { action: 'reset' } as any,
          {
            workflowId: workflowId || '',
            userId: options.userId
          }
        );
      }
      
      // Emit event
      eventEmitter.emit('workflow:reset', {});
    } catch (error) {
      logger.error('Error resetting workflow', {}, error);
    }
  }, [workflowId, options.userId, actions, eventEmitter, logger]);
  
  /**
   * Process a domain action with error handling and state updates
   */
  const process = useCallback(async (
    input: TInput,
    processOptions: {
      step?: WorkflowStep;
      successStep?: WorkflowStep;
      onProgress?: (progress: number, phase: ProcessingPhase) => void;
      metadata?: Record<string, unknown>;
      transactionOptions?: {
        isolationLevel?: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
        timeout?: number;
        retryCount?: number;
      };
    } = {}
  ): Promise<TResult> => {
    try {
      if (!workflowId) {
        throw new Error('Workflow not initialized. Make sure userId is provided.');
      }
      
      // Prepare options
      const options: ProcessOptions = {
        workflowId,
        userId: options.userId,
        step: processOptions.step,
        successStep: processOptions.successStep,
        onProgress: processOptions.onProgress,
        metadata: processOptions.metadata,
        isolationLevel: processOptions.transactionOptions?.isolationLevel
      };
      
      // Generate transaction ID if not provided
      options.transactionId = processOptions.metadata?.transactionId as string ||
                             crypto.randomUUID();
      
      // Call domain's beforeProcess hook if available
      if (actions.beforeProcess) {
        await actions.beforeProcess(input, options);
      }
      
      // Update step if provided
      if (processOptions.step) {
        await updateStep(processOptions.step, {
          ...processOptions.metadata,
          startedAt: new Date().toISOString(),
          transactionId: options.transactionId
        });
      }
      
      // Create progress callback
      const progressCallback = processOptions.onProgress
        ? (progress: number, phase: ProcessingPhase) => {
            updateProgress(progress, phase);
            processOptions.onProgress!(progress, phase);
          }
        : (progress: number, phase: ProcessingPhase) => {
            updateProgress(progress, phase);
          };
      
      let result: Result<TResult>;
      
      // Process using domain-specific action with transaction if configured
      if (processOptions.transactionOptions) {
        const transactionResult = await transactionManager.executeTransaction(
          workflowId,
          async (transactionId) => {
            options.transactionId = transactionId;
            
            const actionResult = await actions.processAction(input, {
              ...options,
              onProgress: progressCallback
            });
            
            if (actionResult.isSuccess()) {
              return actionResult.value;
            } else {
              throw new Error(actionResult.error.message);
            }
          },
          {
            isolationLevel: processOptions.transactionOptions.isolationLevel,
            retryCount: processOptions.transactionOptions.retryCount || 0,
            timeout: processOptions.transactionOptions.timeout,
            step: processOptions.step,
            errorStep: DomainOnlyWorkflowStep.ERROR,
            metadata: processOptions.metadata,
            domainName: actions.domainName
          }
        );
        
        if (transactionResult.isSuccess()) {
          result = Result.success(transactionResult.value);
        } else {
          result = Result.failure(
            transactionResult.error.message,
            transactionResult.error.code,
            transactionResult.error.details
          );
        }
      } else {
        // Process without transaction
        result = await actions.processAction(input, {
          ...options,
          onProgress: progressCallback
        });
      }
      
      if (result.isSuccess()) {
        // Process result to update domain state
        if (actions.processResult) {
          setDomainState(actions.processResult(result.value, domainState));
        }
        
        // Update to success step if provided
        if (processOptions.successStep) {
          await updateStep(processOptions.successStep, {
            completedAt: new Date().toISOString(),
            transactionId: options.transactionId
          });
        }
        
        // Call domain's afterProcess hook if available
        if (actions.afterProcess) {
          await actions.afterProcess(
            result,
            input,
            options
          );
        }
        
        // Emit event
        eventEmitter.emit('process:completed', { input, result: result.value });
        
        return result.value;
      } else {
        throw new Error(result.error.message);
      }
    } catch (error) {
      // Handle errors with categorization and recovery
      const normalizedError = normalizeError(error);
      logger.error('Error processing action', {}, normalizedError);
      
      // Set error in state
      dispatch({
        type: 'SET_ERROR',
        payload: normalizedError.message
      });
      
      // Update workflow to error state
      await updateStep(DomainOnlyWorkflowStep.ERROR, {
        error: normalizedError.message,
        errorTimestamp: new Date().toISOString(),
        errorDetails: normalizedError.data || {}
      });
      
      // Try to categorize error and find recovery strategy
      if (actions.errorCategories && actions.errorRecoveryStrategies) {
        // Find matching category
        const category = Object.entries(actions.errorCategories)
          .find(([_, predicate]) => predicate(normalizedError))
          ?.[0];
        
        if (category && actions.errorRecoveryStrategies[category]) {
          try {
            // Try recovery strategy
            logger.info('Attempting error recovery', { category, error: normalizedError.message });
            
            const recoveryResult = await actions.errorRecoveryStrategies[category](
              normalizedError,
              input,
              {
                workflowId,
                userId: options.userId
              }
            );
            
            if (recoveryResult.isSuccess()) {
              logger.info('Error recovery successful', { category });
              
              // Process result
              if (actions.processResult) {
                setDomainState(actions.processResult(recoveryResult.value, domainState));
              }
              
              // Emit recovery event
              eventEmitter.emit('error:recovered', {
                error: normalizedError,
                category,
                result: recoveryResult.value
              });
              
              return recoveryResult.value;
            }
          } catch (recoveryError) {
            logger.error('Error recovery failed', { category }, recoveryError);
          }
        }
      }
      
      // Emit error event
      eventEmitter.emit('process:error', { input, error: normalizedError });
      
      // Create error result
      return actions.createErrorResult(normalizedError, input);
    }
  }, [workflowId, options.userId, domainState, actions, updateStep, updateProgress, eventEmitter, logger]);
  
  // Computed status properties
  const status = {
    currentStep: state.currentStep,
    progress: state.progress,
    phase: state.phase,
    isError: state.currentStep === DomainOnlyWorkflowStep.ERROR,
    isComplete: state.currentStep === 'complete',
    isIdle: state.currentStep === 'idle'
  };
  
  // Return hook value
  return {
    // State
    state,
    workflowId,
    isLoading,
    isConnected,
    subscriptionError,
    
    // Domain state
    ...domainState,
    
    // Methods
    process,
    updateStep,
    updateProgress,
    reset,
    loadOrCreateWorkflowState,
    
    // Status
    status,
    
    // Event subscription
    on: eventEmitter.on.bind(eventEmitter)
  };
}