// lib/workflow/nodes/patient/correction-node.ts

import { patientSummaryVerificationService } from '@/lib/services/patient/verification/patient-summary-verification-service'
import { WorkflowSteps, ProcessingPhase } from '@/lib/types/workflow'
import { VerificationStatus } from '@/lib/types/verification'
import type { WorkflowState } from '../../state/workflow-state'
import logger from '@/lib/logger'

// Define the return type since PartialWorkflowState isn't exported
type PartialWorkflowState = Partial<WorkflowState>;

/**
 * LangGraph node for handling patient summary corrections
 * 
 * This node applies user corrections to the patient summary
 * and updates the workflow state with the corrected summary.
 * 
 * @param state Current workflow state
 * @returns Partial state update with corrected summary
 */
export const patientCorrectionNode = async (
  state: WorkflowState
): Promise<PartialWorkflowState> => {
  const moduleLogger = logger.withMetadata({
    node: 'patientCorrectionNode',
    threadId: state.threadId,
    patientId: state.patientId
  });

  try {
    moduleLogger.info('Processing patient summary correction');
    
    // Ensure we have a patient summary and correction text
    if (!state.patientSummary) {
      throw new Error('No patient summary available for correction');
    }
    
    if (!state.correctionText) {
      // If coming from verification node, correctionText should be there
      // If not explicitly set, try to use the current message content
      if (!state.currentMessage?.content) {
        throw new Error('No correction text available');
      }
      
      state.correctionText = state.currentMessage.content;
    }
    
    // Get user ID for attribution
    const userId = state.userId || 'system';
    
    // Process the correction using the verification service
    const correctedSummary = await patientSummaryVerificationService.processCorrection(
      state.patientSummary,
      state.correctionText,
      {
        workflowId: state.threadId,
        userId,
        onProgress: (progress) => {
          // Progress callback for real-time updates
          // Not used directly in state updates but could be used for events
        }
      }
    );
    
    // Create correction record for the verification history
    const correction = {
      original: JSON.stringify(state.patientSummary),
      corrected: JSON.stringify(correctedSummary),
      timestamp: new Date().toISOString(),
      userId
    };
    
    // Get current corrections from state or initialize empty array
    const currentCorrections = state.verification?.corrections || [];
    
    moduleLogger.info('Correction applied successfully', {
      userId,
      correctionCount: currentCorrections.length + 1
    });
    
    // Return updated state with corrected summary
    return {
      patientSummary: correctedSummary,
      verification: {
        status: 'in_progress',
        corrections: [...currentCorrections, correction],
        verifiedAt: state.verification?.verifiedAt,
        items: state.verification?.items || []
      },
      progress: {
        currentStep: WorkflowSteps.VERIFICATION,
        percentage: 75,
        phase: ProcessingPhase.VERIFICATION,
        isCompleted: false
      },
      // Clear correction text so we don't reapply it
      correctionText: undefined,
      needsCorrection: false,
      workflowUpdatedAt: new Date().toISOString()
    };
  } catch (error) {
    // Log error
    moduleLogger.error('Correction processing failed', {}, error);
    
    // Return error state
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown correction error',
        domain: 'correction',
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

export default patientCorrectionNode;