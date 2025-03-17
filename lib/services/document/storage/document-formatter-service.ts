/**
 * Document Formatter Service
 * 
 * Handles document formatting, conversion, and summary generation.
 */
import logger from '@/lib/logger'
import type {
  DocumentType,
  PatientDocument,
  TypedPatientDocument,
} from '@/lib/types/document'
import { DocumentStorageError } from './errors'

/**
 * Service for document formatting operations
 */
export class DocumentFormatterService {
  /**
   * Logger instance
   */
  private readonly logger

  constructor(loggerInstance?: typeof logger) {
    this.logger = loggerInstance || logger
  }

  /**
   * Generate a brief content summary from document text
   * 
   * @param text Document text to summarize
   * @returns Brief summary (max 200 chars)
   */
  generateContentSummary(text: string): string {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentFormatterService',
      method: 'generateContentSummary',
      textLength: text?.length,
    })
    
    try {
      moduleLogger.info('Generating content summary')
      
      if (!text) return ''

      // Extract the first few sentences (max 200 chars)
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)

      if (sentences.length === 0) {
        return 'Empty document'
      }

      // Take up to 3 sentences
      let summary = sentences.slice(0, 3).join('. ').trim()

      // Truncate if too long
      if (summary.length > 200) {
        summary = `${summary.substring(0, 197)}...`
      }

      moduleLogger.info('Content summary generated successfully')
      return summary
    } catch (error) {
      moduleLogger.error('Error generating content summary', {}, error)
      // Return a default summary rather than throwing in this case
      return 'Document summary unavailable'
    }
  }

  /**
   * Convert a database document to a typed document
   * 
   * @param document Raw document from database
   * @returns Typed document with proper type information
   */
  convertToTypedDocument(document: PatientDocument): TypedPatientDocument {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentFormatterService',
      method: 'convertToTypedDocument',
      documentId: document.id,
    })
    
    try {
      moduleLogger.info('Converting document to typed document')
      
      // Handle document_type conversion
      let docType: DocumentType
      
      if (document.document_type) {
        // Try to parse the document type if it's a string
        if (typeof document.document_type === 'string') {
          try {
            docType = JSON.parse(document.document_type)
          } catch {
            // Default if string parsing fails
            docType = { category: 'clinical', type: 'document' }
          }
        } else {
          // Use as is if it's already an object
          docType = document.document_type as unknown as DocumentType
        }
      } else {
        // Default if missing
        docType = { category: 'clinical', type: 'document' }
      }

      moduleLogger.info('Document converted successfully')
      
      // Return the typed document
      return {
        ...document,
        document_type: docType,
      }
    } catch (error) {
      moduleLogger.error('Error converting document to typed document', {}, error)

      // Return with a default document type
      return {
        ...document,
        document_type: { category: 'clinical', type: 'document' },
      }
    }
  }

  /**
   * Batch convert documents to typed documents
   * 
   * @param documents Array of raw documents
   * @returns Array of typed documents
   */
  convertBatchToTypedDocuments(documents: PatientDocument[]): TypedPatientDocument[] {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentFormatterService',
      method: 'convertBatchToTypedDocuments',
      documentCount: documents.length,
    })
    
    try {
      moduleLogger.info('Converting batch of documents')
      
      const result = documents.map(doc => this.convertToTypedDocument(doc))
      
      moduleLogger.info('Batch converted successfully')
      return result
    } catch (error) {
      moduleLogger.error('Error converting batch of documents', {}, error)
      
      // Attempt a safer conversion in case of error
      return documents.map(doc => ({
        ...doc,
        document_type: { category: 'clinical', type: 'document' },
      }))
    }
  }
}