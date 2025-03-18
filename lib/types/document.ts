/**
 * Document Types - Single Source of Truth
 *
 * This file provides a centralized definition of document-related types
 * derived from the Supabase database schema to ensure consistency across
 * all document processing functionality.
 */
import { z } from 'zod'
import type { UUID, Timestamp, BaseEntity } from './base'
import type { ProcessingPhase } from './workflow'

// =========================================================================
// Database-derived type definitions
// =========================================================================

/**
 * Document category enum type
 */
export enum DocumentCategory {
  CLINICAL = 'clinical',
  LAB = 'lab',
  IMAGING = 'imaging',
  PRESCRIPTION = 'prescription',
  ADMINISTRATIVE = 'administrative',
}

/**
 * Document processing status values
 */
export enum DocumentProcessingStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  EXTRACTING = 'extracting',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Document state lifecycle stages - tracking the document through its lifecycle
 */
export enum DocumentLifecycleStage {
  /**
   * Document has been uploaded but not processed
   */
  UPLOADED = 'uploaded',

  /**
   * Document is being processed for text extraction
   */
  EXTRACTING = 'extracting',

  /**
   * Extraction has completed successfully
   */
  EXTRACTED = 'extracted',

  /**
   * Document content is being analyzed
   */
  ANALYZING = 'analyzing',

  /**
   * Document content is undergoing verification
   */
  VERIFYING = 'verifying',

  /**
   * Document content has been verified
   */
  VERIFIED = 'verified',

  /**
   * Processing has completed successfully
   */
  COMPLETED = 'completed',

  /**
   * Processing failed at some step
   */
  FAILED = 'failed',

  /**
   * Document is archived/inactive
   */
  ARCHIVED = 'archived',
}

// =========================================================================
// Core document types
// =========================================================================

/**
 * Document type - core definition
 */
export interface DocumentType {
  /**
   * Unique identifier
   */
  id?: string
  
  /**
   * Document title
   */
  title?: string
  
  /**
   * Document content
   */
  content?: string
  
  /**
   * Patient ID
   */
  patientId?: string
  
  /**
   * Creation timestamp
   */
  createdAt?: Date
  
  /**
   * Document status
   */
  status?: string
  
  /**
   * Document category
   */
  category: DocumentCategory

  /**
   * Document type within the category
   */
  type: string

  /**
   * Optional subtype for more specific categorization
   */
  subtype?: string

  /**
   * Additional metadata for the document type
   */
  metadata?: Record<string, unknown>
  
  /**
   * Pre-extracted chunks from document processing
   * Used to avoid redundant chunking
   */
  chunks?: Array<{
    content: string
    pageNumber?: number
    metadata?: Record<string, unknown>
  }>
  
  /**
   * Structured data from extraction
   */
  structuredData?: Record<string, any>
  
  /**
   * Extracted data from processing
   */
  extractedData?: ExtractedData
}

/**
 * Type guard for DocumentType
 */
export function isDocumentType(value: unknown): value is DocumentType {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>
  
  // Check required properties
  const hasRequiredProperties = 
    typeof obj.category === 'string' &&
    Object.values(DocumentCategory).includes(
      obj.category as DocumentCategory
    ) &&
    typeof obj.type === 'string';
  
  if (!hasRequiredProperties) return false;
    
  // Check optional properties have correct types if present
  const hasValidOptionalProperties =
    (obj.id === undefined || typeof obj.id === 'string') &&
    (obj.title === undefined || typeof obj.title === 'string') &&
    (obj.content === undefined || typeof obj.content === 'string') &&
    (obj.patientId === undefined || typeof obj.patientId === 'string') &&
    (obj.status === undefined || typeof obj.status === 'string') &&
    (obj.createdAt === undefined || obj.createdAt instanceof Date || 
      (typeof obj.createdAt === 'string' && !isNaN(Date.parse(obj.createdAt as string)))) &&
    (obj.subtype === undefined || typeof obj.subtype === 'string') &&
    (obj.metadata === undefined || (typeof obj.metadata === 'object' && obj.metadata !== null)) &&
    (obj.structuredData === undefined || (typeof obj.structuredData === 'object' && obj.structuredData !== null));
  
  // Check chunks array if present
  const hasValidChunks = obj.chunks === undefined || (
    Array.isArray(obj.chunks) && 
    obj.chunks.every(chunk => 
      typeof chunk === 'object' && 
      chunk !== null && 
      typeof (chunk as any).content === 'string'
    )
  );
  
  // Check extractedData if present
  const hasValidExtractedData = obj.extractedData === undefined || (
    typeof obj.extractedData === 'object' && 
    obj.extractedData !== null &&
    typeof (obj.extractedData as any).rawText === 'string'
  );
  
  return hasValidOptionalProperties && hasValidChunks && hasValidExtractedData;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  /**
   * User ID who uploaded the document
   */
  uploadedBy?: UUID

  /**
   * Error message if extraction fails
   */
  error?: string

  /**
   * Error code if extraction fails
   */
  errorCode?: string

  /**
   * Patient ID if this is a patient document
   */
  patientId?: UUID

  /**
   * Document type information
   */
  documentType?: DocumentType

  /**
   * Original filename
   */
  title?: string

  /**
   * File format (MIME type)
   */
  fileType?: string

  /**
   * File size in bytes
   */
  fileSize?: number

  /**
   * Document hash for deduplication
   */
  checksum?: string

  /**
   * Processing status
   */
  processingStatus?: DocumentProcessingStatus

  /**
   * Additional custom metadata
   */
  custom?: Record<string, unknown>
  
  /**
   * Document type confidence score (0-1)
   */
  documentTypeConfidence?: number
  
  /**
   * Detected document sections
   */
  detectedSections?: string[]
}

