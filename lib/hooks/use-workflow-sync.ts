'use client'

import { useEffect, useState, useRef } from 'react'
import { workflowService } from '@/lib/services/workflow/workflow-service'
import { useChatStore } from '@/stores/chat-store'
import type { WorkflowStep } from '@/lib/workflow/types'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { validateWorkflowTransition } from '@/lib/workflow/workflow-manager'
import { workflowStateManager } from '@/lib/services/workflow/workflow-state-manager'
import { WorkflowStateError } from '@/lib/errors'

/**
 * Synchronizes the local workflow state with Supabase realtime updates.
 * 
 * This hook establishes a subscription to workflow_states table changes,
 * allowing multiple users to see real-time updates to workflow status.
 * 
 * @param workflowId - The ID of the workflow to synchronize (optional, defaults to localStorage)
 * @returns Object containing synchronization status and connection state
 */
export function useWorkflowSync(workflowId?: string) {
  // Local state for subscription status
  const [isConnected, setIsConnected] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Track the channel reference for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  // Get workflow update methods from store
  const updateWorkflowStep = useChatStore(state => state.updateWorkflowStep)

  useEffect(() => {
    // Get workflow ID from localStorage if not provided
    const effectiveWorkflowId = workflowId || localStorage.getItem('current_workflow_id')
    
    if (!effectiveWorkflowId) {
      setError('No workflow ID available for synchronization')
      return
    }

    // Initialize the connection
    const setupRealtimeSubscription = async () => {
      try {
        // Create a new realtime channel through the workflow service
        const channel = workflowService.subscribeToWorkflowChanges(
          effectiveWorkflowId,
          (payload) => {
            // Handle the database update
            handleWorkflowUpdate(payload)
          },
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
        await fetchCurrentWorkflowState(effectiveWorkflowId)
      } catch (err) {
        console.error('Error setting up realtime subscription:', err)
        setError(`Failed to initialize sync: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Fetch current workflow state to ensure we're in sync
    const fetchCurrentWorkflowState = async (id: string) => {
      try {
        const state = await workflowService.getWorkflowState(id)
        
        if (!state) throw new Error('No workflow state found')
        
        // Don't update if the steps are the same (prevents loops)
        const currentStep = useChatStore.getState().workflow.currentStep
        if (currentStep !== state.step) {
          // Update the local state with remote state
          updateWorkflowStep(state.step, state.metadata || {})
          setLastSyncedAt(new Date())
        }
      } catch (err) {
        console.error('Error fetching current workflow state:', err)
        setError(`Failed to fetch current state: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Process workflow updates from Supabase
    const handleWorkflowUpdate = (payload: RealtimePostgresChangesPayload<{
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
      }
      
      // Don't update if it's our own change (check for _localUpdate flag)
      if (metadata?._localUpdate) {
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
        
        // Update the local state with remote state, even if validation failed
        // This keeps clients in sync even if transitions are technically invalid
        updateWorkflowStep(appStep, enrichedMetadata)
        setLastSyncedAt(new Date())
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
  }, [workflowId, updateWorkflowStep])

  // Return sync status and methods
  return {
    isConnected,
    lastSyncedAt,
    error,
    
    // Force a manual sync with the database
    forceSync: async () => {
      const effectiveWorkflowId = workflowId || workflowStateManager.getCurrentWorkflowId()
      if (!effectiveWorkflowId) {
        setError('No workflow ID available for synchronization')
        return false
      }
      
      try {
        const state = await workflowService.getWorkflowState(effectiveWorkflowId)
        
        if (!state) throw new Error('No workflow state found')
        
        // Get current step from store for validation
        const currentStep = useChatStore.getState().workflow.currentStep
        
        // Validate the transition if steps are different
        if (currentStep !== state.step) {
          const validationResult = validateWorkflowTransition(currentStep, state.step, state.metadata)
          
          if (!validationResult.isValid) {
            console.warn(
              `Force sync validation warning - transition from '${currentStep}' to '${state.step}' is invalid:`,
              validationResult.error
            )
            
            // Add validation warning to metadata
            state.metadata = {
              ...state.metadata,
              _validationWarning: {
                message: validationResult.error || 'Invalid forced transition',
                details: validationResult.details,
                from: currentStep,
                to: state.step,
                timestamp: new Date().toISOString()
              }
            }
          }
        }
        
        // Update the local state with remote state
        updateWorkflowStep(state.step, {
          ...state.metadata,
          _forceSynced: true,
          _syncedAt: new Date().toISOString(),
          _validation: currentStep !== state.step 
            ? { result: validationResult.isValid ? 'valid' : 'invalid_but_forced' }
            : { result: 'same_step' }
        })
          
        setLastSyncedAt(new Date())
        return true
      } catch (err) {
        console.error('Error during force sync:', err)
        setError(`Force sync failed: ${err instanceof Error ? err.message : String(err)}`)
        return false
      }
    }
  }
}