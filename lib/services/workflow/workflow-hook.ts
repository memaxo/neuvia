import { useState, useEffect, useCallback } from 'react';
import { workflowService } from '@/lib/services/workflow/workflow-service';
import { workflowMediator } from '@/lib/services/workflow/workflow-mediator';
import { eventService } from '@/lib/services/event-service';
import { EVENT_TYPES } from '@/lib/types/events';
import type { WorkflowStep, ProcessingPhase, WorkflowState } from '@/lib/types/workflow';
import type { VerificationItem } from '@/lib/types/verification';
import type { UUID } from '@/lib/types/base';

/**
 * Workflow state manager interface used by the chat store
 */
export interface WorkflowStateManager {
  getCurrentWorkflowId: () => string | null;
  getCurrentChatId: () => string | null;
  resetWorkflow: () => Promise<void>;
  updateWorkflowState: (step: WorkflowStep, metadata?: Record<string, unknown>) => Promise<void>;
  initiateVerification?: (extractedDocument: any, messageId?: string) => Promise<any>;
  processCorrection?: (correctionText: string, currentSummary: string, messageId?: string) => Promise<any>;
  completeVerification?: (isApproved: boolean, options?: {items?: VerificationItem[], comments?: string}) => Promise<any>;
  beginReportGeneration?: (reportMetadata?: Record<string, unknown>) => Promise<{ success: boolean }>;
}

interface UseWorkflowOptions {
  chatId?: string;
  userId?: string;
  onError?: (error: Error) => void;
  onStateChange?: (state: WorkflowState) => void;
}

/**
 * React hook for integrating workflow state with UI components
 *
 * @param options Hook options
 */
