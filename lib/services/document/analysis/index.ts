/**
 * Document Analysis Service Exports
 * 
 * This file exports all components of the document analysis service module.
 */

// Re-export all types
export * from './types'
export * from './errors'

// Export services
export * from './document-section-service'
export * from './document-type-service'
export * from './key-point-service'

// Export constants
export { 
  MEDICAL_DOCUMENT_TYPES, 
  MEDICAL_SECTION_PATTERNS,
  DOCUMENT_TYPE_PATTERNS,
  IMPORTANT_SECTIONS_BY_DOC_TYPE,
  MEDICAL_INDICATOR_PATTERNS
} from './medical-document-patterns'

// Import logger
import logger from '@/lib/logger'

// Export default instantiated services
import { DocumentSectionService } from './document-section-service'
import { DocumentTypeService } from './document-type-service'
import { KeyPointService } from './key-point-service'

// Create shared instances of the services
const documentSectionService = new DocumentSectionService()
const documentTypeService = new DocumentTypeService(documentSectionService)
const keyPointService = new KeyPointService(documentSectionService)

/**
 * Analyze a document from workflow state
 * 
 * This method handles both document analysis and workflow state transformation
 * allowing workflow nodes to be simpler orchestrators
 * 
 * @param state Current workflow state
 * @returns Partial workflow state with analysis results
 */
export async function analyzeDocumentFromWorkflowState(
  state: any
): Promise<Partial<any>> {
  const moduleLogger = logger.withMetadata({
    method: 'analyzeDocumentFromWorkflowState',
    documentId: state.documentId
  });

  try {
    moduleLogger.info('Processing document analysis from workflow state');
    
    // Validate that we have extracted text to analyze
    if (!state.extractedData?.text) {
      throw new Error('No extracted text available for analysis');
    }
    
    const extractedText = state.extractedData.text;
    
    // 1. Detect document type
    moduleLogger.info('Detecting document type', { 
      documentId: state.documentId,
      textLength: extractedText.length 
    });
    
    const typeDetectionStartTime = Date.now();
    const typeResult = await documentTypeService.detectDocumentType(extractedText);
    const typeDetectionTime = Date.now() - typeDetectionStartTime;
    
    moduleLogger.info('Document type detected', { 
      documentId: state.documentId,
      documentType: `${typeResult.type.category}/${typeResult.type.type}`,
      confidence: typeResult.confidence,
      detectionTimeMs: typeDetectionTime
    });
    
    // Update progress
    const updatedProgress = {
      currentStep: "DOCUMENT_ANALYSIS",
      percentage: 60,
      phase: "ANALYSIS",
      isCompleted: false
    };
    
    // 2. Extract key points if we have a document type
    const keyPointsStartTime = Date.now();
    const keyPoints = await keyPointService.extractKeyPoints(extractedText, typeResult.type);
    const keyPointsTime = Date.now() - keyPointsStartTime;
    
    moduleLogger.info('Key points extracted', { 
      documentId: state.documentId,
      keyPointCount: keyPoints.length,
      extractionTimeMs: keyPointsTime
    });
    
    // 3. Create a basic summary from top key points
    let summary = '';
    if (keyPoints.length > 0) {
      // Use the highest-scoring key points to build a summary
      const topPoints = keyPoints
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(kp => kp.text);
      
      summary = `This appears to be a ${typeResult.type.type} document`;
      
      if (typeResult.detectedSections && typeResult.detectedSections.length > 0) {
        summary += ` with sections including ${typeResult.detectedSections.slice(0, 3).join(', ')}`;
      }
      
      summary += `. Key information: ${topPoints.join(' ')}`;
    } else {
      summary = `This appears to be a ${typeResult.type.type} document. No key points were identified.`;
    }
    
    // Log successful analysis
    moduleLogger.info('Document analysis completed', {
      documentId: state.documentId,
      documentType: `${typeResult.type.category}/${typeResult.type.type}`,
      keyPointCount: keyPoints.length,
      summaryLength: summary.length
    });
    
    // Return the updated workflow state
    return {
      analysisResult: {
        summary,
        keyFindings: keyPoints.map(kp => kp.text),
        documentType: typeResult.type,
        confidence: typeResult.confidence,
        analyzedAt: new Date().toISOString()
      },
      progress: {
        currentStep: "DOCUMENT_ANALYSIS",
        percentage: 70,
        phase: "EXTRACTION_COMPLETED",
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    };
  } catch (error) {
    // Log the error
    moduleLogger.error('Document analysis from workflow state failed', {
      documentId: state.documentId
    }, error);
    
    // Return error state
    return {
      error: {
        message: error instanceof Error ? error.message : 'Unknown analysis error',
        domain: 'analysis',
        step: "DOCUMENT_ANALYSIS",
        timestamp: new Date().toISOString(),
        recoverable: true,
        context: { 
          error: String(error),
          documentId: state.documentId,
          textLength: state.extractedData?.text?.length
        }
      },
      progress: {
        currentStep: "ERROR",
        percentage: state.progress?.percentage || 0,
        phase: "ERROR",
        isCompleted: false
      },
      workflowUpdatedAt: new Date().toISOString()
    };
  }
}

// Default exports for easy consumption
export default {
  sectionService: documentSectionService,
  typeService: documentTypeService,
  keyPointService: keyPointService,
  analyzeFromWorkflowState: analyzeDocumentFromWorkflowState
}