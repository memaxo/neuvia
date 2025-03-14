import { useCallback, useState, useEffect } from 'react'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { useWorkflowErrorHandler } from '@/lib/workflow/workflow-error-handler'
import { normalizeError } from '@/lib/errors'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow'
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow';

/**
 * Options for base workflow hook
 */
export interface BaseWorkflowHookOptions {
  /** User ID required for workflow operations */
  userId?: string;
  
  /** Initial workflow step */
  initialStep?: WorkflowStep;
  
  /** Optional chat ID for chat-based workflows */
  chatId?: string | null;
  
  /** Domain name for error handling */
  domain: string;
  
  /** Whether to auto-load workflow on initialization */
  autoLoad?: boolean;
}

/**
 * Update step options
 */
export interface UpdateStepOptions {
  /** Conflict handling strategy */
  conflictStrategy?: 'fail' | 'force' | 'merge';
  
  /** Skip validation of transitions */
  skipValidation?: boolean;
  
  /** Include a chat message with the update */
  withChatMessage?: { 
    content: string;
    role?: string;
    metadata?: Record<string, unknown>
  };
}

/**
 * Base result interface for useBaseWorkflowHook
 */
export interface BaseWorkflowHookResult {
  /** Current workflow state */
  state: WorkflowState;
  
  /** Workflow ID */
  workflowId: string | null;
  
  /** Update workflow step */
  updateStep: (
    step: WorkflowStep, 
    metadata?: Record<string, unknown>, 
    options?: UpdateStepOptions
  ) => Promise<WorkflowState>;
  
  /** Update workflow progress */
  updateProgress: (
    progress: number, 
    phase?: ProcessingPhase, 
    notifyUsers?: boolean
  ) => Promise<WorkflowState>;
  
  /** Update progress with chat notification */
  updateProgressWithNotification: (
    progress: number, 
    phase: ProcessingPhase, 
    messageContent: string
  ) => Promise<WorkflowState>;
  
  /** Reset workflow to idle state */
  resetWorkflow: () => Promise<boolean>;
  
  /** Load or create workflow state */
  loadOrCreateWorkflowState: () => Promise<string | null>;
  
  /** Current connection status */
  isConnected: boolean;
  
  /** Subscription error */
  subscriptionError: string | null;
  
  /** Convenience workflow status indicators */
  status: {
    currentStep: WorkflowStep;
    progress: number;
    phase?: ProcessingPhase;
    isError: boolean;
    isComplete: boolean;
    isIdle: boolean;
    [key: string]: unknown;
  };
}

/**
 * Base hook for workflow management
 * Provides common functionality for domain-specific workflow hooks
 */
