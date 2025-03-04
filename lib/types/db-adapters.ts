/**
 * Database adapter functions
 *
 * This file provides utilities and adapter functions for converting between
 * database representations (snake_case) and application models (camelCase).
 */
import type {
  Document,
  DocumentType,
  DocumentMetadata,
  ExtractedDocument,
  DocumentChunk,
  DocumentLifecycleStage,
  DocumentProcessingStatus,
} from './document'
import type { WorkflowStep, WorkflowState } from './workflow'
import type {
  VerificationMetadata,
  VerificationItem,
  VerifiedDocument,
  VerificationStatusType,
} from './verification'
import type { Report, ReportSections } from './report'
import type { BaseEntity } from './base'

/**
 * Converts camelCase string to snake_case
 * @example
 * toSnakeCase('helloWorld') // 'hello_world'
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * Converts snake_case string to camelCase
 * @example
 * toCamelCase('hello_world') // 'helloWorld'
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * Convert an object with camelCase keys to snake_case keys
 * @example
 * toSnakeCaseKeys({ firstName: 'John', lastName: 'Doe' }) // { first_name: 'John', last_name: 'Doe' }
 */
export function toSnakeCaseKeys<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  return Object.entries(obj).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      const snakeKey = toSnakeCase(key)

      // Recursively convert nested objects
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        acc[snakeKey] = toSnakeCaseKeys(value as Record<string, unknown>)
      } else if (Array.isArray(value)) {
        // Handle arrays - convert objects within arrays
        acc[snakeKey] = value.map((item) =>
          item !== null && typeof item === 'object' && !Array.isArray(item)
            ? toSnakeCaseKeys(item as Record<string, unknown>)
            : item
        )
      } else {
        acc[snakeKey] = value
      }

      return acc
    },
    {}
  )
}

/**
 * Convert an object with snake_case keys to camelCase keys
 * @example
 * toCamelCaseKeys({ first_name: 'John', last_name: 'Doe' }) // { firstName: 'John', lastName: 'Doe' }
 */
export function toCamelCaseKeys<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  return Object.entries(obj).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      const camelKey = toCamelCase(key)

      // Recursively convert nested objects
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        acc[camelKey] = toCamelCaseKeys(value as Record<string, unknown>)
      } else if (Array.isArray(value)) {
        acc[camelKey] = value.map((item) =>
          item !== null && typeof item === 'object' && !Array.isArray(item)
            ? toCamelCaseKeys(item as Record<string, unknown>)
            : item
        )
      } else {
        acc[camelKey] = value
      }

      return acc
    },
    {}
  )
}

/**
 * Type-safe wrapper for converting from database to application model
 */
export function dbToApp<T>(obj: Record<string, unknown>): T {
  return toCamelCaseKeys(obj) as unknown as T
}

/**
 * Type-safe wrapper for converting from application to database model
 */
export function appToDb<T>(obj: Record<string, unknown>): T {
  return toSnakeCaseKeys(obj) as unknown as T
}

// =========================================================================
// Document Adapters
// =========================================================================

/**
 * Database representation of a document type
 */
export interface DbDocumentType {
  category: string
  type: string
  subtype?: string
  metadata?: Record<string, unknown>
}

/**
 * Database representation of a document
 */
export interface DbDocument {
  id: string
  created_at: string
  updated_at: string
  file_name: string
  file_size: number
  file_type: string
  document_type: DbDocumentType
  lifecycle_stage: string
  patient_id?: string
  department_id?: string
  metadata?: Record<string, unknown>
}

/**
 * Database representation of an extracted document
 */
export interface DbExtractedDocument extends DbDocument {
  extracted_data: {
    raw_text: string
    metadata: Record<string, unknown>
    chunks?: Array<{
      content: string
      page_number?: number
      metadata?: Record<string, unknown>
    }>
  }
  is_processed: boolean
  processing_error?: string
  processing_status: string
  confidence?: number
}

/**
 * Database representation of a document chunk
 */
