/**
 * Document Database Types
 * 
 * Type definitions for the document database schema used in the Neuvia app.
 * These types directly extend the Supabase database types to ensure consistency.
 */
import type { Database, Tables, Json } from '@/lib/supabase';
import type { DocumentType } from './base';

/**
 * Document category enum type from database
 */
export type DocumentCategory = Database['public']['Enums']['document_category'];

/**
 * Document processing status type
 */
export type DocumentProcessingStatus = 'pending' | 'uploaded' | 'processing' | 'completed' | 'failed';

/**
 * Patient document type that directly maps to the database schema
 * Represents a row from the 'patient_documents' table
 */
export type PatientDocument = Tables<'patient_documents'>;

/**
 * Document chunk type that directly maps to the database schema
 * Represents a row from the 'document_chunks' table
 */
export type DocumentChunk = Tables<'document_chunks'>;

/**
 * Document embedding type that directly maps to the database schema
 * Represents a row from the 'document_embeddings' table
 */
export type DocumentEmbedding = {
  /**
   * Unique embedding ID (primary key)
   */
  id: string;

  /**
   * Document ID (foreign key)
   */
  document_id: string;

  /**
   * Chunk ID (foreign key)
   */
  chunk_id: string;

  /**
   * Vector embedding (stored as string in DB but used as number[] in application)
   */
  embedding: number[];

  /**
   * Content that was embedded
   */
  content: string;

  /**
   * Metadata for the embedding
   */
  metadata?: Json;

  /**
   * Creation timestamp (set by database)
   */
  created_at: string;
};

/**
 * Patient document insert type
 * For creating new patient document records
 */
export type PatientDocumentInsert = Database['public']['Tables']['patient_documents']['Insert'];

/**
 * Document chunk insert type
 * For creating new document chunk records
 */
export type DocumentChunkInsert = Database['public']['Tables']['document_chunks']['Insert'];

/**
 * Response shape for document API operations
 */
export interface DocumentApiResponse<T> {
  /**
   * Whether the operation was successful
   */
  success: boolean;
  
  /**
   * Response data
   */
  data?: T;
  
  /**
   * Error message if operation failed
   */
  error?: string;
  
  /**
   * Error code if operation failed
   */
  code?: string;
}

/**
 * Helper type to convert database document_type JSON to a proper DocumentType
 */
export interface TypedPatientDocument extends Omit<PatientDocument, 'document_type'> {
  /**
   * Properly typed document type information
   */
  document_type: DocumentType;
}