import { useEffect, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { workflowService } from '@/lib/services/workflow/core/workflow-service'
import { normalizeError } from '@/lib/errors'
import { useWorkflowErrorHandler } from '@/lib/services/workflow/hooks/workflow-error-handler' // Import your error handler
import type { WorkflowState, WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow'

/**
 * Base options for the useBaseWorkflow hook.
 */
export interface UseBaseWorkflowOptions {
  userId?: string
  chatId?: string | null
  /** The initial step if the workflow doesn't yet exist in the DB */
  initialStep?: WorkflowStep
  /** Called when there's an unrecoverable error */
  onError?: (err: Error) => void
  /** Called when the workflow state changes */
  onStateChange?: (state: WorkflowState) => void
  /** Whether to automatically load the workflow on mount (default: true) */
  autoLoad?: boolean
}

/**
 * Hook return object
 */
export interface UseBaseWorkflow {
  workflowId: string | null
  state: WorkflowState
  isConnected: boolean
  subscriptionError: string | null
  loadOrCreateWorkflowState: () => Promise<string | null>
  updateStep: (
    step: WorkflowStep,
    metadata?: Record<string, unknown>,
    options?: {
      conflictStrategy?: 'fail' | 'force' | 'merge'
      skipValidation?: boolean
      withChatMessage?: {
        content: string
        role?: string
        metadata?: Record<string, unknown>
      }
    }
  ) => Promise<WorkflowState>
  updateProgress: (
    progress: number,
    phase?: ProcessingPhase,
    notifyUsers?: boolean
  ) => Promise<WorkflowState>
  updateProgressWithNotification: (
    progress: number,
    phase: ProcessingPhase,
    messageContent: string
  ) => Promise<WorkflowState>
  resetWorkflow: () => Promise<boolean>
  status: {
    currentStep: WorkflowStep
    progress: number
    phase?: ProcessingPhase
    isError: boolean
    isComplete: boolean
    isIdle: boolean
  }
}

/**
 * A single, centralized base workflow hook that manages:
 * - Loading/creating a workflow row
 * - Subscribing to changes
 * - Updating steps, progress, etc.
 * - Resetting to an initial step
 *
 * Domain-specific hooks (e.g. verification) can build on top of this hook,
 * adding specialized methods that call these base actions or external domain services.
 */
export function useBaseWorkflow(options: UseBaseWorkflowOptions = {}): UseBaseWorkflow {
  const {
    userId,
    chatId,
    initialStep = 'idle',
    onError,
    onStateChange,
    autoLoad = true
  } = options

  // Local workflow state
  const [state, setState] = useState<WorkflowState>({
    currentStep: initialStep,
    progress: 0,
    timestamp: new Date().toISOString(),
    metadata: {}
  })

  // Track the workflow DB ID
  const [workflowId, setWorkflowId] = useState<string | null>(null)

  // Subscription management
  const [subscriptionChannel, setSubscriptionChannel] = useState<RealtimeChannel | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)

  // Our error handler
  const errorHandler = useWorkflowErrorHandler()

  /**
   * Actually load or create the workflow row in DB, then set local state.
   */
  const loadOrCreateWorkflowState = useCallback(async (): Promise<string | null> => {
    if (!userId) return null

    try {
      const { id, data } = await workflowService.getOrCreateWorkflowForUser(
        userId,
        chatId ?? null,
        initialStep,
        {
          currentStep: initialStep,
          progress: 0,
          createdAt: new Date().toISOString()
        }
      )

      setWorkflowId(id)

      if (data) {
        const meta = (data.metadata as Record<string, unknown>) ?? {}
        setState((prevState) => ({
          ...prevState,
          currentStep: (meta.currentStep as WorkflowStep) || (data.current_step as WorkflowStep),
          progress: typeof meta.progress === 'number' ? meta.progress : 0,
          phase: typeof meta.phase === 'string' ? (meta.phase as ProcessingPhase) : undefined,
          error: typeof meta.error === 'string' ? meta.error : null,
          metadata: meta,
          timestamp: data.timestamp || new Date().toISOString()
        }))
      }

      return id
    } catch (err) {
      const normalized = normalizeError(err)
      setSubscriptionError(normalized.message)
      onError?.(normalized)
      await errorHandler.handleError(err, initialStep, {
        details: { userId, chatId },
        showToast: true
      })
      return null
    }
  }, [userId, chatId, initialStep, onError, errorHandler])

  /**
   * Subscribe to changes in the workflow DB row, updating local state.
   */
  const subscribeToChanges = useCallback(() => {
    if (!userId) return

    try {
      // Unsubscribe from old channel
      if (subscriptionChannel) {
        workflowService.unsubscribeFromChannel(subscriptionChannel)
      }

      // Subscribe to changes for user+chat
      const channel = workflowService.subscribeToWorkflowForUser(
        userId,
        chatId ?? null,
        (payload) => {
          const newData = payload.new as {
            id: string
            metadata?: Record<string, unknown>
            current_step: string
            updated_at: string
          }
          if (!newData) return

          const meta = (newData.metadata as Record<string, unknown>) ?? {}
          setWorkflowId(newData.id)
          setState((prevState) => {
            const updatedState: WorkflowState = {
              ...prevState,
              currentStep: (meta.currentStep as WorkflowStep) ?? (newData.current_step as WorkflowStep),
              progress: typeof meta.progress === 'number' ? meta.progress : 0,
              phase: typeof meta.phase === 'string' ? (meta.phase as ProcessingPhase) : undefined,
              error: typeof meta.error === 'string' ? meta.error : null,
              metadata: meta,
              timestamp: new Date(newData.updated_at).toISOString()
            }
            onStateChange?.(updatedState)
            return updatedState
          })
        },
        (status) => {
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
    } catch (err) {
      const normalized = normalizeError(err)
      setSubscriptionError(normalized.message)
      setIsConnected(false)
      onError?.(normalized)
      errorHandler.handleError(err, state.currentStep, {
        details: { userId, chatId },
        showToast: true
      })
    }
  }, [userId, chatId, subscriptionChannel, onError, errorHandler, state.currentStep, onStateChange])

  // On mount, load (or create) workflow + subscribe (if autoLoad)
  useEffect(() => {
    if (!userId || !autoLoad) return

    void loadOrCreateWorkflowState().then(() => {
      subscribeToChanges()
    })

    return () => {
      if (subscriptionChannel) {
        workflowService.unsubscribeFromChannel(subscriptionChannel)
        setSubscriptionChannel(null)
        setIsConnected(false)
      }
    }
  }, [userId, autoLoad, chatId, loadOrCreateWorkflowState, subscribeToChanges, subscriptionChannel])

  /**
   * Update the workflow step in DB (and local state) with optional conflict resolution and chat message.
   */
  const updateStep = useCallback(
    async (
      step: WorkflowStep,
      metadata?: Record<string, unknown>,
      options?: {
        conflictStrategy?: 'fail' | 'force' | 'merge'
        skipValidation?: boolean
        withChatMessage?: {
          content: string
          role?: string
          metadata?: Record<string, unknown>
        }
      }
    ): Promise<WorkflowState> => {
      // Immediately update local for smoother UI
      const newMetadata = {
        ...(state.metadata || {}),
        ...metadata,
        currentStep: step
      }
      const newState: WorkflowState = {
        ...state,
        currentStep: step,
        metadata: newMetadata,
        timestamp: new Date().toISOString()
      }
      setState(newState)
      onStateChange?.(newState)

      // If no workflowId, skip DB update
      if (!workflowId) {
        return newState
      }

      try {
        // If we have a chat message
        if (options?.withChatMessage && chatId) {
          const { content, role = 'system', metadata: msgMetadata } = options.withChatMessage
          await workflowService.updateWithChatMessage(
            workflowId,
            step,
            newMetadata,
            content,
            role,
            msgMetadata || null
          )
          return newState
        }

        // If conflict resolution is specified
        if (options?.conflictStrategy) {
          await workflowService.updateWithConflictResolution(
            workflowId,
            step,
            newMetadata,
            {
              expectedTimestamp: state.timestamp,
              strategy: options.conflictStrategy
            }
          )
          return newState
        }

        // Otherwise standard update
        await workflowService.updateWorkflowState(
          workflowId,
          step,
          newMetadata,
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
            metadata: metadata || {}
          }
        )

        return newState
      } catch (err) {
        const normalized = normalizeError(err)
        onError?.(normalized)
        await errorHandler.handleError(err, state.currentStep, {
          details: { step, metadata, options },
          showToast: true,
          workflowId: workflowId ?? undefined
        })
        return state
      }
    },
    [chatId, errorHandler, onError, onStateChange, state, workflowId]
  )

  /**
   * Update workflow progress (local + DB).
   */
  const updateProgress = useCallback(
    async (progress: number, phase?: ProcessingPhase, notifyUsers?: boolean): Promise<WorkflowState> => {
      // Local state update
      const newMeta = {
        ...state.metadata,
        progress
      } as Record<string, unknown>
      if (phase !== undefined) {
        newMeta.phase = phase
      }
      const newState: WorkflowState = {
        ...state,
        progress,
        phase,
        metadata: newMeta,
        timestamp: new Date().toISOString()
      }
      setState(newState)
      onStateChange?.(newState)

      // If we have a workflowId, update in DB
      if (workflowId) {
        try {
          await workflowService.updateProgress(
            workflowId,
            progress,
            phase ?? ProcessingPhase.INITIALIZATION,
            state.currentStep,
            notifyUsers ?? true
          )
        } catch (err) {
          const normalized = normalizeError(err)
          onError?.(normalized)
          await errorHandler.handleError(err, state.currentStep, {
            details: { progress, phase, notifyUsers },
            showToast: true,
            workflowId
          })
        }
      }

      return newState
    },
    [state, workflowId, onError, onStateChange, errorHandler]
  )

  /**
   * Update progress with a chat message notification.
   */
  const updateProgressWithNotification = useCallback(
    async (progress: number, phase: ProcessingPhase, messageContent: string): Promise<WorkflowState> => {
      // Local state
      const newMeta = {
        ...state.metadata,
        progress,
        phase
      }
      const newState: WorkflowState = {
        ...state,
        progress,
        phase,
        metadata: newMeta,
        timestamp: new Date().toISOString()
      }
      setState(newState)
      onStateChange?.(newState)

      if (workflowId && chatId) {
        try {
          await workflowService.updateWithChatMessage(
            workflowId,
            state.currentStep,
            {
              progress,
              phase: phase.toString(),
              timestamp: new Date().toISOString()
            },
            messageContent,
            'system',
            {
              type: 'progress_update',
              progress,
              phase: phase.toString()
            }
          )
        } catch (err) {
          const normalized = normalizeError(err)
          onError?.(normalized)
          await errorHandler.handleError(err, state.currentStep, {
            details: { progress, phase, messageContent },
            showToast: true,
            workflowId
          })
        }
      }

      return newState
    },
    [state, workflowId, chatId, onError, onStateChange, errorHandler]
  )

  /**
   * Reset the workflow back to the initial step (idle by default).
   */
  const resetWorkflow = useCallback(async (): Promise<boolean> => {
    // Immediately reset local
    const resetState: WorkflowState = {
      currentStep: initialStep,
      progress: 0,
      timestamp: new Date().toISOString(),
      metadata: {}
    }
    setState(resetState)
    onStateChange?.(resetState)

    // Reset in DB
    if (workflowId) {
      try {
        await workflowService.updateWorkflowState(
          workflowId,
          initialStep,
          {
            progress: 0,
            error: null,
            resetAt: new Date().toISOString()
          },
          { forceUpdate: true }
        )
      } catch (err) {
        const normalized = normalizeError(err)
        onError?.(normalized)
        await errorHandler.handleError(err, state.currentStep, {
          details: { action: 'resetWorkflow' },
          showToast: true,
          workflowId
        })
        return false
      }
    }

    return true
  }, [initialStep, workflowId, state.currentStep, onError, onStateChange, errorHandler])

  // Computed status
  const status = {
    currentStep: state.currentStep,
    progress: state.progress,
    phase: state.phase,
    isError: state.currentStep === DomainOnlyWorkflowStep.ERROR,
    isComplete: state.currentStep === 'complete',
    isIdle: state.currentStep === 'idle'
  }

  return {
    workflowId,
    state,
    isConnected,
    subscriptionError,
    loadOrCreateWorkflowState,
    updateStep,
    updateProgress,
    updateProgressWithNotification,
    resetWorkflow,
    status
  }
}