'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase/clients'
import { useChatStore } from '@/stores/chat-store'
import type { WorkflowStep } from '@/lib/workflow/types'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

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

    const supabase = createBrowserClient()
    
    // Initialize the connection
    const setupRealtimeSubscription = async () => {
      try {
        // Create a new realtime channel
        const channel = supabase
          .channel(`workflow-${effectiveWorkflowId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'workflow_states',
              filter: `id=eq.${effectiveWorkflowId}`
            },
            (payload: RealtimePostgresChangesPayload<{
              current_step: string
              metadata: Record<string, any>
            }>) => {
              // Handle the database update
              handleWorkflowUpdate(payload)
            }
          )
          .subscribe((status) => {
            // Update connection status
            setIsConnected(status === 'SUBSCRIBED')
            if (status === 'SUBSCRIBED') {
              setLastSyncedAt(new Date())
              setError(null)
            } else if (status === 'CHANNEL_ERROR') {
              setError('Error connecting to realtime updates')
            }
          })

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
        const { data, error } = await supabase
          .from('workflow_states')
          .select('current_step, metadata')
          .eq('id', id)
          .single()
        
        if (error) throw error
        
        if (data) {
          // Determine application-specific step from database step
          const dbStep = data.current_step
          
          // Map database step to application step if needed
          let appStep: WorkflowStep = dbStep as WorkflowStep
          
          // If there's custom step mapping in the metadata, use it
          if (data.metadata?.originalStep) {
            appStep = data.metadata.originalStep as WorkflowStep
          }
          
          // Don't update if the steps are the same (prevents loops)
          const currentStep = useChatStore.getState().workflow.currentStep
          if (currentStep !== appStep) {
            // Update the local state with remote state
            updateWorkflowStep(appStep, data.metadata || {})
            setLastSyncedAt(new Date())
          }
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
        // Add a flag to prevent loop-back updates
        const enrichedMetadata = {
          ...metadata,
          _syncedFromRemote: true,
          _syncedAt: new Date().toISOString()
        }
        
        // Update the local state with remote state
        updateWorkflowStep(appStep, enrichedMetadata)
        setLastSyncedAt(new Date())
      }
    }

    // Set up the subscription
    setupRealtimeSubscription()

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
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
      const effectiveWorkflowId = workflowId || localStorage.getItem('current_workflow_id')
      if (!effectiveWorkflowId) {
        setError('No workflow ID available for synchronization')
        return false
      }
      
      const supabase = createBrowserClient()
      try {
        const { data, error } = await supabase
          .from('workflow_states')
          .select('current_step, metadata')
          .eq('id', effectiveWorkflowId)
          .single()
        
        if (error) throw error
        
        if (data) {
          // Determine application-specific step from database step
          const dbStep = data.current_step
          
          // Map database step to application step if needed
          let appStep: WorkflowStep = dbStep as WorkflowStep
          
          // If there's custom step mapping in the metadata, use it
          if (data.metadata?.originalStep) {
            appStep = data.metadata.originalStep as WorkflowStep
          }
          
          // Update the local state with remote state
          updateWorkflowStep(appStep, {
            ...data.metadata,
            _forceSynced: true,
            _syncedAt: new Date().toISOString()
          })
          
          setLastSyncedAt(new Date())
          return true
        }
        return false
      } catch (err) {
        console.error('Error during force sync:', err)
        setError(`Force sync failed: ${err instanceof Error ? err.message : String(err)}`)
        return false
      }
    }
  }
}