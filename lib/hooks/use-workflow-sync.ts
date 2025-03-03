'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { workflowService } from '@/lib/services/workflow/workflow-service'
import { useChatStore } from '@/stores/chat-store'
import type { WorkflowStep } from '@/lib/workflow/types'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { validateWorkflowTransition } from '@/lib/workflow/workflow-manager'
import { workflowStateManager } from '@/lib/services/workflow/workflow-state-manager'
import { WorkflowStateError, normalizeError } from '@/lib/errors'

/**
 * Synchronizes the local workflow state with Supabase realtime updates.
 * 
 * This hook establishes a subscription to workflow_states table changes,
 * allowing multiple users to see real-time updates to workflow status.
 * It includes optimistic updates and robust conflict resolution.
 * 
 * @param workflowId - The ID of the workflow to synchronize (optional, defaults to localStorage)
 * @returns Object containing synchronization status, connection state, and methods
 */
export function useWorkflowSync(workflowId?: string) {
  // Local state for subscription status
  const [isConnected, setIsConnected] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Track pending transaction IDs
  const [pendingTransactions, setPendingTransactions] = useState<string[]>([])
  
  // Track the channel reference for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  // Effective workflow ID after resolving from props or localStorage
  const effectiveWorkflowIdRef = useRef<string | null>(null)
  
  // Get workflow update methods from store
  const updateWorkflowStep = useChatStore(state => state.updateWorkflowStep)

  // Fetch current workflow state with advanced options
  const fetchCurrentWorkflowState = useCallback(async (
    id: string,
    options: { 
      bypassCache?: boolean;
      includeTransactions?: boolean;
      forceUpdate?: boolean;
    } = {}
  ) => {
    try {
      const state = await workflowService.getWorkflowState(id, {
        bypassCache: options.bypassCache,
        includeTransactions: options.includeTransactions
      })
      
      if (!state) throw new Error('No workflow state found')
      
      // Don't update if the steps are the same (prevents loops)
      const currentStep = useChatStore.getState().workflow.currentStep
      if (currentStep !== state.step || options.forceUpdate) {
        // Update the local state with remote state
        updateWorkflowStep(state.step, {
          ...state.metadata,
          _syncSource: 'fetch',
          _syncedAt: new Date().toISOString(),
          _version: state.version
        })
        setLastSyncedAt(new Date())
      }
      
      return state
    } catch (err) {
      console.error('Error fetching current workflow state:', err)
      const normalizedError = normalizeError(err)
      setError(`Failed to fetch current state: ${normalizedError.message}`)
      throw normalizedError
    }
  }, [updateWorkflowStep])
  
  // Process workflow updates from Supabase
  const handleWorkflowUpdate = useCallback((payload: RealtimePostgresChangesPayload<{
    current_step: string
    metadata: Record<string, any>
  }>) => {
    // Extract new data from payload
    const { current_step, metadata } = payload.new
    
    // Determine application-specific step from database step
    let appStep: WorkflowStep = current_step as WorkflowStep
    
    // If there's custom step mapping in the metadata, use it
    if (metadata?.originalStep) {
      appStep = metadata.originalStep as WorkflowStep
    } else if (metadata?.appStep) {
      appStep = metadata.appStep as WorkflowStep
    }
    
    // Get transaction ID if available
    const transactionId = metadata?._transactionId
    
    // Check if this is one of our pending transactions
    if (transactionId && pendingTransactions.includes(transactionId)) {
      // This is our own transaction that completed, so remove it from pending
      setPendingTransactions(prev => prev.filter(id => id !== transactionId))
      
      // Don't update state since we've already applied it optimistically
      // Just mark last synced for tracking
      setLastSyncedAt(new Date())
      return
    }
    
    // Don't update if it's our own change (check for _localUpdate and _clientId flags)
    if (metadata?._localUpdate && metadata?._clientId === workflowService.getClientId()) {
      return
    }
    
    // Don't update if the steps are the same (prevents loops)
    const currentStep = useChatStore.getState().workflow.currentStep
    if (currentStep !== appStep) {
      // Validate the transition even for remote updates
      const validationResult = validateWorkflowTransition(currentStep, appStep, metadata)
      
      if (!validationResult.isValid) {
        console.warn(
          `Remote workflow transition validation failed from '${currentStep}' to '${appStep}':`,
          validationResult.error
        )
        
        // Log the validation error but allow the transition (with warning)
        const validationError = new WorkflowStateError({
          message: validationResult.error || 'Invalid remote workflow transition',
          transition: { from: currentStep, to: appStep },
          data: {
            source: 'remote',
            details: validationResult.details,
            metadata
          }
        })
        
        // Record the validation warning in the metadata
        metadata._validationWarning = {
          message: validationError.message,
          details: validationResult.details,
          from: currentStep,
          to: appStep,
          timestamp: new Date().toISOString()
        }
        
        setError(`Remote workflow update validation warning: ${validationError.message}`)
      }
      
      // Add a flag to prevent loop-back updates and include validation info
      const enrichedMetadata = {
        ...metadata,
        _syncedFromRemote: true,
        _syncedAt: new Date().toISOString(),
        _validationResult: validationResult.isValid ? 'valid' : 'invalid_but_allowed'
      }
      
      // If this update includes conflict resolution info, add diagnostic data
      if (metadata?._conflictResolution || metadata?._conflictResolved) {
        enrichedMetadata._conflictInfo = {
          detectedAt: new Date().toISOString(),
          currentLocalStep: currentStep,
          remoteStep: appStep,
          strategy: metadata?._conflictResolution?.strategy || 'unknown'
        }
      }
      
      // Update the local state with remote state, even if validation failed
      // This keeps clients in sync even if transitions are technically invalid
      updateWorkflowStep(appStep, enrichedMetadata)
      setLastSyncedAt(new Date())
    }
  }, [updateWorkflowStep, pendingTransactions])

  // Update workflow with optimistic UI
  const updateWorkflowOptimistically = useCallback(async (
    step: WorkflowStep,
    metadata: Record<string, any> = {},
    options: {
      optimistic?: boolean;
      conflictStrategy?: 'client-wins' | 'server-wins' | 'merge' | 'manual';
      forceUpdate?: boolean;
    } = {}
  ): Promise<string> => {
    if (!effectiveWorkflowIdRef.current) {
      throw new Error('No workflow ID available for update')
    }
    
    try {
      // Perform the update with transaction tracking
      const transactionId = await workflowService.updateWorkflowState(
        effectiveWorkflowIdRef.current,
        step,
        {
          ...metadata,
          _source: 'optimistic_update',
          _clientTimestamp: new Date().toISOString()
        },
        options
      )
      
      // Add to pending transactions for tracking
      if (options.optimistic !== false) {
        setPendingTransactions(prev => [...prev, transactionId])
      }
      
      return transactionId
    } catch (err) {
      setError(`Failed to update workflow: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }, [])
  
  // Check transaction status
  const checkTransactionStatus = useCallback(async (transactionId: string) => {
    if (!transactionId) return null
    
    try {
      return await workflowService.getTransactionStatus(transactionId)
    } catch (err) {
      console.error('Error checking transaction status:', err)
      return {
        status: 'error' as const,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }, [])

  useEffect(() => {
    // Get workflow ID from localStorage if not provided
    effectiveWorkflowIdRef.current = workflowId || workflowStateManager.getCurrentWorkflowId()
    
    if (!effectiveWorkflowIdRef.current) {
      setError('No workflow ID available for synchronization')
      return
    }

    // Initialize the connection
    const setupRealtimeSubscription = async () => {
      try {
        // Create a new realtime channel through the workflow service
        const channel = workflowService.subscribeToWorkflowChanges(
          effectiveWorkflowIdRef.current!,
          handleWorkflowUpdate,
          (status) => {
            // Update connection status
            setIsConnected(status === 'SUBSCRIBED')
            if (status === 'SUBSCRIBED') {
              setLastSyncedAt(new Date())
              setError(null)
            } else if (status === 'CHANNEL_ERROR') {
              setError('Error connecting to realtime updates')
            }
          }
        )

        // Store channel reference for cleanup
        channelRef.current = channel
        
        // Fetch initial state to ensure we're in sync
        await fetchCurrentWorkflowState(effectiveWorkflowIdRef.current!, {
          includeTransactions: true
        })
      } catch (err) {
        console.error('Error setting up realtime subscription:', err)
        setError(`Failed to initialize sync: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Set up the subscription
    setupRealtimeSubscription()

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        workflowService.unsubscribeFromChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [workflowId, fetchCurrentWorkflowState, handleWorkflowUpdate])

  // Return sync status and enhanced methods
  return {
    isConnected,
    lastSyncedAt,
    error,
    pendingTransactions,
    
    // Force a manual sync with the database
    forceSync: async (options: { bypassCache?: boolean } = {}) => {
      if (!effectiveWorkflowIdRef.current) {
        setError('No workflow ID available for synchronization')
        return false
      }
      
      try {
        await fetchCurrentWorkflowState(effectiveWorkflowIdRef.current, {
          bypassCache: options.bypassCache ?? true,
          forceUpdate: true
        })
        return true
      } catch (err) {
        console.error('Error during force sync:', err)
        setError(`Force sync failed: ${err instanceof Error ? err.message : String(err)}`)
        return false
      }
    },
    
    // Update workflow with optimistic updates
    updateWorkflow: updateWorkflowOptimistically,
    
    // Check transaction status
    checkTransaction: checkTransactionStatus,
    
    // Get client ID for transaction tracking
    getClientId: () => workflowService.getClientId?.() || 'unknown',
    
    // Resolve a conflict manually if needed
    resolveConflict: async (
      transactionId: string,
      resolution: 'local' | 'remote' | 'custom',
      customState?: {
        step: WorkflowStep;
        metadata?: Record<string, any>;
      }
    ) => {
      if (!effectiveWorkflowIdRef.current) {
        throw new Error('No workflow ID available')
      }
      
      try {
        // First get transaction status
        const txStatus = await checkTransactionStatus(transactionId)
        
        if (!txStatus || txStatus.status !== 'conflict') {
          throw new Error(`Transaction ${transactionId} is not in conflict state or not found`)
        }
        
        // Get current state from database
        const currentState = await workflowService.getWorkflowState(
          effectiveWorkflowIdRef.current,
          { bypassCache: true }
        )
        
        if (!currentState) {
          throw new Error('Could not fetch current workflow state')
        }
        
        // Handle different resolution strategies
        let resolvedState: { 
          step: WorkflowStep; 
          metadata: Record<string, any> 
        }
        
        if (resolution === 'remote') {
          // Use remote state as is - just add resolution info
          resolvedState = {
            step: currentState.step,
            metadata: {
              ...currentState.metadata,
              _manualResolution: {
                strategy: 'remote',
                transactionId,
                timestamp: new Date().toISOString()
              }
            }
          }
        } else if (resolution === 'local') {
          // Get the local state from the conflict metadata
          const localState = currentState.metadata?._conflict?.localState
          
          if (!localState) {
            throw new Error('Cannot find local state in conflict data')
          }
          
          resolvedState = {
            step: localState.step as WorkflowStep,
            metadata: {
              ...localState.metadata,
              _manualResolution: {
                strategy: 'local',
                transactionId,
                timestamp: new Date().toISOString()
              }
            }
          }
        } else if (resolution === 'custom' && customState) {
          // Use provided custom state
          resolvedState = {
            step: customState.step,
            metadata: {
              ...(customState.metadata || {}),
              _manualResolution: {
                strategy: 'custom',
                transactionId,
                timestamp: new Date().toISOString()
              }
            }
          }
        } else {
          throw new Error('Invalid resolution strategy or missing custom state')
        }
        
        // Force update with the resolved state
        const newTxId = await workflowService.updateWorkflowState(
          effectiveWorkflowIdRef.current,
          resolvedState.step,
          resolvedState.metadata,
          { forceUpdate: true, optimistic: false }
        )
        
        return {
          success: true,
          transactionId: newTxId
        }
      } catch (err) {
        console.error('Error resolving conflict:', err)
        setError(`Conflict resolution failed: ${err instanceof Error ? err.message : String(err)}`)
        
        throw err
      }
    }
  }
}