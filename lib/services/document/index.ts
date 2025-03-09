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

// Import component modules
import { SectionDetector } from './utils/section-detection'
import {
  ChunkingStrategy,
  ChunkingOptions,
  ChunkingStrategyFactory,
  SemanticChunkingStrategy,
  PageBasedChunkingStrategy,
  SectionBasedChunkingStrategy
} from './chunking/chunking-strategies'
import {
  DocumentExtractor,
  ExtractorFactory,
  EnhancedExtractionOptions,
  OcrDocumentExtractor,
  PlainTextExtractor
} from './extractors/extractor-factory'

// Export the service implementations
export {
  // Legacy service (full implementation)
  documentService,
  
  // New specialized services
  DocumentExtractionService,
  DocumentStorageService,
  DocumentAnalysisService,
  
  // Utilities
  SectionDetector,
  
  // Chunking strategies
  ChunkingStrategy,
  ChunkingOptions,
  ChunkingStrategyFactory,
  SemanticChunkingStrategy,
  PageBasedChunkingStrategy,
  SectionBasedChunkingStrategy,
  
  // Extractors
  DocumentExtractor,
  ExtractorFactory,
  EnhancedExtractionOptions,
  OcrDocumentExtractor,
  PlainTextExtractor
}

// Create singleton instances
export const extractionService = new DocumentExtractionService()
export const storageService = new DocumentStorageService()
export const analysisService = new DocumentAnalysisService()

// Default export for backward compatibility
export default documentService