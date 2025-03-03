import type { SupabaseClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { createBrowserClient } from '@/lib/supabase/clients'
import type { ProcessingPhase, WorkflowStep } from '@/lib/workflow/types'

/**
 * Service for managing workflow state persistence and retrieval
 */
export class WorkflowService {
  private supabase: SupabaseClient<Database>

  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient()
  }
  
  /**
   * Subscribe to workflow state changes
   * @param workflowId The workflow ID to subscribe to
   * @param onUpdate Callback for update events
   * @param onStatusChange Callback for subscription status changes
   * @returns The RealtimeChannel for cleanup
   */
  subscribeToWorkflowChanges(
    workflowId: string,
    onUpdate: (payload: RealtimePostgresChangesPayload<any>) => void,
    onStatusChange?: (status: string) => void
  ): RealtimeChannel {
    const channel = this.supabase
      .channel(`workflow-${workflowId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_states',
          filter: `id=eq.${workflowId}`
        },
        onUpdate
      )
      .subscribe(status => {
        if (onStatusChange) {
          onStatusChange(status)
        }
      })
      
    return channel
  }
  
  /**
   * Unsubscribe from a realtime channel
   * @param channel The channel to unsubscribe from
   */
  unsubscribeFromChannel(channel: RealtimeChannel): void {
    this.supabase.removeChannel(channel)
  }

  /**
   * Create a unique client ID for tracking local changes
   * This helps prevent echo updates in multi-instance scenarios
   */
  private generateClientId(): string {
    // Check localStorage first for a persistent ID
    const storedId = typeof localStorage !== 'undefined'
      ? localStorage.getItem('neuvia_client_id')
      : null

    if (storedId) {
      return storedId
    }

    // Generate a new ID if not found
    const clientId = crypto.randomUUID()

    // Store in localStorage for persistence across page loads
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('neuvia_client_id', clientId)
    }

    return clientId
  }

  /**
   * Helper method to determine if a step is directly storable in the database
   */
  private isDbWorkflowStep(step: WorkflowStep): step is Database['public']['Enums']['workflow_step'] {
    const dbSteps: Database['public']['Enums']['workflow_step'][] = [
      'idle',
      'uploading',
      'extracting',
      'verification',
      'report_generation',
      'complete',
      'chat_started',
      'chat_in_progress',
      'chat_completed',
      'chat_error',
    ]
    return dbSteps.includes(step as Database['public']['Enums']['workflow_step'])
  }

  /**
   * Update workflow state in database
   */
  async updateWorkflowState(
    workflowId: string,
    step: WorkflowStep,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      if (!workflowId) return

      // Convert application workflow step to database workflow step if needed
      let dbStep: Database['public']['Enums']['workflow_step'] = 'idle'

      // Map application-specific steps to database enum values
      if (step === 'error') {
        dbStep = 'chat_error'
      } else if (step === 'research' || step === 'report_presentation') {
        // Map research to chat_in_progress for database compatibility
        dbStep = 'chat_in_progress'
      } else if (
        step === 'idle' ||
        step === 'uploading' ||
        step === 'extracting' ||
        step === 'verification' ||
        step === 'report_generation' ||
        step === 'complete' ||
        step === 'chat_started' ||
        step === 'chat_in_progress' ||
        step === 'chat_completed' ||
        step === 'verification_pending' ||
        step === 'verification_in_progress' ||
        step === 'verification_completed' ||
        step === 'verification_failed'
      ) {
        // These steps exist in both types, so use directly
        dbStep = step
      }

      // Mark this update as originated from local client to prevent echo updates
      const enrichedMetadata = {
        ...(metadata || {}),
        updatedAt: new Date().toISOString(),
        originalStep: step, // Store the original step for reference
        _localUpdate: true, // Flag to prevent echo updates in real-time sync
        _clientId: this.generateClientId(), // Add unique client ID to track the source
      }

      await this.supabase
        .from('workflow_states')
        .update({
          current_step: dbStep,
          metadata: enrichedMetadata,
        })
        .eq('id', workflowId)
    } catch (error) {
      console.error('Failed to update workflow state in database:', error)
      throw error
    }
  }

  /**
   * Get current workflow state by ID
   */
  async getWorkflowState(workflowId: string): Promise<{
    step: WorkflowStep
    metadata: Record<string, any>
  } | null> {
    try {
      if (!workflowId) return null

      const { data, error } = await this.supabase
        .from('workflow_states')
        .select('current_step, metadata')
        .eq('id', workflowId)
        .single()

      if (error || !data) {
        console.error('Error fetching workflow state:', error)
        return null
      }

      // Convert database step to app step if needed
      const step = data.metadata?.appStep || data.current_step

      return {
        step: step as WorkflowStep,
        metadata: data.metadata || {}
      }
    } catch (error) {
      console.error('Failed to get workflow state:', error)
      throw error
    }
  }

  /**
   * Create a new workflow state
   */
  async createWorkflowState(
    userId: string,
    initialStep: WorkflowStep = 'idle',
    metadata: Record<string, any> = {}
  ): Promise<string | null> {
    try {
      // Determine if the step is valid for the database
      const step = this.isDbWorkflowStep(initialStep)
        ? initialStep
        : 'idle' as Database['public']['Enums']['workflow_step']

      const timestamp = new Date().toISOString()
      
      // Insert the workflow
      const { data, error } = await this.supabase
        .from('workflow_states')
        .insert({
          user_id: userId,
          current_step: step,
          metadata: {
            ...metadata,
            ...(initialStep !== step ? { appStep: initialStep } : {}),
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        })
        .select('id')
        .single()

      if (error || !data) {
        console.error('Error creating workflow state:', error)
        return null
      }

      return data.id
    } catch (error) {
      console.error('Failed to create workflow state:', error)
      throw error
    }
  }

  /**
   * Set workflow status to error
   */
  async setWorkflowError(
    workflowId: string,
    errorMessage: string,
    errorDetails: Record<string, any> = {}
  ): Promise<void> {
    try {
      if (!workflowId) return

      const timestamp = new Date().toISOString()
      
      await this.supabase
        .from('workflow_states')
        .update({
          current_step: 'chat_error',
          metadata: {
            error: errorMessage,
            errorDetails,
            errorAt: timestamp,
            updatedAt: timestamp,
          }
        })
        .eq('id', workflowId)
    } catch (error) {
      console.error('Failed to set workflow error:', error)
      throw error
    }
  }

  /**
   * Update workflow processing status
   */
  async updateProcessingStatus(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase
  ): Promise<void> {
    try {
      if (!workflowId) return

      const { data: currentState, error: fetchError } = await this.supabase
        .from('workflow_states')
        .select('metadata')
        .eq('id', workflowId)
        .single()

      if (fetchError) {
        console.error('Error fetching current workflow state:', fetchError)
        return
      }

      const currentMetadata = currentState?.metadata || {}
      
      await this.supabase
        .from('workflow_states')
        .update({
          metadata: {
            ...currentMetadata,
            processingStatus: {
              progress,
              phase,
              updatedAt: new Date().toISOString()
            }
          }
        })
        .eq('id', workflowId)
    } catch (error) {
      console.error('Failed to update processing status:', error)
      throw error
    }
  }

  /**
   * Reset workflow state
   */
  async resetWorkflow(workflowId: string): Promise<void> {
    try {
      if (!workflowId) return

      await this.supabase
        .from('workflow_states')
        .update({
          current_step: 'idle',
          metadata: {
            reset: true,
            resetAt: new Date().toISOString()
          }
        })
        .eq('id', workflowId)
    } catch (error) {
      console.error('Failed to reset workflow:', error)
      throw error
    }
  }

  /**
   * Complete workflow
   */
  async completeWorkflow(
    workflowId: string,
    completionMetadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      if (!workflowId) return

      const timestamp = new Date().toISOString()
      
      await this.supabase
        .from('workflow_states')
        .update({
          current_step: 'complete',
          metadata: {
            ...completionMetadata,
            completedAt: timestamp,
            updatedAt: timestamp,
          }
        })
        .eq('id', workflowId)
    } catch (error) {
      console.error('Failed to complete workflow:', error)
      throw error
    }
  }
}

// Export singleton instance
export const workflowService = new WorkflowService()