import { createBrowserClient } from '@/lib/supabase/clients'
import type { 
  FileUpload,
  UploadMetadata,
  UploadOptions,
  UploadType
} from '@/lib/types/upload'
import type { DocumentType } from '@/lib/types/document'
import type { StorageError, StorageApiError } from '@supabase/storage-js'
import logger from '@/lib/logger'
import {
  ValidationError,
  ExternalServiceError,
  normalizeError,
  ApplicationError,
} from '@/lib/errors'

/**
 * Centralized service for handling all file uploads in the application
 *
 * This service provides a unified interface for uploading files of different types
 * to various storage buckets. It handles validation, metadata configuration,
 * error handling, and post-upload processing.
 */
export class UploadService {
  private readonly supabase = createBrowserClient()
  private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
  private readonly RETRY_ATTEMPTS = 3
  private readonly RETRY_DELAY = 1000 // ms

  /**
   * Main method to upload a file with type-specific handling
   *
   * @param file The file to upload
   * @param options Upload configuration options
   * @returns The uploaded file information
   * @throws {ValidationError} For invalid files or options
   * @throws {ExternalServiceError} For storage service failures
   * @throws {SystemError} For unexpected system errors
   */
  async uploadFile(file: File, options: UploadOptions): Promise<FileUpload> {
    const moduleLogger = logger.withMetadata({
      module: 'UploadService',
      method: 'uploadFile',
      uploadType: options.type,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
    })

    // Validate file exists
    if (!file) {
      moduleLogger.error('No file provided')
      throw new ValidationError({
        message: 'No file provided',
        code: 'MISSING_FILE',
        data: { providedOptions: Object.keys(options) },
      })
    }

    // Validate file is not empty
    if (file.size === 0) {
      moduleLogger.error('Empty file provided')
      throw new ValidationError({
        message: 'Cannot upload empty file',
        code: 'EMPTY_FILE',
        data: { fileName: file.name, fileType: file.type },
      })
    }

    // Validate options has required upload type
    if (!options.type) {
      moduleLogger.error('Missing upload type')
      throw new ValidationError({
        message: 'Upload type is required',
        code: 'MISSING_UPLOAD_TYPE',
        data: { fileName: file.name, providedOptions: Object.keys(options) },
      })
    }

    try {
      moduleLogger.info('Starting file upload')

      // Start progress tracking
      options.onProgress?.(0, 'Preparing upload...')

      // Validate file based on type and options
      this.validateFile(file, options)
      options.onProgress?.(5, 'File validated')

      moduleLogger.debug('File validated successfully')

      // Configure metadata based on upload type
      const metadata = this.configureMetadata(file, options)

      // Determine the appropriate storage bucket
      const bucketName = this.getBucketForType(options.type, options.bucketName)

      // Validate bucket exists (this would be a nice enhancement but we'll
      // need to get bucket list from storage client first in a real implementation)

      // Create a unique file path
      const filePath = this.generateFilePath(file, options)

      // Update progress
      options.onProgress?.(10, 'Uploading file...')

      // Retry logic for transient storage errors
      let uploadError: StorageError | null = null
      let attemptCount = 0

      while (attemptCount < this.RETRY_ATTEMPTS) {
        try {
          // Upload to Supabase Storage
          const uploadResult = await this.supabase.storage
            .from(bucketName)
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true,
              contentType: file.type,
            })

          uploadError = uploadResult.error

          // If upload succeeded, break retry loop
          if (!uploadError) break

          // If error is not retryable, don't retry
          const storageError = this.handleStorageError(uploadError)
          if (!storageError.data.retryable) {
            moduleLogger.warn('Non-retryable storage error, aborting retry', {
              errorCode: storageError.code,
              attempt: attemptCount + 1,
            })
            throw storageError
          }

          // Log retry attempt
          attemptCount++
          if (attemptCount < this.RETRY_ATTEMPTS) {
            const backoffTime = this.RETRY_DELAY * Math.pow(2, attemptCount - 1)
            moduleLogger.warn('Retrying upload after error', {
              attempt: attemptCount,
              maxAttempts: this.RETRY_ATTEMPTS,
              backoffTime,
              errorCode: (uploadError as StorageApiError).status,
              errorMessage: uploadError.message,
            })

            // Notify user of retry
            options.onProgress?.(10, `Retry attempt ${attemptCount}...`)

            // Wait before retry with exponential backoff
            await new Promise((resolve) => setTimeout(resolve, backoffTime))
          }
        } catch (retryError) {
          // If this is an ApplicationError thrown from inside our retry logic
          // (like a non-retryable storage error), propagate it
          if (retryError instanceof ApplicationError) {
            throw retryError
          }

          // Otherwise treat as a generic upload failure and retry if possible
          uploadError = retryError as StorageError
          attemptCount++

          if (attemptCount < this.RETRY_ATTEMPTS) {
            const backoffTime = this.RETRY_DELAY * Math.pow(2, attemptCount - 1)
            moduleLogger.warn('Unexpected error during upload, retrying', {
              attempt: attemptCount,
              maxAttempts: this.RETRY_ATTEMPTS,
              backoffTime,
              error:
                retryError instanceof Error
                  ? retryError.message
                  : String(retryError),
            })

            // Wait before retry with exponential backoff
            await new Promise((resolve) => setTimeout(resolve, backoffTime))
          }
        }
      }

