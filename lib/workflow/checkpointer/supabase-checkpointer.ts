import { createBrowserClient } from '@/lib/supabase/clients';
import type { WorkflowState } from '../state/workflow-state';
import logger from '@/lib/logger';
import type { Database } from '@/lib/types/database';

/**
 * Thread status enum
 */
export enum ThreadStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
  ERROR = 'error'
}

/**
 * Thread metadata interface
 */
export interface ThreadMetadata {
  name?: string;
  description?: string;
  tags?: string[];
  domain?: string;
  intent?: string;
  [key: string]: any;
}

/**
 * Thread list options
 */
export interface ThreadListOptions {
  userId?: string;
  patientId?: string;
  status?: ThreadStatus | ThreadStatus[];
  parentThreadId?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Thread creation options
 */
export interface ThreadCreateOptions {
  name?: string;
  autoArchive?: boolean;
  expiresAt?: Date;
  metadata?: ThreadMetadata;
}

/**
 * Thread fork options
 */
export interface ThreadForkOptions extends ThreadCreateOptions {
  parentThreadId: string;
}

/**
 * LangGraph.js compatible checkpointer implementation that uses Supabase for state persistence
 */
export interface Checkpointer {
  save: (state: WorkflowState, threadId: string) => Promise<void>;
  load: (threadId: string) => Promise<WorkflowState>;
  list: (options?: ThreadListOptions) => Promise<WorkflowState[]>;
  delete: (threadId: string) => Promise<void>;
  subscribe?: (threadId: string, callback: (state: WorkflowState) => void) => () => void;
  
  // Extended thread management
  fork?: (options: ThreadForkOptions) => Promise<string>;
  archive?: (threadId: string, permanent?: boolean) => Promise<boolean>;
  restore?: (threadId: string) => Promise<boolean>;
  pause?: (threadId: string) => Promise<boolean>;
  complete?: (threadId: string) => Promise<boolean>;
}

// Type alias for workflow_states row from the database
type WorkflowStateRow = Database['public']['Tables']['workflow_states']['Row'];

// Type representing the state field that will be stored as JSON
interface StateField {
  state: any;
  [key: string]: any;
}

/**
 * Function to serialize workflow state for database storage
 * Handles non-serializable objects like File
 */
function serializeState(state: WorkflowState): any {
  return JSON.parse(JSON.stringify(state, (key, value) => {
    // Handle File objects (convert to object with metadata)
    if (value instanceof File) {
      return {
        _file: {
          name: value.name,
          size: value.size,
          type: value.type,
          lastModified: value.lastModified,
        }
      };
    }
    
    // Handle Date objects (convert to ISO string)
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    return value;
  }));
}

/**
 * Function to deserialize workflow state from database
 */
function deserializeState(data: any): WorkflowState {
  if (!data) return {} as WorkflowState;
  
  // If we receive a string, parse it
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (error) {
      console.error('Error parsing workflow state:', error);
      return {} as WorkflowState;
    }
  }
  
  return data as WorkflowState;
}

/**
 * Creates a Supabase-based checkpointer for LangGraph workflows
 */
export function createSupabaseCheckpointer(): SupabaseCheckpointer {
  return new SupabaseCheckpointer();
}

/**
 * Supabase implementation of the LangGraph Checkpointer interface
 */
export class SupabaseCheckpointer implements Checkpointer {
  private supabase = createBrowserClient();
  private readonly tableName = 'workflow_states';
  
