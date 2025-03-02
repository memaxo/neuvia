import { createBrowserClient } from '@/lib/supabase/clients'
import {
  type DocumentType,
  type FileUpload,
  type UploadMetadata,
  type UploadOptions,
  type UploadType,
} from '@/lib/types/upload'
import type { StorageError } from '@supabase/storage-js'
import logger from '@/lib/logger'
import { ValidationError, ExternalServiceError, SystemError, normalizeError } from '@/lib/errors'

/**
 * Centralized service for handling all file uploads in the application
 */
export class UploadService {
  private supabase = createBrowserClient()
  private DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB

  /**
   * Main method to upload a file with type-specific handling
   */
  async uploadFile(file: File, options: UploadOptions): Promise<FileUpload> {
    if (!file) {
      throw new ValidationError({
        message: 'No file provided',
        code: 'INVALID_FILE'
      });
    }

    try {
      const moduleLogger = logger.withMetadata({
        module: 'UploadService',
        method: 'uploadFile',
        uploadType: options.type,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
      moduleLogger.info('Starting file upload');
      
      // Start progress tracking
      options.onProgress?.(0, 'Preparing upload...')

      // Validate file based on type and options
      this.validateFile(file, options)
      options.onProgress?.(5, 'File validated')
      
      moduleLogger.debug('File validated successfully');

      // Configure metadata based on upload type
      const metadata = this.configureMetadata(file, options)

      // Determine the appropriate storage bucket
      const bucketName = this.getBucketForType(options.type, options.bucketName)

      // Create a unique file path
      const filePath = this.generateFilePath(file, options)

      // Update progress
      options.onProgress?.(10, 'Uploading file...')

      // Upload to Supabase Storage
      const { error: uploadError } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        moduleLogger.error('Storage upload failed', { bucketName, filePath }, uploadError);
        throw this.handleStorageError(uploadError);
      }

      moduleLogger.info('File uploaded to storage successfully', { bucketName, filePath });
      options.onProgress?.(80, 'Processing upload...')

      // Get public URL for the file
      const {
        data: { publicUrl },
      } = this.supabase.storage.from(bucketName).getPublicUrl(filePath)

      // If needed, trigger processing based on file type
      if (!options.skipProcessing) {
        moduleLogger.debug('Starting file processing');
        await this.processUploadedFile(file, filePath, bucketName, options);
        moduleLogger.debug('File processing completed');
      }

      options.onProgress?.(100, 'Upload complete');
      moduleLogger.info('File upload and processing completed successfully', { publicUrl });

      // Return the complete file upload info
      return {
        id: filePath.split('/').pop() || '',
        path: filePath,
        url: publicUrl,
        size: file.size,
        contentType: file.type,
        metadata,
        createdAt: new Date(),
      }
    } catch (error) {
      // Create appropriate error type based on existing error
      const moduleLogger = logger.withMetadata({
        module: 'UploadService',
        method: 'uploadFile',
        uploadType: options.type,
        fileName: file.name
      });
      
      // If it's already one of our error types, just use it directly
      if (error instanceof ValidationError || 
          error instanceof ExternalServiceError || 
          error instanceof SystemError) {
        moduleLogger.error('Upload failed', {}, error);
        throw error;
      }
      
      // Otherwise normalize it
      const normalizedError = new ExternalServiceError({
        message: error instanceof Error ? error.message : 'Failed to upload file',
        code: 'UPLOAD_FAILED',
        service: 'Storage',
        data: { 
          fileName: file.name, 
          fileType: file.type,
          fileSize: file.size,
          uploadType: options.type
        },
        cause: error
      });
      
      moduleLogger.error('Upload failed with unexpected error', {}, normalizedError);
      throw normalizedError;
    }
  }

  /**
   * Upload an avatar image
   */
  async uploadAvatar(
    file: File,
    userId: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<string> {
    const result = await this.uploadFile(file, {
      type: 'avatar',
      metadata: { userId },
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 5 * 1024 * 1024, // 5MB
      onProgress,
      skipProcessing: true,
    })

    return result.path
  }

  /**
   * Upload a patient document
   */
  async uploadPatientDocument(
    file: File,
    patientId: string,
    documentType: DocumentType,
    departmentId?: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<FileUpload> {
    return this.uploadFile(file, {
      type: 'patient-document',
      metadata: {
        documentType,
        patientId,
        departmentId,
      },
      patientId,
      departmentId,
      onProgress,
    })
  }

  /**
   * Upload a chat attachment
   */
  async uploadChatAttachment(
    file: File,
    chatId: string,
    messageId?: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<FileUpload> {
    return this.uploadFile(file, {
      type: 'chat-attachment',
      metadata: {
        chatId,
        messageId,
      },
      onProgress,
    })
  }

  /**
   * Validate a file based on upload options
   */
  private validateFile(file: File, options: UploadOptions): void {
    // Check file size
    const maxSize =
      options.maxSize || this.getDefaultMaxSizeForType(options.type)
    if (file.size > maxSize) {
      throw new ValidationError({
        message: `File size exceeds maximum allowed size of ${this.formatFileSize(maxSize)}`,
        code: 'FILE_TOO_LARGE',
        data: {
          fileSize: file.size,
          maxSize: maxSize,
          fileName: file.name
        }
      });
    }

    // Check file type if specified
    if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
      if (!options.allowedMimeTypes.includes(file.type)) {
        throw new ValidationError({
          message: `File type ${file.type} is not supported. Allowed types: ${options.allowedMimeTypes.join(', ')}`,
          code: 'INVALID_FILE_TYPE',
          data: {
            fileType: file.type,
            allowedTypes: options.allowedMimeTypes,
            fileName: file.name
          }
        });
      }
    } else {
      // Use default allowed types based on upload type
      const allowedTypes = this.getAllowedMimeTypesForType(options.type)
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        throw new ValidationError({
          message: `File type ${file.type} is not supported for ${options.type} uploads`,
          code: 'INVALID_FILE_TYPE',
          data: {
            fileType: file.type,
            uploadType: options.type,
            allowedTypes: allowedTypes,
            fileName: file.name
          }
        });
      }
    }

    // Type-specific validation
    switch (options.type) {
      case 'avatar':
        // Additional avatar-specific validation could go here
        break
      case 'patient-document':
        if (!options.patientId) {
          throw new ValidationError({
            message: 'Patient ID is required for patient document uploads',
            code: 'MISSING_PATIENT_ID',
            data: {
              uploadType: options.type,
              fileName: file.name
            }
          });
        }
        break
      case 'chat-attachment':
        // Validate chat attachments
        break
    }
  }

  /**
   * Get default max file size based on upload type
   */
  private getDefaultMaxSizeForType(type: UploadType): number {
    switch (type) {
      case 'avatar':
        return 5 * 1024 * 1024 // 5MB
      case 'document':
      case 'patient-document':
        return 20 * 1024 * 1024 // 20MB
      case 'chat-attachment':
        return 10 * 1024 * 1024 // 10MB
      default:
        return this.DEFAULT_MAX_SIZE
    }
  }

  /**
   * Get allowed MIME types based on upload type
   */
  private getAllowedMimeTypesForType(type: UploadType): string[] {
    switch (type) {
      case 'avatar':
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      case 'document':
      case 'patient-document':
        return [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/jpeg',
          'image/png',
        ]
      case 'chat-attachment':
        return [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'text/plain',
          'application/json',
        ]
      default:
        return []
    }
  }

  /**
   * Configure metadata based on upload type and options
   */
  private configureMetadata(
    file: File,
    options: UploadOptions
  ): UploadMetadata {
    const baseMetadata: UploadMetadata = {
      originalFilename: file.name,
      contentType: file.type,
      ...options.metadata,
    }

    // Add type-specific metadata
    switch (options.type) {
      case 'avatar':
        return {
          ...baseMetadata,
          userId: options.userId || options.metadata?.userId,
        }
      case 'patient-document':
        return {
          ...baseMetadata,
          patientId: options.patientId || options.metadata?.patientId,
          departmentId: options.departmentId || options.metadata?.departmentId,
          documentType: options.metadata?.documentType || {
            category: 'clinical',
            type: 'document',
          },
        }
      case 'chat-attachment':
        return {
          ...baseMetadata,
          chatId: options.metadata?.chatId,
          messageId: options.metadata?.messageId,
        }
      default:
        return baseMetadata
    }
  }

  /**
   * Get the appropriate storage bucket for the upload type
   */
  private getBucketForType(type: UploadType, customBucket?: string): string {
    if (customBucket) return customBucket

    switch (type) {
      case 'avatar':
        return 'avatars'
      case 'patient-document':
        return 'patient-documents'
      case 'chat-attachment':
        return 'chat-attachments'
      default:
        return 'uploads'
    }
  }

  /**
   * Generate a unique file path for the upload
   */
  private generateFilePath(file: File, options: UploadOptions): string {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 10)
    const fileExt = file.name.split('.').pop() || ''
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9.]/g, '_')
      .substring(0, 50)

