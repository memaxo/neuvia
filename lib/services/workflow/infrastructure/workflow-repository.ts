/**
 * @fileoverview Workflow Repository
 *
 * PHASE 3 IMPLEMENTATION:
 * Simplified and standardized workflow repository.
 * 
 * The single source of truth for all database operations related to workflows.
 * This repository centralizes all database access to ensure consistency and
 * proper encapsulation of data access logic.
 * 
 * This file has been updated to simplify its methods and improve error handling
 * as part of the Phase 3 implementation.
 */

import { createBrowserClient } from '@/lib/supabase/clients'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { WorkflowStepMapper } from '../utils/step-mapper'
import { workflowStateMapper } from '@/lib/types/workflow-mapper'

import type { 
  WorkflowStep, 
  ProcessingPhase, 
  WorkflowState 
} from '@/lib/types/workflow'

import type { UUID, Timestamp } from '@/lib/types/base'
import type { DbWorkflowState } from '@/lib/types/db-adapters'

/**
 * Options for database update operations
 */
export interface UpdateOptions {
  /** Expected timestamp for optimistic concurrency control */
  expectedTimestamp?: string;
  
  /** Force update even if timestamps don't match */
  forceUpdate?: boolean;
  
  /** Strategy for handling conflicts */
  conflictStrategy?: 'fail' | 'force' | 'merge';
  
  /** Whether to skip validation of workflow transitions */
  skipValidation?: boolean;
}

/**
 * Options for database subscriptions
 */
export interface SubscriptionOptions {
  /** Function to call when subscription status changes */
  onStatusChange?: (status: string) => void;
  
  /** Whether to use channel presence for tracking connected clients */
  withPresence?: boolean;
}

/**
 * Repository for all workflow database operations
 */
export class WorkflowRepository {
  private readonly supabase: SupabaseClient<Database>;
  private readonly clientId: string;
  private readonly logger = logger.withMetadata({ module: 'WorkflowRepository' });
  
  constructor(supabaseClient?: SupabaseClient<Database>) {
    this.supabase = supabaseClient || createBrowserClient();
    this.clientId = this.generateClientId();
  }
  
  /**
   * Fetch workflow state by ID
   */
  async getWorkflowState(workflowId: string): Promise<WorkflowState | null> {
    try {
      if (!workflowId) return null;

      const { data, error } = await this.supabase
        .from('workflow_states')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No row found
          return null;
        }
        throw error;
      }
      if (!data) return null;

      // Create DB workflow state object
      const dbWorkflowState: DbWorkflowState = {
        id: data.id,
        step: data.current_step,
        progress: typeof data.metadata?.progress === 'number' ? data.metadata.progress : 0,
        phase: typeof data.metadata?.phase === 'string' ? data.metadata.phase : undefined,
        error: typeof data.metadata?.error === 'string' ? data.metadata.error : null,
        metadata: data.metadata || {},
        timestamp: data.updated_at || new Date().toISOString(),
      };

