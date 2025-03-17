/**
 * Document Analysis Type Definitions
 * 
 * This file contains the type definitions specific to the document analysis services.
 */

import type { DocumentType } from '@/lib/types/document'

/**
 * Document type detection result
 */
export interface DocumentTypeDetectionResult {
  type: DocumentType
  confidence: number
  detectedSections?: string[]
  possibleTypes?: DocumentType[]
}

/**
 * Document section with content
 */
export interface DocumentSection {
  section: string
  content: string
}

/**
 * Key point extracted from document
 */
export interface DocumentKeyPoint {
  text: string
  score: number
}

/**
 * Medical document section pattern
 */
export interface SectionPattern {
  name: string
  patterns: string[]
}