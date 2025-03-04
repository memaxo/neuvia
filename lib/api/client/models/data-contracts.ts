/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface ApiSuccessResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  /** Response data payload */
  data: object;
  /**
   * ISO timestamp of when the response was generated
   * @format date-time
   */
  timestamp: string;
}

export interface ApiErrorResponse {
  error: {
    /** Human-readable error message */
    message: string;
    /** Error code for programmatic handling */
    code?: string;
    /**
     * ISO timestamp of when the error occurred
     * @format date-time
     */
    timestamp: string;
    /** Additional error details, varies by error type */
    details?: object;
  };
}

export interface PaginationParams {
  /**
   * Page number (1-based)
   * @min 1
   * @default 1
   */
  page?: number;
  /**
   * Number of items per page
   * @min 1
   * @max 100
   * @default 20
   */
  limit?: number;
}

export interface PaginationMeta {
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total items available */
  total: number;
  /** Total number of pages */
  totalPages: number;
}

/**
 * UUID identifier
 * 
 * @format uuid
 * @description Standard UUID format used throughout the API
 */
export type UUID = string;

/**
 * ISO 8601 formatted timestamp
 * 
 * @format date-time
 * @description Standard ISO-8601 timestamp used throughout the API
 */
export type Timestamp = string;

export interface SuccessResponse {
  /** Indicates if the operation was successful */
  success: boolean;
  /** Optional success message */
  message?: string;
}

/** Category of medical document */
export enum DocumentCategory {
  Clinical = 'clinical',
  Lab = 'lab',
  Imaging = 'imaging',
  Prescription = 'prescription',
  Administrative = 'administrative',
}

export interface DocumentType {
  /** Document category */
  category: DocumentCategory;
  /** Specific document type within the category */
  type: string;
}

export interface DocumentMetadata {
  /**
   * User ID who uploaded the document
   * @format uuid
   */
  uploaded_by?: string;
  /**
   * Patient ID if this is a patient document
   * @format uuid
   */
  patient_id?: string;
  /** Document type information */
  document_type?: DocumentType;
  /** Original filename */
  title?: string;
  /** File format (MIME type) */
  file_type?: string;
  /**
   * File size in bytes
   * @min 0
   */
  file_size?: number;
  /** Document hash for deduplication */
  checksum?: string;
  /**
   * Extraction timestamp
   * @format date-time
   */
  created_at?: string;
  /** Processing status */
  processing_status?: 'pending' | 'processing' | 'completed' | 'error';
  /**
   * Page number (for multi-page documents)
   * @min 1
   */
  page_number?: number;
  /**
   * Chunk index (for chunked documents)
   * @min 0
   */
  chunk_index?: number;
  /** Additional custom metadata */
  custom?: Record<string, any>;
  /** Content hash for deduplication within langchain */
  content_hash?: string;
}

export interface DocumentChunk {
  /**
   * Chunk ID
   * @format uuid
   */
  id: string;
  /**
   * Document ID this chunk belongs to
   * @format uuid
   */
  document_id?: string;
  /** Chunk text content */
  content: string;
  /**
   * Chunk index in the document
   * @min 0
   */
  chunk_index: number;
  /**
   * Page number
   * @min 1
   */
  page_number?: number;
  /**
   * Token count
   * @min 0
   */
  token_count: number;
  /** Metadata for the chunk */
  metadata?: Record<string, any>;
  /** Heading or section title */
  heading?: string;
  /** Importance score */
  importance_score?: number;
}

/** Current step in the workflow process */
export enum WorkflowStep {
  Idle = 'idle',
  Uploading = 'uploading',
  Extracting = 'extracting',
  Verification = 'verification',
  ReportGeneration = 'report_generation',
  Complete = 'complete',
  ChatStarted = 'chat_started',
  ChatInProgress = 'chat_in_progress',
  ChatCompleted = 'chat_completed',
  ChatError = 'chat_error',
  Research = 'research',
  ReportPresentation = 'report_presentation',
  VerificationPending = 'verification_pending',
  VerificationInProgress = 'verification_in_progress',
  VerificationCompleted = 'verification_completed',
  VerificationFailed = 'verification_failed',
  Error = 'error',
}

/** Current phase of processing */
export enum ProcessingPhase {
  Initialization = 'initialization',
  Uploading = 'uploading',
  Extraction = 'extraction',
  Analysis = 'analysis',
  Verification = 'verification',
  Correction = 'correction',
  Research = 'research',
  ReportGeneration = 'report_generation',
  Completion = 'completion',
  ExtractionCompleted = 'extraction_completed',
  Error = 'error',
}