  /**
   * Saves workflow state to Supabase
   */
  async save(state: WorkflowState, threadId: string): Promise<void> {
    try {
      if (!threadId) {
        throw new Error('ThreadId is required to save workflow state');
      }
      
      // Prepare data for storage
      const serializedState = serializeState(state);
      
      // Insert or update workflow state in Supabase
      const { error } = await this.supabase
        .from(this.tableName)
        .upsert({
          thread_id: threadId,
          thread_status: ThreadStatus.ACTIVE, // Mark as active on save
          metadata: serializedState,
          user_id: state.userId,
          created_at: state.workflowStartedAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      if (error) {
        throw error;
      }
      
      logger.debug('Saved workflow state', { threadId });
    } catch (error) {
      logger.error('Error saving workflow state', { threadId, error });
      throw error;
    }
  }
  
  /**
   * Loads workflow state from Supabase
   */
  async load(threadId: string): Promise<WorkflowState> {
    try {
      if (!threadId) {
        throw new Error('ThreadId is required to load workflow state');
      }
      
      // Query Supabase for workflow state
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('thread_id', threadId)
        .single();
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        return {} as WorkflowState;
      }
      
      // Check if thread is active
      if ((data as WorkflowStateRow).thread_status === ThreadStatus.ARCHIVED) {
        logger.warn('Loading archived thread', { threadId });
      }
      
      // Deserialize state
      const state = deserializeState((data as WorkflowStateRow).metadata);
      
      logger.debug('Loaded workflow state', { threadId });
      
      return state;
    } catch (error) {
      logger.error('Error loading workflow state', { threadId, error });
      return {} as WorkflowState;
    }
  }
  
  /**
   * Lists workflow states with optional filtering
   */
  async list(options?: ThreadListOptions): Promise<WorkflowState[]> {
    try {
      // Build query
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .order('updated_at', { ascending: false });
      
      // Apply filters
      if (options?.userId) {
        query = query.eq('user_id', options.userId);
      }
      
      if (options?.patientId) {
        query = query.eq('patient_id', options.patientId);
      }
      
      if (options?.parentThreadId) {
        query = query.eq('parent_thread_id', options.parentThreadId);
      }
      
      // Handle status filter
      if (options?.status) {
        if (Array.isArray(options.status)) {
          query = query.in('thread_status', options.status);
        } else {
          query = query.eq('thread_status', options.status);
        }
      } else if (!options?.includeArchived) {
        // Default: exclude archived unless specifically requested
        query = query.neq('thread_status', ThreadStatus.ARCHIVED);
      }
      
      // Apply pagination
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      if (options?.offset) {
        query = query.range(options.offset, (options.offset + (options.limit || 20) - 1));
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Deserialize states
      return (data || []).map(item => deserializeState((item as WorkflowStateRow).metadata));
    } catch (error) {
      logger.error('Error listing workflow states', { options, error });
      return [];
    }
  }
  
  /**
   * Deletes workflow state from Supabase
   */
  async delete(threadId: string): Promise<void> {
    try {
      if (!threadId) {
        throw new Error('ThreadId is required to delete workflow state');
      }
      
      // Delete workflow state
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('thread_id', threadId);
      
      if (error) {
        throw error;
      }
      
      logger.debug('Deleted workflow state', { threadId });
    } catch (error) {
      logger.error('Error deleting workflow state', { threadId, error });
      throw error;
    }
  }
  
  /**
   * Subscribes to changes in workflow state
   */
  subscribe(threadId: string, callback: (state: WorkflowState) => void): () => void {
    if (!threadId) {
      throw new Error('ThreadId is required to subscribe to workflow state');
    }
    
    // Create channel for real-time updates
    const channel = this.supabase
      .channel(`workflow_${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: this.tableName,
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          if (payload.new) {
            const state = deserializeState((payload.new as any).metadata);
            callback(state);
          }
        }
      )
      .subscribe();
    
    // Return unsubscribe function
    return () => {
      this.supabase.removeChannel(channel);
    };
  }
  
  /**
   * Creates a fork of an existing thread
   */
  async fork(options: ThreadForkOptions): Promise<string> {
    try {
      const { parentThreadId, name, autoArchive, expiresAt, metadata } = options;
      
      if (!parentThreadId) {
        throw new Error('Parent thread ID is required to fork a thread');
      }
      
      // Call the database function to fork the thread
      const { data, error } = await this.supabase
        .rpc('fork_workflow_thread', {
          p_thread_id: parentThreadId,
          p_new_thread_name: name,
          p_thread_metadata: metadata || {}
        });
      
      if (error) {
        throw error;
      }
      
      // The function returns the new thread ID
      const newThreadId = data as string;
      
      // Update additional properties if needed
      if (autoArchive !== undefined || expiresAt) {
        const updateData: any = {};
        
        if (autoArchive !== undefined) {
          updateData.auto_archive = autoArchive;
        }
        
        if (expiresAt) {
          updateData.expires_at = expiresAt.toISOString();
        }
        
        const { error: updateError } = await this.supabase
          .from(this.tableName)
          .update(updateData)
          .eq('thread_id', newThreadId);
          
        if (updateError) {
          logger.error('Error updating forked thread', { 
            threadId: newThreadId, 
            error: updateError 
          });
        }
      }
      
      logger.debug('Created thread fork', { 
        parentThreadId, 
        newThreadId, 
        name 
      });
      
      return newThreadId;
    } catch (error) {
      logger.error('Error forking thread', { 
        parentThreadId: options.parentThreadId, 
        error 
      });
      throw error;
    }
  }
  
  /**
   * Archives a thread
   */
  async archive(threadId: string, permanent: boolean = false): Promise<boolean> {
    try {
      if (!threadId) {
        throw new Error('Thread ID is required to archive a thread');
      }
      
      // Call the database function to archive the thread
      const { data, error } = await this.supabase
        .rpc('archive_workflow_thread', {
          p_thread_id: threadId,
          p_permanent: permanent
        });
      
      if (error) {
        throw error;
      }
      
      logger.debug('Archived thread', { threadId, permanent });
      
      return true;
    } catch (error) {
      logger.error('Error archiving thread', { threadId, permanent, error });
      throw error;
    }
  }
  
  /**
   * Restores an archived thread
   */
  async restore(threadId: string): Promise<boolean> {
    try {
      if (!threadId) {
        throw new Error('Thread ID is required to restore a thread');
      }
      
      // Call the database function to restore the thread
      const { data, error } = await this.supabase
        .rpc('restore_workflow_thread', {
          p_thread_id: threadId
        });
      
      if (error) {
        throw error;
      }
      
      logger.debug('Restored thread', { threadId });
      
      return true;
    } catch (error) {
      logger.error('Error restoring thread', { threadId, error });
      throw error;
    }
  }
  
  /**
   * Pauses a thread
   */
  async pause(threadId: string): Promise<boolean> {
    try {
      if (!threadId) {
        throw new Error('Thread ID is required to pause a thread');
      }
      
      // Update thread status in database
      const { error } = await this.supabase
        .from(this.tableName)
        .update({
          thread_status: ThreadStatus.PAUSED,
          updated_at: new Date().toISOString()
        })
        .eq('thread_id', threadId);
      
      if (error) {
        throw error;
      }
      
      logger.debug('Paused thread', { threadId });
      
      return true;
    } catch (error) {
      logger.error('Error pausing thread', { threadId, error });
      throw error;
    }
  }
  
  /**
   * Marks a thread as completed
   */
  async complete(threadId: string): Promise<boolean> {
    try {
      if (!threadId) {
        throw new Error('Thread ID is required to complete a thread');
      }
      
      // Update thread status in database
      const { error } = await this.supabase
        .from(this.tableName)
        .update({
          thread_status: ThreadStatus.COMPLETED,
          updated_at: new Date().toISOString()
        })
        .eq('thread_id', threadId);
      
      if (error) {
        throw error;
      }
      
      logger.debug('Completed thread', { threadId });
      
      return true;
    } catch (error) {
      logger.error('Error completing thread', { threadId, error });
      throw error;
    }
  }
}