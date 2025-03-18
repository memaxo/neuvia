import { createBrowserClient } from '@/lib/supabase/clients';
import type { WorkflowState } from '../state/workflow-state';
import logger from '@/lib/logger';
import type { Database } from '@/lib/types/database';
import { uploadService } from '@/lib/services/upload/upload-service';
import type { FileUpload } from '@/lib/types/upload';

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
 * Handles non-serializable objects like File by replacing them with references
 */
function serializeState(state: WorkflowState): any {
  // Create a deep clone to avoid modifying the original
  return JSON.parse(JSON.stringify(state, (key, value) => {
    // Handle File objects (replace with references)
    if (value instanceof File) {
      // Check if we already have a file reference
      if (value._fileReference) {
        // Return just the reference information
        return {
          _fileRef: value._fileReference,
        };
      }
      
      // If this is a new file without a reference, log warning
      // The file should have been uploaded and reference set before serialization
      logger.warn('File in workflow state without reference', {
        fileName: value.name,
        fileSize: value.size
      });
      
      // Return minimal metadata to avoid data loss, but not the full file
      return {
        _pendingFile: {
          name: value.name,
          size: value.size,
          type: value.type,
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
 * Handles file references by preserving them for later resolution
 */
function deserializeState(data: any): WorkflowState {
  if (!data) return {} as WorkflowState;
  
  // If we receive a string, parse it
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (error) {
      logger.error('Error parsing workflow state:', {}, error);
      return {} as WorkflowState;
    }
  }
  
  // Process the data to detect file references
  function processObjectReferences(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    // Process all properties
    for (const key in obj) {
      const value = obj[key];
      
      // If this is a file reference
      if (value && typeof value === 'object') {
        if (value._fileRef) {
          // Mark as a file reference for later resolution
          // We'll leave the reference in place to be resolved later
          // when the file is actually needed
          obj[key] = value;
        } else if (value._pendingFile) {
          // This was a file that didn't have a reference when serialized
          // Leave it as a placeholder, as the actual file is lost
          logger.warn('Found pending file without reference in state', {
            fileName: value._pendingFile.name,
          });
          obj[key] = value;
        } else {
          // Recursively process nested objects
          obj[key] = processObjectReferences(value);
        }
      }
    }
    
    return obj;
  }
  
  return processObjectReferences(data) as WorkflowState;
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
   * Extracts all File objects from the workflow state
   * @private
   */
  private extractFiles(state: WorkflowState): Map<string, File> {
    const fileMap = new Map<string, File>();
    
    // Recursive function to traverse the state object
    const traverse = (obj: any, path: string = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      // Process all properties
      for (const key in obj) {
        const value = obj[key];
        const currentPath = path ? `${path}.${key}` : key;
        
        // If this is a File object, add it to the map
        if (value instanceof File) {
          fileMap.set(currentPath, value);
        } 
        // Recursively process nested objects (but not Files)
        else if (value && typeof value === 'object' && !(value instanceof Date)) {
          traverse(value, currentPath);
        }
      }
    };
    
    traverse(state);
    return fileMap;
  }
  
  /**
   * Uploads files and records references
   * @private
   */
  private async uploadStateFiles(
    files: Map<string, File>, 
    threadId: string, 
    state: WorkflowState
  ): Promise<void> {
    const moduleLogger = logger.withMetadata({
      module: 'SupabaseCheckpointer',
      method: 'uploadStateFiles',
      threadId,
      fileCount: files.size,
    });
    
    moduleLogger.debug('Processing files in workflow state');
    
    // Process each file
    for (const [path, file] of files.entries()) {
      try {
        // Skip files that already have a reference
        if ((file as any)._fileReference) {
          moduleLogger.debug('File already has reference', {
            path,
            reference: (file as any)._fileReference,
          });
          continue;
        }
        
        // Determine file type based on context
        const isDocument = path.includes('document') || 
                           path.includes('file') || 
                           path.includes('attachment');
                           
        const uploadType = isDocument ? 'document' : 'chat-attachment';
        
        // Upload the file
        moduleLogger.debug('Uploading file from workflow state', {
          path,
          fileName: file.name,
          fileSize: file.size,
          uploadType,
        });
        
        const upload = await uploadService.uploadFile(file, {
          type: uploadType,
          metadata: {
            threadId,
            userId: state.userId,
            workflowPath: path,
            isWorkflowFile: true,
          },
          bucketName: 'workflow-files',
          skipProcessing: true, // Skip processing to avoid duplicate work
        });
        
        // Attach the reference to the original file object
        // This modification is important so other code can still use the File
        // but now it has a reference to the stored version
        (file as any)._fileReference = {
          id: upload.id,
          path: upload.path,
          url: upload.url,
          uploadedAt: upload.createdAt.toISOString(),
        };
        
        moduleLogger.debug('File uploaded and reference attached', {
          path,
          fileId: upload.id,
        });
      } catch (error) {
        moduleLogger.error('Error uploading file from workflow state', {
          path,
          fileName: file.name,
        }, error);
        
        // Continue with other files rather than failing the entire save
        // The serialization will still mark this as a pending file
      }
    }
  }
  
  /**
   * Resolves a file reference to retrieve the actual file
   * @private
   */
  private async resolveFileReference(fileRef: { id: string, path: string, url: string }): Promise<File | null> {
    try {
      // Fetch the file from storage using the reference
      const response = await fetch(fileRef.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      // Convert to a file object
      const blob = await response.blob();
      const fileName = fileRef.path.split('/').pop() || 'unknown';
      const file = new File([blob], fileName, { type: blob.type });
      
      // Attach the reference to the file for future use
      (file as any)._fileReference = fileRef;
      
      return file;
    } catch (error) {
      logger.error('Error resolving file reference', {
        fileId: fileRef.id,
        filePath: fileRef.path,
      }, error);
      
      return null;
    }
  }
  
  /**
   * Saves workflow state to Supabase
   */
  async save(state: WorkflowState, threadId: string): Promise<void> {
    try {
      if (!threadId) {
        throw new Error('ThreadId is required to save workflow state');
      }
      
      // First, extract and upload all File objects
      const files = this.extractFiles(state);
      
      if (files.size > 0) {
        logger.debug('Found files in workflow state', { 
          threadId, 
          fileCount: files.size 
        });
        
        // Upload all files and update references
        await this.uploadStateFiles(files, threadId, state);
      }
      
      // Now prepare data for storage
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
      
      logger.debug('Saved workflow state', { 
        threadId, 
        filesProcessed: files.size 
      });
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
      
      // Deserialize state (preserves file references)
      const state = deserializeState((data as WorkflowStateRow).metadata);
      
      // Add DB record to state for reference
      state.db = data as WorkflowStateRow;
      
      logger.debug('Loaded workflow state', { threadId });
      
      return state;
    } catch (error) {
      logger.error('Error loading workflow state', { threadId, error });
      return {} as WorkflowState;
    }
  }
  
  /**
   * Helper method to resolve file references in the state when needed
   * This method is not part of the core Checkpointer interface but provides
   * a way for other code to access files referenced in the state
   */
  async resolveFileReferences(state: WorkflowState): Promise<WorkflowState> {
    const moduleLogger = logger.withMetadata({
      module: 'SupabaseCheckpointer',
      method: 'resolveFileReferences',
      threadId: state.threadId,
    });
    
    moduleLogger.debug('Resolving file references in state');
    
    // Create a clone to avoid modifying the original directly
    const resolvedState = { ...state };
    let fileRefCount = 0;
    
    // Recursive function to traverse and resolve
    const resolveRefs = async (obj: any, path: string = ''): Promise<void> => {
      if (!obj || typeof obj !== 'object') return;
      
      // Get all keys
      const keys = Object.keys(obj);
      
      // Process each key
      for (const key of keys) {
        const value = obj[key];
        const currentPath = path ? `${path}.${key}` : key;
        
        // If this is a file reference
        if (value && typeof value === 'object' && value._fileRef) {
          fileRefCount++;
          moduleLogger.debug('Resolving file reference', {
            path: currentPath,
            ref: value._fileRef,
          });
          
          try {
            // Resolve the reference to get the actual file
            const file = await this.resolveFileReference(value._fileRef);
            if (file) {
              // Replace the reference with the actual file
              obj[key] = file;
              moduleLogger.debug('File reference resolved', {
                path: currentPath,
                fileName: file.name,
              });
            } else {
              moduleLogger.warn('Failed to resolve file reference', {
                path: currentPath,
                ref: value._fileRef,
              });
              // Keep the reference in place
            }
          } catch (error) {
            moduleLogger.error('Error resolving file reference', {
              path: currentPath,
            }, error);
            // Keep the reference in place
          }
        } 
        // Handle pending files (files that were in the state but not uploaded)
        else if (value && typeof value === 'object' && value._pendingFile) {
          moduleLogger.warn('Found pending file without actual data', {
            path: currentPath,
            fileName: value._pendingFile.name,
          });
          // Nothing to do here - the file content is lost
        }
        // Recursively process nested objects
        else if (value && typeof value === 'object' && !(value instanceof Date)) {
          await resolveRefs(value, currentPath);
        }
      }
    };
    
    // Start the recursive resolution
    await resolveRefs(resolvedState);
    
    moduleLogger.debug('Completed file reference resolution', {
      refCount: fileRefCount,
    });
    
    return resolvedState;
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