export interface ExtractedDocument {
  /**
   * Document ID
   * @format uuid
   */
  id: string;
  /**
   * Creation timestamp
   * @format date-time
   */
  created_at: string;
  /** Document type */
  document_type: DocumentType;
  /**
   * Patient ID
   * @format uuid
   */
  patient_id?: string;
  extractedData: {
    /** Raw document text */
    content_text: string;
    /** Document metadata */
    metadata: Record<string, any>;
    /** Document chunks */
    chunks?: {
      /** Chunk content */
      content: string;
      /** Page number */
      page_number?: number;
    }[];
  };
  /** Whether extraction was successful */
  is_processed: boolean;
  /** Error message if extraction failed */
  processing_error?: string;
  /** Processing status */
  processing_status: string;
}

export interface DocumentEmbedding {
  /** Document ID (numerical in the actual DB) */
  id: number;
  /** Document content */
  content: string;
  /** Embedding vector (stored as string in Postgres) */
  embedding: string;
  /** Document metadata */
  metadata?: DocumentMetadata;
  /**
   * Creation timestamp
   * @format date-time
   */
  created_at: string;
  /** Reference to document */
  document_id?: number;
}

export interface DocumentSearchQuery {
  /** Search query */
  query: string;
  /** Filter metadata (optional) */
  filter?: Record<string, any>;
  /**
   * Number of results to return (match_count in RPC)
   * @min 1
   * @default 5
   */
  match_count?: number;
  /**
   * Minimum similarity threshold (0-1) (match_threshold in RPC)
   * @min 0
   * @max 1
   * @default 0.5
   */
  match_threshold?: number;
  /**
   * Patient ID filter
   * @format uuid
   */
  patient_id?: string;
}

export interface DocumentSearchResult {
  /**
   * Document ID
   * @format uuid
   */
  id?: string;
  /**
   * Document ID this chunk belongs to
   * @format uuid
   */
  document_id?: string;
  /** Document content */
  content: string;
  /** Metadata */
  metadata?: Record<string, any>;
  /**
   * Similarity score (0-1)
   * @min 0
   * @max 1
   */
  similarity: number;
}

export interface DocumentSearchResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  data: {
    /** Search results */
    results: DocumentSearchResult[];
    /** Original search query */
    query: string;
    metadata?: {
      /** Total number of matches found */
      total_matches?: number;
      /** Processing time in milliseconds */
      processing_time_ms?: number;
    };
  };
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