export function useWorkflow(options: UseWorkflowOptions = {}) {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const { chatId, userId, onError, onStateChange } = options;

  // Initialize workflow
  useEffect(() => {
    let mounted = true;
    
    const initWorkflow = async () => {
      try {
        if (!userId) {
          return;
        }
        
        setIsLoading(true);
        
        // Try to load existing workflow or create new one
        const existingWorkflow = await workflowService.loadWorkflowStateForUser(userId, chatId);
        
        if (existingWorkflow) {
          if (mounted) {
            setWorkflowId(existingWorkflow.id);
            
            // Fetch the current state
            const currentState = await workflowService.getWorkflowState(existingWorkflow.id);
            if (currentState && mounted) {
              setWorkflowState(currentState);
              onStateChange?.(currentState);
            }
          }
        } else if (chatId) {
          // Create new workflow
          const result = await workflowService.getOrCreateWorkflowForUser(
            userId,
            chatId,
            'idle',
            { createdAt: new Date().toISOString() }
          );
          
          if (mounted) {
            setWorkflowId(result.id);
            
            // Fetch the current state
            const currentState = await workflowService.getWorkflowState(result.id);
            if (currentState && mounted) {
              setWorkflowState(currentState);
              onStateChange?.(currentState);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing workflow:', err);
        if (mounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          onError?.(error);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    initWorkflow();
    
    return () => {
      mounted = false;
    };
  }, [userId, chatId, onError, onStateChange]);
  
  // Subscribe to workflow changes
  useEffect(() => {
    if (!workflowId) return;
    
    // Subscribe to workflow state changes
    const channel = workflowService.subscribeToWorkflowChanges(
      workflowId,
      (payload) => {
        const newState = {
          currentStep: payload.new.current_step as WorkflowStep,
          progress: (payload.new.metadata as any)?.progress || 0,
          phase: (payload.new.metadata as any)?.phase as ProcessingPhase | undefined,
          error: (payload.new.metadata as any)?.error as string | null | undefined,
          metadata: payload.new.metadata as Record<string, unknown> | undefined,
          timestamp: (payload.new as any)?.updated_at || new Date().toISOString()
        };
        
        setWorkflowState(newState);
        onStateChange?.(newState);
      }
    );
    
    return () => {
      workflowService.unsubscribeFromChannel(channel);
    };
  }, [workflowId, onStateChange]);
  
  // Create workflow state manager for chat store integration
  const workflowStateManager: WorkflowStateManager = {
    getCurrentWorkflowId: useCallback(() => workflowId, [workflowId]),
    getCurrentChatId: useCallback(() => chatId || null, [chatId]),
    
    resetWorkflow: useCallback(async () => {
      if (!workflowId) return;
      
      try {
        await workflowService.updateWorkflowState(
          workflowId,
          'idle',
          { reset: true, resetAt: new Date().toISOString() }
        );
      } catch (err) {
        console.error('Error resetting workflow:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      }
    }, [workflowId, onError]),
    
    updateWorkflowState: useCallback(async (step: WorkflowStep, metadata?: Record<string, unknown>) => {
      if (!workflowId) return;
      
      try {
        await workflowService.updateWorkflowState(workflowId, step, metadata);
        
        // Publish workflow updated event
        await eventService.publish(EVENT_TYPES.WORKFLOW_UPDATED, {
          workflowId,
          currentStep: step,
          progress: metadata?.progress as number || 0,
          phase: metadata?.phase as ProcessingPhase | undefined,
          metadata
        });
      } catch (err) {
        console.error('Error updating workflow state:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      }
    }, [workflowId, onError]),
    
    initiateVerification: useCallback(async (extractedDocument: any, messageId?: string) => {
      if (!workflowId) return null;
      
      try {
        return await workflowMediator.initiateVerification(
          workflowId,
          extractedDocument,
          messageId
        );
      } catch (err) {
        console.error('Error initiating verification:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      }
    }, [workflowId, onError]),
    
    processCorrection: useCallback(async (correctionText: string, currentSummary: string, messageId?: string) => {
      if (!workflowId) return null;
      
      try {
        return await workflowMediator.processCorrection(
          workflowId,
          correctionText,
          currentSummary,
          messageId
        );
      } catch (err) {
        console.error('Error processing correction:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      }
    }, [workflowId, onError]),
    
    completeVerification: useCallback(async (isApproved: boolean, options?: {items?: VerificationItem[], comments?: string}) => {
      if (!workflowId) return null;
      
      try {
        return await workflowMediator.completeVerification(
          workflowId,
          isApproved,
          options
        );
      } catch (err) {
        console.error('Error completing verification:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      }
    }, [workflowId, onError]),
    
    beginReportGeneration: useCallback(async (reportMetadata?: Record<string, unknown>) => {
      if (!workflowId) return { success: false };
      
      try {
        const workflowState = await workflowService.getWorkflowState(workflowId);
        
        if (!workflowState) {
          throw new Error(`Workflow not found: ${workflowId}`);
        }
        
        // Get patient ID from workflow state
        const patientId = workflowState.metadata?.patientId as string;
        
        if (!patientId) {
          throw new Error('No patient ID found in workflow state');
        }
        
        // Get research result from workflow state
        const researchResult = workflowState.metadata?.researchResult;
        
        if (!researchResult) {
          // If no research result, generate one
          const research = await workflowMediator.generateResearch(
            workflowId,
            patientId,
            userId || 'system'
          );
          
          // Generate report from research
          await workflowMediator.generateReport(
            workflowId,
            patientId,
            research,
            reportMetadata
          );
        } else {
          // Generate report from existing research
          await workflowMediator.generateReport(
            workflowId,
            patientId,
            researchResult as Record<string, unknown>,
            reportMetadata
          );
        }
        
        return { success: true };
      } catch (err) {
        console.error('Error beginning report generation:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      }
    }, [workflowId, userId, onError]),
  };
  
  return {
    workflowId,
    workflowState,
    isLoading,
    error,
    workflowStateManager,
    
    // Expose workflow mediator methods directly
    uploadDocument: useCallback(async (file: File, patientId: string) => {
      if (!workflowId) {
        throw new Error('No active workflow');
      }
      
      try {
        return await workflowMediator.initiateDocumentProcessing(
          workflowId,
          file,
          patientId
        );
      } catch (err) {
        console.error('Error uploading document:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      }
    }, [workflowId, onError]),
    
    initiateVerification: workflowStateManager.initiateVerification,
    processCorrection: workflowStateManager.processCorrection,
    completeVerification: workflowStateManager.completeVerification,
    generateReport: workflowStateManager.beginReportGeneration,
    
    formatReport: useCallback(async (reportData: Record<string, unknown>, format: string) => {
      if (!workflowId) {
        throw new Error('No active workflow');
      }
      
      try {
        return await workflowMediator.formatReport(
          workflowId,
          reportData,
          format
        );
      } catch (err) {
        console.error('Error formatting report:', err);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      }
    }, [workflowId, onError]),
  };
}