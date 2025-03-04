/**
 * Document Storage Service
 * 
 * Responsible for storing and retrieving documents from the database.
 * Handles the database interaction layer for document management.
 */

import { createBrowserClient } from '@/lib/supabase/clients'
import logger from '@/lib/logger'
import { normalizeError, ValidationError, ApplicationError } from '@/lib/errors'
import { getDbCompatibleMetadata } from '@/lib/processing/types/verification'
import type { Json } from '@/lib/supabase'
import type {
  DocumentType,
  ExtractedDocument,
  PatientDocument,
  PatientDocumentInsert,
  TypedPatientDocument,
} from '@/lib/types/document'

/**
 * Custom error class for storage service errors
 */
class StorageServiceError extends ApplicationError {
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
 * Service for handling document storage operations
 */
export class DocumentStorageService {
  private supabase = createBrowserClient()
  
  /**
   * Save an extracted document to the database
   * 
   * @param extractedDocument The extracted document to save
   * @param departmentId Optional department ID
   * @returns The saved document ID
   */
  async saveDocument(
    extractedDocument: ExtractedDocument,
    departmentId?: string
  ): Promise<string> {
    try {
      const moduleLogger = logger.withMetadata({
        module: 'DocumentStorageService',
        method: 'saveDocument',
        documentId: extractedDocument.id,
        patientId: extractedDocument.patient_id,
      })

      moduleLogger.info('Saving document to database')

      // Ensure category is one of the valid enum values
      const category = extractedDocument.document_type.category as
        | 'clinical'
        | 'lab'
        | 'imaging'
        | 'prescription'
        | 'administrative'
      
      if (
        ![
          'clinical',
          'lab',
          'imaging',
          'prescription',
          'administrative',
        ].includes(category)
      ) {
        // Default to clinical if not a valid category
        moduleLogger.warn(`Invalid category: ${category}, defaulting to 'clinical'`)
      }

      // Generate a document title that includes meaningful information
      const documentType = extractedDocument.document_type.type || 'document'
      const timestamp = new Date().toISOString().split('T')[0]
      const title =
        extractedDocument.extracted_data.metadata.title ||
        `${category.charAt(0).toUpperCase() + category.slice(1)} ${documentType} - ${timestamp}`

      // Prepare data for insertion
      const documentRecord: PatientDocumentInsert = {
        patient_id: extractedDocument.patient_id,
        title,
        category:
          (category as
            | 'clinical'
            | 'lab'
            | 'imaging'
            | 'prescription'
            | 'administrative') || 'clinical',
        document_type: getDbCompatibleMetadata(
          extractedDocument.document_type
        ) as Json,
        file_path:
          extractedDocument.extracted_data.metadata.filename || 'unknown-file',
        file_type:
          extractedDocument.extracted_data.metadata.fileFormat ||
          'application/pdf',
        file_size: extractedDocument.extracted_data.metadata.fileSize || 0,
        checksum:
          extractedDocument.extracted_data.metadata.checksum ||
          `generated-${Date.now().toString()}`,
        document_date: new Date().toISOString().split('T')[0],
        content_text: extractedDocument.extracted_data.rawText,
        content_summary: this.generateContentSummary(
          extractedDocument.extracted_data.rawText
        ),
        metadata: getDbCompatibleMetadata({
          ...extractedDocument.extracted_data.metadata,
          extractionDate: new Date().toISOString(),
          departmentId,
        }) as Json,
        processing_status: extractedDocument.is_processed
          ? 'completed'
          : 'failed',
        is_processed: extractedDocument.is_processed,
        processing_error: extractedDocument.processing_error,
        department: departmentId,
      }

      // Insert into database
      const { data, error } = await this.supabase
        .from('patient_documents')
        .insert(documentRecord)
        .select('id')
        .single()

      if (error) {
        moduleLogger.error('Error saving document:', {}, error)
        throw new StorageServiceError(
          `Failed to save document: ${error.message}`,
          'DATABASE_ERROR',
          true,
          { error }
        )
      }

      moduleLogger.info('Document saved successfully', { savedId: data.id })
      return data.id
    } catch (error) {
      // If it's already an application error, just rethrow
      if (error instanceof ApplicationError) {
        throw error
      }
      
      // Otherwise normalize the error
      throw new StorageServiceError(
        `Failed to save document: ${error instanceof Error ? error.message : String(error)}`,
        'SAVE_DOCUMENT_ERROR',
        false,
        { originalError: error }
      )
    }
  }

