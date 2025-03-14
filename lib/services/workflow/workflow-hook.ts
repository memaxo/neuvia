import { useState, useEffect, useCallback } from 'react';
import { workflowService } from '@/lib/services/workflow/workflow-service';
import { workflowCoordinator } from '@/lib/services/workflow/coordination/workflow-coordinator';
import { workflowTransactionManager } from '@/lib/services/workflow/workflow-transaction-manager';
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
              // Cast the currentState to WorkflowState to fix type compatibility issues
              const workflowState: WorkflowState = {
                currentStep: currentState.currentStep as WorkflowStep,
                progress: currentState.progress,
                phase: currentState.phase as ProcessingPhase | undefined,
                error: currentState.error,
                metadata: currentState.metadata,
                timestamp: currentState.timestamp || currentState.updatedAt
              };
              
              setWorkflowState(workflowState);
              onStateChange?.(workflowState);
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
              // Cast the currentState to WorkflowState to fix type compatibility issues
              const workflowState: WorkflowState = {
                currentStep: currentState.currentStep as WorkflowStep,
                progress: currentState.progress,
                phase: currentState.phase as ProcessingPhase | undefined,
                error: currentState.error,
                metadata: currentState.metadata,
                timestamp: currentState.timestamp || currentState.updatedAt
              };
              
              setWorkflowState(workflowState);
              onStateChange?.(workflowState);
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
        // Use workflow transaction manager for atomic execution with progress tracking
        return await workflowTransactionManager.executeTransaction(
          workflowId,
          async (progressCallback, transactionId) => {
            // Start with transition to verification_pending
            await workflowService.updateWorkflowState(
              workflowId,
              'verification_pending',
              {
                transactionId,
                documentId: extractedDocument.id,
                phase: 'verification_pending'
              }
            );
            
            // Update progress
            progressCallback(20, ProcessingPhase.VERIFICATION);
            
            // Use coordinator to initiate verification
            const result = await workflowCoordinator.initiateVerification({
              workflowId,
              extractedDocument,
              messageId,
              onProgress: (progress, phase) => {
                // Forward progress updates
                progressCallback(progress, phase);
              }
            });
            
            // Final progress update
            progressCallback(100, ProcessingPhase.VERIFICATION);
            
            return result;
          },
          {
            step: 'verification_pending',
            metadata: {
              documentId: extractedDocument.id,
              messageId
            },
            withNotifications: !!chatId,
            chatId: chatId || undefined,
            recoveryStep: 'extracting'
          }
        );
      } catch (err) {
        const normalizedError = normalizeError(err);
        console.error('Error initiating verification:', normalizedError);
        setError(normalizedError);
        onError?.(normalizedError);
        throw normalizedError;
      }
    }, [workflowId, onError, chatId]),
    
    processCorrection: useCallback(async (correctionText: string, currentSummary: string, messageId?: string) => {
      if (!workflowId) return null;
      
      try {
        // Use workflow coordinator with better error handling
        return await workflowCoordinator.processVerificationCorrection({
          workflowId,
          correctionText,
          currentSummary,
          messageId,
          chatId: chatId || undefined,
          onProgress: (progress, phase) => {
            // Optionally handle progress updates
            console.log(`Correction progress: ${progress}% (${phase})`);
          }
        });
      } catch (err) {
        const normalizedError = normalizeError(err);
        console.error('Error processing correction:', normalizedError);
        setError(normalizedError);
        onError?.(normalizedError);
        
        // Set workflow to error state if needed
        try {
          await workflowService.updateWorkflowState(
            workflowId,
            'verification_in_progress',
            {
              error: normalizedError.message,
              errorCode: normalizedError.code || 'CORRECTION_ERROR',
              errorTimestamp: new Date().toISOString()
            }
          );
        } catch (stateError) {
          console.warn('Failed to update workflow error state', stateError);
        }
        
        throw normalizedError;
      }
    }, [workflowId, onError, chatId]),
    
    completeVerification: useCallback(async (isApproved: boolean, options?: {items?: VerificationItem[], comments?: string}) => {
      if (!workflowId) return null;
      
      try {
        // Use workflowCoordinator for completion with transaction support
        return await workflowTransactionManager.executeTransaction(
          workflowId,
          async (progressCallback, transactionId) => {
            // Initial progress update
            progressCallback(10, ProcessingPhase.VERIFICATION_COMPLETION);
            
            // Complete verification through coordinator
            const result = await workflowCoordinator.completeVerification(
              workflowId,
              {
                isApproved,
                options,
                transactionId,
                onProgress: (progress, phase) => {
                  progressCallback(progress, phase);
                }
              }
            );
            
            // Final progress update
            progressCallback(100, ProcessingPhase.VERIFICATION_COMPLETION);
            
            return result;
          },
          {
            step: isApproved ? 'verification_completed' : 'verification_failed',
            metadata: {
              isApproved,
              verificationCompleted: true,
              completedAt: new Date().toISOString(),
              ...(options || {})
            },
            withNotifications: !!chatId,
            chatId: chatId || undefined,
            recoveryStep: 'verification_in_progress'
          }
        );
      } catch (err) {
        const normalizedError = normalizeError(err);
        console.error('Error completing verification:', normalizedError);
        setError(normalizedError);
        onError?.(normalizedError);
        
        // Set appropriate error state
        try {
          await workflowService.updateWorkflowState(
            workflowId,
            isApproved ? 'verification_in_progress' : 'verification_failed',
            {
              error: normalizedError.message,
              errorCode: normalizedError.code || 'VERIFICATION_COMPLETION_ERROR',
              errorTimestamp: new Date().toISOString()
            }
          );
        } catch (stateError) {
          console.warn('Failed to update workflow error state', stateError);
        }
        
        throw normalizedError;
      }
    }, [workflowId, onError, chatId]),
    
    beginReportGeneration: useCallback(async (reportMetadata?: Record<string, unknown>) => {
      if (!workflowId) return { success: false };
      
      try {
        // Use transaction manager for reliable, atomic report generation
        const result = await workflowTransactionManager.executeTransaction(
          workflowId,
          async (progressCallback, transactionId) => {
            // Initial progress update
            progressCallback(10, ProcessingPhase.REPORT_GENERATION);
            
            // Get current workflow state
            const rawWorkflowState = await workflowService.getWorkflowState(workflowId);
            
            if (!rawWorkflowState) {
              throw new Error(`Workflow not found: ${workflowId}`);
            }
            
            // Cast to WorkflowState
            const workflowState: WorkflowState = {
              currentStep: rawWorkflowState.currentStep as WorkflowStep,
              progress: rawWorkflowState.progress,
              phase: rawWorkflowState.phase as ProcessingPhase | undefined,
              error: rawWorkflowState.error,
              metadata: rawWorkflowState.metadata,
              timestamp: rawWorkflowState.timestamp || rawWorkflowState.updatedAt
            };
            
            // Get patient ID from workflow state
            const patientId = workflowState.metadata?.patientId as string;
            
            if (!patientId) {
              throw new Error('No patient ID found in workflow state');
            }
            
            // Update progress
            progressCallback(20, ProcessingPhase.REPORT_GENERATION);
            
            // Get research result from workflow state
            const researchResult = workflowState.metadata?.researchResult;
            
            let report;
            
            if (!researchResult) {
              // If no research result, generate one using coordinator
              progressCallback(30, ProcessingPhase.RESEARCH);
              
              const research = await workflowCoordinator.generateResearch(
                workflowId,
                patientId,
                userId || 'system'
              );
              
              // Update progress
              progressCallback(60, ProcessingPhase.REPORT_GENERATION);
              
              // Generate report from research using coordinator
              report = await workflowCoordinator.generateReport(
                workflowId,
                patientId,
                research,
                reportMetadata
              );
            } else {
              // Generate report from existing research using coordinator
              progressCallback(50, ProcessingPhase.REPORT_GENERATION);
              
              report = await workflowCoordinator.generateReport(
                workflowId,
                patientId,
                researchResult as Record<string, unknown>,
                reportMetadata
              );
            }
            
            // Final progress update
            progressCallback(100, ProcessingPhase.REPORT_GENERATION);
            
            return { success: true, report };
          },
          {
            step: 'report_generation',
            metadata: {
              reportGenerationStartedAt: new Date().toISOString(),
              ...(reportMetadata || {})
            },
            withNotifications: !!chatId,
            chatId: chatId || undefined,
            recoveryStep: 'verification_completed',
            maxRetries: 1
          }
        );
        
        return { success: true, report: result.data.report };
      } catch (err) {
        const normalizedError = normalizeError(err);
        console.error('Error beginning report generation:', normalizedError);
        setError(normalizedError);
        onError?.(normalizedError);
        
        // Set workflow to error state
        try {
          await workflowService.updateWorkflowState(
            workflowId,
            'error',
            {
              error: normalizedError.message,
              errorCode: normalizedError.code || 'REPORT_GENERATION_ERROR',
              errorTimestamp: new Date().toISOString(),
              reportGenerationFailed: true
            }
          );
        } catch (stateError) {
          console.warn('Failed to update workflow error state', stateError);
        }
        
        return { success: false, error: normalizedError.message };
      }
    }, [workflowId, userId, onError, chatId]),
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
        // Use workflowCoordinator for document processing with transaction support
        return await workflowTransactionManager.executeTransaction(
          workflowId,
          async (progressCallback, transactionId) => {
            // Initial progress
            progressCallback(10, ProcessingPhase.UPLOADING);
            
            // Process document using coordinator
            const result = await workflowCoordinator.processDocumentToCompletion(
              workflowId,
              file,
              {
                userId: userId || 'system',
                patientId,
                onProgress: (progress, phase) => {
                  // Forward progress updates
                  progressCallback(progress, phase);
                },
                transactionId
              }
            );
            
            return result.documentId;
          },
          {
            step: 'uploading',
            metadata: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              patientId
            },
            withNotifications: !!chatId,
            chatId: chatId || undefined,
            recoveryStep: 'idle'
          }
        );
      } catch (err) {
        const normalizedError = normalizeError(err);
        console.error('Error uploading document:', normalizedError);
        setError(normalizedError);
        onError?.(normalizedError);
        
        // Set workflow to error state
        try {
          await workflowService.updateWorkflowState(
            workflowId,
            'error',
            {
              error: normalizedError.message,
              errorCode: normalizedError.code || 'DOCUMENT_UPLOAD_ERROR',
              errorTimestamp: new Date().toISOString(),
              fileName: file.name
            }
          );
        } catch (stateError) {
          console.warn('Failed to update workflow error state', stateError);
        }
        
        throw normalizedError;
      }
    }, [workflowId, userId, chatId, onError]),
    
    initiateVerification: workflowStateManager.initiateVerification,
    processCorrection: workflowStateManager.processCorrection,
    completeVerification: workflowStateManager.completeVerification,
    generateReport: workflowStateManager.beginReportGeneration,
    
    formatReport: useCallback(async (reportData: Record<string, unknown>, format: string) => {
      if (!workflowId) {
        throw new Error('No active workflow');
      }
      
      try {
        // Use workflowCoordinator for report formatting
        return await workflowCoordinator.formatReport(
          workflowId,
          reportData,
          format
        );
      } catch (err) {
        const normalizedError = normalizeError(err);
        console.error('Error formatting report:', normalizedError);
        setError(normalizedError);
        onError?.(normalizedError);
        
        // Set workflow to error state
        try {
          await workflowService.updateWorkflowState(
            workflowId,
            'error',
            {
              error: normalizedError.message,
              errorCode: normalizedError.code || 'REPORT_FORMAT_ERROR',
              errorTimestamp: new Date().toISOString(),
              format
            }
          );
        } catch (stateError) {
          console.warn('Failed to update workflow error state', stateError);
        }
        
        throw normalizedError;
      }
    }, [workflowId, onError]),
  };
}