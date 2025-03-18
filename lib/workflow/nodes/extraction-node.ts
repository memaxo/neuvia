/**
 * Document Extraction Node for LangGraph Workflow
 * 
 * This node handles document text extraction using the ExtractionService.
 * It's responsible for extracting text content from document files and updating
 * the workflow state with the extraction results.
 */

import { ExtractionService, type ExtractionOptions } from '@/lib/services/document/extraction/extraction-service'
import type { WorkflowState } from '@/lib/workflow/state/workflow-state'
import { WorkflowSteps, ProcessingPhase } from '@/lib/types/workflow'
import logger from '@/lib/logger'

// Define the return type locally since PartialWorkflowState isn't exported
type PartialWorkflowState = Partial<WorkflowState>;

// Create module-level logger
const moduleLogger = logger.withMetadata({ module: 'ExtractionNode' })

// Initialize extraction service
const extractionService = new ExtractionService()

/**
 * Default extraction options tailored for the workflow
 */
const DEFAULT_EXTRACTION_OPTIONS: ExtractionOptions = {
  splitPages: true,
  extractTables: true,
  detectSections: true,
  ocrImages: true,
  preserveLayout: true,
  maxPageLength: 5000
}

/**
 * Document extraction node for LangGraph workflow
 * 
 * This node extracts text from document files using the ExtractionService
 * and updates the workflow state with extraction results. It now delegates to the
 * extraction service for both domain logic and state transformations, following the
 * pattern of domain services being the single source of truth.
 * 
 * @param state The current workflow state
 * @param options Optional extraction options to customize the extraction process
 * @returns A partial workflow state with extraction results
 */
export const extractionNode = async (
  state: WorkflowState,
  options: ExtractionOptions = DEFAULT_EXTRACTION_OPTIONS
): Promise<PartialWorkflowState> => {
  try {
    // Log the start of extraction at the orchestration level
    moduleLogger.info('Starting document extraction node', {
      documentId: state.documentId,
      workflowId: state.workflowId
    })
    
    // Initialize progress tracking
    const initialState: PartialWorkflowState = {
      progress: {
        currentStep: WorkflowSteps.EXTRACTING,
        percentage: 10,
        phase: ProcessingPhase.EXTRACTION,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    }
    
    // Delegate to domain service for both extraction and state transformation
    const result = await extractionService.extractTextFromWorkflowState(state, options)
    
    // Return result from domain service
    return result
  } catch (error) {
    // Log the error at the orchestration level
    moduleLogger.error('Error in extraction node', { 
      workflowId: state.workflowId,
      documentId: state.documentId
    }, error)
    
    // Return error state
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown extraction error',
        domain: 'extraction',
        step: WorkflowSteps.EXTRACTING,
        timestamp: new Date().toISOString(),
        recoverable: false,
        context: { 
          error: String(error),
          fileName: state.file?.name,
          fileType: state.file?.type
        }
      },
      progress: {
        currentStep: WorkflowSteps.ERROR,
        percentage: state.progress?.percentage || 0,
        phase: ProcessingPhase.ERROR,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    }
  }
}

/**
 * Batch document extraction node for processing multiple files
 * 
 * This is a utility node that can be used when processing multiple files
 * in a single workflow instance.
 * 
 * @param state The current workflow state
 * @param options Optional extraction options
 * @returns A partial workflow state with extraction results for all files
 */
export const batchExtractionNode = async (
  state: WorkflowState,
  options?: ExtractionOptions
): Promise<PartialWorkflowState> => {
  // This would be implemented if batch processing is needed
  // For now it's a placeholder as the current state schema supports a single file
  
  moduleLogger.warn('Batch extraction not fully implemented yet', {
    documentId: state.documentId
  })
  
  // Default to single file extraction for now
  return extractionNode(state, options)
}

export default extractionNode