export interface DbDocumentChunk {
  id: string
  document_id?: string
  content: string
  chunk_index: number
  page_number?: number
  token_count: number
  metadata?: Record<string, unknown>
  heading?: string
  importance_score?: number
}

/**
 * Convert document type from database to application format
 */
export function documentTypeFromDb(dbDocType: DbDocumentType): DocumentType {
  return {
    category: dbDocType.category as DocumentType['category'],
    type: dbDocType.type,
    subtype: dbDocType.subtype,
    metadata: dbDocType.metadata,
  }
}

/**
 * Convert document type from application to database format
 */
export function documentTypeToDb(docType: DocumentType): DbDocumentType {
  return {
    category: docType.category,
    type: docType.type,
    subtype: docType.subtype,
    metadata: docType.metadata,
  }
}

/**
 * Convert document from database to application format
 */
export function documentFromDb(dbDoc: DbDocument): Document {
  const doc: Partial<Document> & BaseEntity = {
    id: dbDoc.id,
    createdAt: dbDoc.created_at,
    updatedAt: dbDoc.updated_at,
    fileName: dbDoc.file_name,
    fileSize: dbDoc.file_size,
    fileType: dbDoc.file_type,
    documentType: documentTypeFromDb(dbDoc.document_type),
    lifecycleStage: dbDoc.lifecycle_stage as DocumentLifecycleStage,
    patientId: dbDoc.patient_id,
    departmentId: dbDoc.department_id,
    metadata: dbDoc.metadata,
  }

  return doc as Document
}

/**
 * Convert document from application to database format
 */
export function documentToDb(doc: Partial<Document> & BaseEntity): DbDocument {
  return {
    id: doc.id,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    file_name: doc.fileName!,
    file_size: doc.fileSize!,
    file_type: doc.fileType!,
    document_type: documentTypeToDb(doc.documentType!),
    lifecycle_stage: doc.lifecycleStage!,
    patient_id: doc.patientId,
    department_id: doc.departmentId,
    metadata: doc.metadata,
  }
}

/**
 * Convert extracted document from database to application format
 */
export function extractedDocumentFromDb(
  dbDoc: DbExtractedDocument
): ExtractedDocument {
  const baseDoc = documentFromDb(dbDoc)

  return {
    ...baseDoc,
    extractedData: {
      rawText: dbDoc.extracted_data.raw_text,
      metadata: dbDoc.extracted_data.metadata as unknown as DocumentMetadata,
      chunks: dbDoc.extracted_data.chunks?.map((chunk) => ({
        content: chunk.content,
        pageNumber: chunk.page_number,
        metadata: chunk.metadata,
      })),
    },
    isProcessed: dbDoc.is_processed,
    processingError: dbDoc.processing_error,
    processingStatus: dbDoc.processing_status as DocumentProcessingStatus,
    confidence: dbDoc.confidence,
  }
}

/**
 * Convert extracted document from application to database format
 */
export function extractedDocumentToDb(
  doc: ExtractedDocument
): DbExtractedDocument {
  const baseDoc = documentToDb(doc as unknown as Partial<Document> & BaseEntity)

  return {
    ...baseDoc,
    extracted_data: {
      raw_text: doc.extractedData.rawText,
      metadata: doc.extractedData.metadata as unknown as Record<
        string,
        unknown
      >,
      chunks: doc.extractedData.chunks?.map((chunk) => ({
        content: chunk.content,
        page_number: chunk.pageNumber,
        metadata: chunk.metadata,
      })),
    },
    is_processed: doc.isProcessed,
    processing_error: doc.processingError,
    processing_status: doc.processingStatus,
    confidence: doc.confidence,
  }
}

/**
 * Convert document chunk from database to application format
 */
