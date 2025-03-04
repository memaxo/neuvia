/**
 * Document Analysis Service
 * 
 * Responsible for analyzing document content, detecting document types,
 * and extracting insights from document text.
 */

import logger from '@/lib/logger'
import { normalizeError, ValidationError, ApplicationError } from '@/lib/errors'
import type { DocumentType } from '@/lib/types/document'

/**
 * Document type detection result
 */
interface DocumentTypeDetectionResult {
  type: DocumentType
  confidence: number
  detectedSections?: string[]
  possibleTypes?: DocumentType[]
}

/**
 * Custom error class for analysis service errors
 */
class AnalysisServiceError extends ApplicationError {
  constructor(
    message: string,
    code: string,
    isRetryable: boolean = false,
    data?: Record<string, unknown>
  ) {
    super({
      message,
      code,
      data: {
        ...data,
        isRetryable,
      },
    })
  }
}

/**
 * Service for analyzing document content and structure
 */
export class DocumentAnalysisService {
  /**
   * Special medical document patterns for improved processing
   */
  private readonly medicalDocumentTypes: Record<string, DocumentType> = {
    PROGRESS_NOTE: { category: 'clinical', type: 'progress_note' },
    HISTORY_AND_PHYSICAL: { category: 'clinical', type: 'history_physical' },
    DISCHARGE_SUMMARY: { category: 'clinical', type: 'discharge_summary' },
    OPERATIVE_REPORT: { category: 'clinical', type: 'operative_report' },
    CONSULTATION: { category: 'clinical', type: 'consultation' },
    PATHOLOGY_REPORT: { category: 'lab', type: 'pathology_report' },
    RADIOLOGY_REPORT: { category: 'imaging', type: 'radiology_report' },
    LAB_RESULTS: { category: 'lab', type: 'lab_results' },
    MEDICATION_LIST: { category: 'clinical', type: 'medication_list' },
    IMMUNIZATION_RECORD: { category: 'clinical', type: 'immunization_record' },
  }

  /**
   * Medical document section patterns
   */
  private readonly medicalSectionPatterns = [
    {
      name: 'patient_information',
      patterns: ['patient information', 'demographics', 'patient data'],
    },
    {
      name: 'chief_complaint',
      patterns: ['chief complaint', 'presenting complaint', 'reason for visit'],
    },
    {
      name: 'history_of_present_illness',
      patterns: ['history of present illness', 'hpi', 'present illness'],
    },
    {
      name: 'past_medical_history',
      patterns: ['past medical history', 'pmh', 'medical history'],
    },
    {
      name: 'medications',
      patterns: ['medications', 'current medications', 'meds', 'prescription'],
    },
    {
      name: 'allergies',
      patterns: ['allergies', 'drug allergies', 'medication allergies'],
    },
    {
      name: 'review_of_systems',
      patterns: ['review of systems', 'ros', 'systems review'],
    },
    {
      name: 'physical_examination',
      patterns: [
        'physical examination',
        'physical exam',
        'examination',
        'exam',
      ],
    },
    { name: 'assessment', patterns: ['assessment', 'impression', 'diagnosis'] },
    { name: 'plan', patterns: ['plan', 'treatment plan', 'recommendations'] },
    {
      name: 'laboratory_results',
      patterns: ['laboratory', 'lab results', 'laboratory studies'],
    },
    {
      name: 'imaging_results',
      patterns: ['imaging', 'radiology', 'x-ray', 'ct scan', 'mri'],
    },
    {
      name: 'procedures',
      patterns: ['procedures', 'interventions', 'operations'],
    },
  ]

