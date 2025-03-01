import { createBrowserClient } from '@/lib/supabase/clients'
import {
  type DocumentType,
  type FileUpload,
  type UploadError,
  type UploadMetadata,
  type UploadOptions,
  type UploadType,
} from '@/lib/types/upload'
import type { StorageError } from '@supabase/storage-js'

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
      throw this.createError('INVALID_FILE', 'No file provided', false)
    }

    try {
      // Start progress tracking
      options.onProgress?.(0, 'Preparing upload...')

      // Validate file based on type and options
      this.validateFile(file, options)
      options.onProgress?.(5, 'File validated')

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
        throw this.handleStorageError(uploadError)
      }

      options.onProgress?.(80, 'Processing upload...')

      // Get public URL for the file
      const {
        data: { publicUrl },
      } = this.supabase.storage.from(bucketName).getPublicUrl(filePath)

      // If needed, trigger processing based on file type
      if (!options.skipProcessing) {
        await this.processUploadedFile(file, filePath, bucketName, options)
      }

      options.onProgress?.(100, 'Upload complete')

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
      // Ensure error is properly formatted
      if (error instanceof Error && 'code' in error) {
        throw error
      }

      throw this.createError(
        'UPLOAD_FAILED',
        error instanceof Error ? error.message : 'Failed to upload file',
        true,
        error
      )
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
      throw this.createError(
        'FILE_TOO_LARGE',
        `File size exceeds maximum allowed size of ${this.formatFileSize(maxSize)}`,
        false
      )
    }

    // Check file type if specified
    if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
      if (!options.allowedMimeTypes.includes(file.type)) {
        throw this.createError(
          'INVALID_FILE_TYPE',
          `File type ${file.type} is not supported. Allowed types: ${options.allowedMimeTypes.join(', ')}`,
          false
        )
      }
    } else {
      // Use default allowed types based on upload type
      const allowedTypes = this.getAllowedMimeTypesForType(options.type)
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        throw this.createError(
          'INVALID_FILE_TYPE',
          `File type ${file.type} is not supported for ${options.type} uploads`,
          false
        )
      }
    }

    // Type-specific validation
    switch (options.type) {
      case 'avatar':
        // Additional avatar-specific validation could go here
        break
      case 'patient-document':
        if (!options.patientId) {
          throw this.createError(
            'MISSING_PATIENT_ID',
            'Patient ID is required for patient document uploads',
            false
          )
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
   * Create a standardized error object
   */
  private createError(
    code: string,
    message: string,
    retryable: boolean,
    details?: any
  ): UploadError {
    const error = new Error(message) as UploadError
    error.code = code
    error.retryable = retryable
    error.details = details
    return error
  }

  /**
   * Handle Supabase storage errors
   */
  private handleStorageError(error: StorageError): UploadError {
    let code = 'STORAGE_ERROR'
    let retryable = false

    if (error.statusCode) {
      if (error.statusCode >= 500) {
        retryable = true
        code = 'STORAGE_SERVER_ERROR'
      } else if (error.statusCode === 413) {
        code = 'FILE_TOO_LARGE'
      } else if (error.statusCode === 401 || error.statusCode === 403) {
        code = 'UNAUTHORIZED'
      }
    }

    return this.createError(
      code,
      error.message || 'Storage error occurred',
      retryable,
      error
    )
  }
}

// Export a singleton instance
export const uploadService = new UploadService()
