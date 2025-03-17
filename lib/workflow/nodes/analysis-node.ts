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

import { 
  DocumentTypeService,
  DocumentSectionService,
  KeyPointService
} from '@/lib/services/document/analysis'
import { WorkflowState, PartialWorkflowState } from '@/lib/workflow/state/workflow-state'
import { WorkflowSteps, ProcessingPhase } from '@/lib/types/workflow'
import logger from '@/lib/logger'

// Create module-level logger
const moduleLogger = logger.withMetadata({ module: 'AnalysisNode' })

// Initialize services
const sectionService = new DocumentSectionService()
const typeService = new DocumentTypeService(sectionService)
const keyPointService = new KeyPointService(sectionService)

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
    
    // Update progress state to indicate analysis is starting
    const partialState: PartialWorkflowState = {
      progress: {
        currentStep: WorkflowSteps.DOCUMENT_ANALYSIS,
        percentage: 45,
        phase: ProcessingPhase.ANALYSIS,
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    }
    
    // Validate that we have extracted text to analyze
    if (!state.extractedData?.text) {
      throw new Error('No extracted text available for analysis')
    }
    
    const extractedText = state.extractedData.text
    
    // 1. Detect document type
    moduleLogger.info('Detecting document type', { 
      documentId: state.documentId,
      textLength: extractedText.length 
    })
    
    const typeDetectionStartTime = Date.now()
    const typeResult = await typeService.detectDocumentType(extractedText)
    const typeDetectionTime = Date.now() - typeDetectionStartTime
    
    moduleLogger.info('Document type detected', { 
      documentId: state.documentId,
      documentType: `${typeResult.type.category}/${typeResult.type.type}`,
      confidence: typeResult.confidence,
      detectionTimeMs: typeDetectionTime
    })
    
    // Update progress
    partialState.progress = {
      currentStep: WorkflowSteps.DOCUMENT_ANALYSIS,
      percentage: 60,
      phase: ProcessingPhase.ANALYSIS,
      isCompleted: false
    }
    
    // 2. Extract key points if we have a document type
    const keyPointsStartTime = Date.now()
    const keyPoints = await keyPointService.extractKeyPoints(extractedText, typeResult.type)
    const keyPointsTime = Date.now() - keyPointsStartTime
    
    moduleLogger.info('Key points extracted', { 
      documentId: state.documentId,
      keyPointCount: keyPoints.length,
      extractionTimeMs: keyPointsTime
    })
    
    // 3. Create a basic summary from top key points
    let summary = ''
    if (keyPoints.length > 0) {
      // Use the highest-scoring key points to build a summary
      const topPoints = keyPoints
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(kp => kp.text)
      
      summary = `This appears to be a ${typeResult.type.type} document`
      
      if (typeResult.detectedSections && typeResult.detectedSections.length > 0) {
        summary += ` with sections including ${typeResult.detectedSections.slice(0, 3).join(', ')}`
      }
      
      summary += `. Key information: ${topPoints.join(' ')}`
    } else {
      summary = `This appears to be a ${typeResult.type.type} document. No key points were identified.`
    }
    
    // Log successful analysis
    moduleLogger.info('Document analysis completed', {
      documentId: state.documentId,
      documentType: `${typeResult.type.category}/${typeResult.type.type}`,
      keyPointCount: keyPoints.length,
      summaryLength: summary.length
    })
    
    // Update the state with analysis results
    return {
      ...partialState,
      analysisResult: {
        summary,
        keyFindings: keyPoints.map(kp => kp.text),
        documentType: typeResult.type,
        confidence: typeResult.confidence,
        analyzedAt: new Date().toISOString()
      },
      progress: {
        currentStep: WorkflowSteps.DOCUMENT_ANALYSIS,
        percentage: 70,
        phase: ProcessingPhase.EXTRACTION_COMPLETED,
        isCompleted: false
      }
    }
  } catch (error) {
    // Log the error
    moduleLogger.error('Document analysis failed', {
      documentId: state.documentId
    }, error)
    
    // Return error state
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown analysis error',
        code: 'ANALYSIS_ERROR',
        step: WorkflowSteps.DOCUMENT_ANALYSIS,
        timestamp: new Date().toISOString(),
        recoverable: true,
        details: { 
          error: String(error),
          documentId: state.documentId,
          textLength: state.extractedData?.text?.length
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
  // This function could be expanded to include more advanced analysis options
  // such as custom NLP, entity extraction, relation detection, etc.
  // For now, we'll use the standard analysis node
  return analysisNode(state);
}

export default analysisNode