export function useBaseWorkflowHook(
  options: BaseWorkflowHookOptions
): BaseWorkflowHookResult {
  const { 
    userId, 
    initialStep = 'idle', 
    chatId, 
    domain,
    autoLoad = true
  } = options
  
  // Workflow state management
  const [state, setState] = useState<WorkflowState>({
    currentStep: initialStep,
    progress: 0,
    timestamp: new Date().toISOString(),
    metadata: {}
  })
  
  // Workflow identity
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  
  // Subscription management
  const [subscriptionChannel, setSubscriptionChannel] = useState<RealtimeChannel | null>(null)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  
  // Error handling
  const errorHandler = useWorkflowErrorHandler()
  
  /**
   * Load or create workflow state from DB using the workflowService
   */
  const loadOrCreateWorkflowState = useCallback(async () => {
    if (!userId) return null
    
    try {
      // Get or create workflow state
      const { id, data } = await workflowService.getOrCreateWorkflowForUser(
        userId,
        chatId,
        initialStep,
        { 
          progress: 0, 
          currentStep: initialStep, 
          createdAt: new Date().toISOString(),
          domain
        }
      )
      
      setWorkflowId(id)
      
      if (data) {
        const meta = (data.metadata as Record<string, unknown>) ?? {}
        setState((prevState) => ({
          ...prevState,
          currentStep: (meta.currentStep as WorkflowStep) || data.current_step as WorkflowStep,
          progress: typeof meta.progress === 'number' ? meta.progress : 0,
          phase: typeof meta.phase === 'string' ? meta.phase as ProcessingPhase : undefined,
          error: typeof meta.error === 'string' ? meta.error : null,
          metadata: meta,
          timestamp: data.timestamp || new Date().toISOString(),
        }))
      }
      
      return id
    } catch (error) {
      const normalizedError = normalizeError(error)
      await errorHandler.handleError(error, initialStep, {
        details: { userId, chatId, domain },
        showToast: true,
      })
      
      setSubscriptionError(normalizedError.message)
      return null
    }
  }, [userId, chatId, initialStep, domain, errorHandler])
  
  /**
   * Subscribe to workflow state changes
   */
  const subscribeToChanges = useCallback(() => {
    if (!userId) return
    
    try {
      // Unsubscribe from any existing channel first
      if (subscriptionChannel) {
        workflowService.unsubscribeFromChannel(subscriptionChannel)
      }
      
      // Subscribe to workflow changes
      const channel = workflowService.subscribeToWorkflowForUser(
        userId,
        chatId,
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const newData = payload.new as { 
            id: string; 
            metadata?: Record<string, unknown>; 
            current_step: string; 
            updated_at: string 
          };
          
          try {
            if (!newData) return
            
            // Extract metadata
            const meta = (newData.metadata as Record<string, unknown>) ?? {}
            
            // Update workflow ID if needed
            setWorkflowId(newData.id)
            
            // Update state with new data
            setState((prevState) => ({
              ...prevState,
              currentStep: (meta.currentStep as WorkflowStep) ?? (newData.current_step as WorkflowStep),
              progress: typeof meta.progress === 'number' ? meta.progress : 0,
              phase: typeof meta.phase === 'string' ? meta.phase as ProcessingPhase : undefined,
              error: typeof meta.error === 'string' ? meta.error : null,
              metadata: meta,
              timestamp: new Date(newData.updated_at).toISOString(),
            }))
          } catch (err) {
            const normalizedError = normalizeError(err)
            setSubscriptionError(normalizedError.message)
            
            void errorHandler.handleError(
              err,
              state.currentStep,
              { 
                details: { userId, chatId, payload, domain }, 
                showToast: true 
              }
            )
          }
        },
        (status) => {
          // Update connection status
          if (status === 'SUBSCRIBED') {
            setIsConnected(true)
            setSubscriptionError(null)
          } else if (status === 'CHANNEL_ERROR') {
            setIsConnected(false)
            setSubscriptionError('Connection error')
          } else if (status === 'TIMED_OUT') {
            setIsConnected(false)
            setSubscriptionError('Connection timed out')
          }
        }
      )
      
      setSubscriptionChannel(channel)
      
    } catch (error) {
      const normalizedError = normalizeError(error)
      setSubscriptionError(normalizedError.message)
      setIsConnected(false)
      
      void errorHandler.handleError(
        error,
        state.currentStep,
        { 
          details: { userId, chatId, domain }, 
          showToast: true 
        }
      )
    }
  }, [userId, chatId, subscriptionChannel, state.currentStep, domain, errorHandler])
  
  // Effect to load/create workflow state and subscribe to changes
  useEffect(() => {
    if (!userId || !autoLoad) return
    
    // Load or create the workflow state
    void loadOrCreateWorkflowState().then(() => {
      // Subscribe to changes after workflow is loaded
      subscribeToChanges()
    })
    
    // Cleanup subscription on unmount
    return () => {
      if (subscriptionChannel) {
        workflowService.unsubscribeFromChannel(subscriptionChannel)
        setSubscriptionChannel(null)
        setIsConnected(false)
      }
    }
  }, [userId, chatId, autoLoad, loadOrCreateWorkflowState, subscribeToChanges, subscriptionChannel])
  
  /**
   * Update workflow step
   */
  const updateStep = useCallback(
    async (
      step: WorkflowStep,
      metadata?: Record<string, unknown>,
      options?: UpdateStepOptions
    ): Promise<WorkflowState> => {
      try {
        // Update local state immediately for better UX
        const newState: WorkflowState = {
          ...state,
          currentStep: step,
          metadata: { 
            ...(state.metadata || {}), 
            ...metadata, 
            currentStep: step,
            domain
          },
          timestamp: new Date().toISOString(),
        }
        
        setState(newState)
        
        // Skip DB update if no workflowId
        if (!workflowId) {
          return newState
        }
        
        // Special case: if we have a chat message, use the combined function
        if (options?.withChatMessage && chatId) {
          const { content, role = 'system', metadata: messageMetadata } = options.withChatMessage
          
          await workflowService.updateWithChatMessage(
            workflowId,
            step,
            { 
              ...(metadata || {}), 
              currentStep: step,
              domain
            },
            content,
            role,
            messageMetadata || null
          )
          
          return newState
        }
        
        // Use conflict resolution if strategy specified
        if (options?.conflictStrategy) {
          await workflowService.updateWithConflictResolution(
            workflowId,
            step,
            { 
              ...(metadata || {}), 
              currentStep: step,
              domain 
            },
            {
              expectedTimestamp: state.timestamp,
              strategy: options.conflictStrategy
            }
          )
          
          return newState
        }
        
        // Standard update
        await workflowService.updateWorkflowState(
          workflowId,
          step,
          { 
            ...(metadata || {}), 
            currentStep: step,
            domain
          },
          {
            skipValidation: options?.skipValidation,
            useAtomicUpdate: true
          }
        )
        
        // Log step change
        await workflowService.logWorkflowEvent(
          workflowId,
          'step_changed',
          {
            from: state.currentStep,
            to: step,
            timestamp: new Date().toISOString(),
            metadata: metadata || {},
            domain
          }
        )
        
        return newState
      } catch (error) {
        await errorHandler.handleError(
          error,
          state.currentStep,
          {
            details: { step, metadata, options, domain },
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        )
        
        return state
      }
    },
    [state, workflowId, chatId, domain, errorHandler]
  )
  
  /**
   * Update workflow progress
   */
  const updateProgress = useCallback(
    async (progress: number, phase?: ProcessingPhase, notifyUsers?: boolean): Promise<WorkflowState> => {
      try {
        // Update local state immediately
        const newMeta = {
          ...state.metadata,
          progress,
          domain
        } as Record<string, unknown>
        
        if (phase) {
          newMeta.phase = phase
        }
        
        const newState: WorkflowState = {
          ...state,
          progress,
          phase,
          metadata: newMeta,
          timestamp: new Date().toISOString(),
        }
        
        setState(newState)
        
        // Update in database if we have a workflowId
        if (workflowId) {
          await workflowService.updateProgress(
            workflowId,
            progress,
            phase ?? ProcessingPhase.INITIALIZATION,
            state.currentStep,
            notifyUsers ?? true
          )
        }
        
        return newState
      } catch (error) {
        await errorHandler.handleError(
          error,
          state.currentStep,
          {
            details: { progress, phase, notifyUsers, domain },
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        )
        
        return state
      }
    },
    [state, workflowId, domain, errorHandler]
  )
  
  /**
   * Update progress with chat notification
   */
  const updateProgressWithNotification = useCallback(
    async (progress: number, phase: ProcessingPhase, messageContent: string): Promise<WorkflowState> => {
      try {
        // Update local state immediately
        const newMeta = {
          ...state.metadata,
          progress,
          phase,
          domain
        } as Record<string, unknown>
        
        const newState: WorkflowState = {
          ...state,
          progress,
          phase,
          metadata: newMeta,
          timestamp: new Date().toISOString(),
        }
        
        setState(newState)
        
        // Update with chat message if we have required IDs
        if (workflowId && chatId) {
          await workflowService.updateWithChatMessage(
            workflowId,
            state.currentStep,
            {
              progress,
              phase: phase.toString(),
              timestamp: new Date().toISOString(),
              domain
            },
            messageContent,
            'system',
            {
              type: 'progress_update',
              progress,
              phase: phase.toString(),
              domain
            }
          )
        }
        
        return newState
      } catch (error) {
        await errorHandler.handleError(
          error,
          state.currentStep,
          {
            details: { progress, phase, messageContent, domain },
            showToast: true,
            workflowId: workflowId ?? undefined
          }
        )
        
        return state
      }
    },
    [state, workflowId, chatId, domain, errorHandler]
  )
  
  /**
   * Reset workflow to idle state
   */
  const resetWorkflow = useCallback(async (): Promise<boolean> => {
    try {
      // Reset local state
      setState({
        currentStep: initialStep,
        progress: 0,
        timestamp: new Date().toISOString(),
        metadata: {
          domain
        }
      })
      
      // Reset in database if we have a workflowId
      if (workflowId) {
        await workflowService.updateWorkflowState(
          workflowId,
          initialStep,
          {
            progress: 0,
            error: null,
            domain,
            resetAt: new Date().toISOString()
          },
          { forceUpdate: true }
        )
      }
      
      return true
    } catch (error) {
      await errorHandler.handleError(
        error,
        state.currentStep,
        {
          details: { action: 'resetWorkflow', domain },
          showToast: true,
          workflowId: workflowId ?? undefined
        }
      )
      
      return false
    }
  }, [initialStep, workflowId, state.currentStep, domain, errorHandler])
  
  // Computed status object with common workflow status indicators
  const status = {
    currentStep: state.currentStep,
    progress: state.progress,
    phase: state.phase,
    isError: state.currentStep === DomainOnlyWorkflowStep.ERROR,
    isComplete: state.currentStep === 'complete',
    isIdle: state.currentStep === 'idle',
    // Domain-specific statuses can be added by consumers
  }
  
  return {
    state,
    workflowId,
    updateStep,
    updateProgress,
    updateProgressWithNotification,
    resetWorkflow,
    loadOrCreateWorkflowState,
    isConnected,
    subscriptionError,
    status
  }
}