      // Map to domain model
      return workflowStateMapper.toDomain(dbWorkflowState);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get workflow state', {
        workflowId,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to get workflow state: ${normalizedError.message}`,
        code: 'WORKFLOW_FETCH_FAILED',
        data: { workflowId, originalError: normalizedError }
      });
    }
  }
  
  /**
   * Create new workflow state
   */
  async createWorkflowState(
    userId: string,
    initialStep: WorkflowStep = 'idle',
    chatId: string | null = null,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      const dbStep = WorkflowStepMapper.toDatabaseStep(initialStep);
      const now = new Date().toISOString();
      
      const enrichedMetadata = {
        ...metadata,
        appStep: initialStep !== 'idle' ? initialStep : undefined,
        createdAt: now,
        updatedAt: now,
        _clientId: this.clientId,
      };
      
      const { data, error } = await this.supabase
        .from('workflow_states')
        .insert({
          user_id: userId,
          current_step: dbStep,
          chat_id: chatId,
          metadata: enrichedMetadata,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }
      
      if (!data) {
        throw new Error('Failed to create workflow state');
      }
      
      return data.id;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to create workflow state', {
        userId,
        initialStep,
        chatId,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to create workflow state: ${normalizedError.message}`,
        code: 'WORKFLOW_CREATE_FAILED',
        data: { userId, initialStep, chatId, originalError: normalizedError }
      });
    }
  }
  
  /**
   * Get or create workflow state for user
   */
  async getOrCreateForUser(
    userId: string,
    chatId: string | null,
    initialStep: WorkflowStep = 'idle',
    initialMetadata: Record<string, unknown> = {}
  ): Promise<{ id: string; state: WorkflowState }> {
    try {
      // Try to load existing
      const existing = await this.loadStateForUser(userId, chatId);
      if (existing) {
        return { id: existing.id, state: existing };
      }
      
      // Create new
      const id = await this.createWorkflowState(userId, initialStep, chatId, initialMetadata);
      const state = await this.getWorkflowState(id);
      
      if (!state) {
        throw new Error('Failed to retrieve newly created workflow state');
      }
      
      return { id, state };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get or create workflow for user', {
        userId,
        chatId,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to get or create workflow: ${normalizedError.message}`,
        code: 'WORKFLOW_GET_OR_CREATE_FAILED',
        data: { userId, chatId, originalError: normalizedError }
      });
    }
  }
  
  /**
   * Load workflow state by user ID and optional chat ID
   */
  async loadStateForUser(
    userId: string,
    chatId?: string | null
  ): Promise<WorkflowState & { id: string } | null> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
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
      
      if (error) throw error;
      if (!data) return null;
      
      // Create DB workflow state object
      const dbWorkflowState: DbWorkflowState = {
        id: data.id,
        step: data.current_step,
        progress: typeof data.metadata?.progress === 'number' ? data.metadata.progress : 0,
        phase: typeof data.metadata?.phase === 'string' ? data.metadata.phase : undefined,
        error: typeof data.metadata?.error === 'string' ? data.metadata.error : null,
        metadata: data.metadata || {},
        timestamp: data.updated_at || new Date().toISOString(),
      };
      
      // Map to domain model and add ID
      const state = workflowStateMapper.toDomain(dbWorkflowState);
      return { ...state, id: data.id };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to load workflow state for user', {
        userId,
        chatId,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to load workflow state: ${normalizedError.message}`,
        code: 'WORKFLOW_LOAD_FAILED',
        data: { userId, chatId, originalError: normalizedError }
      });
    }
  }
  
  /**
   * Update workflow state
   */
  async updateWorkflowState(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, unknown> = {},
    options: UpdateOptions = {}
  ): Promise<WorkflowState> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      const dbStep = WorkflowStepMapper.toDatabaseStep(step);
      const now = new Date().toISOString();
      
      // Enrich metadata with client info
      const enrichedMetadata = {
        ...metadata,
        updatedAt: now,
        _clientId: this.clientId,
      };
      
      // Check if we should use atomic update function
      if (options.expectedTimestamp) {
        // Use optimistic concurrency control
        const { data, error } = await this.supabase.rpc(
          'update_workflow_state_atomic',
          {
            p_workflow_id: workflowId,
            p_new_step: dbStep,
            p_metadata: enrichedMetadata,
            p_expected_timestamp: options.expectedTimestamp
          }
        );
        
        if (error) {
          // Handle concurrency conflict
          if (error.message && error.message.includes('CONCURRENT_MODIFICATION')) {
            throw new ApplicationError({
              message: 'Concurrent modification detected',
              code: 'CONCURRENT_MODIFICATION',
              data: {
                workflowId,
                expectedTimestamp: options.expectedTimestamp
              }
            });
          }
          throw error;
        }
        
        // Fetch updated state
        const updated = await this.getWorkflowState(workflowId);
        if (!updated) {
          throw new Error('Failed to retrieve updated workflow state');
        }
        
        return updated;
      }
      
      // Use conflict resolution strategy if specified
      if (options.conflictStrategy) {
        const strategy = options.forceUpdate 
          ? 'force' 
          : options.conflictStrategy;
        
        const result = await this.updateWithConflictResolution(
          workflowId,
          step,
          enrichedMetadata,
          {
            strategy
          }
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to update workflow state');
        }
        
        // Fetch updated state
        const updated = await this.getWorkflowState(workflowId);
        if (!updated) {
          throw new Error('Failed to retrieve updated workflow state');
        }
        
        return updated;
      }
      
      // Direct update (legacy approach)
      const { data, error } = await this.supabase
        .from('workflow_states')
        .update({
          current_step: dbStep,
          metadata: enrichedMetadata,
          updated_at: now,
        })
        .eq('id', workflowId)
        .select()
        .single();
      
      if (error) throw error;
      if (!data) {
        throw new Error('No data returned from update');
      }
      
      // Create DB workflow state object
      const dbWorkflowState: DbWorkflowState = {
        id: data.id,
        step: data.current_step,
        progress: typeof data.metadata?.progress === 'number' ? data.metadata.progress : 0,
        phase: typeof data.metadata?.phase === 'string' ? data.metadata.phase : undefined,
        error: typeof data.metadata?.error === 'string' ? data.metadata.error : null,
        metadata: data.metadata || {},
        timestamp: data.updated_at || now,
      };
      
      // Map to domain model
      return workflowStateMapper.toDomain(dbWorkflowState);
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update workflow state', {
        workflowId,
        step,
        error: normalizedError.message
      });
      throw new ApplicationError({
        message: `Failed to update workflow state: ${normalizedError.message}`,
        code: 'WORKFLOW_UPDATE_FAILED',
        data: { workflowId, step, originalError: normalizedError }
      });
    }
  }
  
  /**
   * Update workflow state with conflict resolution
   */
  async updateWithConflictResolution(
    workflowId: string,
    step: WorkflowStep,
    metadata: Record<string, unknown> = {},
    options: {
      expectedTimestamp?: string;
      strategy?: 'fail' | 'force' | 'merge';
    } = {}
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Prepare metadata with client info
      const enrichedMetadata = {
        ...metadata,
        updatedAt: new Date().toISOString(),
        _clientId: this.clientId,
      };
      
      // Get expected timestamp if not provided
      const expectedTimestamp = options.expectedTimestamp ||
                             (await this.getWorkflowState(workflowId))?.timestamp ||
                             new Date().toISOString();
      
      // Use DB function for conflict resolution
      const { data, error } = await this.supabase.rpc(
        'update_workflow_with_conflict_resolution',
        {
          p_workflow_id: workflowId,
          p_new_step: WorkflowStepMapper.toDatabaseStep(step),
          p_metadata: enrichedMetadata,
          p_expected_timestamp: expectedTimestamp,
          p_resolution_strategy: options.strategy || 'fail'
        }
      );
      
      if (error) throw error;
      
      return {
        success: data?.success || false,
        data: data?.data
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      
      // Special handling for concurrent modification errors
      if (normalizedError.message && normalizedError.message.includes('CONCURRENT_MODIFICATION') &&
          options.strategy === 'merge') {
        // If merge strategy and conflict, try to get current state and merge
        try {
          const currentState = await this.getWorkflowState(workflowId);
          if (currentState && currentState.metadata) {
            const mergedMetadata = {
              ...currentState.metadata,
              ...metadata,
              _mergedAt: new Date().toISOString()
            };
            
            // Try again with forced update
            return this.updateWithConflictResolution(
              workflowId,
              step,
              mergedMetadata,
              { strategy: 'force' }
            );
          }
        } catch (mergeError) {
          // If merge fails, continue with original error
          this.logger.error('Failed to merge during conflict resolution', {
            workflowId,
            error: normalizedError.message
          });
        }
      }
      
      this.logger.error('Failed to update with conflict resolution', {
        workflowId,
        step,
        strategy: options.strategy,
        error: normalizedError.message
      });
      
      return {
        success: false,
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Update workflow progress
   */
  async updateProgress(
    workflowId: string,
    progress: number,
    phase: ProcessingPhase,
    currentStep?: WorkflowStep,
    notifyUsers: boolean = true
  ): Promise<boolean> {
    try {
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      // Use the step mapper to convert domain step to DB step
      const dbStep = currentStep
        ? WorkflowStepMapper.toDatabaseStep(currentStep)
        : (await this.getWorkflowState(workflowId))?.currentStep || 'idle';
      
      const { data, error } = await this.supabase.rpc(
        'update_workflow_progress',
        {
          p_workflow_id: workflowId,
          p_progress: progress,
          p_phase: phase.toString(),
          p_current_step: WorkflowStepMapper.toDatabaseStep(dbStep as WorkflowStep),
          p_notify_users: notifyUsers
        }
      );
      
      if (error) throw error;
      return data?.success || false;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update workflow progress', {
        workflowId,
        progress,
        phase,
        error: normalizedError.message
      });
      return false;
    }
  }
  
  /**
   * Update workflow with chat message
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
        throw new Error('Workflow ID is required');
      }
      
      // Prepare metadata with client info
      const enrichedMetadata = {
        ...metadata,
        updatedAt: new Date().toISOString(),
        _clientId: this.clientId,
      };
      
      // Use the DB function for atomic update + message
      const { data, error } = await this.supabase.rpc(
        'update_workflow_with_chat_message',
        {
          p_workflow_id: workflowId,
          p_new_step: WorkflowStepMapper.toDatabaseStep(step),
          p_metadata: enrichedMetadata,
          p_message_content: messageContent,
          p_message_role: messageRole,
          p_message_metadata: messageMetadata
        }
      );
      
      if (error) throw error;
      
      return {
        success: data?.success || false,
        workflowId: data?.workflow?.id,
        messageId: data?.message?.id
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to update with chat message', {
        workflowId,
        step,
        messageRole,
        error: normalizedError.message
      });
      return { success: false };
    }
  }
  
  /**
   * Log workflow event
   */
  async logEvent(
    workflowId: string,
    eventType: string,
    eventData: Record<string, unknown>,
    actorId?: string
  ): Promise<string | null> {
    try {
      if (!workflowId) {
        return null;
      }
      
      // Add timestamp if not present
      const enhancedEventData = {
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString(),
        clientId: this.clientId
      };
      
      const { data, error } = await this.supabase.rpc(
        'log_workflow_event',
        {
          p_workflow_id: workflowId,
          p_event_type: eventType,
          p_event_data: enhancedEventData,
          p_actor_id: actorId
        }
      );
      
      if (error) throw error;
      return data?.event_id || null;
    } catch (err) {
      // Just log error but don't throw since event logging is non-critical
      this.logger.error('Failed to log workflow event', {
        workflowId,
        eventType,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }
  
  /**
   * Recover workflow state
   */
  async recoverState(
    workflowId: string,
    targetStep: WorkflowStep,
    recoveryMetadata?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      if (!workflowId) {
        return false;
      }
      
      // Enhance recovery metadata
      const enhancedRecoveryData = {
        ...(recoveryMetadata || {}),
        recoveredAt: new Date().toISOString(),
        recoveredBy: this.clientId
      };
      
      // Use DB function for recovery
      const { data, error } = await this.supabase.rpc(
        'recover_workflow_state',
        {
          p_workflow_id: workflowId,
          p_target_step: WorkflowStepMapper.toDatabaseStep(targetStep),
          p_recovery_metadata: enhancedRecoveryData
        }
      );
      
      if (error) throw error;
      return data?.success || false;
    } catch (err) {
      this.logger.error('Failed to recover workflow state', {
        workflowId,
        targetStep,
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  }
  
  /**
   * Reconstruct workflow state from events
   */
  async reconstructState(workflowId: string): Promise<Record<string, unknown> | null> {
    try {
      if (!workflowId) {
        return null;
      }
      
      const { data, error } = await this.supabase.rpc(
        'reconstruct_workflow_state',
        { p_workflow_id: workflowId }
      );
      
      if (error) throw error;
      return data;
    } catch (err) {
      this.logger.error('Failed to reconstruct workflow state', {
        workflowId,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
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
  
  /**
   * Get a summary of workflow state for debugging or monitoring
   * 
   * PHASE 3 IMPLEMENTATION:
   * A new simplified method to get summary information across all domains
   * 
   * @param workflowId Workflow ID to summarize
   * @returns Summary information about the workflow
   */
  async getWorkflowSummary(workflowId: string): Promise<Record<string, unknown> | null> {
    try {
      if (!workflowId) {
        return null;
      }
      
      // Get basic workflow state
      const state = await this.getWorkflowState(workflowId);
      if (!state) {
        return null;
      }
      
      // Get last 5 events
      const events = await this.supabase
        .from('workflow_events')
        .select('event_type, occurred_at, event_data')
        .eq('workflow_id', workflowId)
        .order('occurred_at', { ascending: false })
        .limit(5);
      
      // Get last transition
      const transitions = await this.supabase
        .from('workflow_transitions')
        .select('from_step, to_step, transitioned_at')
        .eq('workflow_id', workflowId)
        .order('transitioned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Compile summary
      const summary = {
        workflowId,
        currentState: state.currentStep,
        progress: state.progress,
        error: state.error,
        lastUpdated: state.timestamp,
        metadata: state.metadata,
        lastTransition: transitions.data ? {
          from: transitions.data.from_step,
          to: transitions.data.to_step,
          at: transitions.data.transitioned_at
        } : null,
        recentEvents: events.data || [],
        domains: this.getActiveDomains(state.metadata)
      };
      
      return summary;
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get workflow summary', {
        workflowId,
        error: normalizedError.message
      });
      return null;
    }
  }
  
  /**
   * Identify active domains based on metadata
   * 
   * PHASE 3 IMPLEMENTATION:
   * Helper method to determine which domains are active in a workflow
   */
  private getActiveDomains(metadata: Record<string, unknown>): string[] {
    const domains: string[] = [];
    
    // Check for chat domain
    if (metadata.chatId) {
      domains.push('Chat');
    }
    
    // Check for document domain
    if (metadata.documentId) {
      domains.push('Document');
    }
    
    // Check for verification domain
    if (metadata.verificationId) {
      domains.push('Verification');
    }
    
    // Check for report domain
    if (metadata.reportId) {
      domains.push('Report');
    }
    
    // Check for research domain
    if (metadata.researchId || metadata.isResearchModeActive) {
      domains.push('Research');
    }
    
    // If no specific domains found, add a default
    if (domains.length === 0) {
      domains.push('Workflow');
    }
    
    return domains;
  }
}

// Export singleton instance
export const workflowRepository = new WorkflowRepository();