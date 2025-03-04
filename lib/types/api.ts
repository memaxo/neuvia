/**
 * @fileoverview Canonical API types for the application
 * 
 * This file defines standardized request and response types for API endpoints.
 * It provides a consistent way to handle API communication across the application.
 */

import type { UUID, Timestamp } from './base';
import type { DocumentType, DocumentSearchQuery, DocumentSearchResult } from './document';
import type { VerificationItem, VerificationStatusType, VerificationMetadata } from './workflow';

// ==========================================================================
// Core API Types
// ==========================================================================

/**
 * Standard API request with typed body
 */
export interface ApiRequest<TBody = unknown> {
  /**
   * Request body with specific type
   */
  body: TBody;
  
  /**
   * Request headers
   */
  headers: Record<string, string>;
  
  /**
   * Request parameters
   */
  params?: Record<string, string>;
  
  /**
   * Query parameters
   */
  query?: Record<string, string>;
}

/**
 * Standard API response with typed data
 */
export interface ApiResponse<TData = unknown> {
  /**
   * Whether the API call was successful
   */
  success: boolean;
  
  /**
   * Response data with specific type
   */
  data: TData;
  
  /**
   * Response message
   */
  message?: string;
  
  /**
   * HTTP status code
   */
  status: number;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  /**
   * Success is always false for errors
   */
  success: false;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error code for client handling
   */
  code: string;
  
  /**
   * HTTP status code
   */
  status: number;
  
  /**
   * Additional error details
   */
  details?: unknown;
  
  /**
   * Stack trace (only in development)
   */
  stack?: string;
}

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  /**
   * Page number (1-based)
   */
  page: number;
  
  /**
   * Number of items per page
   */
  pageSize: number;
  
  /**
   * Sort column
   */
  sortBy?: string;
  
  /**
   * Sort direction
   */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  /**
   * Items for the current page
   */
  items: T[];
  
  /**
   * Pagination metadata
   */
  pagination: {
    /**
     * Current page number
     */
    page: number;
    
    /**
     * Number of items per page
     */
    pageSize: number;
    
    /**
     * Total number of items
     */
    totalItems: number;
    
    /**
     * Total number of pages
     */
    totalPages: number;
    
    /**
     * Whether there is a next page
     */
    hasNextPage: boolean;
    
    /**
     * Whether there is a previous page
     */
    hasPreviousPage: boolean;
  };
}

// ==========================================================================
// Document API Types (formerly DocumentApi namespace)
// ==========================================================================

/**
 * Document upload request
 */
export interface DocumentUploadRequest {
  /**
   * File data (base64 encoded or multipart)
   */
  file: File | string;
  
  /**
   * Document type
   */
  documentType?: DocumentType;
  
  /**
   * Patient ID
   */
  patientId?: UUID;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Document upload response
 */
export interface DocumentUploadResponse {
  /**
   * Uploaded document ID
   */
  documentId: UUID;
  
  /**
   * Original filename
   */
  fileName: string;
  
  /**
   * Upload timestamp
   */
  uploadedAt: Timestamp;
  
  /**
   * File size in bytes
   */
  fileSize: number;
}

/**
 * Document extraction response
 */
export interface DocumentExtractionResponse {
  /**
   * Document ID
   */
  documentId: UUID;
  
  /**
   * Extraction status
   */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Extracted text if available
   */
  text?: string;
  
  /**
   * Extracted metadata if available
   */
  metadata?: Record<string, unknown>;
  
  /**
   * Error message if extraction failed
   */
  error?: string;
}

/**
 * Document search request
 */
export interface DocumentSearchRequest extends DocumentSearchQuery {
  /**
   * Optional pagination parameters
   */
  pagination?: PaginationParams;
}

/**
 * Document search response
 */
export interface DocumentSearchResponse {
  /**
   * Search results
   */
  results: DocumentSearchResult[];
  
  /**
   * Search metadata
   */
  metadata: {
    /**
     * Total results found
     */
    totalResults: number;
    
    /**
     * Query time in milliseconds
     */
    queryTimeMs: number;
    
    /**
     * Search query used
     */
    query: string;
  };
}

// ==========================================================================
// Verification API Types (formerly VerificationApi namespace)
// ==========================================================================

/**
 * Verification request
 */
export interface VerificationRequest {
  /**
   * Document ID to verify
   */
  documentId: UUID;
  
  /**
   * Patient ID if available
   */
  patientId?: UUID;
  
  /**
   * Specific items to verify (if not provided, all will be verified)
   */
  items?: VerificationItem[];
  
  /**
   * Verification options
   */
  options?: {
    /**
     * Is verification required
     */
    isRequired?: boolean;
    
    /**
     * Auto-approve after timeout
     */
    autoApproveOnTimeout?: boolean;
    
    /**
     * Timeout in milliseconds
     */
    timeoutMs?: number;
    
    /**
     * Minimum confidence threshold
     */
    confidenceThreshold?: number;
  };
}

/**
 * Verification status response
 */
export interface VerificationStatusResponse {
  /**
   * Document ID being verified
   */
  documentId: UUID;
  
  /**
   * Overall verification status
   */
  status: VerificationStatusType;
  
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Items to verify
   */
  items: VerificationItem[];
  
  /**
   * Complete verification metadata
   */
  metadata: VerificationMetadata;
  
  /**
   * Timestamp when verification started
   */
  startedAt: Timestamp;
  
  /**
   * Timestamp when verification was last updated
   */
  updatedAt: Timestamp;
  
  /**
   * Timestamp when verification was completed
   */
  completedAt?: Timestamp;
}

/**
 * Verification update request
 */
export interface VerificationUpdateRequest {
  /**
   * Document ID being verified
   */
  documentId: UUID;
  
