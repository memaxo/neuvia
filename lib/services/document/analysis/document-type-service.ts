/**
 * Document Type Service
 * 
 * Service focused solely on detecting and classifying document types.
 */

import logger from '@/lib/logger'
import { DocumentCategory } from '@/lib/types/document'
import type { DocumentType } from '@/lib/types/document'
import { DocumentTypeDetectionError } from './errors'
import { 
  MEDICAL_DOCUMENT_TYPES, 
  DOCUMENT_TYPE_PATTERNS 
} from './medical-document-patterns'
import type { DocumentTypeDetectionResult } from './types'
import { DocumentSectionService } from './document-section-service'

/**
 * Service for detecting document types
 */
export class DocumentTypeService {
  /**
   * Logger instance
   */
  private readonly logger: typeof logger

  /**
   * Section service for detecting document sections
   */
  private readonly sectionService: DocumentSectionService
  
  constructor(
    sectionService?: DocumentSectionService,
    loggerInstance?: typeof logger
  ) {
    this.sectionService = sectionService || new DocumentSectionService()
    this.logger = loggerInstance || logger
  }

  /**
   * Detect document type from content
   * 
   * @param content Document content to analyze
   * @returns Detected document type with confidence
   */
  async detectDocumentType(content: string): Promise<DocumentTypeDetectionResult> {
    try {
      // Default document type
      const defaultType: DocumentTypeDetectionResult = {
        type: { category: DocumentCategory.CLINICAL, type: 'note' },
        confidence: 0.5,
      }

      // If no content, return default
      if (!content || content.length < 50) {
        return defaultType
      }

      // Extract the first ~1000 characters for analysis
      const sampleText = content.substring(0, 1000).toLowerCase()

      // Detect document sections
      const detectedSections = this.sectionService.detectSections(content)

      // Calculate scores for each document type based on keyword matching
      const scores: Record<string, number> = {}

      // Score each document type
      for (const [type, patterns] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
        scores[type] = 0
        for (const pattern of patterns) {
          if (pattern.test(sampleText)) {
            scores[type] += 1
          }
        }
      }

      // Find the type with the highest score
      let bestType = ''
      let bestScore = 0

      for (const [type, score] of Object.entries(scores)) {
        if (score > bestScore) {
          bestScore = score
          bestType = type
        }
      }

      // Calculate confidence based on score and number of patterns
      const maxPossibleScore = Math.max(
        ...Object.values(DOCUMENT_TYPE_PATTERNS).map((patterns) => patterns.length)
      )
      const confidence = bestScore > 0 ? bestScore / maxPossibleScore : 0.2

      // If confidence is too low, return default type
      if (confidence < 0.3) {
        return {
          ...defaultType,
          detectedSections,
        }
      }

      // Return the detected document type
      return {
        type: MEDICAL_DOCUMENT_TYPES[bestType] || defaultType.type,
        confidence,
        detectedSections,
        possibleTypes: Object.entries(scores)
          .filter(([_, score]) => score > 0)
          .sort(([_, scoreA], [__, scoreB]) => scoreB - scoreA)
          .slice(0, 3)
          .map(([type, _]) => MEDICAL_DOCUMENT_TYPES[type]),
      }
    } catch (error) {
      const moduleLogger = this.logger.withMetadata({
        module: 'DocumentTypeService',
        method: 'detectDocumentType',
        contentLength: content?.length,
      })

      moduleLogger.error('Error detecting document type', {}, error)
      
      throw new DocumentTypeDetectionError('Failed to detect document type')
    }
  }
}