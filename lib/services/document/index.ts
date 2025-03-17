/**
 * Document Services Module
 * 
 * This file exports document-related services with clear separation of concerns:
 * - Extraction: Handles text extraction from documents
 * - Chunking: Divides documents into manageable chunks
 * - Analysis: Performs document type detection, section extraction, and key point identification
 * - Storage: Manages document storage and retrieval with database operations, metadata handling, 
 *           and content formatting
 * 
 * NOTE: Refactored to align with LangGraph architecture - services have been
 * modularized and separated from workflow orchestration logic.
 * 
 * The modular approach makes these services more composable:
 * - DocumentSectionService: Detects and extracts document sections
 * - DocumentTypeService: Identifies document types and categories
 * - KeyPointService: Extracts important points from document content
 * - DocumentDatabaseService: Performs core database operations
 * - DocumentMetadataService: Handles metadata operations
 * - DocumentFormatterService: Manages content formatting and document conversion
 * - DocumentStatusService: Manages document status updates
 */

// Import the document service for backward compatibility
import { documentService } from './document-service'

// Re-export all services from their respective modules
export * from './extraction'
export * from './chunking'
export * from './analysis'
export * from './storage'

// Import utilities
import { SectionDetector } from './utils/section-detection'
export { SectionDetector }

// Import singletons
import { extractionService, ocrService } from './extraction'
import { chunkingService } from './chunking'
import analysisServices from './analysis'
import storageServices from './storage'

// Export singletons for easy imports
export {
  extractionService,
  ocrService,
  chunkingService,
  analysisServices,
  storageServices
}

// Default export for backward compatibility
export default documentService