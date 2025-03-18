// workflow/nodes/patient/summary-generation-node.ts

import { patientSummaryCoreService } from '@/lib/services/patient/core/patient-summary-core-service'
import { ProcessingPhase } from '@/lib/types/workflow'
import type { WorkflowState } from '../../state/workflow-state'
import logger from '@/lib/logger'

// Define the return type since PartialWorkflowState isn't exported
type PartialWorkflowState = Partial<WorkflowState>;

/**
 * LangGraph node for generating a patient summary from extracted documents
 * 
 * This node takes extracted document data from the workflow state and
 * generates a comprehensive patient summary using the core service.
 * 
 * @param state Current workflow state
 * @returns Partial state update with generated summary
 */
export const patientSummaryGenerationNode = async (
  state: WorkflowState
): Promise<PartialWorkflowState> => {
  const moduleLogger = logger.withMetadata({
    node: 'patientSummaryGenerationNode',
    threadId: state.threadId,
    patientId: state.patientId
  });

  try {
    moduleLogger.info('Starting patient summary generation');
    
    // Initial progress update to indicate start of summary generation
    const initialState: PartialWorkflowState = {
      progress: {
        currentStep: "summary_generation",
        percentage: 40,
        phase: ProcessingPhase.ANALYSIS,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    };

    // Delegate to domain service's workflow-aware method
    // The service will handle validation, business logic, and state transformation
    const result = await patientSummaryCoreService.generateSummaryFromWorkflowState(state);
    
    // Return combined state
    return {
      ...initialState,
      ...result
    };
  } catch (error) {
    // Log critical orchestration errors
    moduleLogger.error('Patient summary generation node failed', {}, error);
    
    // Return error state
    return {
      error: {
        message: error instanceof Error ? error.message : 'Orchestration error in summary generation',
        domain: 'workflow',
        step: "summary_generation",
        timestamp: new Date().toISOString(),
        recoverable: false,
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

export default patientSummaryGenerationNode;