export interface DocumentUploadRequest {
  /**
   * Document file to upload
   * @format binary
   */
  file: File;
  /**
   * Patient ID
   * @format uuid
   */
  patient_id?: string;
  /** Document type information */
  document_type?: DocumentType;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface DocumentUploadResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  data: {
    /**
     * ID of the uploaded document
     * @format uuid
     */
    document_id: string;
    /**
     * URL to access the document
     * @format uri
     */
    url: string;
    /** Processing status */
    processing_status?: 'pending' | 'processing' | 'completed' | 'error';
    /** Document metadata */
    metadata?: DocumentMetadata;
  };
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

/** Current status of the verification process */
export enum VerificationStatusType {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Failed = 'failed',
}

export interface VerificationStatus {
  /** Whether the item is verified */
  isVerified: boolean;
  /**
   * When the verification occurred (ISO string format)
   * @format date-time
   */
  verifiedAt: string;
  /** Optional corrections to the original data */
  corrections?: Record<string, string>;
  /** User who performed the verification (if applicable) */
  verifiedBy?: string;
}

export interface VerificationChangeHistoryEntry {
  /** Version ID */
  id: string;
  /** Content at this version */
  content: string;
  /**
   * Timestamp of the change
   * @format date-time
   */
  timestamp: string;
  /** User who made the change (if applicable) */
  userId?: string;
}

export interface VerificationItem {
  /** Unique identifier for this verification item */
  id: string;
  /** Title/label for this verification item */
  title: string;
  /** Description of what needs to be verified */
  description?: string;
  /** The original content extracted from the document */
  originalContent: string;
  /** The current content after any corrections */
  currentContent: string;
  /** Whether this item has been verified by a user */
  isVerified: boolean;
  /** Whether this item has been modified during verification */
  isModified: boolean;
  /** History of content changes */
  changeHistory: VerificationChangeHistoryEntry[];
  /** Metadata for this verification item */
  metadata?: Record<string, any>;
}

export interface VerificationOptions {
  /** Whether verification is required */
  isRequired: boolean;
  /**
   * Timeout for verification (in milliseconds)
   * @min 0
   */
  timeoutMs?: number;
  /** Whether to auto-approve after timeout */
  autoApproveOnTimeout?: boolean;
  /** User ID performing verification */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Optional verification items to include */
  items?: VerificationItem[];
}

export interface CorrectionEntry {
  /** Correction ID */
  id: string;
  /** Correction text */
  text: string;
  /**
   * Timestamp when correction was made
   * @format date-time
   */
  timestamp: string;
}

export interface VerificationMetadata {
  /** Current verification status */
  verificationStatus: VerificationStatusType;
  /** ID of the original summary */
  originalSummaryId: string;
  /** ID of the current version being verified */
  currentVersionId: string;
  /**
   * Number of corrections applied
   * @min 0
   */
  correctionCount: number;
  /**
   * Timestamp when the summary was verified
   * @format date-time
   */
  verifiedAt?: string;
  /** User ID who verified the summary */
  verifiedBy?: string;
  /** History of corrections applied */
  corrections: CorrectionEntry[];
  /** Extracted document data */
  extractedData?: Record<string, any>;
  /**
   * Timestamp when verification started
   * @format date-time
   */
  startedAt?: string;
  /**
   * Timestamp of last update
   * @format date-time
   */
  lastUpdated?: string;
}

export interface MessageMetadata {
  /** Whether this message contains a summary */
  isSummary?: boolean;
  /** Whether this message is requesting verification */
  isVerificationRequest?: boolean;
  /** Whether this message is a correction to a summary */
  isCorrection?: boolean;
  /** Whether this message is a progress update */
  isProgress?: boolean;
  /** ID of the summary version this message refers to */
  summaryVersionId?: string;
  /**
   * Progress value (0-100) for progress messages
   * @min 0
   * @max 100
   */
  progressValue?: number;
  /** Current phase for progress messages */
  progressPhase?: string;
  /** Reference to verification metadata if applicable */
  verificationMetadata?: VerificationMetadata;
  [key: string]: any;
}

export interface VerificationResult {
  /** Whether verification was completed */
  isCompleted: boolean;
  /** Whether the content was approved */
  isApproved: boolean;
  /** List of verification items with their verification status */
  items: VerificationItem[];
  /**
   * Timestamp of verification completion
   * @format date-time
   */
  completedAt?: string;
  /** User who completed verification */
  completedBy?: string;
  /**
   * Time taken for verification (in milliseconds)
   * @min 0
   */
  verificationTime?: number;
  /** Detailed metadata about the verification process */
  verificationMetadata: VerificationMetadata;
}

export interface VerificationMessage {
  /** Message ID */
  id: string;
  /** Message content */
  content: string;
  /** Message role */
  role: 'system' | 'user' | 'assistant';
  /** Whether this message is a verification request */
  isVerificationRequest?: boolean;
  /** Whether this message contains summary content */
  isSummary?: boolean;
  /** Whether this message is a correction */
  isCorrection?: boolean;
  /** Metadata for this message */
  metadata: MessageMetadata;
  /**
   * Creation timestamp
   * @format date-time
   */
  createdAt: string;
}

export interface VerifiedDocument {
  /** Unique identifier */
  id: string;
  /** The original extracted document ID */
  extractedDocumentId: string;
  /**
   * Creation timestamp
   * @format date-time
   */
  createdAt: string;
  /**
   * Patient ID
   * @format uuid
   */
  patientId?: string;
  /** Document type information */
  documentType: DocumentType;
  /** Verification items */
  verificationItems: VerificationItem[];
  /** The verified data (after corrections) */
  verifiedData: Record<string, any>;
  /** Original extraction data */
  originalData: Record<string, any>;
  /** Overall verification status */
  verificationStatus: VerificationStatus;
  /** Optional UI state for verification tracking */
  _uiState?: {
    /** Whether all verification steps are completed in the UI */
    isUIVerificationComplete?: boolean;
    /**
     * Timestamp when the verification was completed in the UI
     * @format date-time
     */
    uiVerifiedAt?: string;
  };
}

export interface StartVerificationRequest {
  /** Content to be verified */
  content: string;
  /** Verification options */
  options?: VerificationOptions;
}

export interface StartVerificationResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  data: {
    /** ID of the verification process */
    verificationId: string;
    /** Items that need verification */
    items: VerificationItem[];
    /** Current verification status */
    status: VerificationStatusType;
    /** Verification metadata */
    metadata?: VerificationMetadata;
  };
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

export interface SubmitCorrectionRequest {
  /** Correction text */
  correction: string;
  /** ID of the verification process */
  verificationId: string;
  /** Optional ID of the specific verification item being corrected */
  itemId?: string;
}

export interface CompleteVerificationRequest {
  /** ID of the verification process */
  verificationId: string;
  /** Whether the content is approved */
  isApproved: boolean;
  /** Optional comments about the verification */
  comments?: string;
}

export interface CompleteVerificationResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  /** Verification result */
  data: VerificationResult;
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

/** Available report formats */
export enum ReportFormatType {
  Markdown = 'markdown',
  Pdf = 'pdf',
  Docx = 'docx',
  Html = 'html',
  Json = 'json',
}

/** Available report styles */
export enum ReportStyleType {
  Clinical = 'clinical',
  Academic = 'academic',
  Simplified = 'simplified',
}

/** Level of detail in generated reports */
export enum DetailLevelType {
  Basic = 'basic',
  Standard = 'standard',
  Comprehensive = 'comprehensive',
}

export interface ReportConfig {
  /** Format of the report */
  format: ReportFormatType;
  /**
   * Style of the report formatting
   * @default "clinical"
   */
  style?: ReportStyleType;
  /**
   * Level of detail in the report
   * @default "standard"
   */
  detailLevel?: DetailLevelType;
  /**
   * Whether to include metadata in the report
   * @default true
   */
  includeMetadata?: boolean;
  /**
   * Whether to include metadata in the footer (for PDF/DOCX)
   * @default false
   */
  metadataInFooter?: boolean;
}

export interface ReportSection {
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /**
   * Display order of the section
   * @min 0
   */
  order?: number;
  /**
   * Heading level (1-5)
   * @min 1
   * @max 5
   */
  level?: number;
  /** Additional section metadata */
  metadata?: Record<string, any>;
}

export interface ReportMetadata {
  /**
   * Timestamp when the report was generated
   * @format date-time
   */
  generatedAt?: string;
  /** User who generated the report */
  generatedBy?: string;
  /**
   * Patient ID
   * @format uuid
   */
  patientId?: string;
  /** IDs of documents used to generate the report */
  documentIds?: string[];
  /** Version of the report */
  reportVersion?: string;
  /** Verification status of the report */
  verificationStatus?: 'unverified' | 'verified' | 'rejected';
  /** User who verified the report */
  verifiedBy?: string;
  /**
   * Timestamp when the report was verified
   * @format date-time
   */
  verifiedAt?: string;
}

export interface Report {
  /**
   * Report ID
   * @format uuid
   */
  id: string;
  /** Report title */
  title: string;
  /** Report description */
  description?: string;
  /** Report content */
  content: string;
  /** Report sections */
  sections?: ReportSection[];
  /** Report configuration */
  config: ReportConfig;
  /** Report metadata */
  metadata?: ReportMetadata;
  /**
   * Patient ID
   * @format uuid
   */
  patientId?: string;
  /**
   * Timestamp when the report was created
   * @format date-time
   */
  createdAt: string;
  /**
   * Timestamp when the report was last updated
   * @format date-time
   */
  updatedAt?: string;
}

export interface GenerateReportRequest {
  /**
   * Patient ID
   * @format uuid
   */
  patientId: string;
  /** Report configuration */
  config?: ReportConfig;
  /** Optional list of document IDs to include (if not provided, all patient documents are used) */
  documentIds?: string[];
  /** Custom report title */
  title?: string;
  /** Custom report description */
  description?: string;
}

export interface GenerateReportResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  data: {
    /**
     * ID of the generated report
     * @format uuid
     */
    reportId: string;
    /** Report generation status */
    status: 'pending' | 'processing' | 'completed' | 'error';
    /** Estimated time to complete in seconds */
    estimatedTimeSeconds?: number;
    /** The generated report (if completed) */
    report?: Report;
  };
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

export interface GetReportResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  /** The requested report */
  data: Report;
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

export interface ListReportsResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  data: {
    /** List of reports */
    reports: Report[];
    /** Pagination metadata */
    pagination: PaginationMeta;
  };
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

export interface UpdateReportRequest {
  /** Updated report title */
  title?: string;
  /** Updated report description */
  description?: string;
  /** Updated report content */
  content?: string;
  /** Updated report sections */
  sections?: ReportSection[];
  /** Updated report configuration */
  config?: ReportConfig;
  /** Updated report metadata */
  metadata?: Record<string, any>;
}

export interface DeleteReportResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  data: {
    /** Whether the report was deleted */
    deleted: boolean;
    /**
     * ID of the deleted report
     * @format uuid
     */
    reportId?: string;
  };
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

/** Chat interaction mode */
export enum ChatMode {
  Default = 'default',
  PatientSummary = 'patient_summary',
  Research = 'research',
  Diagnosis = 'diagnosis',
  Verification = 'verification',
}

/** Depth of research to perform */
export enum ResearchDepth {
  Basic = 'basic',
  Comprehensive = 'comprehensive',
  Expert = 'expert',
}

export interface ResearchOptions {
  /** Depth of research to perform */
  depth?: ResearchDepth;
  /** Whether to include sources in the response */
  sources?: boolean;
  /** Whether to only include the latest research */
  latestOnly?: boolean;
}

export interface ReportFormat {
  /** Format of the report */
  format: 'markdown' | 'pdf' | 'docx' | 'html' | 'json';
  /** Style of the report */
  style?: 'clinical' | 'academic' | 'simplified';
  /** Whether to include metadata in the footer */
  metadataInFooter?: boolean;
}

export interface ReportOptions {
  /** Format of the report */
  format?: 'markdown' | 'pdf' | 'docx' | 'html' | 'json';
  /** Whether to include metadata */
  includeMetadata?: boolean;
  /** Level of detail in the report */
  detailLevel?: 'basic' | 'standard' | 'comprehensive';
}

export interface Message {
  /** Message ID */
  id?: string;
  /** Message content */
  content: string;
  /** Message role */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Message creation timestamp */
  createdAt?: string | object;
  /** Message metadata */
  metadata?: {
    /** Document ID */
    documentId?: string;
    /** Message title */
    title?: string;
    /** Whether this message is a report */
    isReport?: boolean;
    /** Whether this message is research */
    isResearch?: boolean;
    /** Research options */
    researchOptions?: ResearchOptions;
    /** Report format */
    reportFormat?: ReportFormat;
    /** Verification status */
    verificationStatus?: 'pending' | 'verified' | 'rejected';
    /** Source documents */
    sourceDocuments?: string[];
    [key: string]: any;
  };
}

export interface ChatMessage {
  /** Message ID */
  id?: string;
  /** Message content */
  content: string;
  /** Message role */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Message creation timestamp */
  createdAt?: string | object;
  /** Message metadata */
  metadata?: MessageMetadata;
}

export interface ChatSessionState {
  /** Current chat ID */
  chatId?: string | null;
  /** Chat messages */
  messages: ChatMessage[];
  /** Current chat mode */
  mode: ChatMode;
  /** Whether a response is being generated */
  isLoading: boolean;
  /** Current workflow step */
  workflowStep: WorkflowStep;
  /** Current verification state (if in verification mode) */
  verification?: {
    /** Items being verified */
    items?: VerificationItem[];
    /** Verification metadata */
    metadata?: VerificationMetadata;
    /** Original content being verified */
    originalContent?: string;
    /** Current content after any corrections */
    currentContent?: string;
  };
  /** Error message if any */
  error?: string | null;
}

export interface SendMessageRequest {
  /** Message content */
  message: string;
  /** Message options */
  options?: {
    /** Whether this message is a correction */
    isCorrection?: boolean;
    /** Message metadata */
    metadata?: MessageMetadata;
  };
}

export interface SendMessageResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  data: {
    /** ID of the sent message */
    messageId: string;
    /** ID of the chat */
    chatId: string;
    /** The sent message */
    message?: ChatMessage;
    /** The response message */
    response?: ChatMessage;
  };
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

export interface ChatHistoryResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  data: {
    /** Chat ID */
    chatId: string;
    /** Chat messages */
    messages: ChatMessage[];
    /** Chat mode */
    mode?: ChatMode;
    /** Chat metadata */
    metadata?: Record<string, any>;
  };
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}

export interface StartChatRequest {
  /** Chat mode */
  mode?: ChatMode;
  /** Optional initial message */
  initialMessage?: string;
  /** Additional metadata for the chat */
  metadata?: Record<string, any>;
}

export interface StartChatResponse {
  /**
   * Indicates successful operation
   * @example true
   */
  success: boolean;
  data: {
    /** Chat ID */
    chatId: string;
    /** Chat mode */
    mode?: ChatMode;
    /** Initial system message (if any) */
    initialMessage?: ChatMessage;
  };
  /**
   * Server timestamp of the response
   * @format date-time
   */
  timestamp: string;
}