/**
 * Type guard for DocumentMetadata
 */
export function isDocumentMetadata(value: unknown): value is DocumentMetadata {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  // Check optional properties have correct types if present
  const hasValidUploadedBy =
    obj.uploadedBy === undefined || typeof obj.uploadedBy === 'string'

  const hasValidPatientId =
    obj.patientId === undefined || typeof obj.patientId === 'string'

  const hasValidDocumentType =
    obj.documentType === undefined || isDocumentType(obj.documentType)

  const hasValidTitle = obj.title === undefined || typeof obj.title === 'string'

  const hasValidFileType =
    obj.fileType === undefined || typeof obj.fileType === 'string'

  const hasValidFileSize =
    obj.fileSize === undefined ||
    (typeof obj.fileSize === 'number' && obj.fileSize >= 0)

  const hasValidChecksum =
    obj.checksum === undefined || typeof obj.checksum === 'string'

  const hasValidProcessingStatus =
    obj.processingStatus === undefined ||
    (typeof obj.processingStatus === 'string' &&
      Object.values(DocumentProcessingStatus).includes(
        obj.processingStatus as DocumentProcessingStatus
      ))

  const hasValidCustom =
    obj.custom === undefined ||
    (typeof obj.custom === 'object' && obj.custom !== null)

  return (
    hasValidUploadedBy &&
    hasValidPatientId &&
    hasValidDocumentType &&
    hasValidTitle &&
    hasValidFileType &&
    hasValidFileSize &&
    hasValidChecksum &&
    hasValidProcessingStatus &&
    hasValidCustom
  )
}

/**
 * Document chunk
 */
export interface DocumentChunk {
  /**
   * Chunk ID
   */
  id: UUID

  /**
   * Document ID this chunk belongs to
   */
  documentId?: UUID

  /**
   * Chunk text content
   */
  content: string

  /**
   * Chunk index in the document
   */
  chunkIndex: number

  /**
   * Page number
   */
  pageNumber?: number

  /**
   * Token count
   */
  tokenCount: number

  /**
   * Metadata for the chunk
   */
  metadata?: Record<string, unknown>

  /**
   * Heading or section title
   */
  heading?: string

  /**
   * Importance score
   */
  importanceScore?: number
}

/**
 * Type guard for DocumentChunk
 */
export function isDocumentChunk(value: unknown): value is DocumentChunk {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  return (
    typeof obj.id === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.chunkIndex === 'number' &&
    Number.isInteger(obj.chunkIndex) &&
    obj.chunkIndex >= 0 &&
    typeof obj.tokenCount === 'number' &&
    Number.isInteger(obj.tokenCount) &&
    obj.tokenCount >= 0 &&
    (obj.documentId === undefined || typeof obj.documentId === 'string') &&
    (obj.pageNumber === undefined ||
      (typeof obj.pageNumber === 'number' &&
        Number.isInteger(obj.pageNumber) &&
        obj.pageNumber > 0)) &&
    (obj.metadata === undefined ||
      (typeof obj.metadata === 'object' && obj.metadata !== null)) &&
    (obj.heading === undefined || typeof obj.heading === 'string') &&
    (obj.importanceScore === undefined ||
      typeof obj.importanceScore === 'number')
  )
}

/**
 * Base document interface with common properties
 */
export interface Document extends BaseEntity {
  /**
   * Original filename
   */
  fileName: string

  /**
   * File size in bytes
   */
  fileSize: number

  /**
   * File MIME type
   */
  fileType: string

