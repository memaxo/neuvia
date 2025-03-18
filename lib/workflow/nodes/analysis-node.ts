/**
 * Document Analysis Node for LangGraph Workflow
 * 
 * This node handles document analysis operations including:
 * - Document type detection
 * - Document section detection
 * - Key point extraction
 * 
 * It integrates with the document analysis services to analyze extracted document text
 * and updates the workflow state with analysis results.
 */

import { analyzeDocumentFromWorkflowState } from '@/lib/services/document/analysis'
import { WorkflowState, PartialWorkflowState } from '@/lib/workflow/state/workflow-state'
import { ProcessingPhase } from '@/lib/types/workflow'
import logger from '@/lib/logger'

// Create module-level logger
const moduleLogger = logger.withMetadata({ module: 'AnalysisNode' })

/**
 * Document analysis node for LangGraph workflow
 * 
 * This node analyzes document content and updates the workflow state with:
 * - Detected document type
 * - Key findings
 * - Summary information
 * 
 * @param state The current workflow state
 * @returns A partial workflow state with analysis results
 */
export const analysisNode = async (
  state: WorkflowState
): Promise<PartialWorkflowState> => {
  try {
    // Log the start of analysis
    moduleLogger.info('Starting document analysis', {
      documentId: state.documentId,
      extractedTextLength: state.extractedData?.text?.length
    })
    
    // Initial progress update
    const initialState: PartialWorkflowState = {
      progress: {
        currentStep: "DOCUMENT_ANALYSIS",
        percentage: 45,
        phase: ProcessingPhase.ANALYSIS,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    }
    
    // Delegate to domain service's workflow-aware method
    // The service will handle all analysis logic and state transformation
    const result = await analyzeDocumentFromWorkflowState(state);
    
    // Return combined state
    return {
      ...initialState,
      ...result
    }
  } catch (error) {
    // Log critical orchestration errors
    moduleLogger.error('Document analysis node orchestration failed', {
      documentId: state.documentId
    }, error)
    
    // Return error state for orchestration errors
    return {
      error: {
        message: error instanceof Error ? error.message : 'Orchestration error in document analysis',
        domain: 'workflow',
        step: "DOCUMENT_ANALYSIS",
        timestamp: new Date().toISOString(),
        recoverable: true,
        context: { 
          error: String(error),
          documentId: state.documentId
        }
      },
      progress: {
        currentStep: "ERROR",
        percentage: state.progress?.percentage || 0,
        phase: ProcessingPhase.ERROR,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    }
  }
}

/**
 * Enhanced analysis node with more advanced processing options
 * This is an alternative entry point for workflows that need more detailed analysis
 * 
 * @param state The current workflow state
 * @param options Analysis options to customize the analysis process
 * @returns A partial workflow state with analysis results
 */
export const enhancedAnalysisNode = async (
  state: WorkflowState,
  options: {
    generateSummary?: boolean;
    extractKeyPoints?: boolean;
    detectSections?: boolean;
    maxKeyPoints?: number;
  } = {}
): Promise<PartialWorkflowState> => {
  // For now, we'll use the standard analysis node
  // In the future, this could pass options to the service layer
  return analysisNode(state);
}

export default analysisNode