      // If we exhausted all retries and still have an error, throw it
      if (uploadError) {
        moduleLogger.error(
          'Storage upload failed after retries',
          {
            bucketName,
            filePath,
            attempts: attemptCount,
          },
          uploadError
        )
        throw this.handleStorageError(uploadError)
      }

      moduleLogger.info('File uploaded to storage successfully', {
        bucketName,
        filePath,
        attempts: attemptCount > 0 ? attemptCount : 1,
      })

      options.onProgress?.(80, 'Processing upload...')

      // Get public URL for the file
      let publicUrl = ''
      try {
        const { data: urlData } = this.supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath)

        if (!urlData || !urlData.publicUrl) {
          throw new ExternalServiceError({
            message: 'Failed to get public URL for uploaded file',
            code: 'STORAGE_URL_ERROR',
            service: 'Storage',
            statusCode: 500,
            data: { filePath, bucketName },
          })
        }

        publicUrl = urlData.publicUrl
      } catch (error) {
        moduleLogger.error('Error in final upload steps', {}, error)
        throw normalizeError(error)
      }

      // If needed, trigger processing based on file type (explicitly checking that skipProcessing is not true)
      if (options.skipProcessing !== true) {
        try {
          moduleLogger.debug('Starting file processing')
          await this.processUploadedFile(file, filePath, bucketName, options)
          moduleLogger.debug('File processing completed')
        } catch (processingError) {
          // Log processing error but don't fail the upload
          moduleLogger.error(
            'File processing failed',
            {
              filePath,
              fileType: file.type,
            },
            processingError
          )

          metadata.processingError =
            processingError instanceof Error
              ? processingError.message
              : String(processingError)

          options.onProgress?.(95, 'Processing failed, but upload succeeded')
        }
      }

      options.onProgress?.(100, 'Upload complete')

      // Create ID from path or generate a random one if needed
      const fileId = filePath.split('/').pop() || crypto.randomUUID()

      // Add tracking information to metadata
      const enhancedMetadata = {
        ...metadata,
        uploadedAt: new Date().toISOString(),
        uploadAttempts: attemptCount > 0 ? attemptCount : 1,
      }

      moduleLogger.info('File upload and processing completed successfully', {
        fileId,
        publicUrl,
        processingSkipped: !!options.skipProcessing,
      })

      // Return the complete file upload info
      return {
        id: fileId,
        path: filePath,
        url: publicUrl,
        size: file.size,
        contentType: file.type,
        metadata: enhancedMetadata,
        createdAt: new Date(),
      }
    } catch (error) {
      // If error occurred, ensure progress callback gets notified
      options.onProgress?.(0, 'Upload failed')

      // Get logger with metadata if not already created
      const errorLogger =
        moduleLogger ||
        logger.withMetadata({
          module: 'UploadService',
          method: 'uploadFile',
          uploadType: options.type,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        })

      // If it's already one of our error types, just use it directly
      if (error instanceof ApplicationError) {
        errorLogger.error(
          'Upload failed',
          {
            errorCode: error.code,
            errorType: error.name,
          },
          error
        )
        throw error
      }

      // Check for common error patterns we can better identify
      let errorMessage = error instanceof Error ? error.message : String(error)
      let errorCode = 'UPLOAD_FAILED'

      // Identify common error patterns and assign better codes/messages
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        errorCode = 'STORAGE_QUOTA_EXCEEDED'
        errorMessage = 'Storage quota exceeded'
      } else if (
        errorMessage.includes('network') ||
        errorMessage.includes('connection')
      ) {
        errorCode = 'NETWORK_ERROR'
        errorMessage = 'Network error during upload'
      } else if (errorMessage.includes('timeout')) {
        errorCode = 'UPLOAD_TIMEOUT'
        errorMessage = 'Upload timed out'
      } else if (
        errorMessage.includes('permission') ||
        errorMessage.includes('access denied')
      ) {
        errorCode = 'STORAGE_PERMISSION_DENIED'
        errorMessage = 'Permission denied to storage bucket'
      }

      // Create a normalized error with enhanced context
      const normalizedError = new ExternalServiceError({
        message: errorMessage,
        code: errorCode,
        service: 'Storage',
        data: {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          uploadType: options.type,
          bucket: options.bucketName || this.getBucketForType(options.type),
        },
        cause: error,
      })

      errorLogger.error(
        'Upload failed with unexpected error',
        {
          errorCode: normalizedError.code,
          errorType: normalizedError.name,
        },
        normalizedError
      )

      throw normalizedError
    }
  }

  /**
   * Upload an avatar image
   *
   * @param file The image file to upload
   * @param userId The ID of the user this avatar belongs to
   * @param onProgress Optional callback for progress updates
   * @returns The path to the uploaded avatar
   * @throws {ValidationError} If the file is invalid or too large
   * @throws {ExternalServiceError} If the upload fails
   */
  async uploadAvatar(
    file: File,
    userId: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<string> {
    if (!userId) {
      throw new ValidationError({
        message: 'User ID is required for avatar upload',
        code: 'MISSING_USER_ID',
        data: { fileName: file?.name },
      })
    }

    const moduleLogger = logger.withMetadata({
      module: 'UploadService',
      method: 'uploadAvatar',
      userId,
      fileName: file?.name,
      fileSize: file?.size,
    })

    moduleLogger.info('Starting avatar upload')

    try {
      const result = await this.uploadFile(file, {
        type: 'avatar',
        metadata: { userId },
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ],
        maxSize: 5 * 1024 * 1024, // 5MB
        onProgress,
        skipProcessing: true,
        userId,
      })

      moduleLogger.info('Avatar upload completed successfully', {
        path: result.path,
        url: result.url,
      })

      return result.path
    } catch (error) {
      // Error already properly handled in uploadFile
      // Just add context specific to avatar uploads
      moduleLogger.error('Avatar upload failed', {}, error)

      if (error instanceof ApplicationError) {
        // Add userId to error data if not already present
        if (!(error as ApplicationError).data.userId) {
          ;(error as ApplicationError).data.userId = userId
        }
        throw error
      }

      // Shouldn't reach here but just in case
      throw normalizeError(error)
    }
  }

  /**
   * Upload a patient document
   *
   * @param file The document file to upload
   * @param patientId The ID of the patient this document belongs to
   * @param documentType The type of medical document
   * @param departmentId Optional department ID
   * @param onProgress Optional callback for progress updates
   * @returns The uploaded file information
   * @throws {ValidationError} If the file or patient data is invalid
   * @throws {ExternalServiceError} If the upload fails
   */
  async uploadPatientDocument(
    file: File,
    patientId: string,
    documentType: DocumentType,
    departmentId?: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<FileUpload> {
    if (!patientId) {
      throw new ValidationError({
        message: 'Patient ID is required for document upload',
        code: 'MISSING_PATIENT_ID',
        data: { fileName: file?.name },
      })
    }

    if (!documentType || !documentType.type) {
      throw new ValidationError({
        message: 'Document type is required for patient document upload',
        code: 'MISSING_DOCUMENT_TYPE',
        data: { fileName: file?.name, patientId },
      })
    }

    const moduleLogger = logger.withMetadata({
      module: 'UploadService',
      method: 'uploadPatientDocument',
      patientId,
      documentType: `${documentType.category}/${documentType.type}`,
      departmentId,
      fileName: file?.name,
      fileSize: file?.size,
    })

    moduleLogger.info('Starting patient document upload')

    try {
      return await this.uploadFile(file, {
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
    } catch (error) {
      // Error already properly handled in uploadFile
      // Just add context specific to patient document uploads
      moduleLogger.error('Patient document upload failed', {}, error)
      throw error // Already normalized in uploadFile
    }
  }

  /**
   * Upload a chat attachment
   *
   * @param file The file to attach to a chat
   * @param chatId The ID of the chat this attachment belongs to
   * @param messageId Optional message ID this attachment belongs to
   * @param onProgress Optional callback for progress updates
   * @returns The uploaded file information
   * @throws {ValidationError} If the file or chat data is invalid
   * @throws {ExternalServiceError} If the upload fails
   */
  async uploadChatAttachment(
    file: File,
    chatId: string,
    messageId?: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<FileUpload> {
    if (!chatId) {
      throw new ValidationError({
        message: 'Chat ID is required for attachment upload',
        code: 'MISSING_CHAT_ID',
        data: { fileName: file?.name },
      })
    }

    const moduleLogger = logger.withMetadata({
      module: 'UploadService',
      method: 'uploadChatAttachment',
      chatId,
      messageId,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
    })

    moduleLogger.info('Starting chat attachment upload')

    try {
      return await this.uploadFile(file, {
        type: 'chat-attachment',
        metadata: {
          chatId,
          messageId,
        },
        onProgress,
      })
    } catch (error) {
      // Error already properly handled in uploadFile
      moduleLogger.error('Chat attachment upload failed', {}, error)
      throw error // Already normalized in uploadFile
    }
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
        message: `File size exceeds maximum allowed (${this.formatFileSize(maxSize)})`,
        code: 'FILE_TOO_LARGE',
        data: {
          fileSize: file.size,
          maxSize,
          fileName: file.name,
        },
      })
    }

    // Check file type if specified
    if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
      if (!options.allowedMimeTypes.includes(file.type)) {
        throw new ValidationError({
          message: `File type not allowed (${file.type})`,
          code: 'INVALID_FILE_TYPE',
          data: {
            fileType: file.type,
            uploadType: options.type,
            allowedTypes: options.allowedMimeTypes,
            fileName: file.name,
          },
        })
      }
    } else {
      // Use default allowed types based on upload type
      const allowedTypes = this.getAllowedMimeTypesForType(options.type)
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        throw new ValidationError({
          message: `File type not allowed (${file.type})`,
          code: 'INVALID_FILE_TYPE',
          data: {
            fileType: file.type,
            uploadType: options.type,
            allowedTypes,
            fileName: file.name,
          },
        })
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
              fileName: file.name,
            },
          })
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
          details,
        },
        cause: details instanceof Error ? details : undefined,
      })
    } else {
      return new ValidationError({
        message,
        code,
        data: {
          retryable,
          details,
        },
      })
    }
  }

  /**
   * Handle Supabase storage errors with comprehensive classification
   *
   * @param error The storage error from Supabase
   * @returns A properly classified ExternalServiceError with retry information
   */
  private handleStorageError(error: StorageError): ExternalServiceError {
    const storageError = error as StorageApiError
    const statusCode = storageError.status ?? 500
    let code = 'STORAGE_ERROR'
    let message = error.message || 'Storage error occurred'
    let isOperational = false // Default to not retryable

    const moduleLogger = logger.withMetadata({
      module: 'UploadService',
      method: 'handleStorageError',
      errorStatus: storageError.status,
      errorName: error.name,
      errorMessage: error.message,
    })

    moduleLogger.debug('Classifying storage error')

    if (storageError.status) {
      if (storageError.status >= 500) {
        code = 'STORAGE_SERVER_ERROR'
        isOperational = true
        message = 'Storage service encountered an error, please try again'
      } else if (storageError.status === 429) {
        code = 'STORAGE_RATE_LIMITED'
        isOperational = true
        message = 'Upload rate limit exceeded, please try again later'
      } else if (storageError.status === 413) {
        code = 'FILE_TOO_LARGE'
        isOperational = false
        message = 'File size exceeds storage service limits'
      } else if (storageError.status === 415) {
        code = 'UNSUPPORTED_FILE_TYPE'
        isOperational = false
        message = 'File type not supported by storage service'
      } else if (storageError.status === 401 || storageError.status === 403) {
        code = 'STORAGE_UNAUTHORIZED'
        isOperational = false
        message = 'Not authorized to upload to this storage location'
      } else if (storageError.status === 404) {
        code = 'STORAGE_BUCKET_NOT_FOUND'
        isOperational = false
        message = 'Storage bucket does not exist'
      } else if (storageError.status === 409) {
        code = 'STORAGE_FILE_CONFLICT'
        isOperational = false
        message = 'File already exists with conflicting content'
      }
    }

    if (error.message !== null && error.message !== '') {
      const lowerMsg = error.message.toLowerCase()
      if (lowerMsg.includes('network') || lowerMsg.includes('connection')) {
        code = 'STORAGE_NETWORK_ERROR'
        isOperational = true
        message = 'Network error during file upload'
      } else if (lowerMsg.includes('timeout')) {
        code = 'STORAGE_TIMEOUT'
        isOperational = true
        message = 'Upload timed out, please try again'
      } else if (lowerMsg.includes('quota')) {
        code = 'STORAGE_QUOTA_EXCEEDED'
        isOperational = false
        message = 'Storage quota exceeded'
      }
    }

    moduleLogger.debug('Classified storage error', {
      originalStatus: storageError.status,
      classifiedCode: code,
      isRetryable: isOperational,
    })

    return new ExternalServiceError({
      message,
      code,
      service: 'Storage',
      statusCode,
      data: {
        retryable: isOperational,
        originalError: error,
        originalMessage: error.message,
        originalStatus: storageError.status,
      },
      cause: error,
    })
  }
}

// Export a singleton instance
export const uploadService = new UploadService()
