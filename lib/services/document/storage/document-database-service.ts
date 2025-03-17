/**
 * Document Database Service
 * 
 * Core database operations for document storage.
 * Handles direct interaction with the database without business logic.
 */
import { createBrowserClient } from '@/lib/supabase/clients'
import logger from '@/lib/logger'
import { normalizeError } from '@/lib/errors'
import type { Json } from '@/lib/supabase'
import type {
  PatientDocument,
  PatientDocumentInsert,
  TypedPatientDocument,
} from '@/lib/types/document'
import { 
  DatabaseOperationError,
  DocumentRetrievalError 
} from './errors'
import { DocumentQueryOptions } from './types'

/**
 * Service for core document database operations
 */
export class DocumentDatabaseService {
  /**
   * Supabase client instance
   */
  private readonly supabase

  /**
   * Logger instance
   */
  private readonly logger

  constructor(loggerInstance?: typeof logger) {
    this.supabase = createBrowserClient()
    this.logger = loggerInstance || logger
  }

  /**
   * Insert a document record
   * 
   * @param documentRecord Document data to insert
   * @returns Inserted document ID
   */
  async insertDocument(documentRecord: PatientDocumentInsert): Promise<string> {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentDatabaseService',
      method: 'insertDocument',
      patientId: documentRecord.patient_id,
    })

    try {
      moduleLogger.info('Inserting document record')

      const { data, error } = await this.supabase
        .from('patient_documents')
        .insert(documentRecord)
        .select('id')
        .single()

      if (error) {
        moduleLogger.error('Error inserting document:', {}, error)
        throw new DatabaseOperationError(`Failed to insert document: ${error.message}`, 
          'DATABASE_INSERT_ERROR', true, { error })
      }

      moduleLogger.info('Document inserted successfully', { documentId: data.id })
      return data.id
    } catch (error) {
      if (error instanceof DatabaseOperationError) {
        throw error
      }
      
      moduleLogger.error('Error inserting document', {}, error)
      
      throw new DatabaseOperationError(
        `Failed to insert document: ${error instanceof Error ? error.message : String(error)}`,
        'DATABASE_INSERT_ERROR', true, { originalError: error }
      )
    }
  }

  /**
   * Get document by ID
   * 
   * @param documentId Document ID to retrieve
   * @returns Raw document data or null if not found
   */
  async getDocumentById(documentId: string): Promise<PatientDocument | null> {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentDatabaseService',
      method: 'getDocumentById',
      documentId,
    })
    
    try {
      moduleLogger.info('Retrieving document by ID')
      
      const { data, error } = await this.supabase
        .from('patient_documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (error) {
        moduleLogger.error('Error retrieving document', {}, error)
        
        throw new DocumentRetrievalError(`Failed to retrieve document: ${error.message}`, 
          'DOCUMENT_RETRIEVAL_ERROR', true, { documentId, error }
        )
      }

      moduleLogger.info('Document retrieved successfully')
      return data as PatientDocument || null
    } catch (error) {
      if (error instanceof DocumentRetrievalError) {
        throw error
      }
      
      moduleLogger.error('Error retrieving document', {}, error)
      
      throw new DocumentRetrievalError(
        `Failed to retrieve document: ${error instanceof Error ? error.message : String(error)}`,
        'DOCUMENT_RETRIEVAL_ERROR', true, { documentId, originalError: error }
      )
    }
  }

  /**
   * Get documents for a patient
   * 
   * @param patientId Patient ID to get documents for
   * @param options Query options for filtering and pagination
   * @returns Array of patient documents
   */
  async getDocumentsByPatientId(
    patientId: string,
    options: DocumentQueryOptions = {}
  ): Promise<PatientDocument[]> {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentDatabaseService',
      method: 'getDocumentsByPatientId',
      patientId,
    })
    
    try {
      moduleLogger.info('Retrieving documents by patient ID', { options })
      
      const { 
        limit = 50, 
        offset = 0,
        sortBy = 'created_at', 
        sortDirection = 'desc',
        filters = {}
      } = options

      let query = this.supabase
        .from('patient_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .range(offset, offset + limit - 1)
      
      // Apply additional filters if provided
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      }

      const { data, error } = await query

      if (error) {
        moduleLogger.error('Error retrieving patient documents', {}, error)
        
        throw new DocumentRetrievalError(
          `Failed to retrieve patient documents: ${error.message}`,
          'PATIENT_DOCUMENTS_ERROR', true, { patientId, error }
        )
      }

      moduleLogger.info('Documents retrieved successfully', { count: data?.length || 0 })
      return (data || []) as PatientDocument[]
    } catch (error) {
      if (error instanceof DocumentRetrievalError) {
        throw error
      }
      
      moduleLogger.error('Error retrieving patient documents', {}, error)
      
      throw new DocumentRetrievalError(
        `Failed to retrieve patient documents: ${error instanceof Error ? error.message : String(error)}`,
        'PATIENT_DOCUMENTS_ERROR', true, { patientId, originalError: error }
      )
    }
  }

  /**
   * Update document record
   * 
   * @param documentId Document ID to update
   * @param updateData Data to update
   * @returns True if update was successful
   */
  async updateDocument(
    documentId: string,
    updateData: Record<string, any>
  ): Promise<boolean> {
    const moduleLogger = this.logger.withMetadata({
      module: 'DocumentDatabaseService',
      method: 'updateDocument',
      documentId,
    })
    
    try {
      moduleLogger.info('Updating document')
      
      // Always update the timestamp
      const dataWithTimestamp = {
        ...updateData,
        updated_at: new Date(),
      }

      const { error } = await this.supabase
        .from('patient_documents')
        .update(dataWithTimestamp)
        .eq('id', documentId)

      if (error) {
        moduleLogger.error('Error updating document', {}, error)
        
        throw new DatabaseOperationError(
          `Failed to update document: ${error.message}`,
          'DATABASE_UPDATE_ERROR', true, { documentId, error }
        )
      }

      moduleLogger.info('Document updated successfully')
      return true
    } catch (error) {
      if (error instanceof DatabaseOperationError) {
        throw error
      }
      
      moduleLogger.error('Error updating document', {}, error)
      
      throw new DatabaseOperationError(
        `Failed to update document: ${error instanceof Error ? error.message : String(error)}`,
        'DATABASE_UPDATE_ERROR', true, { documentId, originalError: error }
      )
    }
  }
}