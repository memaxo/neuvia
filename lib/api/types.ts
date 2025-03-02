/**
 * API TypeScript Types
 * 
 * Type definitions that align with the OpenAPI schema for use in TypeScript code
 */
import type { OpenAPIV3 } from 'openapi-types'
import type {
  DocumentCategory,
  DocumentType,
  DocumentMetadata,
  DocumentChunk,
  ExtractedDocument,
  DocumentSearchQuery,
  DocumentSearchResult,
} from '@/lib/schemas/document-types'
import type {
  VerificationStatusType,
  VerificationItem,
  VerificationMetadata,
  VerificationOptions,
  VerificationResult,
} from '@/lib/processing/types/verification'
import type {
  ChatMode,
  ResearchOptions,
  ReportFormat,
} from '@/lib/chat/types'

/**
 * Common API request type
 */
export interface ApiRequest<T = any> {
  /**
   * Request body
   */
  body?: T
  
  /**
   * Request query parameters
   */
  query?: Record<string, string | string[]>
  
  /**
   * Request headers
   */
  headers?: Record<string, string>
}

/**
 * Common API response type
 */
export interface ApiResponse<T = any> {
  /**
   * Indicates successful operation
   */
  success: boolean
  
  /**
   * Response data
   */
  data: T
  
  /**
   * Timestamp of the response
   */
  timestamp: string
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  /**
   * Error details
   */
  error: {
    /**
     * Error message
     */
    message: string
    
    /**
     * Error code
     */
    code?: string
    
    /**
     * Timestamp when the error occurred
     */
    timestamp: string
    
    /**
     * Additional error details
     */
    details?: Record<string, any>
  }
}

/**
 * Verification API types
 */
export namespace VerificationApi {
  /**
   * Get patient summary verification request
   */
  export interface GetPatientSummaryVerificationRequest {
    /**
     * Path parameters
     */
    params: {
      /**
       * Patient ID
       */
      patientId: string
    }
  }
  
  /**
   * Get patient summary verification response
   */
  export interface GetPatientSummaryVerificationResponse {
    /**
     * Current verification status
     */
    verificationStatus: VerificationStatusType
    
    /**
     * Verification items
     */
    items: VerificationItem[]
    
    /**
     * Verification metadata
     */
    metadata?: VerificationMetadata
    
    /**
     * Original content being verified
     */
    originalContent?: string
    
    /**
     * Current content after any corrections
     */
    currentContent?: string
  }
  
  /**
   * Update patient summary verification request
   */
  export interface UpdatePatientSummaryVerificationRequest {
    /**
     * Path parameters
     */
    params: {
      /**
       * Patient ID
       */
      patientId: string
    }
    
    /**
     * Request body
     */
    body: {
      /**
       * Verification status to set
       */
      status: 'pending' | 'verified' | 'rejected'
      
      /**
       * Optional comments about the verification
       */
      comments?: string
      
      /**
       * Updated verification items
       */
      items?: VerificationItem[]
    }
  }
  
  /**
   * Get document verification request
   */
  export interface GetDocumentVerificationRequest {
    /**
     * Query parameters
     */
    query: {
      /**
       * Extracted document ID
       */
      extractedDocumentId: string
    }
  }
  
  /**
   * Generate document verification request
   */
  export interface GenerateDocumentVerificationRequest {
    /**
     * Request body
     */
    body: {
      /**
       * Document ID
       */
      documentId: string
      
      /**
       * Workflow ID
       */
      workflowId: string
      
      /**
       * Verification options
       */
      options?: VerificationOptions
    }
  }
  
  /**
   * Generate document verification response
   */
  export interface GenerateDocumentVerificationResponse {
    /**
     * Verification process ID
     */
    verificationId: string
    
    /**
     * Workflow ID
     */
    workflowId: string
    
    /**
     * Verification items
     */
    items: VerificationItem[]
    
    /**
     * Verification status
     */
    status: VerificationStatusType
  }
}

/**
 * Research API types
 */
export namespace ResearchApi {
  /**
   * Perform research request
   */
  export interface PerformResearchRequest {
    /**
     * Research query
     */
    query?: string
    
    /**
     * Document ID to research
     */
    documentId?: string
    
    /**
     * Research options
     */
    options?: {
      /**
       * Depth of research to perform
       */
      depth?: 'basic' | 'comprehensive' | 'expert'
      
      /**
       * Maximum number of sources to include
       */
      sourcesLimit?: number
      
      /**
       * Whether to include source content in the response
       */
      includeSourceContent?: boolean
      
      /**
       * Whether this is a medical diagnosis research
       */
      isMedicalDiagnosis?: boolean
      
      /**
       * Optional patient data for context in medical diagnosis
       */
      patientData?: string
    }
  }
  
