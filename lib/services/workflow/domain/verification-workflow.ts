/**
 * @fileoverview Verification Workflow Processor
 * 
 * Handles all verification-related workflow operations including:
 * - Verification initialization
 * - Correction processing
 * - Verification state management
 * - Results handling
 */

import { ApplicationError, normalizeError } from '@/lib/errors'
import logger from '@/lib/logger'
import { workflowRepository } from '../infrastructure/workflow-repository'
import { workflowStateManager } from '../infrastructure/workflow-state-manager'
import { workflowEventSourcing } from '../infrastructure/workflow-event-source'
import { workflowTransactionManager } from '../workflow-transaction-manager'

import type { WorkflowStep, ProcessingPhase } from '@/lib/types/workflow'

/**
 * Verification result
 */
export interface VerificationResult {
  /** Verification ID */
  verificationId: string;
  /** Document ID */
  documentId: string;
  /** Summary ID if applicable */
  summaryId?: string;
  /** Whether verification was successful */
  success: boolean;
  /** Verification data */
  data?: Record<string, unknown>;
  /** Verification metadata */
  metadata: Record<string, unknown>;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Correction data
 */
export interface CorrectionData {
  /** Fields that were corrected */
  correctedFields: Record<string, unknown>;
  /** User provided comments */
  userComments?: string;
  /** User ID who made the correction */
  userId: string;
  /** Version ID if applicable */
  versionId?: string;
}

/**
 * Verification options
 */
export interface VerificationOptions {
  /** User ID who initiated verification */
  userId: string;
  /** Document ID to verify */
  documentId: string;
  /** Document data to verify */
  documentData: Record<string, unknown>;
  /** Whether to auto-proceed to report generation after verification */
  autoGenerateReport?: boolean;
  /** Progress callback */
  onProgress?: (progress: number, phase: ProcessingPhase) => void;
  /** Transaction ID for tracking */
  transactionId?: string;
}

/**
 * Verification workflow processor
 */
export class VerificationWorkflow {
  private readonly logger = logger.withMetadata({ module: 'VerificationWorkflow' });
  
