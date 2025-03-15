import { createBrowserClient } from '@/lib/supabase/clients'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { Result } from '@/lib/services/workflow/error/result'

import type {
  WorkflowStep,
  ProcessingPhase,
  WorkflowState
} from '@/lib/types/workflow'
import { DomainOnlyWorkflowStep } from '@/lib/types/workflow'

/**
 * Options for database update operations
 */
export interface UpdateOptions {
  /** Skip validation of workflow transitions */
  skipValidation?: boolean;
}

/**
 * Options for database subscriptions
 */
export interface SubscriptionOptions {
  /** Function to call when subscription status changes */
  onStatusChange?: (status: string) => void;
}

/**
 * Options for progress updates
 */
export interface ProgressOptions {
  /** Current workflow step */
  currentStep?: WorkflowStep;
  
  /** Whether to notify users about progress */
  notifyUsers?: boolean;
}

/**
 * Simplified WorkflowManager for direct state management
 */
export class WorkflowManager {
  private readonly supabase: SupabaseClient<Database>;
  private readonly clientId: string;
  private readonly logger = logger.withMetadata({ module: 'WorkflowManager' });
  
  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient();
    this.clientId = this.generateClientId();
  }
  
  /**
   * Fetch workflow state by ID
   * @returns Result containing workflow state or null if not found
   */
  async getState(workflowId: string): Promise<Result<WorkflowState | null>> {
    if (!workflowId) return Result.success(null);

    try {
      const { data, error } = await this.supabase
        .from('workflow_states')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No row found
          return Result.success(null);
        }
        return Result.failure(
          `Database error: ${error.message}`,
          'WORKFLOW_FETCH_FAILED',
          { workflowId, error }
        );
      }
      if (!data) return Result.success(null);

      // Map DB data to domain model
      return Result.success({
        currentStep: data.current_step as WorkflowStep,
        progress: typeof data.metadata?.progress === 'number' ? data.metadata.progress : 0,
        phase: typeof data.metadata?.phase === 'string'
          ? data.metadata.phase as ProcessingPhase
          : ProcessingPhase.INITIALIZATION,
        error: typeof data.metadata?.error === 'string' ? data.metadata.error : null,
        metadata: data.metadata || {},
        timestamp: data.updated_at || new Date().toISOString(),
      });
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get workflow state', {
        workflowId,
        error: normalizedError.message
      });
      return Result.failure(
        `Failed to get workflow state: ${normalizedError.message}`,
        'WORKFLOW_FETCH_FAILED',
        { workflowId, originalError: normalizedError }
      );
    }
  }
  
  /**
   * Create new workflow state
   * @returns Result containing the new workflow state ID
   */
  async createState(
    userId: string,
    initialStep: WorkflowStep = 'idle',
    chatId: string | null = null,
    metadata: Record<string, unknown> = {}
  ): Promise<Result<string>> {
    if (!userId) {
      return Result.failure(
        'User ID is required',
        'WORKFLOW_CREATE_FAILED_VALIDATION',
        { userId, initialStep, chatId }
      );
    }
    
    try {
      const now = new Date().toISOString();
      
      const enrichedMetadata = {
        ...metadata,
        createdAt: now,
        updatedAt: now,
        clientId: this.clientId,
      };
      
      const { data, error } = await this.supabase
        .from('workflow_states')
        .insert({
          user_id: userId,
          current_step: initialStep,
          chat_id: chatId,
          metadata: enrichedMetadata,
        })
        .select('id')
        .single();

      if (error) {
        return Result.failure(
          `Database error: ${error.message}`,
          'WORKFLOW_CREATE_FAILED',
          { userId, initialStep, chatId, error }
        );
      }
      
      if (!data) {
        return Result.failure(
          'Failed to create workflow state: No data returned',
          'WORKFLOW_CREATE_FAILED',
          { userId, initialStep, chatId }
        );
      }
      
      return Result.success(data.id);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to create workflow state', {
        userId,
        initialStep,
        chatId,
        error: normalizedError.message
      });
      return Result.failure(
        `Failed to create workflow state: ${normalizedError.message}`,
        'WORKFLOW_CREATE_FAILED',
        { userId, initialStep, chatId, originalError: normalizedError }
      );
    }
  }
  
  /**
   * Get or create workflow state for user
   * @returns Result containing the workflow ID and state
   */
  async getOrCreateForUser(
    userId: string,
    chatId: string | null,
    initialStep: WorkflowStep = 'idle',
    initialMetadata: Record<string, unknown> = {}
  ): Promise<Result<{ id: string; state: WorkflowState }>> {
    try {
      // Try to load existing
      const existingResult = await this.loadStateForUser(userId, chatId);
      if (existingResult.isSuccess() && existingResult.value) {
        return Result.success({
          id: existingResult.value.id,
          state: existingResult.value
        });
      }
      
      // Create new
      const idResult = await this.createState(userId, initialStep, chatId, initialMetadata);
      if (idResult.isFailure()) {
        return Result.failure(
          idResult.error.message,
          idResult.error.code,
          idResult.error.details
        );
      }
      
      const id = idResult.value;
      const stateResult = await this.getState(id);
      
      if (stateResult.isFailure()) {
        return Result.failure(
          stateResult.error.message,
          stateResult.error.code,
          stateResult.error.details
        );
      }
      
      if (!stateResult.value) {
        return Result.failure(
          'Failed to retrieve newly created workflow state',
          'WORKFLOW_GET_OR_CREATE_FAILED',
          { userId, chatId, id }
        );
      }
      
      return Result.success({ id, state: stateResult.value });
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get or create workflow for user', {
        userId,
        chatId,
        error: normalizedError.message
      });
      return Result.failure(
        `Failed to get or create workflow: ${normalizedError.message}`,
        'WORKFLOW_GET_OR_CREATE_FAILED',
        { userId, chatId, originalError: normalizedError }
      );
    }
  }
  
  /**
   * Load workflow state by user ID and optional chat ID
   * @returns Result containing the workflow state with ID, or null if not found
   */
  async loadStateForUser(
    userId: string,
    chatId?: string | null
  ): Promise<Result<(WorkflowState & { id: string }) | null>> {
    if (!userId) {
      return Result.failure(
        'User ID is required',
        'WORKFLOW_LOAD_FAILED_VALIDATION',
        { userId, chatId }
      );
    }
    
    try {
      let query = this.supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', userId);
        
      if (chatId !== undefined && chatId !== null) {
        query = query.eq('chat_id', chatId);
      } else {
        query = query.is('chat_id', null);
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (error) {
        return Result.failure(
          `Database error: ${error.message}`,
          'WORKFLOW_LOAD_FAILED',
          { userId, chatId, error }
        );
      }
      
      if (!data) return Result.success(null);
      
      // Map to domain model
      return Result.success({
        id: data.id,
        currentStep: data.current_step as WorkflowStep,
        progress: typeof data.metadata?.progress === 'number' ? data.metadata.progress : 0,
        phase: typeof data.metadata?.phase === 'string'
          ? data.metadata.phase as ProcessingPhase
          : ProcessingPhase.INITIALIZATION,
        error: typeof data.metadata?.error === 'string' ? data.metadata.error : null,
        metadata: data.metadata || {},
        timestamp: data.updated_at || new Date().toISOString(),
      });
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to load workflow state for user', {
        userId,
        chatId,
        error: normalizedError.message
      });
      return Result.failure(
        `Failed to load workflow state: ${normalizedError.message}`,
        'WORKFLOW_LOAD_FAILED',
        { userId, chatId, originalError: normalizedError }
      );
    }
  }
  
  /**
   * Update workflow state
   * @returns Result containing the updated workflow state
   */
  async updateState(
    workflowId: string,
    toStep: WorkflowStep,
    metadata: Record<string, unknown> = {},
    options: UpdateOptions = {}
  ): Promise<Result<WorkflowState>> {
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_UPDATE_FAILED_VALIDATION',
        { workflowId, toStep }
      );
    }
    
    try {
      // Get current state for adding to metadata
      let currentStep: WorkflowStep = 'idle';
      try {
        const currentStateResult = await this.getState(workflowId);
        if (currentStateResult.isSuccess() && currentStateResult.value) {
          currentStep = currentStateResult.value.currentStep;
        }
      } catch (err) {
        // If we can't get the state, continue with default
        this.logger.warn('Unable to get current workflow state', {
          workflowId,
          error: err instanceof Error ? err.message : String(err)
        });
      }
      
      const now = new Date().toISOString();
      
      // Prepare metadata
      const enrichedMetadata = {
        ...metadata,
        updatedAt: now,
        previousStep: currentStep,
        clientId: this.clientId,
      };
      
      // Update the state
      const { data, error } = await this.supabase
        .from('workflow_states')
        .update({
          current_step: toStep,
          metadata: enrichedMetadata,
          updated_at: now,
        })
        .eq('id', workflowId)
        .select()
        .single();
      
      if (error) {
        return Result.failure(
          `Database error: ${error.message}`,
          'WORKFLOW_UPDATE_FAILED',
          { workflowId, toStep, error }
        );
      }
      
      if (!data) {
        return Result.failure(
          'No data returned from update',
          'WORKFLOW_UPDATE_FAILED',
          { workflowId, toStep }
        );
      }
      
      // Return updated state
      return Result.success({
        currentStep: data.current_step as WorkflowStep,
        progress: typeof data.metadata?.progress === 'number' ? data.metadata.progress : 0,
        phase: typeof data.metadata?.phase === 'string'
          ? data.metadata.phase as ProcessingPhase
          : ProcessingPhase.INITIALIZATION,
        error: typeof data.metadata?.error === 'string' ? data.metadata.error : null,
        metadata: data.metadata || {},
        timestamp: data.updated_at || now,
      });
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update workflow state', {
        workflowId,
        toStep,
        error: normalizedError.message
      });
      return Result.failure(
        `Failed to update workflow state: ${normalizedError.message}`,
        'WORKFLOW_UPDATE_FAILED',
        { workflowId, toStep, originalError: normalizedError }
      );
    }
  }
  
  /**
   * Update workflow progress
   */
  async updateProgress(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase,
    options: ProgressOptions = {}
  ): Promise<Result<boolean>> {
    if (!workflowId) {
      return Result.failure("Workflow ID is required", "WORKFLOW_UPDATE_PROGRESS_INVALID", { workflowId });
    }
    try {
      const { currentStep, notifyUsers = false } = options;
      const stateResult = await this.getState(workflowId);
      if (stateResult.isFailure() || !stateResult.value) {
         return Result.failure("Workflow state not found", "WORKFLOW_STATE_NOT_FOUND", { workflowId });
      }
      const state = stateResult.value;
      const updatedMetadata = {
         ...state.metadata,
         progress,
         phase: phase.toString(),
         progressUpdatedAt: new Date().toISOString()
      };
      const { error } = await this.supabase
         .from('workflow_states')
         .update({
            metadata: updatedMetadata,
            updated_at: new Date().toISOString()
         })
         .eq('id', workflowId);
      if (error) {
         return Result.failure(`Database error: ${error.message}`, "WORKFLOW_PROGRESS_UPDATE_FAILED", { workflowId, error });
      }
      if (notifyUsers) {
         const { data, error: chatError } = await this.supabase
           .from('workflow_states')
           .select('chat_id')
           .eq('id', workflowId)
           .single();
         if (chatError) {
            this.logger.warn("Failed to retrieve chat_id for progress notification", { workflowId, chatError: chatError.message });
         }
         if (data?.chat_id) {
            const { error: messageError } = await this.supabase
              .from('messages')
              .insert({
                chat_id: data.chat_id,
                role: 'system',
                content: { text: `Progress update: ${progress}% (${phase})` },
                metadata: { type: 'progress_update', progress, phase: phase.toString() }
              });
            if (messageError) {
               this.logger.warn("Failed to send progress notification", { workflowId, messageError: messageError.message });
            }
         }
      }
      return Result.success(true);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error("Failed to update workflow progress", {
         workflowId,
         progress,
         phase: phase.toString(),
         error: normalizedError.message
      });
      return Result.failure(normalizedError.message, normalizedError.code || "WORKFLOW_PROGRESS_UPDATE_FAILED", { workflowId });
    }
  }
  
  /**
   * Handle workflow error, setting the state to an error state
   * @returns Result containing the error workflow state
   */
  async handleError(
    workflowId: string,
    error: unknown,
    errorStep: WorkflowStep = DomainOnlyWorkflowStep.ERROR,
    errorDetails: Record<string, unknown> = {}
  ): Promise<Result<WorkflowState>> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorTimestamp = new Date().toISOString();
      
      // Get current workflow state to determine context
      let currentState;
      try {
        const stateResult = await this.getState(workflowId);
        if (stateResult.isSuccess()) {
          currentState = stateResult.value;
        }
      } catch (stateError) {
        // If we can't get the state, continue with fallback error step
        this.logger.warn('Unable to get workflow state during error handling', {
          workflowId,
          error: stateError instanceof Error ? stateError.message : String(stateError)
        });
      }
      
      const currentStep = currentState?.currentStep || 'idle';
      
      // Create error metadata
      const errorMetadata = {
        ...(currentState?.metadata || {}),
        error: errorMessage,
        errorTimestamp,
        errorDetails,
        previousStep: currentStep
      };
      
      // Update to error state
      const updateResult = await this.updateState(
        workflowId,
        errorStep,
        errorMetadata
      );
      
      if (updateResult.isSuccess()) {
        return updateResult;
      }
      
      // If update failed, return a minimal error state as fallback
      return Result.success({
        currentStep: DomainOnlyWorkflowStep.ERROR,
        progress: 0,
        phase: ProcessingPhase.ERROR,
        error: errorMessage,
        metadata: {
          errorDetails,
          errorTimestamp,
          previousStep: currentStep
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      // Don't throw from error handler to avoid cascading errors
      const normalizedError = normalizeError(err);
      this.logger.error('Error handling failed', {
        workflowId,
        originalError: error instanceof Error ? error.message : String(error),
        handlerError: normalizedError.message
      });
      
      // Return minimal error state
      return Result.success({
        currentStep: DomainOnlyWorkflowStep.ERROR,
        progress: 0,
        phase: ProcessingPhase.ERROR,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          errorDetails,
          errorTimestamp: new Date().toISOString(),
          previousStep: errorDetails.currentStep as string || 'unknown'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Reset workflow to initial state
   * @returns Result containing the reset workflow state
   */
  async reset(
    workflowId: string,
    initialStep: WorkflowStep = 'idle',
    metadata: Record<string, unknown> = {}
  ): Promise<Result<WorkflowState>> {
    try {
      const resetMetadata = {
        ...metadata,
        resetAt: new Date().toISOString(),
        resetBy: metadata.userId || 'system',
        progress: 0,
        error: null
      };
      
      // Update to initial step
      return await this.updateState(
        workflowId,
        initialStep,
        resetMetadata
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to reset workflow', {
        workflowId,
        initialStep,
        error: normalizedError.message
      });
      return Result.failure(
        `Failed to reset workflow: ${normalizedError.message}`,
        'WORKFLOW_RESET_FAILED',
        { workflowId, initialStep, originalError: normalizedError }
      );
    }
  }
  
  /**
   * Complete workflow
   * @returns Result containing the completed workflow state
   */
  async completeWorkflow(
    workflowId: string,
    completionMetadata: Record<string, unknown> = {}
  ): Promise<Result<WorkflowState>> {
    try {
      const completionTimestamp = new Date().toISOString();
      
      // Update state to complete
      return await this.updateState(
        workflowId,
        'complete',
        {
          completedAt: completionTimestamp,
          ...completionMetadata
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to complete workflow', {
        workflowId,
        error: normalizedError.message
      });
      return Result.failure(
        `Failed to complete workflow: ${normalizedError.message}`,
        'WORKFLOW_COMPLETION_FAILED',
        {
          workflowId,
          originalError: normalizedError
        }
      );
    }
  }
  
  /**
   * Update workflow with chat message in a single atomic operation
   */
  async updateWithChatMessage(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, unknown>,
    messageContent: string,
    messageRole: string = 'system',
    messageMetadata: Record<string, unknown> | null = null
  ): Promise<{ success: boolean; workflowId?: string; messageId?: string }> {
    try {
      if (!workflowId) {
        throw new Error('workflowId is required');
      }
      
      // Get the chat_id from the workflow state
      const { data: workflow, error: workflowError } = await this.supabase
        .from('workflow_states')
        .select('chat_id, current_step')
        .eq('id', workflowId)
        .single();
      
      if (workflowError) throw workflowError;
      if (!workflow) {
        return { success: false };
      }
      
      const chatId = workflow.chat_id;
      if (!chatId) {
        return { success: false };
      }
      
      // Update workflow state
      const enrichedMetadata = {
        ...metadata,
        updatedAt: new Date().toISOString(),
        clientId: this.clientId,
      };
      
      const { error: updateError } = await this.supabase
        .from('workflow_states')
        .update({
          current_step: step,
          metadata: enrichedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId);
      
      if (updateError) throw updateError;
      
      // Add chat message
      const { data: message, error: messageError } = await this.supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          role: messageRole,
          content: typeof messageContent === 'string'
            ? { text: messageContent }
            : messageContent,
          metadata: messageMetadata
        })
        .select('id')
        .single();
      
      if (messageError) throw messageError;
      
      // Update workflow to reference the new message
      await this.supabase
        .from('workflow_states')
        .update({
          last_message_id: message.id
        })
        .eq('id', workflowId);
      
      return {
        success: true,
        workflowId,
        messageId: message.id
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update with chat message', {
        workflowId,
        step,
        error: normalizedError.message
      });
      return { success: false };
    }
  }
  
  /**
   * Subscribe to workflow for user
   */
  subscribeToWorkflowForUser(
    userId: string,
    chatId: string | null,
    onUpdate: (payload: {
      new: Record<string, unknown>;
      old: Record<string, unknown>;
    }) => void,
    options: SubscriptionOptions = {}
  ): RealtimeChannel {
    const channelName = `workflow-${userId}-${chatId ?? 'null'}`;
    const channel = this.supabase.channel(channelName);
    
    // Build filter
    let filter = `user_id=eq.${userId}`;
    if (chatId !== null && chatId !== '') {
      filter += ` AND chat_id=eq.${chatId}`;
    } else {
      filter += ' AND chat_id IS NULL';
    }
    
    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_states',
          filter,
        },
        onUpdate
      )
      .subscribe((status) => {
        if (options.onStatusChange) {
          options.onStatusChange(status);
        }
      });
    
    return channel;
  }
  
  /**
   * Subscribe to workflow changes
   */
  subscribeToWorkflowChanges(
    workflowId: string,
    onUpdate: (payload: {
      new: Record<string, unknown>;
      old: Record<string, unknown>;
    }) => void,
    options: SubscriptionOptions = {}
  ): RealtimeChannel {
    const channel = this.supabase
      .channel(`workflow-${workflowId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workflow_states',
          filter: `id=eq.${workflowId}`,
        },
        onUpdate
      )
      .subscribe((status) => {
        if (options.onStatusChange) {
          options.onStatusChange(status);
        }
      });
    
    return channel;
  }
  
  /**
   * Unsubscribe from channel
   */
  unsubscribeFromChannel(channel: RealtimeChannel): void {
    void this.supabase.removeChannel(channel);
  }
  
  /**
   * Get client ID
   */
  getClientId(): string {
    return this.clientId;
  }
  
  /**
   * Generate client ID
   */
  private generateClientId(): string {
    if (typeof localStorage !== 'undefined') {
      const storedId = localStorage.getItem('neuvia_client_id');
      if (storedId) return storedId;
      const newId = crypto.randomUUID();
      localStorage.setItem('neuvia_client_id', newId);
      return newId;
    }
    // fallback if localStorage not available
    return `client-${Date.now()}`;
  }
}

// Export singleton instance
export const workflowManager = new WorkflowManager();