    switch (options.type) {
      case 'avatar':
        const userId = options.userId || options.metadata?.userId || 'user'
        return `${userId}-${timestamp}.${fileExt}`

      case 'patient-document':
        const patientId =
          options.patientId || options.metadata?.patientId || 'patient'
        return `${patientId}/${timestamp}-${randomId}.${fileExt}`

      case 'chat-attachment':
        const chatId = options.metadata?.chatId || 'chat'
        return `${chatId}/${timestamp}-${sanitizedFileName}`

      default:
        return `${options.type}/${timestamp}-${randomId}-${sanitizedFileName}`
    }
  }

  /**
   * Process an uploaded file based on its type (if needed)
   */
  private async processUploadedFile(
    file: File,
    filePath: string,
    bucketName: string,
    options: UploadOptions
  ): Promise<void> {
    // This would integrate with our document processing service for patient documents
    if (
      options.type === 'patient-document' &&
      file.type === 'application/pdf'
    ) {
      // Here we would call the document processing service
      // This is a placeholder - we'd need to import and use the actual service
      // const processingService = new DocumentProcessingService();
      // await processingService.processDocument(file, options.patientId || '');
    }

    // For chat attachments, might need to generate thumbnails, extract text, etc.
    if (options.type === 'chat-attachment' && file.type.startsWith('image/')) {
      // Generate thumbnail, extract text, etc.
    }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * Create a standardized error using the new error system
   * This is a transitional method for compatibility with existing code
   */
  private createError(
    code: string,
    message: string,
    retryable: boolean,
    details?: any
  ): ValidationError | ExternalServiceError {
    if (code.startsWith('STORAGE_') || code === 'UPLOAD_FAILED') {
      return new ExternalServiceError({
        message,
        code,
        service: 'Storage',
        data: { 
          retryable,
          details
        },
        cause: details instanceof Error ? details : undefined
      });
    } else {
      return new ValidationError({
        message,
        code,
        data: { 
          retryable,
          details
        }
      });
    }
  }

  /**
   * Handle Supabase storage errors
   */
  private handleStorageError(error: StorageError): ExternalServiceError {
    let code = 'STORAGE_ERROR';
    let message = error.message || 'Storage error occurred';
    let isOperational = false;
    let statusCode = 500;

    if (error.statusCode) {
      statusCode = error.statusCode;
      
      if (error.statusCode >= 500) {
        code = 'STORAGE_SERVER_ERROR';
        isOperational = true; // Server errors are generally retryable
      } else if (error.statusCode === 413) {
        code = 'FILE_TOO_LARGE';
        statusCode = 413;
      } else if (error.statusCode === 401 || error.statusCode === 403) {
        code = 'STORAGE_UNAUTHORIZED';
        statusCode = error.statusCode;
      }
    }

    return new ExternalServiceError({
      message,
      code,
      service: 'Storage',
      statusCode,
      data: { 
        retryable: isOperational,
        originalError: error
      },
      cause: error
    });
  }
}

// Export a singleton instance
export const uploadService = new UploadService()
