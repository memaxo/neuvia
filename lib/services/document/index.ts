/**
 * Document Services Module
 * 
 * This file exports document-related services with clear separation of concerns:
 * - DocumentExtractionService: Handles text extraction from documents
 * - DocumentStorageService: Manages document storage and retrieval
 * - DocumentAnalysisService: Performs analysis and categorization
 */

import { documentService } from './document-service'
import { DocumentExtractionService } from './extraction-service'
import { DocumentStorageService } from './storage-service'
import { DocumentAnalysisService } from './analysis-service'

// We've now implemented all three specialized services

// Export the service implementations
export {
  // Legacy service (full implementation)
  documentService,
  
  // New specialized services
  DocumentExtractionService,
  DocumentStorageService,
  DocumentAnalysisService
}

// Create singleton instances
export const extractionService = new DocumentExtractionService()
export const storageService = new DocumentStorageService()
export const analysisService = new DocumentAnalysisService()

// Default export for backward compatibility
export default documentService