  /**
   * Document type information
   */
  documentType: DocumentType

  /**
   * Current lifecycle stage
   */
  lifecycleStage: DocumentLifecycleStage

  /**
   * Patient ID if this is a patient document
   */
  patientId?: UUID

  /**
   * Department ID if applicable
   */
  departmentId?: UUID

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>
}

/**
 * Type guard for Document
 */
export function isDocument(value: unknown): value is Document {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  // First check if it's a valid BaseEntity
  const hasValidId = typeof obj.id === 'string'
  const hasValidCreatedAt =
    obj.createdAt instanceof Date ||
    (typeof obj.createdAt === 'string' && !isNaN(Date.parse(obj.createdAt)))

  // Then check Document-specific properties
  const hasValidFileName = typeof obj.fileName === 'string'
  const hasValidFileSize = typeof obj.fileSize === 'number' && obj.fileSize >= 0
  const hasValidFileType = typeof obj.fileType === 'string'
  const hasValidDocumentType = isDocumentType(obj.documentType)
  const hasValidLifecycleStage =
    typeof obj.lifecycleStage === 'string' &&
    Object.values(DocumentLifecycleStage).includes(
      obj.lifecycleStage as DocumentLifecycleStage
    )

  // Optional fields
  const hasValidPatientId =
    obj.patientId === undefined || typeof obj.patientId === 'string'
  const hasValidDepartmentId =
    obj.departmentId === undefined || typeof obj.departmentId === 'string'
  const hasValidMetadata =
    obj.metadata === undefined ||
    (typeof obj.metadata === 'object' && obj.metadata !== null)

  return (
    hasValidId &&
    hasValidCreatedAt &&
    hasValidFileName &&
    hasValidFileSize &&
    hasValidFileType &&
    hasValidDocumentType &&
    hasValidLifecycleStage &&
    hasValidPatientId &&
    hasValidDepartmentId &&
    hasValidMetadata
  )
}

/**
 * Result of an extraction operation
 */
export interface ExtractedData {
  /**
   * Raw text content of the document
   */
  rawText: string

  /**
   * Document metadata
   */
  metadata: DocumentMetadata

  /**
   * Content chunks (if any)
   */
  chunks?: Array<{
    /**
     * Text content of this chunk
     */
    content: string

    /**
     * Page number where this chunk appears
     */
    pageNumber?: number

    /**
     * Additional metadata about this chunk
     */
    metadata?: Record<string, unknown>
  }>
}

/**
 * Extracted document interface
 */
export interface ExtractedDocument extends Document {
  /**
   * Extracted data from the document
   */
  extractedData: ExtractedData

  /**
   * Whether extraction was successful
   */
  isProcessed: boolean

  /**
   * Error message if extraction failed
   */
  processingError?: string

  /**
   * Current processing status
   */
  processingStatus: DocumentProcessingStatus

  /**
   * Confidence score for extraction (0-1)
   */
  confidence?: number
}

/**
 * Processing status of an operation
 */
export interface ProcessingStatus {
  /**
   * Current status of the processing operation
   */
  status: 'pending' | 'idle' | 'processing' | 'success' | 'error' | 'completed'

  /**
   * Progress indicator (0-100)
   */
  progress: number

  /**
   * Optional description of the current step
   */
  currentStep?: string

  /**
   * Error message if status is 'error'
   */
  error?: string

  /**
   * Phase of the process (for multi-phase operations)
   */
  phase?: ProcessingPhase
}

/**
 * Document search query
 */
export interface DocumentSearchQuery {
  /**
   * Search query
   */
  query: string

  /**
   * Filter metadata (optional)
   */
  filter?: Record<string, unknown>

  /**
   * Number of results to return
   */
  matchCount: number

  /**
   * Minimum similarity threshold (0-1)
   */
  matchThreshold: number

  /**
   * Patient ID filter
   */
  patientId?: UUID
}

/**
 * Document search result
 */
export interface DocumentSearchResult {
  /**
   * Document ID
   */
  id?: UUID

  /**
   * Document ID this chunk belongs to
   */
  documentId?: UUID

  /**
   * Document content
   */
  content: string

  /**
   * Metadata
   */
  metadata?: Record<string, unknown>

  /**
   * Similarity score (0-1)
   */
  similarity: number
}

/**
 * Upload document result
 */
export interface UploadDocumentResult {
  /**
   * ID of the uploaded document
   */
  documentId: UUID

  /**
   * Original filename
   */
  fileName: string

  /**
   * Current extraction status
   */
  extractionStatus?: DocumentLifecycleStage | string
}

// =========================================================================
// Zod schemas for validation
// =========================================================================

