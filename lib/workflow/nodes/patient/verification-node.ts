// workflow/nodes/patient/verification-node.ts

import { patientSummaryVerificationService } from '@/lib/services/patient/verification/patient-summary-verification-service'
import { ProcessingPhase } from '@/lib/types/workflow'
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
    
    // Initial progress update
    const initialState: PartialWorkflowState = {
      progress: {
        currentStep: "verification",
        percentage: 75,
        phase: ProcessingPhase.VERIFICATION,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    };
    
    // Delegate to domain service's workflow-aware method
    // The service will handle all verification logic and state transformation
    const result = await patientSummaryVerificationService.processVerificationFromWorkflowState(state);
    
    // Return combined state
    return {
      ...initialState,
      ...result
    };
  } catch (error) {
    // Log critical orchestration errors
    moduleLogger.error('Verification node orchestration failed', {}, error);
    
    // Return error state for orchestration errors
    return {
      error: {
        message: error instanceof Error ? error.message : 'Orchestration error in verification',
        domain: 'workflow',
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
        currentStep: "ERROR",
        percentage: state.progress?.percentage || 0,
        phase: ProcessingPhase.ERROR,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    };
  }
};

export default patientVerificationNode;