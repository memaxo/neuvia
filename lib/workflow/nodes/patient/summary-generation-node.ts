// workflow/nodes/patient/summary-generation-node.ts

import { patientSummaryCoreService } from '@/lib/services/patient/core/patient-summary-core-service'
import { patientSummaryFormattingService } from '@/lib/services/patient/formatting/patient-summary-formatting-service'
import { WorkflowSteps, ProcessingPhase } from '@/lib/types/workflow'
import type { WorkflowState, PartialWorkflowState } from '@/workflow/state/workflow-state'
import logger from '@/lib/logger'

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
        currentStep: WorkflowSteps.SUMMARY_GENERATION,
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
          code: 'NO_DOCUMENTS',
          step: WorkflowSteps.SUMMARY_GENERATION,
          timestamp: new Date().toISOString(),
          recoverable: true,
          details: {
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
      currentStep: WorkflowSteps.SUMMARY_GENERATION,
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
    
    // Generate markdown for display
    const summaryMarkdown = patientSummaryFormattingService.generateMarkdown(patientSummary);
    
    // Extract structured data for potential use in other nodes
    const structuredData = patientSummaryFormattingService.extractStructuredData(summaryMarkdown);
    
    // Update progress state to indicate summarization is complete
    partialState.progress = {
      currentStep: WorkflowSteps.SUMMARY_GENERATION,
      percentage: 70,
      phase: ProcessingPhase.SUMMARY_GENERATED,
      isCompleted: false
    };
    
    moduleLogger.info('Patient summary generation completed successfully', {
      documentCount: extractedDocuments.length,
      summaryLength: summaryMarkdown.length
    });
    
    // Return updated state with patient summary
    return {
      ...partialState,
      patientSummary,
      patientSummaryMarkdown: summaryMarkdown,
      patientSummaryStructuredData: structuredData,
      verification: {
        status: 'pending',
        corrections: [],
        verificationStartedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    // Log error
    moduleLogger.error('Patient summary generation failed', {}, error);
    
    // Return error state
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown summary generation error',
        code: 'SUMMARY_GENERATION_ERROR',
        step: WorkflowSteps.SUMMARY_GENERATION,
        timestamp: new Date().toISOString(),
        recoverable: false,
        details: {
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