  /**
   * Detect document type from content
   * 
   * @param content Document content to analyze
   * @returns Detected document type with confidence
   */
  async detectDocumentType(
    content: string
  ): Promise<DocumentTypeDetectionResult> {
    try {
      // Default document type
      const defaultType: DocumentTypeDetectionResult = {
        type: { category: 'clinical', type: 'note' },
        confidence: 0.5,
      }

      // If no content, return default
      if (!content || content.length < 50) {
        return defaultType
      }

      // Extract the first ~1000 characters for analysis
      const sampleText = content.substring(0, 1000).toLowerCase()

      // Detect document sections
      const detectedSections = this.detectSectionsInText(content)

      // Calculate scores for each document type based on keyword matching
      const scores: Record<string, number> = {}

      const typePatterns: Record<string, RegExp[]> = {
        PROGRESS_NOTE: [/progress\s+note/i, /soap\s+note/i, /office\s+visit/i],
        HISTORY_AND_PHYSICAL: [
          /history\s+and\s+physical/i,
          /h\s*&\s*p/i,
          /admission\s+note/i,
        ],
        DISCHARGE_SUMMARY: [
          /discharge\s+summary/i,
          /discharge\s+note/i,
          /hospital\s+course/i,
        ],
        OPERATIVE_REPORT: [
          /operative\s+report/i,
          /operation\s+note/i,
          /surgical\s+procedure/i,
        ],
        CONSULTATION: [/consultation/i, /consult\s+note/i, /referred\s+for/i],
        PATHOLOGY_REPORT: [/pathology/i, /specimen/i, /histology/i, /biopsy/i],
        RADIOLOGY_REPORT: [
          /radiology/i,
          /impression:/i,
          /findings:/i,
          /x-ray/i,
          /ct\s+scan/i,
          /mri/i,
        ],
        LAB_RESULTS: [
          /laboratory/i,
          /lab\s+results/i,
          /test\s+results/i,
          /chemistry/i,
          /hematology/i,
        ],
        MEDICATION_LIST: [
          /medication\s+list/i,
          /current\s+medications/i,
          /prescriptions/i,
        ],
        IMMUNIZATION_RECORD: [/immunization/i, /vaccination/i, /vaccine/i],
      }

      // Score each document type
      for (const [type, patterns] of Object.entries(typePatterns)) {
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
        ...Object.values(typePatterns).map((patterns) => patterns.length)
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
        type: this.medicalDocumentTypes[bestType] || defaultType.type,
        confidence,
        detectedSections,
        possibleTypes: Object.entries(scores)
          .filter(([_, score]) => score > 0)
          .sort(([_, scoreA], [__, scoreB]) => scoreB - scoreA)
          .slice(0, 3)
          .map(([type, _]) => this.medicalDocumentTypes[type]),
      }
    } catch (error) {
      const moduleLogger = logger.withMetadata({
        module: 'DocumentAnalysisService',
        method: 'detectDocumentType',
        contentLength: content?.length,
      })

      moduleLogger.error('Error detecting document type', {}, error)

      // Return default type in case of error
      return {
        type: { category: 'clinical', type: 'note' },
        confidence: 0.2,
      }
    }
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
  ): Promise<Array<{ text: string; score: number }>> {
    try {
      // This is a simplified implementation that would be expanded
      // with more sophisticated NLP techniques in a real system
      
      // For now, extract based on section patterns and important phrases
      const sections = this.splitTextBySections(content)
      const results: Array<{ text: string; score: number }> = []
      
      // Define important sections by document type
      const importantSections: string[] = []
      
      switch (documentType.type) {
        case 'progress_note':
          importantSections.push('chief_complaint', 'assessment', 'plan')
          break
        case 'discharge_summary':
          importantSections.push('assessment', 'plan', 'medications')
          break
        case 'pathology_report':
          importantSections.push('assessment', 'diagnosis')
          break
        default:
          importantSections.push('assessment', 'plan', 'medications', 'allergies')
      }
      
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
          if (/\b(?:diagnos|assess|significant|critical|recommend|prescribe)\w*\b/i.test(sentence)) {
            score += 0.2
          }
          
          // Check for test result indicators
          if (/\b(?:positive|negative|elevated|normal|abnormal)\b/i.test(sentence)) {
            score += 0.1
          }
          
          // Check for medication indicators
          if (/\b(?:mg|mcg|dose|daily|prescribed|medication)\b/i.test(sentence)) {
            score += 0.1
          }
          
          // Check for time indicators (suggesting followup or timing)
          if (/\b(?:follow\s*up|return|weeks|days|months|schedule)\b/i.test(sentence)) {
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
      const moduleLogger = logger.withMetadata({
        module: 'DocumentAnalysisService',
        method: 'extractKeyPoints',
        documentType: `${documentType.category}/${documentType.type}`,
      })

      moduleLogger.error('Error extracting key points', {}, error)
      
      // Return empty array in case of error
      return []
    }
  }

  /**
   * Detect sections in a document
   * 
   * @param text Document text
   * @returns Array of section names found in the text
   */
  detectSectionsInText(text: string): string[] {
    const detectedSections: string[] = []

    // Look for common medical document section headers
    for (const section of this.medicalSectionPatterns) {
      for (const pattern of section.patterns) {
        // Look for the pattern surrounded by whitespace or at the beginning of a line
        const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i')
        if (regex.test(text)) {
          detectedSections.push(section.name)
          break // Found this section, no need to check other patterns
        }
      }
    }

    return detectedSections
  }

  /**
   * Split text into sections
   * 
   * @param text Document text
   * @returns Array of sections with content
   */
  splitTextBySections(
    text: string
  ): Array<{ section: string; content: string }> {
    const sections: Array<{ section: string; content: string }> = []
    let currentContent = ''
    let currentSection = 'unknown'

    // Split text into lines for processing
    const lines = text.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check if this line is a section header
      let newSectionFound = false

      for (const section of this.medicalSectionPatterns) {
        for (const pattern of section.patterns) {
          // Look for the pattern surrounded by whitespace or at the beginning of a line
          const regex = new RegExp(`(^|\\s)(${pattern})(:|\\s|$)`, 'i')
          if (regex.test(line)) {
            // If we were already building a section, save it
            if (currentContent.trim()) {
              sections.push({
                section: currentSection,
                content: currentContent.trim(),
              })
            }

            // Start a new section
            currentSection = section.name
            currentContent = `${line}\n` // Include the header in the content
            newSectionFound = true
            break
          }
        }
        if (newSectionFound) break
      }

      // If not a new section, add to current content
      if (!newSectionFound) {
        currentContent += `${line}\n`
      }
    }

    // Add the last section if not empty
    if (currentContent.trim()) {
      sections.push({
        section: currentSection,
        content: currentContent.trim(),
      })
    }

    return sections
  }
}