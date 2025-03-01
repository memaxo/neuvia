import type { Database } from '@/lib/supabase'
/**
 * Document Type Schemas
 *
 * Zod schemas and type definitions for document processing and metadata
 * aligned with Supabase database types
 */
import { z } from 'zod'

type DbEnums = Database['public']['Enums']

/**
 * Document category from database enum
 */
export const DocumentCategoryEnum = z.enum([
  'clinical',
  'lab',
  'imaging',
  'prescription',
  'administrative',
] as [DbEnums['document_category'], ...DbEnums['document_category'][]])

export type DocumentCategory = z.infer<typeof DocumentCategoryEnum>

/**
 * Document type schema
 */
export const DocumentTypeSchema = z.object({
  /**
   * Document category from database enum
   */
  category: DocumentCategoryEnum,

  /**
   * Document type within the category
   */
  type: z.string(),
})

export type DocumentType = z.infer<typeof DocumentTypeSchema>

/**
 * Document metadata schema
 */
export const DocumentMetadataSchema = z.object({
  /**
   * User ID who uploaded the document
   */
  uploaded_by: z.string().uuid().optional(),

  /**
   * Patient ID if this is a patient document
   */
  patient_id: z.string().uuid().optional(),

  /**
   * Document type information
   */
  document_type: DocumentTypeSchema.optional(),

  /**
   * Original filename
   */
  title: z.string().optional(),

  /**
   * File format (MIME type)
   */
  file_type: z.string().optional(),

  /**
   * File size in bytes
   */
  file_size: z.number().nonnegative().optional(),

  /**
   * Document hash for deduplication
   */
  checksum: z.string().optional(),

  /**
   * Extraction timestamp
   */
  created_at: z.string().datetime().optional(),

  /**
   * Processing status from database
   */
  processing_status: z
    .enum(['pending', 'processing', 'completed', 'error'])
    .optional(),

  /**
   * Page number (for multi-page documents)
   */
  page_number: z.number().int().positive().optional(),

  /**
   * Chunk index (for chunked documents)
   */
  chunk_index: z.number().int().nonnegative().optional(),

  /**
   * Additional custom metadata
   */
  custom: z.record(z.any()).optional(),

  /**
   * Content hash for deduplication within langchain
   */
  content_hash: z.string().optional(),
})

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>

/**
 * Document chunk schema aligned with document_chunks table
 */
export const DocumentChunkSchema = z.object({
  /**
   * Chunk ID
   */
  id: z.string().uuid(),

  /**
   * Document ID this chunk belongs to
   */
  document_id: z.string().uuid().optional(),

  /**
   * Chunk text content
   */
  content: z.string(),

  /**
   * Chunk index in the document
   */
  chunk_index: z.number().int().nonnegative(),

  /**
   * Page number
   */
  page_number: z.number().int().positive().optional(),

  /**
   * Token count
   */
  token_count: z.number().int().nonnegative(),

  /**
   * Metadata for the chunk
   */
  metadata: z.record(z.any()).optional(),

  /**
   * Heading or section title
   */
  heading: z.string().optional(),

  /**
   * Importance score
   */
  importance_score: z.number().optional(),
})

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>

/**
 * Workflow step enum from database
 */
export const WorkflowStepEnum = z.enum([
  'idle',
  'uploading',
  'extracting',
  'verification',
  'report_generation',
  'complete',
  'chat_started',
  'chat_in_progress',
  'chat_completed',
  'chat_error',
] as [DbEnums['workflow_step'], ...DbEnums['workflow_step'][]])

export type WorkflowStep = z.infer<typeof WorkflowStepEnum>

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
  created_at: z.string().datetime().or(z.date()),

  /**
   * Document type
   */
  document_type: DocumentTypeSchema,

  /**
   * Patient ID
   */
  patient_id: z.string().uuid().optional(),

  /**
   * Extracted data
   */
  extractedData: z.object({
    /**
     * Raw document text
     */
    content_text: z.string(),

    /**
     * Document metadata
     */
    metadata: z.record(z.any()),

    /**
     * Document chunks
     */
    chunks: z
      .array(
        z.object({
          content: z.string(),
          page_number: z.number().optional(),
        })
      )
      .optional(),
  }),

  /**
   * Whether extraction was successful
   */
  is_processed: z.boolean(),

  /**
   * Error message if extraction failed
   */
  processing_error: z.string().optional(),

  /**
   * Processing status
   */
  processing_status: z.string(),
})

export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>

/**
 * Document embedding schema
 */
export const DocumentEmbeddingSchema = z.object({
  /**
   * Document ID (numerical in the actual DB)
   */
  id: z.number(),

  /**
   * Document content
   */
  content: z.string(),

  /**
   * Embedding vector (stored as string in Postgres)
   */
  embedding: z.string(),

  /**
   * Document metadata
   */
  metadata: DocumentMetadataSchema.optional(),

  /**
   * Creation timestamp
   */
  created_at: z.string().datetime(),

  /**
   * Reference to document
   */
  document_id: z.number().optional(),
})

export type DocumentEmbedding = z.infer<typeof DocumentEmbeddingSchema>

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
  filter: z.record(z.any()).optional(),

  /**
   * Number of results to return (match_count in RPC)
   */
  match_count: z.number().int().positive().default(5),

  /**
   * Minimum similarity threshold (0-1) (match_threshold in RPC)
   */
  match_threshold: z.number().min(0).max(1).default(0.5),

  /**
   * Patient ID filter
   */
  patient_id: z.string().uuid().optional(),
})

export type DocumentSearchQuery = z.infer<typeof DocumentSearchQuerySchema>

/**
 * Document search result schema aligned with match_documents RPC return type
 */
export const DocumentSearchResultSchema = z.object({
  /**
   * Document ID
   */
  id: z.string().uuid().optional(),

  /**
   * Document ID this chunk belongs to
   */
  document_id: z.string().uuid().optional(),

  /**
   * Document content
   */
  content: z.string(),

  /**
   * Metadata
   */
  metadata: z.record(z.any()).optional(),

  /**
   * Similarity score (0-1)
   */
  similarity: z.number().min(0).max(1),
})

export type DocumentSearchResult = z.infer<typeof DocumentSearchResultSchema>
