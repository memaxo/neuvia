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

// Export default instantiated services
import { DocumentSectionService } from './document-section-service'
import { DocumentTypeService } from './document-type-service'
import { KeyPointService } from './key-point-service'

// Create shared instances of the services
const documentSectionService = new DocumentSectionService()
const documentTypeService = new DocumentTypeService(documentSectionService)
const keyPointService = new KeyPointService(documentSectionService)

// Default exports for easy consumption
export default {
  sectionService: documentSectionService,
  typeService: documentTypeService,
  keyPointService: keyPointService
}