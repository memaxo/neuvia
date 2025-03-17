/**
 * Key Point Service
 * 
 * Service focused solely on extracting key points from document content.
 */

import logger from '@/lib/logger'
import type { DocumentType } from '@/lib/types/document'
import { KeyPointExtractionError } from './errors'
import { 
  IMPORTANT_SECTIONS_BY_DOC_TYPE, 
  MEDICAL_INDICATOR_PATTERNS 
} from './medical-document-patterns'
import type { DocumentKeyPoint } from './types'
import { DocumentSectionService } from './document-section-service'

/**
 * Service for extracting key points from document text
 */
export class KeyPointService {
  /**
   * Logger instance
   */
  private readonly logger: typeof logger

  /**
   * Section service for document sections
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
   * Extract key points from document text
   * 
   * @param content Document content
   * @param documentType Document type for context
   * @returns Array of key points with relevance scores
   */
  async extractKeyPoints(
    content: string,
    documentType: DocumentType
  ): Promise<DocumentKeyPoint[]> {
    try {
      // Get document sections
      const sections = this.sectionService.splitTextBySections(content)
      const results: DocumentKeyPoint[] = []
      
      // Define important sections by document type
      const importantSections = 
        IMPORTANT_SECTIONS_BY_DOC_TYPE[documentType.type] || 
        IMPORTANT_SECTIONS_BY_DOC_TYPE.default
      
      // Extract key sentences from important sections
      for (const section of sections) {
        // Score the section based on importance
        const sectionScore = importantSections.includes(section.section) ? 0.8 : 0.4
        
        // Extract sentences from section content
        const sentences = section.content
          .split(/[.!?]\s+/)
          .filter(s => s.trim().length > 10 && s.trim().length < 200)
        
        // Find sentences with medical terms and key phrases
        for (const sentence of sentences) {
          // Check for key medical indicators that suggest important information
          let score = sectionScore
          
          // Check for common medical importance indicators
          if (MEDICAL_INDICATOR_PATTERNS.importance.test(sentence)) {
            score += 0.2
          }
          
          // Check for test result indicators
          if (MEDICAL_INDICATOR_PATTERNS.testResults.test(sentence)) {
            score += 0.1
          }
          
          // Check for medication indicators
          if (MEDICAL_INDICATOR_PATTERNS.medication.test(sentence)) {
            score += 0.1
          }
          
          // Check for time indicators (suggesting followup or timing)
          if (MEDICAL_INDICATOR_PATTERNS.followup.test(sentence)) {
            score += 0.1
          }
          
          // Add sentence if score is high enough
          if (score > 0.5) {
            results.push({
              text: sentence.trim(),
              score: Math.min(0.99, score) // Cap at 0.99
            })
          }
        }
      }
      
      // Sort by score and limit to top 10
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
    } catch (error) {
      const moduleLogger = this.logger.withMetadata({
        module: 'KeyPointService',
        method: 'extractKeyPoints',
        documentType: `${documentType.category}/${documentType.type}`,
      })

      moduleLogger.error('Error extracting key points', {}, error)
      throw new KeyPointExtractionError('Failed to extract key points from document')
    }
  }
}