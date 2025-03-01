// lib/workflow/use-workflow.ts
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/clients';
import type { WorkflowStep, WorkflowState, WorkflowOptions, VerificationMetadata, ProcessingPhase, VerificationStatusType } from './types';
import type { Database } from '@/lib/supabase';
import { 
  extractPatientSummary, 
  processCorrection as processPatientSummaryCorrection,
} from '@/lib/langchain/patient-summary';
import { randomUUID } from 'crypto'; // Using standard Node.js UUID generation

// Type alias for database workflow step enum
type DBWorkflowStep = Database['public']['Enums']['workflow_step'];

// Extending Supabase types to include new verification fields
type WorkflowStateRow = Database['public']['Tables']['workflow_states']['Row'] & {
  verification_metadata?: VerificationMetadata;
  correction_history?: Array<any>;
  current_summary_id?: string;
};

// Function to generate unique IDs
const generateUniqueId = () => randomUUID();

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
  const [verificationMetadata, setVerificationMetadata] = useState<VerificationMetadata | null>(null);
  const [correctionHistory, setCorrectionHistory] = useState<Array<any>>([]);
  const [currentSummaryId, setCurrentSummaryId] = useState<string | null>(null);
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
        const workflowData = data[0] as WorkflowStateRow;
        const metadata = workflowData.metadata as Record<string, any> || {};
        
        setState({
          step: metadata.appStep || workflowData.current_step as WorkflowStep,
          progress: metadata.progress || 0,
          phase: metadata.phase,
          error: metadata.error,
          metadata,
          timestamp: new Date(workflowData.updated_at)
        });
        setWorkflowId(workflowData.id);
        
        // Load verification-specific data if available
        if (workflowData.verification_metadata) {
          setVerificationMetadata(workflowData.verification_metadata);
        }
        
        if (workflowData.correction_history) {
          setCorrectionHistory(workflowData.correction_history);
        }
        
        if (workflowData.current_summary_id) {
          setCurrentSummaryId(workflowData.current_summary_id);
        }
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
        const newData = payload.new as WorkflowStateRow;
        const metadata = newData.metadata as Record<string, any> || {};
        
        setState({
          step: metadata.appStep || newData.current_step as WorkflowStep,
          progress: metadata.progress || 0,
          phase: metadata.phase,
          error: metadata.error,
          metadata,
          timestamp: new Date(newData.updated_at)
        });
        setWorkflowId(newData.id);
        
        // Update verification-specific data
        if (newData.verification_metadata) {
          setVerificationMetadata(newData.verification_metadata);
        }
        
        if (newData.correction_history) {
          setCorrectionHistory(newData.correction_history);
        }
        
        if (newData.current_summary_id) {
          setCurrentSummaryId(newData.current_summary_id);
        }
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
      appStep: state.step, // Store app step in metadata
      createdAt: new Date().toISOString()
    };
    
    // Ensure we're using a valid database step type
    const currentStep = isDbWorkflowStep(state.step) 
      ? state.step 
      : 'idle';
    
    const { data, error } = await supabase
      .from('workflow_states')
      .insert({
        user_id: userId,
        current_step: currentStep,
        chat_id: chatId,
        metadata,
        correction_history: []
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
    newMetadata?: Record<string, any>,
    newVerificationMetadata?: VerificationMetadata | null,
    newCorrectionHistory?: Array<any> | null,
    newCurrentSummaryId?: string | null,
    newLastMessageId?: string | null
  ) => {
    if (!userId) return;
    
    // If we don't have a workflow ID yet, create a new workflow state
    if (!workflowId) {
      await createNewWorkflowState();
      return;
    }
    
    // Prepare the update
    const updates: any = {};
    
    // Handle database step or app-only step
    if (newStep) {
      if (isDbWorkflowStep(newStep)) {
        updates.current_step = newStep;
      } else {
        // For app-only steps, use 'idle' in the database and store the real step in metadata
        updates.current_step = 'idle';
      }
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
    
    // Store app-only steps in metadata
    if (newStep && !isDbWorkflowStep(newStep)) {
      updatedMetadata.appStep = newStep;
    }
    
    updatedMetadata.updatedAt = new Date().toISOString();
    
    updates.metadata = updatedMetadata;
    
    // Add verification-specific updates if provided
    if (newVerificationMetadata !== undefined) {
      updates.verification_metadata = newVerificationMetadata;
      setVerificationMetadata(newVerificationMetadata);
    }
    
    if (newCorrectionHistory !== undefined) {
      updates.correction_history = newCorrectionHistory;
      setCorrectionHistory(newCorrectionHistory || []);
    }
    
    if (newCurrentSummaryId !== undefined) {
      updates.current_summary_id = newCurrentSummaryId;
      setCurrentSummaryId(newCurrentSummaryId);
    }
    
    if (newLastMessageId !== undefined) {
      updates.last_message_id = newLastMessageId;
    }
    
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
    phase?: ProcessingPhase
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
      
      // Set up progress handler
      const handleProgress = (progress: number, phase?: string) => {
        updateProgress(progress, phase as ProcessingPhase);
        options?.onProgress?.(progress, phase);
      };
      
      // Set initial progress
      handleProgress(5, 'initialization');
      
      // Run the operation
      const result = await operation();
      
      // Update progress to complete
      handleProgress(100, 'completion');
      
      // Call success handler if provided
      options?.onSuccess?.(result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update step to error state with error message
      updateStep('error', { 
        error: errorMessage,
        errorTimestamp: new Date().toISOString() 
      });
      
      // Call error handler if provided
      options?.onError?.(errorMessage);
      
      // Re-throw the error
      throw error;
    }
  }, [updateStep, updateProgress]);
  
  // Initialize the verification process for a document
  const initiateVerification = useCallback(async (
    extractedDocument: any,
    messageId?: string
  ) => {
    if (!userId || !chatId) {
      throw new Error('User ID and Chat ID are required for verification');
    }
    
    try {
      // Generate a unique ID for this summary
      const summaryId = generateUniqueId();
      
      // Extract the text from the document safely
      const documentText = typeof extractedDocument === 'object' && extractedDocument !== null
        ? (extractedDocument.text || JSON.stringify(extractedDocument))
        : String(extractedDocument);
      
      // Create verification metadata
      const newVerificationMetadata: VerificationMetadata = {
        verificationStatus: 'pending',
        originalSummaryId: summaryId,
        currentVersionId: summaryId,
        correctionCount: 0,
        corrections: [],
        extractedData: extractedDocument
      };
      
      // Prepare verification metadata for database
      const verificationDbMetadata = {
        extracted_data: extractedDocument,
        verification_started_at: new Date().toISOString(),
        status: 'pending'
      };
      
      // Get existing workflow state if available
      const { data: existingState } = await supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      // Create or update workflow state directly
      const { data, error } = await supabase
        .from('workflow_states')
        .upsert({
          id: existingState?.id,
          user_id: userId,
          current_step: 'verification_pending' as DBWorkflowStep,
          metadata: existingState?.metadata || {},
          verification_metadata: verificationDbMetadata,
          chat_id: chatId,
          correction_history: [],
          current_summary_id: summaryId,
          last_message_id: messageId,
          updated_at: new Date().toISOString(),
          created_at: existingState?.created_at || new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      
      // Update local state
      setVerificationMetadata(newVerificationMetadata);
      setCurrentSummaryId(summaryId);
      setCorrectionHistory([]);
      
      // Extract patient summary using LangChain
      const result = await extractPatientSummary(
        documentText,
        workflowId || data.id,
        { useGemini: true },
        (progress, phase) => {
          updateProgress(progress, phase as ProcessingPhase);
        }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to extract patient summary');
      }
      
      // Update to verification pending state
      setState({
        ...state,
        step: 'verification_pending',
        progress: 100,
        phase: 'verification',
        timestamp: new Date()
      });
      
      return {
        summaryId,
        summary: result.summary,
        structuredData: result.structuredData
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error initiating verification:', errorMessage);
      
      // Update to error state
      updateStep('error', { 
        error: errorMessage,
        errorTimestamp: new Date().toISOString() 
      });
      
      throw error;
    }
  }, [userId, chatId, workflowId, state, supabase, updateProgress, updateStep]);
  
  // Process a user correction to the summary
  const processCorrection = useCallback(async (
    correctionText: string,
    currentSummary: string,
    messageId?: string
  ) => {
    if (!userId || !chatId || !currentSummaryId) {
      throw new Error('Missing required IDs for correction processing');
    }
    
    try {
      // Generate a new summary ID for this correction
      const newSummaryId = generateUniqueId();
      
      // Create correction record
      const correctionRecord = {
        id: generateUniqueId(),
        text: correctionText,
        timestamp: new Date().toISOString(),
        summaryId: currentSummaryId,
        messageId: messageId || null
      };
      
      // Fetch current workflow state
      const { data: currentState, error: fetchError } = await supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (fetchError || !currentState) {
        throw new Error('No workflow state found for user');
      }
      
      // Add type cast and check for current_step and correction_history
      const workflowState = currentState as WorkflowStateRow;
      const currentStep = workflowState.current_step;

      // Validate current state - this step should be one of these values
      if (currentStep !== 'verification_pending' && 
          currentStep !== 'verification_in_progress' &&
          currentStep !== 'verification') {
        throw new Error(`Invalid workflow step for correction: ${currentStep}`);
      }

      // Use safer access to correction_history with fallback
      const correctionHistoryData = workflowState.correction_history || [];

      // Add to correction history
      const updatedHistory = [
        ...correctionHistoryData,
        {
          correction_text: correctionText,
          timestamp: new Date().toISOString(),
          summary_id: newSummaryId,
          message_id: messageId
        }
      ];
      
      // Update state to in_progress
      setState({
        ...state,
        step: 'verification_in_progress',
        progress: 0,
        phase: 'correction',
        timestamp: new Date()
      });
      
      // Process the correction with LangChain
      const result = await processPatientSummaryCorrection(
        currentSummary,
        correctionText,
        workflowId || '',
        { useGemini: false }, // Use more precise model for corrections
        (progress, phase) => {
          updateProgress(progress, phase as ProcessingPhase);
        }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process correction');
      }
      
      // Get current verification metadata safely
      const currentVerificationMetadata = workflowState.verification_metadata || {};
      
      // Update verification metadata
      const updatedVerificationMetadata = {
        ...currentVerificationMetadata,
        verificationStatus: 'in_progress' as VerificationStatusType,
        currentVersionId: newSummaryId,
        correctionCount: updatedHistory.length,
        lastUpdated: new Date().toISOString()
      };
      
      // Update database with verification correction
      const { error: updateError } = await supabase
        .from('workflow_states')
        .update({
          current_step: 'verification_in_progress' as DBWorkflowStep,
          verification_metadata: {
            ...currentVerificationMetadata,
            status: 'in_progress'
          },
          current_summary_id: newSummaryId,
          last_message_id: messageId,
          correction_history: updatedHistory,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (updateError) {
        throw new Error(`Database error: ${updateError.message}`);
      }
      
      // Update local state
      setVerificationMetadata(updatedVerificationMetadata as VerificationMetadata);
      setCorrectionHistory(updatedHistory);
      setCurrentSummaryId(newSummaryId);
      
      return {
        summaryId: newSummaryId,
        summary: result.summary,
        structuredData: result.structuredData,
        correctionCount: updatedHistory.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error processing correction:', errorMessage);
      
      // Update to error state
      updateStep('error', { 
        error: errorMessage,
        errorTimestamp: new Date().toISOString() 
      });
      
      throw error;
    }
  }, [userId, chatId, workflowId, state, currentSummaryId, correctionHistory, supabase, updateProgress, updateStep]);
  
  // Complete the verification process
  const completeVerification = useCallback(async (
    finalSummaryId?: string
  ) => {
    if (!userId) {
      throw new Error('User ID required for verification completion');
    }
    
    try {
      const summaryIdToUse = finalSummaryId || currentSummaryId;
      
      if (!summaryIdToUse) {
        throw new Error('No summary ID available for verification completion');
      }
      
      // Get current workflow state
      const { data: currentState, error: fetchError } = await supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (fetchError || !currentState) {
        throw new Error('No workflow state found for user');
      }
      
      const workflowState = currentState as WorkflowStateRow;
      
      // Access metadata and verification metadata safely
      const currentMetadata = workflowState.metadata || {};
      const currentVerificationMetadata = workflowState.verification_metadata || {};
      
      // Update verification metadata
      const updatedVerificationMetadata = {
        ...currentVerificationMetadata,
        verificationStatus: 'completed' as VerificationStatusType,
        verifiedAt: new Date().toISOString(),
        verifiedBy: userId
      };
      
      // Update database
      const { error: updateError } = await supabase
        .from('workflow_states')
        .update({
          current_step: 'verification_completed' as DBWorkflowStep,
          verification_metadata: {
            ...currentVerificationMetadata,
            status: 'completed'
          },
          current_summary_id: summaryIdToUse,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (updateError) {
        throw new Error(`Database error: ${updateError.message}`);
      }
      
      // Update local state
      setState({
        ...state,
        step: 'verification_completed',
        progress: 100,
        phase: 'completion',
        timestamp: new Date()
      });
      
      setVerificationMetadata(updatedVerificationMetadata as VerificationMetadata);
      
      return {
        success: true,
        summaryId: summaryIdToUse,
        correctionCount: correctionHistory.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error completing verification:', errorMessage);
      
      // Update to error state
      updateStep('error', { 
        error: errorMessage,
        errorTimestamp: new Date().toISOString() 
      });
      
      throw error;
    }
  }, [userId, state, currentSummaryId, correctionHistory, supabase, updateStep]);
  
  // Reset verification state
  const resetVerification = useCallback(async () => {
    if (!userId) {
      throw new Error('User ID required for verification reset');
    }
    
    try {
      // Get existing workflow state to preserve it
      const { data: existingState, error: fetchError } = await supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (fetchError) {
        throw new Error(`Error fetching existing data: ${fetchError.message}`);
      }
      
      // Update database
      const { error: updateError } = await supabase
        .from('workflow_states')
        .update({
          current_step: 'idle' as DBWorkflowStep,
          verification_metadata: null,
          current_summary_id: null,
          correction_history: [],
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (updateError) {
        throw new Error(`Database error: ${updateError.message}`);
      }
      
      // Update local state
      setState({
        ...state,
        step: 'idle',
        progress: 0,
        error: null,
        timestamp: new Date()
      });
      
      setVerificationMetadata(null);
      setCorrectionHistory([]);
      setCurrentSummaryId(null);
      
      return {
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error resetting verification:', errorMessage);
      
      throw error;
    }
  }, [userId, state, supabase]);
  
  // Transition to report generation
  const beginReportGeneration = useCallback(async (
    reportMetadata?: Record<string, any>
  ) => {
    if (!userId) {
      throw new Error('User ID required for report generation');
    }
    
    try {
      // Get current workflow state
      const { data: currentState, error: fetchError } = await supabase
        .from('workflow_states')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (fetchError || !currentState) {
        throw new Error('No workflow state found for user');
      }
      
      const workflowState = currentState as WorkflowStateRow;
      const currentStep = workflowState.current_step;

      // Validate current state - this should be verification_completed
      if (currentStep !== 'verification_completed') {
        throw new Error(`Verification must be completed before generating report, current step: ${currentStep}`);
      }
      
      // Access metadata safely
      const currentMetadata = workflowState.metadata || {};
      
      // Combine existing metadata with report metadata
      const combinedMetadata = {
        ...(typeof currentMetadata === 'object' && currentMetadata !== null ? currentMetadata : {}),
        ...(reportMetadata || {})
      };
      
      // Update database
      const { error: updateError } = await supabase
        .from('workflow_states')
        .update({
          current_step: 'report_generation' as DBWorkflowStep,
          metadata: combinedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (updateError) {
        throw new Error(`Database error: ${updateError.message}`);
      }
      
      // Update local state
      setState({
        ...state,
        step: 'report_generation',
        progress: 0,
        phase: 'report_generation',
        timestamp: new Date()
      });
      
      return {
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error starting report generation:', errorMessage);
      
      // Update to error state
      updateStep('error', { 
        error: errorMessage,
        errorTimestamp: new Date().toISOString() 
      });
      
      throw error;
    }
  }, [userId, state, supabase, updateStep]);
  
  // Helper to check if a step exists in the database enum
  function isDbWorkflowStep(step: WorkflowStep): step is DBWorkflowStep {
    const dbSteps: DBWorkflowStep[] = [
      'idle',
      'uploading',
      'extracting',
      'verification',
      'verification_pending',
      'verification_in_progress',
      'verification_completed',
      'verification_failed',
      'report_generation',
      'complete',
      'chat_started',
      'chat_in_progress',
      'chat_completed',
      'chat_error'
    ];
    
    return dbSteps.includes(step as DBWorkflowStep);
  }
  
  return {
    // Current state
    state,
    workflowId,
    
    // Verification-specific state
    verificationMetadata,
    correctionHistory,
    currentSummaryId,
    
    // Base operations
    updateStep,
    updateProgress,
    runOperation,
    
    // Chat verification methods
    initiateVerification,
    processCorrection,
    completeVerification,
    resetVerification,
    beginReportGeneration
  };
}