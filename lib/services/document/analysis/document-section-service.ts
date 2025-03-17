/**
 * Document Section Service
 * 
 * Service focused solely on detecting and extracting document sections.
 */

import logger from '@/lib/logger'
import { SectionDetectionError } from './errors'
import { MEDICAL_SECTION_PATTERNS } from './medical-document-patterns'
import type { DocumentSection } from './types'

/**
 * Service for detecting and extracting document sections
 */
export class DocumentSectionService {
  /**
   * Logger instance
   */
  private readonly logger: typeof logger

  constructor(loggerInstance?: typeof logger) {
    this.logger = loggerInstance || logger
  }

  /**
   * Detect sections in a document
   * 
   * @param text Document text
   * @returns Array of section names found in the text
   */
  detectSections(text: string): string[] {
    try {
      const detectedSections: string[] = []

      // Look for common medical document section headers
      for (const section of MEDICAL_SECTION_PATTERNS) {
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
    } catch (error) {
      const moduleLogger = this.logger.withMetadata({
        module: 'DocumentSectionService',
        method: 'detectSections',
        textLength: text?.length,
      })

      moduleLogger.error('Error detecting sections in text', {}, error)
      throw new SectionDetectionError('Failed to detect sections in document text')
    }
  }

  /**
   * Split text into sections
   * 
   * @param text Document text
   * @returns Array of sections with content
   */
  splitTextBySections(text: string): DocumentSection[] {
    try {
      const sections: DocumentSection[] = []
      let currentContent = ''
      let currentSection = 'unknown'

      // Split text into lines for processing
      const lines = text.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Check if this line is a section header
        let newSectionFound = false

        for (const section of MEDICAL_SECTION_PATTERNS) {
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
    } catch (error) {
      const moduleLogger = this.logger.withMetadata({
        module: 'DocumentSectionService',
        method: 'splitTextBySections',
        textLength: text?.length,
      })

      moduleLogger.error('Error splitting text into sections', {}, error)
      throw new SectionDetectionError('Failed to split text into sections')
    }
  }
}