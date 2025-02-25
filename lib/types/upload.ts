/**
 * Types related to file uploads throughout the application
 */

/**
 * Types of uploads supported by the application
 */
export type UploadType =
  | 'avatar'
  | 'document'
  | 'chat-attachment'
  | 'patient-document'
  | 'report-attachment';

/**
 * Document types for document uploads
 */
export interface DocumentType {
  category: string;
  type: string;
  subtype?: string;
}

/**
 * Metadata for an uploaded file
 */
export interface UploadMetadata {
  documentType?: DocumentType;
  patientId?: string;
  departmentId?: string;
  description?: string;
  userId?: string;
  chatId?: string;
  messageId?: string;
  originalFilename?: string;
  contentType?: string;
  [key: string]: any; // Allow for additional metadata
}

/**
 * Result of a file upload
 */
export interface FileUpload {
  id: string;
  path: string;
  url: string;
  size: number;
  contentType: string;
  metadata: UploadMetadata;
  createdAt: Date;
}

/**
 * Options for file uploads
 */
export interface UploadOptions {
  type: UploadType;
  metadata?: UploadMetadata;
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  patientId?: string;
  departmentId?: string;
  userId?: string;
  bucketName?: string;
  onProgress?: (progress: number, status: string, speed?: number, timeRemaining?: number) => void;
  skipProcessing?: boolean;
}

/**
 * Error from file upload operation
 */
export interface UploadError extends Error {
  code: string;
  retryable: boolean;
  details?: any;
}

/**
 * Status of a document upload process
 */
export interface DocumentUploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  currentStep?: string;
  error?: string;
} 