  /**
   * Initialize verification process
   */
  async initiateVerification(
    workflowId: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    try {
      // Start transaction for verification
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Get current state
          const currentState = await workflowRepository.getWorkflowState(workflowId);
          if (!currentState) {
            throw new Error('Workflow state not found');
          }
          
          // Determine source step
          const fromStep: WorkflowStep = currentState.currentStep;
          
          // Update workflow state to verification_pending
          await workflowStateManager.transitionState(
            workflowId,
            fromStep,
            'verification_pending',
            {
              documentId: options.documentId,
              documentData: options.documentData,
              userId: options.userId,
              verificationStartedAt: new Date().toISOString(),
              transactionId
            }
          );
          
          // Update progress
          progressCallback(20, ProcessingPhase.VERIFICATION);
          
          // Generate verification ID
          const verificationId = `verify-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
          
          // Prepare verification data
          const verificationData = {
            ...options.documentData,
            verificationId,
            documentId: options.documentId,
            createdAt: new Date().toISOString(),
            status: 'pending'
          };
          
          // Log verification initiation event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'verification_started',
            {
              verificationId,
              documentId: options.documentId,
              timestamp: new Date().toISOString(),
              userId: options.userId,
              transactionId
            }
          );
          
          // Update progress
          progressCallback(50, ProcessingPhase.VERIFICATION);
          
          // Transition to in_progress state
          await workflowStateManager.transitionState(
            workflowId,
            'verification_pending',
            'verification_in_progress',
            {
              verificationId,
              verificationData,
              transactionId
            }
          );
          
          // Final progress update
          progressCallback(100, ProcessingPhase.VERIFICATION_PENDING);
          
          // Return verification result
          return {
            verificationId,
            documentId: options.documentId,
            success: true,
            data: verificationData,
            metadata: {
              status: 'pending',
              createdAt: new Date().toISOString(),
              userId: options.userId
            }
          };
        },
        {
          step: 'verification_pending',
          metadata: {
            documentId: options.documentId,
            userId: options.userId
          },
          onProgress: options.onProgress,
          transactionId: options.transactionId,
          recoveryStep: fromStep => {
            // Determine appropriate recovery step based on source
            if (fromStep === 'extracting' || fromStep === 'verification_pending') {
              return 'idle';
            }
            return 'error';
          }
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to initiate verification', {
        workflowId,
        documentId: options.documentId,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        verificationId: '',
        documentId: options.documentId,
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Process verification correction
   */
  async processCorrection(
    workflowId: string,
    verificationId: string,
    correction: CorrectionData
  ): Promise<VerificationResult> {
    try {
      // Start transaction for correction processing
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Get current state
          const currentState = await workflowRepository.getWorkflowState(workflowId);
          if (!currentState) {
            throw new Error('Workflow state not found');
          }
          
          // Ensure we're in the correct state
          if (currentState.currentStep !== 'verification_in_progress') {
            throw new ApplicationError({
              message: 'Cannot process correction in current workflow state',
              code: 'INVALID_WORKFLOW_STATE',
              data: {
                currentStep: currentState.currentStep,
                expectedStep: 'verification_in_progress',
                workflowId,
                verificationId
              }
            });
          }
          
          // Ensure this workflow has the correct verification ID
          if (currentState.metadata?.verificationId !== verificationId) {
            throw new ApplicationError({
              message: 'Verification ID mismatch',
              code: 'VERIFICATION_ID_MISMATCH',
              data: {
                workflowId,
                verificationId,
                currentVerificationId: currentState.metadata?.verificationId
              }
            });
          }
          
          // Get the current verification data
          const currentVerificationData = currentState.metadata?.verificationData || {};
          const documentId = currentVerificationData.documentId || currentState.metadata?.documentId;
          
          if (!documentId) {
            throw new Error('Document ID not found in workflow state');
          }
          
          // Update progress
          progressCallback(20, ProcessingPhase.VERIFICATION_PROCESSING);
          
          // Apply corrections to verification data
          const updatedVerificationData = {
            ...currentVerificationData,
            ...correction.correctedFields,
            lastModifiedAt: new Date().toISOString(),
            lastModifiedBy: correction.userId,
            status: 'updated',
            userComments: correction.userComments,
            versionId: correction.versionId || `v-${Date.now()}`
          };
          
          // Update progress
          progressCallback(60, ProcessingPhase.VERIFICATION_PROCESSING);
          
          // Log correction event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'verification_updated',
            {
              verificationId,
              documentId,
              timestamp: new Date().toISOString(),
              userId: correction.userId,
              correctionFields: Object.keys(correction.correctedFields),
              versionId: updatedVerificationData.versionId,
              transactionId
            }
          );
          
          // Update workflow state with corrected data
          await workflowStateManager.transitionState(
            workflowId,
            'verification_in_progress',
            'verification_in_progress', // Same state but updated metadata
            {
              verificationData: updatedVerificationData,
              transactionId
            }
          );
          
          // Final progress update
          progressCallback(100, ProcessingPhase.VERIFICATION_PROCESSING);
          
          // Return updated verification result
          return {
            verificationId,
            documentId: documentId as string,
            success: true,
            data: updatedVerificationData,
            metadata: {
              status: 'updated',
              lastModifiedAt: new Date().toISOString(),
              userId: correction.userId,
              versionId: updatedVerificationData.versionId
            }
          };
        },
        {
          step: 'verification_in_progress',
          metadata: {
            verificationId,
            userId: correction.userId
          },
          onProgress: progress => {
            // Simple progress callback
            this.logger.info(`Correction processing progress: ${progress}%`);
          },
          recoveryStep: 'verification_in_progress' // Stay in the same state on failure
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to process correction', {
        workflowId,
        verificationId,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        verificationId,
        documentId: '',
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Complete verification process
   */
  async completeVerification(
    workflowId: string,
    verificationId: string,
    userId: string,
    autoGenerateReport: boolean = false
  ): Promise<VerificationResult> {
    try {
      // Start transaction for verification completion
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Get current state
          const currentState = await workflowRepository.getWorkflowState(workflowId);
          if (!currentState) {
            throw new Error('Workflow state not found');
          }
          
          // Ensure we're in the correct state
          if (currentState.currentStep !== 'verification_in_progress') {
            throw new ApplicationError({
              message: 'Cannot complete verification in current workflow state',
              code: 'INVALID_WORKFLOW_STATE',
              data: {
                currentStep: currentState.currentStep,
                expectedStep: 'verification_in_progress',
                workflowId,
                verificationId
              }
            });
          }
          
          // Ensure this workflow has the correct verification ID
          if (currentState.metadata?.verificationId !== verificationId) {
            throw new ApplicationError({
              message: 'Verification ID mismatch',
              code: 'VERIFICATION_ID_MISMATCH',
              data: {
                workflowId,
                verificationId,
                currentVerificationId: currentState.metadata?.verificationId
              }
            });
          }
          
          // Get the current verification data
          const verificationData = currentState.metadata?.verificationData || {};
          const documentId = verificationData.documentId || currentState.metadata?.documentId;
          
          if (!documentId) {
            throw new Error('Document ID not found in workflow state');
          }
          
          // Update progress
          progressCallback(30, ProcessingPhase.VERIFICATION_COMPLETION);
          
          // Finalize verification data
          const finalVerificationData = {
            ...verificationData,
            completedAt: new Date().toISOString(),
            completedBy: userId,
            status: 'completed'
          };
          
          // Log verification completion event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'verification_completed',
            {
              verificationId,
              documentId,
              timestamp: finalVerificationData.completedAt,
              userId,
              transactionId
            }
          );
          
          // Update progress
          progressCallback(70, ProcessingPhase.VERIFICATION_COMPLETION);
          
          // Update workflow state to verification_completed
          await workflowStateManager.transitionState(
            workflowId,
            'verification_in_progress',
            'verification_completed',
            {
              verificationId,
              verificationData: finalVerificationData,
              documentId,
              completedAt: finalVerificationData.completedAt,
              completedBy: userId,
              transactionId
            }
          );
          
          // Handle auto report generation
          if (autoGenerateReport) {
            // Transition to report generation
            await workflowStateManager.transitionState(
              workflowId,
              'verification_completed',
              'report_generation',
              {
                verificationId,
                documentId,
                reportGenerationStartedAt: new Date().toISOString(),
                transactionId
              }
            );
          }
          
          // Final progress update
          progressCallback(100, ProcessingPhase.VERIFICATION_COMPLETION);
          
          // Return result
          return {
            verificationId,
            documentId: documentId as string,
            success: true,
            data: finalVerificationData,
            metadata: {
              status: 'completed',
              completedAt: finalVerificationData.completedAt,
              userId,
              autoGenerateReport
            }
          };
        },
        {
          step: 'verification_in_progress',
          metadata: {
            verificationId,
            userId
          },
          onProgress: progress => {
            // Simple progress callback
            this.logger.info(`Verification completion progress: ${progress}%`);
          },
          recoveryStep: 'verification_in_progress' // Stay in verification on failure
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to complete verification', {
        workflowId,
        verificationId,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        verificationId,
        documentId: '',
        success: false,
        metadata: {},
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Reject verification (mark as failed)
   */
  async rejectVerification(
    workflowId: string,
    verificationId: string,
    userId: string,
    reason: string
  ): Promise<VerificationResult> {
    try {
      // Start transaction for verification rejection
      return await workflowTransactionManager.executeTransaction(
        workflowId,
        async (progressCallback, transactionId) => {
          // Get current state
          const currentState = await workflowRepository.getWorkflowState(workflowId);
          if (!currentState) {
            throw new Error('Workflow state not found');
          }
          
          // Check current state
          const fromStep = currentState.currentStep;
          if (fromStep !== 'verification_in_progress' && fromStep !== 'verification_pending') {
            throw new ApplicationError({
              message: 'Cannot reject verification in current workflow state',
              code: 'INVALID_WORKFLOW_STATE',
              data: {
                currentStep: fromStep,
                expectedSteps: ['verification_in_progress', 'verification_pending'],
                workflowId,
                verificationId
              }
            });
          }
          
          // Ensure this workflow has the correct verification ID
          if (currentState.metadata?.verificationId !== verificationId) {
            throw new ApplicationError({
              message: 'Verification ID mismatch',
              code: 'VERIFICATION_ID_MISMATCH',
              data: {
                workflowId,
                verificationId,
                currentVerificationId: currentState.metadata?.verificationId
              }
            });
          }
          
          // Get document ID
          const verificationData = currentState.metadata?.verificationData || {};
          const documentId = verificationData.documentId || currentState.metadata?.documentId;
          
          if (!documentId) {
            throw new Error('Document ID not found in workflow state');
          }
          
          // Update progress
          progressCallback(40, ProcessingPhase.VERIFICATION_REJECTION);
          
          // Create rejection data
          const rejectionData = {
            ...verificationData,
            rejectedAt: new Date().toISOString(),
            rejectedBy: userId,
            rejectionReason: reason,
            status: 'rejected'
          };
          
          // Log verification rejection event
          await workflowEventSourcing.appendEvent(
            workflowId,
            'verification_failed',
            {
              verificationId,
              documentId,
              timestamp: rejectionData.rejectedAt,
              userId,
              reason,
              transactionId
            }
          );
          
          // Update progress
          progressCallback(70, ProcessingPhase.VERIFICATION_REJECTION);
          
          // Update workflow state to verification_failed
          await workflowStateManager.transitionState(
            workflowId,
            fromStep,
            'verification_failed',
            {
              verificationId,
              verificationData: rejectionData,
              documentId,
              rejectedAt: rejectionData.rejectedAt,
              rejectedBy: userId,
              rejectionReason: reason,
              transactionId
            }
          );
          
          // Final progress update
          progressCallback(100, ProcessingPhase.VERIFICATION_REJECTION);
          
          // Return result
          return {
            verificationId,
            documentId: documentId as string,
            success: false,
            data: rejectionData,
            metadata: {
              status: 'rejected',
              rejectedAt: rejectionData.rejectedAt,
              userId,
              reason
            }
          };
        },
        {
          step: 'verification_failed',
          metadata: {
            verificationId,
            userId,
            rejectionReason: reason
          },
          onProgress: progress => {
            // Simple progress callback
            this.logger.info(`Verification rejection progress: ${progress}%`);
          },
          recoveryStep: fromStep => fromStep
        }
      );
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to reject verification', {
        workflowId,
        verificationId,
        error: normalizedError.message
      });
      
      // Return error result
      return {
        verificationId,
        documentId: '',
        success: false,
        metadata: {
          error: normalizedError.message
        },
        error: normalizedError.message
      };
    }
  }
  
  /**
   * Get verification status
   */
  async getVerificationStatus(
    workflowId: string,
    verificationId: string
  ): Promise<VerificationResult | null> {
    try {
      // Get workflow state
      const state = await workflowRepository.getWorkflowState(workflowId);
      if (!state) {
        return null;
      }
      
      // Check if verification ID matches
      if (state.metadata?.verificationId !== verificationId) {
        // Try to find in event history
        const events = await workflowEventSourcing.getEventHistory(workflowId, {
          eventType: [
            'verification_started',
            'verification_updated',
            'verification_completed',
            'verification_failed'
          ]
        });
        
        // Find event with this verification ID
        for (const event of events) {
          if (event.event_data?.verificationId === verificationId) {
            // Return basic info from event
            return {
              verificationId,
              documentId: event.event_data.documentId || '',
              success: event.event_type === 'verification_completed',
              metadata: {
                status: this.mapEventTypeToStatus(event.event_type),
                timestamp: event.occurred_at,
                eventType: event.event_type,
                ...event.event_data
              }
            };
          }
        }
        
        return null;
      }
      
      // Get verification data
      const verificationData = state.metadata?.verificationData || {};
      const documentId = verificationData.documentId || state.metadata?.documentId;
      
      if (!documentId) {
        return null;
      }
      
      // Determine status based on workflow step
      const status = this.mapWorkflowStepToStatus(state.currentStep);
      const success = state.currentStep === 'verification_completed';
      
      // Return verification status
      return {
        verificationId,
        documentId: documentId as string,
        success,
        data: verificationData,
        metadata: {
          status,
          workflowStep: state.currentStep,
          ...state.metadata
        }
      };
    } catch (err) {
      const normalizedError = normalizeError(err);
      this.logger.error('Failed to get verification status', {
        workflowId,
        verificationId,
        error: normalizedError.message
      });
      return null;
    }
  }
  
  /**
   * Map event type to verification status
   */
  private mapEventTypeToStatus(eventType: string): string {
    switch (eventType) {
      case 'verification_started':
        return 'pending';
      case 'verification_updated':
        return 'in_progress';
      case 'verification_completed':
        return 'completed';
      case 'verification_failed':
        return 'rejected';
      default:
        return 'unknown';
    }
  }
  
  /**
   * Map workflow step to verification status
   */
  private mapWorkflowStepToStatus(step: WorkflowStep): string {
    switch (step) {
      case 'verification_pending':
        return 'pending';
      case 'verification_in_progress':
        return 'in_progress';
      case 'verification_completed':
        return 'completed';
      case 'verification_failed':
        return 'rejected';
      case 'report_generation':
      case 'report_presentation':
        return 'completed';
      default:
        return 'unknown';
    }
  }
}

// Export singleton instance
export const verificationWorkflow = new VerificationWorkflow();