/**
 * Document category schema
 */
export const DocumentCategorySchema = z.nativeEnum(DocumentCategory)

/**
 * Document type schema - core definition
 */
export const DocumentTypeSchema = z.object({
  /**
   * Document category from enum
   */
  category: DocumentCategorySchema,

  /**
   * Document type within the category
   */
  type: z.string(),

  /**
   * Optional subtype for more specific categorization
   */
  subtype: z.string().optional(),

  /**
   * Additional metadata for the document type
   */
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Document metadata schema
 */
export const DocumentMetadataSchema = z.object({
  /**
   * User ID who uploaded the document
   */
  uploadedBy: z.string().uuid().optional(),

  /**
   * Patient ID if this is a patient document
   */
  patientId: z.string().uuid().optional(),

  /**
   * Document type information
   */
  documentType: DocumentTypeSchema.optional(),

  /**
   * Original filename
   */
  title: z.string().optional(),

  /**
   * File format (MIME type)
   */
  fileType: z.string().optional(),

  /**
   * File size in bytes
   */
  fileSize: z.number().nonnegative().optional(),

  /**
   * Document hash for deduplication
   */
  checksum: z.string().optional(),

  /**
   * Processing status
   */
  processingStatus: z.nativeEnum(DocumentProcessingStatus).optional(),

  /**
   * Additional custom metadata
   */
  custom: z.record(z.unknown()).optional(),
})

/**
 * Document chunk schema
 */
export const DocumentChunkSchema = z.object({
  /**
   * Chunk ID
   */
  id: z.string().uuid(),

  /**
   * Document ID this chunk belongs to
   */
  documentId: z.string().uuid().optional(),

  /**
   * Chunk text content
   */
  content: z.string(),

  /**
   * Chunk index in the document
   */
  chunkIndex: z.number().int().nonnegative(),

  /**
   * Page number
   */
  pageNumber: z.number().int().positive().optional(),

  /**
   * Token count
   */
  tokenCount: z.number().int().nonnegative(),

  /**
   * Metadata for the chunk
   */
  metadata: z.record(z.unknown()).optional(),

  /**
   * Heading or section title
   */
  heading: z.string().optional(),

  /**
   * Importance score
   */
  importanceScore: z.number().optional(),
})

/**
 * Extracted document schema
 */
export const ExtractedDocumentSchema = z.object({
  /**
   * Document ID
   */
  id: z.string().uuid(),

  /**
   * Creation timestamp
   */
  createdAt: z.string().datetime().or(z.date()),

  /**
   * Document type
   */
  documentType: DocumentTypeSchema,

  /**
   * Patient ID
   */
  patientId: z.string().uuid().optional(),

  /**
   * Department ID
   */
  departmentId: z.string().uuid().optional(),

  /**
   * Extracted data
   */
  extractedData: z.object({
    /**
     * Raw document text
     */
    rawText: z.string(),

    /**
     * Document metadata
     */
    metadata: z.record(z.unknown()),

    /**
     * Document chunks
     */
    chunks: z
      .array(
        z.object({
          content: z.string(),
          pageNumber: z.number().optional(),
          metadata: z.record(z.unknown()).optional(),
        })
      )
      .optional(),
  }),

  /**
   * Whether extraction was successful
   */
  isProcessed: z.boolean(),

  /**
   * Error message if extraction failed
   */
  processingError: z.string().optional(),

  /**
   * Processing status
   */
  processingStatus: z.nativeEnum(DocumentProcessingStatus),
})

/**
 * Document search query schema
 */
export const DocumentSearchQuerySchema = z.object({
  /**
   * Search query
   */
  query: z.string(),

  /**
   * Filter metadata (optional)
   */
  filter: z.record(z.unknown()).optional(),

  /**
   * Number of results to return (match_count in RPC)
   */
  matchCount: z.number().int().positive().default(5),

  /**
   * Minimum similarity threshold (0-1) (match_threshold in RPC)
   */
  matchThreshold: z.number().min(0).max(1).default(0.5),

  /**
   * Patient ID filter
   */
  patientId: z.string().uuid().optional(),
})

/**
 * Document search result schema
 */
export const DocumentSearchResultSchema = z.object({
  /**
   * Document ID
   */
  id: z.string().uuid().optional(),

  /**
   * Document ID this chunk belongs to
   */
  documentId: z.string().uuid().optional(),

  /**
   * Document content
   */
  content: z.string(),

  /**
   * Metadata
   */
  metadata: z.record(z.unknown()).optional(),

  /**
   * Similarity score (0-1)
   */
  similarity: z.number().min(0).max(1),
})