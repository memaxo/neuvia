/**
 * Document Storage Service Types
 * 
 * Type definitions specific to document storage
 */
import type {
  DocumentType,
  PatientDocument,
  TypedPatientDocument,
  ExtractedDocument,
} from '@/lib/types/document'

/**
 * Document status types
 */
export type DocumentProcessingStatus = 
  | 'pending'
  | 'processing'
  | 'extracting'
  | 'analyzing'
  | 'completed'
  | 'failed'

/**
 * Document status update options
 */
export interface StatusUpdateOptions {
  errorMessage?: string
  isProcessed?: boolean
  metadata?: Record<string, unknown>
}

/**
 * Document query options
 */
export interface DocumentQueryOptions {
  limit?: number
  offset?: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  filters?: Record<string, any>
}

/**
 * Valid document categories
 */
export const VALID_DOCUMENT_CATEGORIES = [
  'clinical',
  'lab',
  'imaging',
  'prescription',
  'administrative',
] as const

/**
 * Document category type
 */
export type DocumentCategory = typeof VALID_DOCUMENT_CATEGORIES[number]