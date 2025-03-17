// workflow/nodes/patient/verification-node.ts

import { patientSummaryVerificationService } from '@/lib/services/patient/verification/patient-summary-verification-service'
import { WorkflowSteps, ProcessingPhase } from '@/lib/types/workflow'
import { VerificationStatus } from '@/lib/types/verification'
import type { WorkflowState } from '../../state/workflow-state'
import logger from '@/lib/logger'

// Define the return type since PartialWorkflowState isn't exported
type PartialWorkflowState = Partial<WorkflowState>;

/**
 * LangGraph node for handling patient summary verification
 * 
 * This node processes user messages to determine if they're confirming
 * the summary or requesting corrections.
 * 
 * @param state Current workflow state
 * @returns Partial state update based on verification status
 */
export const patientVerificationNode = async (
  state: WorkflowState
): Promise<PartialWorkflowState> => {
  const moduleLogger = logger.withMetadata({
    node: 'patientVerificationNode',
    threadId: state.threadId,
    patientId: state.patientId
  });

  try {
    moduleLogger.info('Processing verification message');
    
    // Ensure we have a patient summary and current message
    if (!state.patientSummary) {
      throw new Error('No patient summary available for verification');
    }
    
    if (!state.currentMessage?.content) {
      throw new Error('No message content available for verification');
    }
    
    // Get the current message content
    const messageContent = state.currentMessage.content;
    const userId = state.userId || 'system';
    
    // Check verification status from message content
    const verificationStatus = await patientSummaryVerificationService.checkVerificationStatus(
      messageContent,
      { workflowId: state.threadId }
    );
    
    // Handle different verification statuses
    if (verificationStatus === 'VERIFIED') {
      moduleLogger.info('User confirmed verification', { userId });
      
      // Mark summary as verified
      const verifiedSummary = await patientSummaryVerificationService.verifySummary(
        state.patientId || '',
        userId,
        'verified',
        messageContent
      );
      
      // If verification failed, return error state
      if (!verifiedSummary) {
        return {
          error: {
            message: 'Failed to mark summary as verified',
            domain: 'verification',
            step: "verification",
            timestamp: new Date().toISOString(),
            recoverable: true,
            context: {
              patientId: state.patientId,
              userId
            }
          },
          progress: {
            currentStep: WorkflowSteps.ERROR,
            percentage: state.progress?.percentage || 70,
            phase: ProcessingPhase.ERROR,
            isCompleted: false
          },
          workflowUpdatedAt: new Date().toISOString()
        };
      }
      
      // Update state with verified summary
      return {
        patientSummary: verifiedSummary,
        verification: {
          status: 'completed',
          verifiedAt: new Date().toISOString(),
          verifiedBy: userId,
          corrections: state.verification?.corrections || [],
          items: state.verification?.items || []
        },
        progress: {
          currentStep: WorkflowSteps.VERIFICATION_COMPLETED,
          percentage: 80,
          phase: ProcessingPhase.VERIFICATION_COMPLETION,
          isCompleted: false
        },
        workflowUpdatedAt: new Date().toISOString(),
        readyForReport: true
      };
    } else if (verificationStatus === 'NEEDS_CORRECTION') {
      moduleLogger.info('User requested correction', { userId });
      
      // Signal that correction is needed
      return {
        needsCorrection: true,
        correctionText: messageContent,
        progress: {
          currentStep: WorkflowSteps.VERIFICATION,
          percentage: 75,
          phase: ProcessingPhase.VERIFICATION,
          isCompleted: false
        },
        workflowUpdatedAt: new Date().toISOString()
      };
    } else {
      // Handle unclear verification status
      moduleLogger.info('Verification status unclear', { userId, messageContent });
      
      // Return state with request for clarification
      return {
        verification: {
          status: 'in_progress',
          corrections: state.verification?.corrections || [],
          verifiedAt: state.verification?.verifiedAt,
          items: state.verification?.items || []
        },
        progress: {
          currentStep: WorkflowSteps.VERIFICATION,
          percentage: 75,
          phase: ProcessingPhase.VERIFICATION,
          isCompleted: false
        },
        workflowUpdatedAt: new Date().toISOString()
      };
    }
  } catch (error) {
    // Log error
    moduleLogger.error('Verification processing failed', {}, error);
    
    // Return error state
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown verification error',
        domain: 'verification',
        step: "verification",
        timestamp: new Date().toISOString(),
        recoverable: true,
        context: {
          threadId: state.threadId,
          patientId: state.patientId,
          error: String(error)
        }
      },
      progress: {
        currentStep: WorkflowSteps.ERROR,
        percentage: state.progress?.percentage || 0,
        phase: ProcessingPhase.ERROR,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    };
  }
};

export default patientVerificationNode;