  /**
   * Items with updates
   */
  items: Array<{
    /**
     * Item ID
     */
    id: UUID;
    
    /**
     * Corrected content
     */
    correctedContent?: string;
    
    /**
     * Whether this item is verified
     */
    isVerified: boolean;
    
    /**
     * Optional notes
     */
    notes?: string;
  }>;
  
  /**
   * Optional complete status
   */
  completeVerification?: boolean;
  
  /**
   * Optional rejection reason
   */
  rejectionReason?: string;
}

/**
 * Verification complete response
 */
export interface VerificationCompleteResponse {
  /**
   * Document ID that was verified
   */
  documentId: UUID;
  
  /**
   * Verification was successful
   */
  success: boolean;
  
  /**
   * Summary of verification
   */
  summary: {
    /**
     * Total items
     */
    totalItems: number;
    
    /**
     * Items modified
     */
    modifiedItems: number;
    
    /**
     * Items approved without changes
     */
    approvedWithoutChanges: number;
  };
  
  /**
   * Next workflow step
   */
  nextStep: string;
}

// ==========================================================================
// Patient API Types (formerly PatientApi namespace)
// ==========================================================================

/**
 * Patient demographics
 */
export interface PatientDemographics {
  /**
   * Patient ID
   */
  id: UUID;
  
  /**
   * First name
   */
  firstName: string;
  
  /**
   * Last name
   */
  lastName: string;
  
  /**
   * Date of birth
   */
  dateOfBirth: string;
  
  /**
   * Gender
   */
  gender?: string;
  
  /**
   * Phone number
   */
  phoneNumber?: string;
  
  /**
   * Email address
   */
  email?: string;
  
  /**
   * Address
   */
  address?: {
    /**
     * Street address
     */
    street?: string;
    
    /**
     * City
     */
    city?: string;
    
    /**
     * State/province
     */
    state?: string;
    
    /**
     * Postal code
     */
    postalCode?: string;
    
    /**
     * Country
     */
    country?: string;
  };
  
  /**
   * Medical record number
   */
  mrn?: string;
}

/**
 * Patient summary
 */
export interface PatientSummary {
  /**
   * Patient demographics
   */
  demographics: PatientDemographics;
  
  /**
   * Medical conditions
   */
  medicalConditions?: string[];
  
  /**
   * Medications
   */
  medications?: Array<{
    /**
     * Medication name
     */
    name: string;
    
    /**
     * Dosage
     */
    dosage?: string;
    
    /**
     * Frequency
     */
    frequency?: string;
    
    /**
     * Start date
     */
    startDate?: string;
    
    /**
     * End date
     */
    endDate?: string;
  }>;
  
  /**
   * Allergies
   */
  allergies?: string[];
  
  /**
   * Most recent document IDs
   */
  recentDocuments?: UUID[];
  
  /**
   * Summary text
   */
  summaryText?: string;
}

/**
 * Patient create request
 */
export interface PatientCreateRequest {
  /**
   * Patient demographics
   */
  demographics: Omit<PatientDemographics, 'id'>;
  
  /**
   * Organization ID
   */
  organizationId?: UUID;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Patient document list response
 *
 * Changed from interface extends PaginatedResponse to a type alias
 * to avoid an empty-interface lint issue.
 */
export type PatientDocumentsResponse = PaginatedResponse<{
  /**
   * Document ID
   */
  id: UUID;
  
  /**
   * Document title/filename
   */
  title: string;
  
  /**
   * Document type
   */
  documentType: DocumentType;
  
  /**
   * Upload date
   */
  uploadedAt: Timestamp;
  
  /**
   * File size in bytes
   */
  fileSize: number;
  
  /**
   * Processing status
   */
  status: string;
}>;

// ==========================================================================
// Report API Types (formerly ReportApi namespace)
// ==========================================================================

/**
 * Report generation request
 */
export interface GenerateReportRequest {
  /**
   * Patient ID
   */
  patientId: UUID;
  
  /**
   * Document IDs to include
   */
  documentIds?: UUID[];
  
  /**
   * Report type
   */
  reportType: 'summary' | 'comprehensive' | 'timeline' | 'custom';
  
  /**
   * Sections to include in custom report
   */
  includeSections?: string[];
  
  /**
   * Custom prompt for report generation
   */
  customPrompt?: string;
  
  /**
   * Additional parameters
   */
  parameters?: Record<string, unknown>;
}

/**
 * Report status response
 */
export interface ReportStatusResponse {
  /**
   * Report ID
   */
  reportId: UUID;
  
  /**
   * Generation status
   */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  /**
   * Progress percentage (0-100)
   */
  progress: number;
  
  /**
   * Current processing step
   */
  currentStep?: string;
  
  /**
   * Estimated completion time
   */
  estimatedCompletionAt?: Timestamp;
  
  /**
   * Error message if generation failed
   */
  error?: string;
}

/**
 * Report data
 */
export interface ReportData {
  /**
   * Report ID
   */
  id: UUID;
  
  /**
   * Patient ID
   */
  patientId: UUID;
  
  /**
   * Report title
   */
  title: string;
  
  /**
   * Report type
   */
  reportType: string;
  
  /**
   * When report was created
   */
  createdAt: Timestamp;
  
  /**
   * User who generated the report
   */
  createdBy?: UUID;
  
  /**
   * Report content organized by sections
   */
  sections: Record<string, {
    /**
     * Section title
     */
    title: string;
    
    /**
     * Section content
     */
    content: string;
    
    /**
     * Section order
     */
    order: number;
  }>;
  
  /**
   * Document IDs used in this report
   */
  sourceDocuments: UUID[];
  
  /**
   * Additional report metadata
   */
  metadata?: Record<string, unknown>;
}