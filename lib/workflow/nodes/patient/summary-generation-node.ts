// workflow/nodes/patient/summary-generation-node.ts

import { patientSummaryCoreService } from '@/lib/services/patient/core/patient-summary-core-service'
import { WorkflowSteps, ProcessingPhase } from '@/lib/types/workflow'
import type { WorkflowState } from '../../state/workflow-state'
import logger from '@/lib/logger'

// Define the return type since PartialWorkflowState isn't exported
type PartialWorkflowState = Partial<WorkflowState>;

/**
 * LangGraph node for generating a patient summary from extracted documents
 * 
 * This node takes extracted document data from the workflow state and
 * generates a comprehensive patient summary.
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
    
    // Update progress state to indicate summarization is starting
    const partialState: PartialWorkflowState = {
      progress: {
        currentStep: "summary_generation", // Use string literal instead of enum
        percentage: 40,
        phase: ProcessingPhase.ANALYSIS,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    };
    
    // Validate required state data
    if (!state.patientId) {
      throw new Error('Patient ID is required for summary generation');
    }
    
    // Get extracted documents from state
    // This could be from document extraction node or directly uploaded
    const extractedDocuments = state.extractedDocuments || [];
    
    if (extractedDocuments.length === 0) {
      moduleLogger.warn('No extracted documents available for summary generation');
      
      return {
        ...partialState,
        error: {
          message: 'No documents available for summary generation',
          domain: 'document', // Changed from code to domain to match WorkflowError
          step: "summary_generation", // Use string literal instead of enum
          timestamp: new Date().toISOString(),
          recoverable: true,
          context: { // Changed details to context to match WorkflowError
            patientId: state.patientId
          }
        },
        progress: {
          currentStep: WorkflowSteps.ERROR,
          percentage: state.progress?.percentage || 0,
          phase: ProcessingPhase.ERROR,
          isCompleted: false
        }
      };
    }
    
    // Update progress
    partialState.progress = {
      currentStep: "summary_generation", // Use string literal instead of enum
      percentage: 50,
      phase: ProcessingPhase.ANALYSIS,
      isCompleted: false
    };
    
    // Check if we have an existing summary to update
    let patientSummary;
    if (state.patientSummary) {
      moduleLogger.info('Updating existing patient summary', {
        newDocumentCount: extractedDocuments.length
      });
      
      // Update existing summary with new documents
      patientSummary = await patientSummaryCoreService.updateSummary(
        state.patientSummary,
        extractedDocuments,
        {
          workflowId: state.threadId,
          onProgress: (progress) => {
            // Progress callback can be used for real-time updates
            // This won't update the state directly but could be used
            // for event emission in a real implementation
          }
        }
      );
    } else {
      moduleLogger.info('Generating new patient summary', {
        documentCount: extractedDocuments.length
      });
      
      // Generate new summary from extracted documents
      patientSummary = await patientSummaryCoreService.generateSummary(
        state.patientId,
        extractedDocuments,
        {
          workflowId: state.threadId,
          onProgress: (progress) => {
            // Progress callback for real-time updates
          }
        }
      );
    }
    
    // Update progress state to indicate summarization is complete
    partialState.progress = {
      currentStep: "summary_generation", // Use string literal instead of enum
      percentage: 70,
      phase: ProcessingPhase.COMPLETION, // Use COMPLETION instead of non-existent SUMMARY_GENERATED
      isCompleted: false
    };
    
    moduleLogger.info('Patient summary generation completed successfully', {
      documentCount: extractedDocuments.length,
      summaryLength: JSON.stringify(patientSummary).length
    });
    
    // Current timestamp for tracking
    const now = new Date().toISOString();
    
    // Return updated state with patient summary
    return {
      ...partialState,
      patientSummary,
      verification: {
        status: 'pending',
        corrections: [],
        verifiedAt: undefined,
        items: []
      }
    };
  } catch (error) {
    // Log error
    moduleLogger.error('Patient summary generation failed', {}, error);
    
    // Return error state
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown summary generation error',
        domain: 'summary', // Changed from code to domain to match WorkflowError
        step: "summary_generation", // Use string literal instead of enum
        timestamp: new Date().toISOString(),
        recoverable: false,
        context: { // Changed details to context to match WorkflowError
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

export default patientSummaryGenerationNode;