export function documentChunkFromDb(dbChunk: DbDocumentChunk): DocumentChunk {
  return {
    id: dbChunk.id,
    documentId: dbChunk.document_id,
    content: dbChunk.content,
    chunkIndex: dbChunk.chunk_index,
    pageNumber: dbChunk.page_number,
    tokenCount: dbChunk.token_count,
    metadata: dbChunk.metadata,
    heading: dbChunk.heading,
    importanceScore: dbChunk.importance_score,
  }
}

/**
 * Convert document chunk from application to database format
 */
export function documentChunkToDb(chunk: DocumentChunk): DbDocumentChunk {
  return {
    id: chunk.id,
    document_id: chunk.documentId,
    content: chunk.content,
    chunk_index: chunk.chunkIndex,
    page_number: chunk.pageNumber,
    token_count: chunk.tokenCount,
    metadata: chunk.metadata,
    heading: chunk.heading,
    importance_score: chunk.importanceScore,
  }
}

// =========================================================================
// Workflow Adapters
// =========================================================================

/**
 * Database representation of workflow state
 */
export interface DbWorkflowState {
  id: string
  step: string
  progress: number
  phase?: string
  error?: string | null
  metadata?: Record<string, unknown>
  timestamp: string
}

/**
 * Convert workflow state from database to application format
 */
export function workflowStateFromDb(dbState: DbWorkflowState): WorkflowState {
  return {
    currentStep: dbState.step as WorkflowStep,
    progress: dbState.progress,
    phase: dbState.phase as WorkflowState['phase'],
    error: dbState.error,
    metadata: dbState.metadata,
    timestamp: dbState.timestamp,
  }
}

/**
 * Convert workflow state from application to database format
 */
export function workflowStateToDb(state: WorkflowState): DbWorkflowState {
  return {
    id: `workflow-${Date.now()}`,
    step: state.currentStep,
    progress: state.progress,
    phase: state.phase,
    error: state.error ?? null,
    metadata: state.metadata,
    timestamp: state.timestamp,
  }
}

// =========================================================================
// Verification Adapters
// =========================================================================

/**
 * Database representation of verification metadata
 */
export interface DbVerificationMetadata {
  verification_status: string
  original_summary_id: string
  current_version_id: string
  correction_count: number
  verified_at?: string
  verified_by?: string
  corrections: Array<{
    id: string
    text: string
    timestamp: string
    user_id?: string
  }>
  extracted_data?: unknown
  started_at?: string
  last_updated?: string
  confidence_score?: number
  rejection_reason?: string
  patient_id?: string
}

/**
 * Database representation of verification item
 */
export interface DbVerificationItem {
  id: string
  title: string
  status: string
  content: string
  metadata?: Record<string, unknown>
  user_id?: string
  verified_at?: string
  correction?: string
  reason?: string
  // Additional fields that are used in the adapter functions but not in the schema
  description?: string
  category?: string
  path?: string
  original_content?: string
  current_content?: string
  is_verified?: boolean
  is_modified?: boolean
  confidence?: number
  change_history?: Array<{
    id: string
    content: string
    timestamp: string
    user_id?: string
    reason?: string
  }>
  source?: {
    document_id: string
    page?: number
    section?: string
    start_position?: number
    end_position?: number
  }
}

/**
 * Database representation of a verified document
 */
export interface DbVerifiedDocument {
  id: string
  original_document_id: string
  verified_by?: string
  verified_at: string
  verification_items: DbVerificationItem[]
  verification_status: string
  verification_metadata: DbVerificationMetadata
  document_type: DbDocumentType
  patient_id?: string
  verified_data: {
    content: Record<string, unknown>
    metadata: Record<string, unknown>
  }
  created_at: string
  updated_at: string
}

/**
 * Convert verification metadata from database to application format
 */
