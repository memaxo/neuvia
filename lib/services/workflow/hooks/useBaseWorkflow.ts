import { useEffect, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { workflowManager } from '@/lib/services/workflow/core/workflow-manager'
import { normalizeError } from '@/lib/errors'
import { useWorkflowErrorHandler } from '@/lib/services/workflow/hooks/workflow-error-handler'
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
 * A simplified base workflow hook that manages:
 * - Loading/creating a workflow row
 * - Subscribing to changes
 * - Updating steps, progress, etc.
 * - Resetting to an initial step
 *
 * STATE MANAGEMENT ARCHITECTURE:
 * ------------------------------
 * This hook implements a dual-state pattern:
 *
 * 1. LOCAL STATE (React useState):
 *    - Maintains UI-responsive workflow state
 *    - Updates immediately for better UX without waiting for network
 *    - Used for rendering components and immediate feedback
 *    - May temporarily get ahead of persistent state during operations
 *
 * 2. PERSISTENT STATE (Database via WorkflowManager):
 *    - Source of truth for workflow state
 *    - Persists across sessions and page refreshes
 *    - Accessible to other users/systems via Supabase
 *    - Updates may have network latency
 *
 * 3. REALTIME SYNC:
 *    - Subscribes to DB changes to keep local state in sync
 *    - Handles multi-user scenarios and external updates
 *    - Resolves potential conflicts between local and persistent state
 *
 * WHEN TO USE WHICH STATE:
 * - For reads/display: Use local state (fast, always available)
 * - For critical operations: Wait for persistent state confirmation
 * - For multi-user coordination: Rely on persistent state + subscriptions
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

  // LOCAL STATE: UI-responsive workflow state (not persisted)
  // This state updates immediately for responsive UI feedback
  const [state, setState] = useState<WorkflowState>({
    currentStep: initialStep,
    progress: 0,
    timestamp: new Date().toISOString(),
    metadata: {}
  })

  // Track the workflow DB ID (links local state to persistent state)
  const [workflowId, setWorkflowId] = useState<string | null>(null)

  // REALTIME SUBSCRIPTION: Keeps local state in sync with database
  const [subscriptionChannel, setSubscriptionChannel] = useState<RealtimeChannel | null>(null)
  const [isConnected, setIsConnected] = useState(false)
// Handle workflow error
const handleError = useCallback((error: Error | string | ResultError, options: ErrorHandlerOptions = {}) => {
  let errorMessage: string;
  let errorCode: string = 'UNKNOWN_ERROR';
  let errorDetails: Record<string, unknown> = {};
  
  // Handle different error types
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (isResultError(error)) {
    // It's a ResultError from the Result pattern
    errorMessage = error.message;
    errorCode = error.code;
    errorDetails = error.details || {};
  } else {
    // It's a regular Error object
    errorMessage = error.message;
    errorCode = (error as any).code || 'UNKNOWN_ERROR';
    errorDetails = { originalError: error };
  }
  
  const { preserveState = false } = options;

  /**
   * Load or create the workflow row in DB, then set local state.
   *
   * PERSISTENT STATE INTERACTION:
   * 1. Fetches existing workflow from database or creates new one
   * 2. Updates local state to match persistent state
   * 3. Returns workflowId for future reference
   *
   * This is the primary method to initialize state synchronization
   * between local and persistent state.
   */
  const loadOrCreateWorkflowState = useCallback(async (): Promise<string | null> => {
    if (!userId) return null

    try {
      // DATABASE OPERATION: Get or create workflow record in persistent storage
      const { id, state } = await workflowManager.getOrCreateForUser(
        userId,
        chatId ?? null,
        initialStep,
        {
          currentStep: initialStep,
          progress: 0,
          createdAt: new Date().toISOString()
        }
      )

      // LOCAL STATE UPDATE: Sync local state with database state
      setWorkflowId(id)
      setState(state)
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
   *
   * PERSISTENT STATE INTERACTION:
   * 1. Establishes a realtime connection to database via Supabase
   * 2. Automatically updates local state when database changes
   * 3. Handles various subscription states (connected, error, timeout)
   *
   * This bidirectional sync ensures:
   * - Local state stays updated with external changes
   * - Multi-user scenarios work correctly
   * - UI remains consistent with backend state
   */
  const subscribeToChanges = useCallback(() => {
    if (!userId) return

    try {
      // Unsubscribe from old channel
      if (subscriptionChannel) {
        workflowManager.unsubscribeFromChannel(subscriptionChannel)
      }

      // DATABASE SUBSCRIPTION: Listen for changes to workflow in database
      const channel = workflowManager.subscribeToWorkflowForUser(
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

          // SYNC FROM DATABASE TO LOCAL: Update local state with latest from database
          // This may override local state changes if database was updated externally
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
        {
          // SUBSCRIPTION STATUS: Track connection status for error handling and UI feedback
          onStatusChange: (status) => {
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
        workflowManager.unsubscribeFromChannel(subscriptionChannel)
        setSubscriptionChannel(null)
        setIsConnected(false)
      }
    }
  }, [userId, autoLoad, chatId, loadOrCreateWorkflowState, subscribeToChanges, subscriptionChannel])

  /**
   * Update the workflow step in DB (and local state)
   *
   * STATE UPDATE PATTERN:
   * 1. OPTIMISTIC LOCAL UPDATE: Immediately updates local state for responsive UI
   * 2. PERSISTENT UPDATE: Asynchronously updates database
   * 3. ERROR HANDLING: Reverts to previous state if database update fails
   *
   * The optimistic update pattern provides immediate feedback to users
   * while ensuring data is eventually consistent with the database.
   */
  const updateStep = useCallback(
    async (
      step: WorkflowStep,
      metadata?: Record<string, unknown>,
      options?: {
        skipValidation?: boolean
        withChatMessage?: {
          content: string
          role?: string
          metadata?: Record<string, unknown>
        }
      }
    ): Promise<WorkflowState> => {
      // OPTIMISTIC LOCAL UPDATE: Immediately update local state for responsive UI
      // This happens before the database operation completes
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

      // If no workflowId, skip DB update (local-only mode)
      if (!workflowId) {
        return newState
      }

      try {
        // PERSISTENT STATE UPDATE: Save changes to database
        // Choose update strategy based on options
        if (options?.withChatMessage && chatId) {
          // DATABASE UPDATE WITH ATOMICITY: Update workflow and add chat message in one operation
          const { content, role = 'system', metadata: msgMetadata } = options.withChatMessage
          await workflowManager.updateWithChatMessage(
            workflowId,
            step,
            newMetadata,
            content,
            role,
            msgMetadata || null
          )
          return newState
        }

        // STANDARD DATABASE UPDATE: Update just the workflow state
        await workflowManager.updateState(
          workflowId,
          step,
          newMetadata,
          {
            skipValidation: options?.skipValidation
          }
        )

        return newState
      } catch (err) {
        // ERROR HANDLING: If database update fails, we should notify but keep local state
        // Note: The subscription might later override local state with database state
        const normalized = normalizeError(err)
        onError?.(normalized)
        await errorHandler.handleError(err, state.currentStep, {
          details: { step, metadata, options },
          showToast: true,
          workflowId: workflowId ?? undefined
        })
        return state // Return original state on error
      }
    },
    [chatId, errorHandler, onError, onStateChange, state, workflowId]
  )

  /**
   * Update workflow progress (local + DB).
   *
   * STATE UPDATE PATTERN:
   * 1. OPTIMISTIC LOCAL UPDATE: Immediately updates progress in local state
   * 2. PERSISTENT UPDATE: Asynchronously updates progress in database
   * 3. NOTIFICATION: Optionally notifies others about progress changes
   *
   * Progress updates are frequent and non-critical, so we prioritize
   * UI responsiveness over perfect consistency.
   */
  const updateProgress = useCallback(
    async (progress: number, phase?: ProcessingPhase, notifyUsers?: boolean): Promise<WorkflowState> => {
      // OPTIMISTIC LOCAL UPDATE: Update progress immediately for responsive UI
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

      // PERSISTENT STATE UPDATE: If we have a workflowId, update progress in database
      if (workflowId) {
        if (workflowId) {
        try {
          const progressResult = await workflowManager.updateProgress(
            workflowId,
            progress,
            phase ?? ProcessingPhase.INITIALIZATION,
            {
              currentStep: state.currentStep,
              notifyUsers: notifyUsers ?? true
            }
          );
          if (progressResult.isFailure()) {
            throw new Error(progressResult.error.message);
          }
        } catch (err) {
          const normalized = normalizeError(err);
          onError?.(normalized);
          await errorHandler.handleError(err, state.currentStep, {
            details: { progress, phase, notifyUsers },
            showToast: true,
            workflowId
          });
        }
      }
      }

      return newState
    },
    [state, workflowId, onError, onStateChange, errorHandler]
  )

  /**
   * Update progress with a chat message notification.
   *
   * STATE UPDATE PATTERN:
   * 1. OPTIMISTIC LOCAL UPDATE: Immediately updates progress locally
   * 2. PERSISTENT UPDATE WITH NOTIFICATION: Updates database and creates chat message
   *
   * This combines progress updates with user notifications in a single
   * database operation for atomicity.
   */
  const updateProgressWithNotification = useCallback(
    async (progress: number, phase: ProcessingPhase, messageContent: string): Promise<WorkflowState> => {
      // OPTIMISTIC LOCAL UPDATE: Update progress immediately for responsive UI
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

      // PERSISTENT STATE UPDATE WITH NOTIFICATION: Update database and notify users
      if (workflowId && chatId) {
        try {
          const result = await workflowManager.updateWithChatMessage(
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
          );
          if (!result.success) {
            throw new Error("Failed to update workflow with chat message");
          }
        } catch (err) {
          const normalized = normalizeError(err);
          onError?.(normalized);
          await errorHandler.handleError(err, state.currentStep, {
            details: { progress, phase, messageContent },
            showToast: true,
            workflowId
          });
        }
      }

      return newState
    },
    [state, workflowId, chatId, onError, onStateChange, errorHandler]
  )

  /**
   * Reset the workflow back to the initial step (idle by default).
   *
   * STATE UPDATE PATTERN:
   * 1. IMMEDIATE LOCAL RESET: Clears local state completely
   * 2. PERSISTENT RESET: Resets database state to initial values
   *
   * This is a destructive operation that clears both local and persistent state.
   * Use with caution as it cannot be undone.
   */
  const resetWorkflow = useCallback(async (): Promise<boolean> => {
    // IMMEDIATE LOCAL RESET: Clear local state completely
    const resetState: WorkflowState = {
      currentStep: initialStep,
      progress: 0,
      timestamp: new Date().toISOString(),
      metadata: {}
    }
    setState(resetState)
    onStateChange?.(resetState)

    // PERSISTENT STATE RESET: Clear database state
    if (workflowId) {
      try {
        // DATABASE OPERATION: Reset workflow state in persistent storage
        await workflowManager.reset(
          workflowId,
          initialStep,
          {
            resetAt: new Date().toISOString(),
            userId
          }
        )
      } catch (err) {
        // ERROR HANDLING: Notify about reset failure, but keep local state reset
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
  }, [initialStep, workflowId, state.currentStep, onError, onStateChange, errorHandler, userId])

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