  /**
   * Get document by ID
   * 
   * @param documentId Document ID to retrieve
   * @returns The patient document or null if not found
   */
  async getDocumentById(documentId: string): Promise<TypedPatientDocument | null> {
    try {
      const { data, error } = await this.supabase
        .from('patient_documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (error) {
        throw new StorageServiceError(
          `Failed to retrieve document: ${error.message}`,
          'DOCUMENT_RETRIEVAL_ERROR',
          true,
          { documentId, error }
        )
      }

      if (!data) {
        return null
      }

      // Convert to typed document
      return this.convertToTypedDocument(data as PatientDocument)
    } catch (error) {
      const moduleLogger = logger.withMetadata({
        module: 'DocumentStorageService',
        method: 'getDocumentById',
        documentId,
      })

      moduleLogger.error('Error retrieving document', {}, error)

      // If it's already an application error, just rethrow
      if (error instanceof ApplicationError) {
        throw error
      }
      
      // Otherwise normalize the error
      throw new StorageServiceError(
        `Failed to retrieve document: ${error instanceof Error ? error.message : String(error)}`,
        'DOCUMENT_RETRIEVAL_ERROR',
        true,
        { documentId, originalError: error }
      )
    }
  }

  /**
   * Get documents for a patient
   * 
   * @param patientId Patient ID to get documents for
   * @param limit Optional limit on number of documents to return
   * @returns Array of patient documents
   */
  async getDocumentsByPatientId(
    patientId: string,
    limit: number = 50
  ): Promise<TypedPatientDocument[]> {
    try {
      const { data, error } = await this.supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        throw new StorageServiceError(
          `Failed to retrieve patient documents: ${error.message}`,
          'PATIENT_DOCUMENTS_ERROR',
          true,
          { patientId, error }
        )
      }

      if (!data || data.length === 0) {
        return []
      }

      // Convert all documents to typed documents
      return data.map(doc => this.convertToTypedDocument(doc as PatientDocument))
    } catch (error) {
      const moduleLogger = logger.withMetadata({
        module: 'DocumentStorageService',
        method: 'getDocumentsByPatientId',
        patientId,
      })

      moduleLogger.error('Error retrieving patient documents', {}, error)

      // If it's already an application error, just rethrow
      if (error instanceof ApplicationError) {
        throw error
      }
      
      // Otherwise normalize the error
      throw new StorageServiceError(
        `Failed to retrieve patient documents: ${error instanceof Error ? error.message : String(error)}`,
        'PATIENT_DOCUMENTS_ERROR',
        true,
        { patientId, originalError: error }
      )
    }
  }

  /**
   * Update document processing status
   * 
   * @param documentId Document ID to update
   * @param status New processing status
   * @param error Optional error message if status is 'failed'
   * @returns True if update was successful
   */
  async updateDocumentStatus(
    documentId: string,
    status: 'pending' | 'processing' | 'extracting' | 'completed' | 'failed',
    error?: string
  ): Promise<boolean> {
    try {
      const updateData: Record<string, any> = {
        processing_status: status,
        updated_at: new Date(),
      }

      // Add error message if status is failed
      if (status === 'failed' && error) {
        updateData.processing_error = error
      }

      // Update is_processed flag based on status
      if (status === 'completed') {
        updateData.is_processed = true
      } else if (status === 'failed') {
        updateData.is_processed = false
      }

      const { error: updateError } = await this.supabase
        .from('patient_documents')
        .update(updateData)
        .eq('id', documentId)

      if (updateError) {
        throw new StorageServiceError(
          `Failed to update document status: ${updateError.message}`,
          'STATUS_UPDATE_ERROR',
          true,
          { documentId, status, error: updateError }
        )
      }

      return true
    } catch (error) {
      const moduleLogger = logger.withMetadata({
        module: 'DocumentStorageService',
        method: 'updateDocumentStatus',
        documentId,
        status,
      })

      moduleLogger.error('Error updating document status', {}, error)

      // If it's already an application error, just rethrow
      if (error instanceof ApplicationError) {
        throw error
      }
      
      // Otherwise normalize the error
      throw new StorageServiceError(
        `Failed to update document status: ${error instanceof Error ? error.message : String(error)}`,
        'STATUS_UPDATE_ERROR',
        true,
        { documentId, status, originalError: error }
      )
    }
  }

  /**
   * Generate a brief content summary from document text
   */
  private generateContentSummary(text: string): string {
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

    return summary
  }

  /**
   * Convert a database document to a typed document
   */
  private convertToTypedDocument(document: PatientDocument): TypedPatientDocument {
    try {
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

      // Return the typed document
      return {
        ...document,
        document_type: docType,
      }
    } catch (error) {
      logger.error('Error converting document to typed document', {
        documentId: document.id,
        error: error instanceof Error ? error.message : String(error),
      })

      // Return with a default document type
      return {
        ...document,
        document_type: { category: 'clinical', type: 'document' },
      }
    }
  }
}