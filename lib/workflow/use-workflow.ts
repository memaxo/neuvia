// lib/workflow/use-workflow.ts
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/clients';
import type { WorkflowStep, WorkflowState, WorkflowOptions } from './types';
import type { Database } from '@/lib/supabase';

type DBWorkflowStep = Database['public']['Enums']['workflow_step'];

interface UseWorkflowOptions {
  userId?: string;
  initialStep?: WorkflowStep;
  chatId?: string | null;
}

/**
 * Custom hook for managing workflow state with database synchronization
 */
export function useWorkflow(options: UseWorkflowOptions = {}) {
  const { userId, initialStep = 'idle', chatId } = options;
  const [state, setState] = useState<WorkflowState>({
    step: initialStep,
    progress: 0,
    timestamp: new Date()
  });
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const supabase = createBrowserClient();
  
  // Load initial state from database
  useEffect(() => {
    if (!userId) return;
    
    const loadWorkflowState = async () => {
      // Get the latest workflow state for this user (and chat if specified)
      const query = supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);
        
      // Add chat_id filter if provided
      const { data } = chatId 
        ? await query.eq('chat_id', chatId)
        : await query.is('chat_id', null);
        
      if (data && data.length > 0) {
        const workflowData = data[0];
        const metadata = workflowData.metadata as Record<string, any> || {};
        
        setState({
          step: workflowData.current_step as WorkflowStep,
          progress: metadata.progress || 0,
          phase: metadata.phase,
          error: metadata.error,
          metadata,
          timestamp: new Date(workflowData.updated_at)
        });
        setWorkflowId(workflowData.id);
      } else {
        // Create a new workflow state if none exists
        await createNewWorkflowState();
      }
    };
    
    loadWorkflowState();
    
    // Set up real-time updates
    const channelName = `workflow-${userId}-${chatId || 'null'}`;
    const channel = supabase.channel(channelName);
    
    const subscription = channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'workflow_states',
        filter: chatId
          ? `user_id=eq.${userId} AND chat_id=eq.${chatId}`
          : `user_id=eq.${userId} AND chat_id IS NULL`
      }, (payload) => {
        const newData = payload.new as any;
        const metadata = newData.metadata as Record<string, any> || {};
        
        setState({
          step: newData.current_step as WorkflowStep,
          progress: metadata.progress || 0,
          phase: metadata.phase,
          error: metadata.error,
          metadata,
          timestamp: new Date(newData.updated_at)
        });
        setWorkflowId(newData.id);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, chatId, supabase]);
  
  // Create a new workflow state in the database
  const createNewWorkflowState = useCallback(async () => {
    if (!userId) return null;
    
    const metadata = {
      progress: 0,
      originalStep: state.step,
      createdAt: new Date().toISOString()
    };
    
    // Ensure we're using a valid database step type
    // If state.step is not a valid DBWorkflowStep, default to 'idle'
    const isValidDBStep = (step: string): step is DBWorkflowStep => {
      const validSteps: DBWorkflowStep[] = [
        'idle', 'uploading', 'extracting', 'verification', 
        'report_generation', 'complete', 'chat_started',
        'chat_in_progress', 'chat_completed', 'chat_error'
      ];
      return validSteps.includes(step as DBWorkflowStep);
    };
    
    const currentStep = isValidDBStep(state.step) ? state.step : 'idle';
    
    const { data, error } = await supabase
      .from('workflow_states')
      .insert({
        user_id: userId,
        current_step: currentStep,
        chat_id: chatId,
        metadata
      })
      .select()
      .single();
    
    if (data && !error) {
      setWorkflowId(data.id);
      return data.id;
    }
    
    console.error('Error creating workflow state:', error);
    return null;
  }, [userId, chatId, state.step, supabase]);
  
  // Update the workflow state in the database
  const updateDatabase = useCallback(async (
    newStep?: WorkflowStep,
    newProgress?: number,
    newPhase?: string,
    newError?: string | null,
    newMetadata?: Record<string, any>
  ) => {
    if (!userId) return;
    
    // If we don't have a workflow ID yet, create a new workflow state
    if (!workflowId) {
      await createNewWorkflowState();
      return;
    }
    
    // Prepare the update
    const updates: any = {};
    
    // Ensure we're using a valid database step type
    if (newStep) {
      const isValidDBStep = (step: string): step is DBWorkflowStep => {
        const validSteps: DBWorkflowStep[] = [
          'idle', 'uploading', 'extracting', 'verification', 
          'report_generation', 'complete', 'chat_started',
          'chat_in_progress', 'chat_completed', 'chat_error'
        ];
        return validSteps.includes(step as DBWorkflowStep);
      };
      
      updates.current_step = isValidDBStep(newStep) ? newStep : 'idle';
    }
    
    // Prepare metadata
    const updatedMetadata = {
      ...(state.metadata || {}),
      ...(newMetadata || {})
    };
    
    // Update specific metadata fields
    if (newProgress !== undefined) {
      updatedMetadata.progress = newProgress;
    }
    
    if (newPhase !== undefined) {
      updatedMetadata.phase = newPhase;
    }
    
    if (newError !== undefined) {
      updatedMetadata.error = newError;
    }
    
    updatedMetadata.updatedAt = new Date().toISOString();
    
    updates.metadata = updatedMetadata;
    
    // Update the database
    const { error } = await supabase
      .from('workflow_states')
      .update(updates)
      .eq('id', workflowId);
    
    if (error) {
      console.error('Error updating workflow state:', error);
    }
  }, [userId, workflowId, state.metadata, createNewWorkflowState, supabase]);
  
  // Update the workflow step
  const updateStep = useCallback((
    step: WorkflowStep,
    metadata?: Record<string, any>
  ) => {
    const newState = {
      ...state,
      step,
      metadata: { ...state.metadata, ...metadata },
      timestamp: new Date()
    };
    
    setState(newState);
    updateDatabase(step, undefined, undefined, undefined, metadata);
    
    return newState;
  }, [state, updateDatabase]);
  
  // Update the progress
  const updateProgress = useCallback((
    progress: number,
    phase?: string
  ) => {
    const newState = {
      ...state,
      progress,
      phase,
      timestamp: new Date()
    };
    
    setState(newState);
    updateDatabase(undefined, progress, phase);
    
    return newState;
  }, [state, updateDatabase]);
  
  // Run an operation with workflow tracking
  const runOperation = useCallback(async <T>(
    step: WorkflowStep,
    operation: () => Promise<T>,
    options?: WorkflowOptions<T>
  ): Promise<T> => {
    try {
      // Update step and reset progress
      updateStep(step, { startedAt: new Date().toISOString() });
      updateProgress(0);
      
      // Report initial progress
      if (options?.onProgress) {
        options.onProgress(0, 'Starting operation');
      }
      
      // Run the operation
      const result = await operation();
      
      // Report completion
      updateProgress(100, 'Complete');
      if (options?.onProgress) {
        options.onProgress(100, 'Complete');
      }
      
      if (options?.onSuccess) {
        options.onSuccess(result);
      }
      
      return result;
    } catch (error) {
      // Handle error
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update state with error
      const newState: WorkflowState = {
        ...state,
        step: 'error' as WorkflowStep,
        error: errorMessage,
        timestamp: new Date()
      };
      
      setState(newState);
      updateDatabase('error' as WorkflowStep, state.progress, state.phase, errorMessage);
      
      if (options?.onError) {
        options.onError(errorMessage);
      }
      
      throw error;
    }
  }, [state, updateStep, updateProgress, updateDatabase]);
  
  // Reset the workflow
  const reset = useCallback(() => {
    const newState: WorkflowState = {
      step: 'idle' as WorkflowStep,
      progress: 0,
      error: null,
      metadata: {},
      timestamp: new Date()
    };
    
    setState(newState);
    updateDatabase('idle' as WorkflowStep, 0, undefined, null, {});
    
    return newState;
  }, [updateDatabase]);
  
  return {
    state,
    workflowId,
    updateStep,
    updateProgress,
    runOperation,
    reset
  };
}