  /**
   * Research source
   */
  export interface ResearchSource {
    /**
     * Source title
     */
    title: string
    
    /**
     * Source URL
     */
    url: string
    
    /**
     * Source content excerpt
     */
    content?: string
    
    /**
     * Publication date
     */
    date?: string
    
    /**
     * Relevance score (0-1)
     */
    relevanceScore?: number
  }
  
  /**
   * Perform research response
   */
  export interface PerformResearchResponse {
    /**
     * Research content
     */
    research: string
    
    /**
     * Original query
     */
    query: string
    
    /**
     * Research sources
     */
    sources?: ResearchSource[]
    
    /**
     * Research metadata
     */
    metadata?: {
      /**
       * Processing time in milliseconds
       */
      processingTimeMs?: number
      
      /**
       * Depth of research performed
       */
      depth?: 'basic' | 'comprehensive' | 'expert'
      
      /**
       * Number of sources included
       */
      sourceCount?: number
      
      /**
       * Whether this was a medical diagnosis
       */
      isMedicalDiagnosis?: boolean
    }
  }
  
  /**
   * Ingest document request
   */
  export interface IngestDocumentRequest {
    /**
     * Document text to ingest
     */
    text: string
    
    /**
     * Optional metadata for the document
     */
    metadata?: Record<string, any>
    
    /**
     * Optional patient ID to associate with the document
     */
    patientId?: string
    
    /**
     * Optional document ID to associate with the embedding
     */
    documentId?: string
    
    /**
     * Size of text chunks for embedding
     */
    chunkSize?: number
    
    /**
     * Overlap between chunks
     */
    chunkOverlap?: number
  }
  
  /**
   * Ingest document response
   */
  export interface IngestDocumentResponse {
    /**
     * Embedding records created
     */
    embeddings: Array<{
      /**
       * Embedding ID
       */
      id: string
      
      /**
       * Index of the chunk
       */
      chunkIndex?: number
      
      /**
       * Embedding metadata
       */
      metadata?: Record<string, any>
    }>
    
    /**
     * Number of embeddings created
     */
    count: number
    
    /**
     * Processing time in milliseconds
     */
    processingTimeMs?: number
  }
}

/**
 * Email API types
 */
export namespace EmailApi {
  /**
   * Send email request
   */
  export interface SendEmailRequest {
    /**
     * Recipients email addresses
     */
    to: string[]
    
    /**
     * Email subject
     */
    subject: string
    
    /**
     * Recipient first name for personalization
     */
    firstName: string
  }
  
  /**
   * Send email response
   */
  export interface SendEmailResponse {
    /**
     * Resend email ID
     */
    id?: string
    
    /**
     * Whether the email was sent successfully
     */
    sent: boolean
    
    /**
     * Timestamp when the email was sent
     */
    timestamp: string
  }
}

/**
 * Security API types
 */
export namespace SecurityApi {
  /**
   * CSP report request
   */
  export interface CspReportRequest {
    /**
     * CSP report data
     */
    'csp-report': {
      /**
       * URI that was blocked by the CSP
       */
      'blocked-uri'?: string
      
      /**
       * CSP directive that was violated
       */
      'violated-directive'?: string
      
      /**
       * URI of the document where the violation occurred
       */
      'document-uri'?: string
      
      /**
       * Source file where the violation occurred
       */
      'source-file'?: string
      
      /**
       * Line number in the source file where the violation occurred
       */
      'line-number'?: number | string
      
      /**
       * Column number in the source file where the violation occurred
       */
      'column-number'?: number | string
      
      /**
       * Effective directive that was violated
       */
      'effective-directive'?: string
      
      /**
       * Original policy that was violated
       */
      'original-policy'?: string
      
      /**
       * Disposition of the violation (enforce or report)
       */
      'disposition'?: string
      
      /**
       * Referrer of the document where the violation occurred
       */
      'referrer'?: string
      
      /**
       * HTTP status code of the response
       */
      'status-code'?: number | string
    }
  }
  
  /**
   * CSP report response
   */
  export interface CspReportResponse {
    /**
     * Whether the report was successfully processed
     */
    reported: boolean
    
    /**
     * Timestamp when the report was processed
     */
    timestamp: string
  }
}

/**
 * Auth API types
 */
export namespace AuthApi {
  /**
   * Auth callback request
   */
  export interface AuthCallbackRequest {
    /**
     * Query parameters
     */
    query: {
      /**
       * Authentication code to exchange for a session
       */
      code: string
    }
  }
}