export function verificationMetadataFromDb(
  dbMeta: DbVerificationMetadata
): VerificationMetadata {
  // Map the corrections array to match the expected format
  const corrections = dbMeta.corrections.map((c) => ({
    id: c.id,
    content: c.text, // Map 'text' to 'content'
    timestamp: c.timestamp,
  }))

  // Create a partial object with only the properties defined in VerificationMetadata
  const metadata: Partial<VerificationMetadata> = {
    verificationStatus: dbMeta.verification_status as VerificationStatusType,
    originalSummaryId: dbMeta.original_summary_id,
    currentVersionId: dbMeta.current_version_id,
    correctionCount: dbMeta.correction_count,
    corrections,
    // Additional properties that might be in the extended version
    documentId:
      dbMeta.extracted_data !== undefined && dbMeta.extracted_data !== null
        ? String(dbMeta.extracted_data)
        : undefined,
    patientId: dbMeta.patient_id,
  }

  return metadata as VerificationMetadata
}

/**
 * Convert verification metadata from application to database format
 */
export function verificationMetadataToDb(
  meta: VerificationMetadata
): DbVerificationMetadata {
  // Map the corrections array to match the database format
  const corrections =
    meta.corrections?.map((c) => ({
      id: c.id,
      text: c.content, // Map 'content' to 'text'
      timestamp:
        typeof c.timestamp === 'object'
          ? c.timestamp.toISOString()
          : c.timestamp,
      user_id: undefined,
    })) || []

  return {
    verification_status: meta.verificationStatus,
    original_summary_id: meta.originalSummaryId ?? '',
    current_version_id: meta.currentVersionId ?? '',
    correction_count: meta.correctionCount,
    verified_at: undefined, // Not in the schema
    verified_by: undefined, // Not in the schema
    corrections,
    extracted_data: undefined, // Not in the schema
    started_at: undefined, // Not in the schema
    last_updated: undefined, // Not in the schema
    confidence_score: undefined, // Not in the schema
    rejection_reason: undefined, // Not in the schema
    patient_id: meta.patientId,
  }
}

/**
 * Convert verification item from database to application format
 */
export function verificationItemFromDb(
  dbItem: DbVerificationItem
): VerificationItem {
  return {
    id: dbItem.id,
    title: dbItem.title,
    content: dbItem.content,
    status: dbItem.status as VerificationItem['status'],
    correction: dbItem.correction,
    reason: dbItem.reason,
    verifiedBy: dbItem.user_id,
    verifiedAt: dbItem.verified_at,
    metadata: dbItem.metadata,
  }
}

/**
 * Convert verification item from application to database format
 */
export function verificationItemToDb(
  item: VerificationItem
): DbVerificationItem {
  // Convert Date objects to ISO strings if present
  const verifiedAt =
    typeof item.verifiedAt === 'object' && item.verifiedAt instanceof Date
      ? item.verifiedAt.toISOString()
      : item.verifiedAt

  return {
    id: item.id,
    title: item.title,
    content: item.content,
    status: item.status,
    correction: item.correction,
    reason: item.reason,
    user_id: item.verifiedBy,
    verified_at: verifiedAt,
    metadata: item.metadata,
  }
}

/**
 * Convert verified document from database to application format
 */
export function verifiedDocumentFromDb(
  dbDoc: DbVerifiedDocument
): VerifiedDocument {
  const doc: Partial<VerifiedDocument> & BaseEntity = {
    id: dbDoc.id,
    originalDocumentId: dbDoc.original_document_id,
    verifiedBy: dbDoc.verified_by,
    verifiedAt: dbDoc.verified_at,
    verificationItems: dbDoc.verification_items.map(verificationItemFromDb),
    verificationStatus: dbDoc.verification_status as VerificationStatusType,
    verificationMetadata: verificationMetadataFromDb(
      dbDoc.verification_metadata
    ),
    documentType: documentTypeFromDb(dbDoc.document_type),
    patientId: dbDoc.patient_id,
    verifiedData: dbDoc.verified_data,
    createdAt: dbDoc.created_at,
    updatedAt: dbDoc.updated_at,
  }

  return doc as VerifiedDocument
}

/**
 * Convert verified document from application to database format
 */
