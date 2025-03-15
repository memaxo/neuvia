import { createBrowserClient } from '@/lib/supabase/clients'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { Result } from '@/lib/services/workflow/error/result'
import { WorkflowStepMapper } from '../utils/workflow-utils'

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
  /** Force update even if validation fails */
  forceUpdate?: boolean;
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
      // Use the helper method to fetch the workflow
      const workflowResult = await this.fetchWorkflowById(workflowId);
      
      if (workflowResult.isFailure()) {
        return Result.failure(
          workflowResult.error.message,
          workflowResult.error.code,
          workflowResult.error.details
        );
      }
      
      const workflow = workflowResult.value;
      if (!workflow) return Result.success(null);

      // Map DB data to domain model
      return Result.success({
        currentStep: WorkflowStepMapper.toDomainStep(workflow.current_step),
        progress: typeof workflow.metadata?.progress === 'number' ? workflow.metadata.progress : 0,
        phase: typeof workflow.metadata?.phase === 'string'
          ? workflow.metadata.phase as ProcessingPhase
          : ProcessingPhase.INITIALIZATION,
        error: typeof workflow.metadata?.error === 'string' ? workflow.metadata.error : null,
        metadata: workflow.metadata || {},
        timestamp: workflow.updated_at || new Date().toISOString(),
      });
    } catch (err) {
      return this.handleError(
        err,
        'Failed to get workflow state',
        'WORKFLOW_FETCH_FAILED',
        { workflowId }
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
      
      // Ensure initialStep is properly mapped to DB format
      const dbStep = WorkflowStepMapper.toDatabaseStep(initialStep);
      
      const enrichedMetadata = {
        ...metadata,
        createdAt: now,
        updatedAt: now,
        clientId: this.clientId,
      };
      
      // Use the helper method to insert the workflow
      const result = await this.insertWorkflow({
        user_id: userId,
        current_step: dbStep,
        chat_id: chatId,
        metadata: enrichedMetadata,
      });
      
      if (result.isFailure()) {
        return Result.failure(
          result.error.message,
          result.error.code,
          result.error.details
        );
      }
      
      return Result.success(result.value);
    } catch (err) {
      return this.handleError(
        err,
        'Failed to create workflow state',
        'WORKFLOW_CREATE_FAILED',
        { userId, initialStep, chatId }
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
    if (!userId) {
      return Result.failure(
        'User ID is required',
        'WORKFLOW_GET_OR_CREATE_VALIDATION',
        { userId, chatId }
      );
    }

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
      return this.handleError(
        err,
        'Failed to get or create workflow for user',
        'WORKFLOW_GET_OR_CREATE_FAILED',
        { userId, chatId }
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
      // Use the helper method to fetch workflow by user ID
      const result = await this.fetchWorkflowByUserId(userId, chatId);
      
      if (result.isFailure()) {
        return Result.failure(
          result.error.message,
          result.error.code,
          result.error.details
        );
      }
      
      const data = result.value;
      if (!data) return Result.success(null);
      
      // Map to domain model
      return Result.success({
        id: data.id,
        currentStep: WorkflowStepMapper.toDomainStep(data.current_step),
        progress: typeof data.metadata?.progress === 'number' ? data.metadata.progress : 0,
        phase: typeof data.metadata?.phase === 'string'
          ? data.metadata.phase as ProcessingPhase
          : ProcessingPhase.INITIALIZATION,
        error: typeof data.metadata?.error === 'string' ? data.metadata.error : null,
        metadata: data.metadata || {},
        timestamp: data.updated_at || new Date().toISOString(),
      });
    } catch (err) {
      return this.handleError(
        err,
        'Failed to load workflow state for user',
        'WORKFLOW_LOAD_FAILED',
        { userId, chatId }
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
      let currentState: WorkflowState | null = null;
      
      try {
        const currentStateResult = await this.getState(workflowId);
        if (currentStateResult.isSuccess() && currentStateResult.value) {
          currentState = currentStateResult.value;
          currentStep = currentState.currentStep;
        }
      } catch (err) {
        // If we can't get the state, continue with default
        this.logger.warn('Unable to get current workflow state', {
          workflowId,
          error: err instanceof Error ? err.message : String(err)
        });
      }
      
      const now = new Date().toISOString();
      
      // Ensure toStep is properly mapped to DB format
      const dbStep = WorkflowStepMapper.toDatabaseStep(toStep);
      
      // Prepare metadata
      const enrichedMetadata = {
        ...metadata,
        updatedAt: now,
        previousStep: currentStep,
        clientId: this.clientId,
      };
      
      // Check for valid transitions if validation is enabled
      if (!options.skipValidation && !options.forceUpdate && currentState) {
        const isValidTransition = this.isValidTransition(currentStep, toStep);
        if (!isValidTransition) {
          return Result.failure(
            `Invalid workflow transition from ${currentStep} to ${toStep}`,
            'WORKFLOW_INVALID_TRANSITION',
            { workflowId, fromStep: currentStep, toStep }
          );
        }
      }
      
      // Use the helper method to update the workflow
      const updateResult = await this.updateWorkflow(
        workflowId,
        {
          current_step: dbStep,
          metadata: enrichedMetadata,
          updated_at: now,
        }
      );
      
      if (updateResult.isFailure()) {
        return Result.failure(
          updateResult.error.message,
          updateResult.error.code,
          updateResult.error.details
        );
      }
      
      const data = updateResult.value;
      if (!data) {
        return Result.failure(
          'No data returned from update',
          'WORKFLOW_UPDATE_FAILED',
          { workflowId, toStep }
        );
      }
      
      // Optionally record the transition
      try {
        await this.recordTransition(workflowId, currentStep, toStep, metadata);
      } catch (transitionErr) {
        // Log but don't fail the operation if transition recording fails
        this.logger.warn('Failed to record workflow transition', {
          workflowId,
          fromStep: currentStep,
          toStep,
          error: transitionErr instanceof Error ? transitionErr.message : String(transitionErr)
        });
      }
      
      // Return updated state
      return Result.success({
        currentStep: WorkflowStepMapper.toDomainStep(data.current_step),
        progress: typeof data.metadata?.progress === 'number' ? data.metadata.progress : 0,
        phase: typeof data.metadata?.phase === 'string'
          ? data.metadata.phase as ProcessingPhase
          : ProcessingPhase.INITIALIZATION,
        error: typeof data.metadata?.error === 'string' ? data.metadata.error : null,
        metadata: data.metadata || {},
        timestamp: data.updated_at || now,
      });
    } catch (err) {
      return this.handleError(
        err,
        'Failed to update workflow state',
        'WORKFLOW_UPDATE_FAILED',
        { workflowId, toStep }
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
      return Result.failure(
        "Workflow ID is required",
        "WORKFLOW_UPDATE_PROGRESS_INVALID",
        { workflowId }
      );
    }
    
    try {
      const { currentStep, notifyUsers = false } = options;
      
      // Get current state
      const stateResult = await this.getState(workflowId);
      if (stateResult.isFailure() || !stateResult.value) {
         return Result.failure(
           "Workflow state not found",
           "WORKFLOW_STATE_NOT_FOUND",
           { workflowId }
         );
      }
      
      const state = stateResult.value;
      const updatedMetadata = {
         ...state.metadata,
         progress,
         phase: phase.toString(),
         progressUpdatedAt: new Date().toISOString()
      };
      
      // Update the workflow
      const updateResult = await this.updateWorkflow(
        workflowId,
        {
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        }
      );
      
      if (updateResult.isFailure()) {
        return Result.failure(
          updateResult.error.message,
          updateResult.error.code,
          updateResult.error.details
        );
      }
      
      // Send notification if requested
      if (notifyUsers) {
        try {
          await this.sendProgressNotification(workflowId, progress, phase);
        } catch (notifyErr) {
          // Log but don't fail the operation if notification fails
          this.logger.warn("Failed to send progress notification", {
            workflowId,
            progress,
            phase: phase.toString(),
            error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
          });
        }
      }
      
      return Result.success(true);
    } catch (err) {
      return this.handleError(
        err,
        "Failed to update workflow progress",
        "WORKFLOW_PROGRESS_UPDATE_FAILED",
        { workflowId, progress, phase: phase.toString() }
      );
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
        errorMetadata,
        { skipValidation: true } // Skip validation for error states
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
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_RESET_VALIDATION_FAILED',
        { workflowId, initialStep }
      );
    }

    try {
      const resetMetadata = {
        ...metadata,
        resetAt: new Date().toISOString(),
        resetBy: metadata.userId || 'system',
        progress: 0,
        error: null
      };
      
      // Update to initial step with skipValidation to allow any transition
      return await this.updateState(
        workflowId,
        initialStep,
        resetMetadata,
        { skipValidation: true }
      );
    } catch (err) {
      return this.handleError(
        err,
        'Failed to reset workflow',
        'WORKFLOW_RESET_FAILED',
        { workflowId, initialStep }
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
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_COMPLETION_VALIDATION_FAILED',
        { workflowId }
      );
    }

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
      return this.handleError(
        err,
        'Failed to complete workflow',
        'WORKFLOW_COMPLETION_FAILED',
        { workflowId }
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
  ): Promise<Result<{ workflowId: string; messageId: string }>> {
    if (!workflowId) {
      return Result.failure(
        'Workflow ID is required',
        'WORKFLOW_CHAT_UPDATE_VALIDATION_FAILED',
        { workflowId, step }
      );
    }

    try {
      // Get the chat_id from the workflow state
      const workflowResult = await this.fetchWorkflowById(workflowId);
      
      if (workflowResult.isFailure()) {
        return Result.failure(
          workflowResult.error.message,
          workflowResult.error.code,
          workflowResult.error.details
        );
      }
      
      const workflow = workflowResult.value;
      if (!workflow) {
        return Result.failure(
          'Workflow not found',
          'WORKFLOW_NOT_FOUND',
          { workflowId }
        );
      }
      
      const chatId = workflow.chat_id;
      if (!chatId) {
        return Result.failure(
          'No chat ID associated with this workflow',
          'WORKFLOW_NO_CHAT_ID',
          { workflowId }
        );
      }
      
      // Ensure step is properly mapped to DB format
      const dbStep = WorkflowStepMapper.toDatabaseStep(step);
      
      // Update workflow state
      const enrichedMetadata = {
        ...metadata,
        updatedAt: new Date().toISOString(),
        clientId: this.clientId,
      };
      
      const updateResult = await this.updateWorkflow(
        workflowId,
        {
          current_step: dbStep,
          metadata: enrichedMetadata,
          updated_at: new Date().toISOString()
        }
      );
      
      if (updateResult.isFailure()) {
        return Result.failure(
          updateResult.error.message,
          updateResult.error.code,
          updateResult.error.details
        );
      }
      
      // Add chat message
      const messageInsertResult = await this.insertChatMessage(
        chatId,
        messageRole,
        typeof messageContent === 'string'
          ? { text: messageContent }
          : messageContent,
        messageMetadata
      );
      
      if (messageInsertResult.isFailure()) {
        return Result.failure(
          messageInsertResult.error.message,
          messageInsertResult.error.code,
          messageInsertResult.error.details
        );
      }
      
      const messageId = messageInsertResult.value;
      
      // Update workflow to reference the new message
      await this.updateWorkflow(
        workflowId,
        {
          last_message_id: messageId
        }
      );
      
      return Result.success({
        workflowId,
        messageId
      });
    } catch (err) {
      return this.handleError(
        err,
        'Failed to update with chat message',
        'WORKFLOW_CHAT_UPDATE_FAILED',
        { workflowId, step }
      );
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
  
  // Private helper methods
  
  /**
   * Centralized error handling
   */
  private handleError<T>(
    error: unknown,
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ): Result<T> {
    const normalizedError = normalizeError(error);
    
    this.logger.error(message, {
      ...context,
      error: normalizedError.message,
      stack: normalizedError.stack,
      data: normalizedError.data
    });
    
    return Result.failure(
      `${message}: ${normalizedError.message}`,
      normalizedError.code || code,
      { ...context, originalError: normalizedError }
    );
  }
  
  /**
   * Fetch workflow by ID
   */
  private async fetchWorkflowById(workflowId: string): Promise<Result<Record<string, any> | null>> {
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
      
      return Result.success(data);
    } catch (err) {
      return this.handleError(
        err,
        'Failed to fetch workflow',
        'WORKFLOW_FETCH_FAILED',
        { workflowId }
      );
    }
  }
  
  /**
   * Fetch workflow by user ID
   */
  private async fetchWorkflowByUserId(
    userId: string,
    chatId?: string | null
  ): Promise<Result<Record<string, any> | null>> {
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
          'WORKFLOW_FETCH_FAILED',
          { userId, chatId, error }
        );
      }
      
      return Result.success(data);
    } catch (err) {
      return this.handleError(
        err,
        'Failed to fetch workflow by user ID',
        'WORKFLOW_FETCH_FAILED',
        { userId, chatId }
      );
    }
  }
  
  /**
   * Insert workflow
   */
  private async insertWorkflow(workflow: Record<string, any>): Promise<Result<string>> {
    try {
      const { data, error } = await this.supabase
        .from('workflow_states')
        .insert(workflow)
        .select('id')
        .single();

      if (error) {
        return Result.failure(
          `Database error: ${error.message}`,
          'WORKFLOW_INSERT_FAILED',
          { workflow, error }
        );
      }
      
      if (!data) {
        return Result.failure(
          'Failed to insert workflow: No data returned',
          'WORKFLOW_INSERT_FAILED',
          { workflow }
        );
      }
      
      return Result.success(data.id);
    } catch (err) {
      return this.handleError(
        err,
        'Failed to insert workflow',
        'WORKFLOW_INSERT_FAILED',
        { workflow }
      );
    }
  }
  
  /**
   * Update workflow
   */
  private async updateWorkflow(
    workflowId: string,
    updates: Record<string, any>
  ): Promise<Result<Record<string, any> | null>> {
    try {
      const { data, error } = await this.supabase
        .from('workflow_states')
        .update(updates)
        .eq('id', workflowId)
        .select()
        .single();
      
      if (error) {
        return Result.failure(
          `Database error: ${error.message}`,
          'WORKFLOW_UPDATE_FAILED',
          { workflowId, updates, error }
        );
      }
      
      return Result.success(data);
    } catch (err) {
      return this.handleError(
        err,
        'Failed to update workflow',
        'WORKFLOW_UPDATE_FAILED',
        { workflowId, updates }
      );
    }
  }
  
  /**
   * Insert chat message
   */
  private async insertChatMessage(
    chatId: string,
    role: string,
    content: any,
    metadata: Record<string, unknown> | null = null
  ): Promise<Result<string>> {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          role,
          content,
          metadata
        })
        .select('id')
        .single();
      
      if (error) {
        return Result.failure(
          `Database error: ${error.message}`,
          'MESSAGE_INSERT_FAILED',
          { chatId, role, error }
        );
      }
      
      if (!data) {
        return Result.failure(
          'Failed to insert message: No data returned',
          'MESSAGE_INSERT_FAILED',
          { chatId, role }
        );
      }
      
      return Result.success(data.id);
    } catch (err) {
      return this.handleError(
        err,
        'Failed to insert chat message',
        'MESSAGE_INSERT_FAILED',
        { chatId, role }
      );
    }
  }
  
  /**
   * Send progress notification
   */
  private async sendProgressNotification(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase
  ): Promise<Result<boolean>> {
    try {
      const { data, error: chatError } = await this.supabase
        .from('workflow_states')
        .select('chat_id')
        .eq('id', workflowId)
        .single();
      
      if (chatError) {
        return Result.failure(
          `Failed to retrieve chat_id: ${chatError.message}`,
          'CHAT_ID_FETCH_FAILED',
          { workflowId, chatError }
        );
      }
      
      if (!data?.chat_id) {
        return Result.failure(
          'No chat ID associated with this workflow',
          'NO_CHAT_ID',
          { workflowId }
        );
      }
      
      const { error: messageError } = await this.supabase
        .from('messages')
        .insert({
          chat_id: data.chat_id,
          role: 'system',
          content: { text: `Progress update: ${progress}% (${phase})` },
          metadata: { type: 'progress_update', progress, phase: phase.toString() }
        });
      
      if (messageError) {
        return Result.failure(
          `Failed to send notification: ${messageError.message}`,
          'NOTIFICATION_FAILED',
          { workflowId, chatId: data.chat_id, messageError }
        );
      }
      
      return Result.success(true);
    } catch (err) {
      return this.handleError(
        err,
        'Failed to send progress notification',
        'NOTIFICATION_FAILED',
        { workflowId, progress, phase: phase.toString() }
      );
    }
  }
  
  /**
   * Record a workflow transition for auditing purposes
   */
  private async recordTransition(
    workflowId: string,
    fromStep: WorkflowStep,
    toStep: WorkflowStep,
    metadata: Record<string, unknown> = {}
  ): Promise<Result<boolean>> {
    try {
      // Convert steps to database format
      const dbFromStep = WorkflowStepMapper.toDatabaseStep(fromStep);
      const dbToStep = WorkflowStepMapper.toDatabaseStep(toStep);
      
      const { error } = await this.supabase
        .from('workflow_transitions')
        .insert({
          workflow_id: workflowId,
          from_step: dbFromStep,
          to_step: dbToStep,
          metadata,
          transitioned_at: new Date().toISOString()
        });
      
      if (error) {
        return Result.failure(
          `Failed to record transition: ${error.message}`,
          'TRANSITION_RECORD_FAILED',
          { workflowId, fromStep, toStep, error }
        );
      }
      
      return Result.success(true);
    } catch (err) {
      // Log but don't propagate errors from transition recording
      this.logger.warn('Failed to record workflow transition', {
        workflowId,
        fromStep,
        toStep,
        error: err instanceof Error ? err.message : String(err)
      });
      
      // Still return success - transition recording is non-critical
      return Result.success(false);
    }
  }
  
  /**
   * Check if a transition is valid
   */
  private isValidTransition(fromStep: WorkflowStep, toStep: WorkflowStep): boolean {
    // Allow all transitions to error state
    if (toStep === DomainOnlyWorkflowStep.ERROR ||
        toStep === 'error' ||
        toStep === 'chat_error' ||
        toStep === 'verification_failed') {
      return true;
    }
    
    // Import allowed transitions from workflow types
    // For now, basic validation - can be expanded later
    const basicAllowedTransitions: Record<string, string[]> = {
      'idle': ['uploading', 'chat_started', 'research', 'error'],
      'uploading': ['extracting', 'error'],
      'extracting': ['verification', 'verification_pending', 'complete', 'document_analysis', 'error'],
      'verification': ['verification_pending', 'error'],
      'verification_pending': ['verification_in_progress', 'error'],
      'verification_in_progress': ['verification_completed', 'verification_failed', 'error'],
      'verification_completed': ['report_generation', 'error'],
      'verification_failed': ['verification_in_progress', 'error'],
      'report_generation': ['complete', 'report_presentation', 'error'],
      'report_presentation': ['complete', 'error'],
      'chat_started': ['chat_in_progress', 'error'],
      'chat_in_progress': ['chat_completed', 'error'],
      'chat_completed': ['chat_in_progress', 'error'],
      'complete': ['idle', 'chat_in_progress', 'uploading', 'error'],
      'error': ['idle', 'uploading', 'extracting', 'verification', 'report_generation'],
      'research': ['report_generation', 'error']
    };
    
    // Convert steps to strings to handle enums
    const fromStepStr = String(fromStep);
    const toStepStr = String(toStep);
    
    // Check if transition is allowed
    return basicAllowedTransitions[fromStepStr]?.includes(toStepStr) || false;
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