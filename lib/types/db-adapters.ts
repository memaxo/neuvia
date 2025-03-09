/**
 * Database adapter interfaces
 *
 * This file provides interfaces for database representations (snake_case) of domain entities.
 * 
 * IMPORTANT: The direct conversion functions have been removed from this file.
 * Instead, use the mapper classes from these dedicated files:
 * - Document conversions: use document-mapper.ts (DocumentMapper, DocumentTypeMapper, etc.)
 * - Verification conversions: use verification-mapper.ts (VerificationItemMapper, etc.)
 * - Report conversions: use report-mapper.ts (ReportMapper, etc.)
 * - Workflow conversions: use workflow-mapper.ts (WorkflowStateMapper, etc.)
 * 
 * Example usage:
 *   import { documentMapper } from '@/lib/types/document-mapper';
 *   const domainDoc = documentMapper.toDomain(dbDoc);
 *   const dbDoc = documentMapper.toDatabase(domainDoc);
 */

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
export interface DbExtractedDocument {
  id: string
  created_at: string
  updated_at: string
  document_type: DbDocumentType
  patient_id?: string
  department_id?: string
  file_name: string
  file_size: number
  file_type: string
  lifecycle_stage: string
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

// Note: The functions below have been deprecated and removed.
// Please use the WorkflowStateMapper class from lib/types/workflow-mapper.ts instead.
// Example usage:
// import { workflowStateMapper } from '@/lib/types/workflow-mapper';
// const domainState = workflowStateMapper.toDomain(dbState);
// const dbState = workflowStateMapper.toDatabase(domainState);

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
  status?: string
  content?: string
  metadata?: Record<string, unknown>
  user_id?: string
  verified_at?: string
  correction?: string
  reason?: string
  // Required fields for mapping to VerificationItem
  description?: string
  original_content?: string
  current_content?: string
  is_verified?: boolean
  is_modified?: boolean
  // Optional fields
  category?: string
  path?: string
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