export function verifiedDocumentToDb(
  doc: VerifiedDocument
): DbVerifiedDocument {
  return {
    id: doc.id,
    original_document_id: doc.originalDocumentId,
    verified_by: doc.verifiedBy,
    verified_at: doc.verifiedAt,
    verification_items: doc.verificationItems.map(verificationItemToDb),
    verification_status: doc.verificationStatus,
    verification_metadata: verificationMetadataToDb(doc.verificationMetadata),
    document_type: documentTypeToDb(doc.documentType),
    patient_id: doc.patientId,
    verified_data: doc.verifiedData,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
  }
}

// =========================================================================
// Report Adapters
// =========================================================================

/**
 * Database representation of report sections
 */
export interface DbReportSections {
  [sectionKey: string]: {
    title: string
    content: string
    order: number
    editable?: boolean
    required?: boolean
    metadata?: Record<string, unknown>
  }
}

/**
 * Database representation of report metadata
 */
export interface DbReportMetadata {
  generated_at: string
  modified_at?: string
  modified_by?: string
  generation_time_ms?: number
  parameters?: Record<string, unknown>
  version?: string
  document_types?: DbDocumentType[]
  [key: string]: unknown
}

/**
 * Database representation of a report
 */
export interface DbReport {
  id: string
  title: string
  patient_id: string
  created_by?: string
  organization_id?: string
  report_type: string
  status: string
  sections: DbReportSections
  source_documents: string[]
  metadata: DbReportMetadata
  created_at: string
  updated_at: string
}

/**
 * Convert report from database to application format
 */
export function reportFromDb(dbReport: DbReport): Report {
  return {
    id: dbReport.id,
    title: dbReport.title,
    patientId: dbReport.patient_id,
    createdBy: dbReport.created_by,
    organizationId: dbReport.organization_id,
    reportType: dbReport.report_type as Report['reportType'],
    status: dbReport.status as Report['status'],
    sections: dbReport.sections as ReportSections,
    sourceDocuments: dbReport.source_documents,
    metadata: {
      generatedAt: dbReport.metadata.generated_at,
      modifiedAt: dbReport.metadata.modified_at,
      modifiedBy: dbReport.metadata.modified_by,
      generationTimeMs: dbReport.metadata.generation_time_ms,
      parameters: dbReport.metadata.parameters,
      version: dbReport.metadata.version,
      documentTypes: dbReport.metadata.document_types?.map(documentTypeFromDb),
      ...Object.fromEntries(
        Object.entries(dbReport.metadata)
          .filter(
            ([key]) =>
              ![
                'generated_at',
                'modified_at',
                'modified_by',
                'generation_time_ms',
                'parameters',
                'version',
                'document_types',
              ].includes(key)
          )
          .map(([key, value]) => [toCamelCase(key), value])
      ),
    },
    createdAt: dbReport.created_at,
    updatedAt: dbReport.updated_at,
  }
}

/**
 * Convert report from application to database format
 */
export function reportToDb(report: Report): DbReport {
  return {
    id: report.id,
    title: report.title,
    patient_id: report.patientId,
    created_by: report.createdBy,
    organization_id: report.organizationId,
    report_type: report.reportType,
    status: report.status,
    sections: report.sections as DbReportSections,
    source_documents: report.sourceDocuments,
    metadata: {
      generated_at: report.metadata.generatedAt,
      modified_at: report.metadata.modifiedAt,
      modified_by: report.metadata.modifiedBy,
      generation_time_ms: report.metadata.generationTimeMs,
      parameters: report.metadata.parameters,
      version: report.metadata.version,
      document_types: report.metadata.documentTypes?.map(documentTypeToDb),
      ...Object.fromEntries(
        Object.entries(report.metadata)
          .filter(
            ([key]) =>
              ![
                'generatedAt',
                'modifiedAt',
                'modifiedBy',
                'generationTimeMs',
                'parameters',
                'version',
                'documentTypes',
              ].includes(key)
          )
          .map(([key, value]) => [toSnakeCase(key), value])
      ),
    },
    created_at: report.createdAt,
    updated_at: report.updatedAt,
  }
}
