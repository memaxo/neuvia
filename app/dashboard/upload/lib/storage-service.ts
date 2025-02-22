import { createClient } from '@/utils/supabase/client'

export type DocumentType = 
  | 'medical-image'  // DICOM, NIfTI, JPEG, PNG
  | 'document'       // PDF, DOCX, TXT, MD
  | 'report'         // Lab reports, clinical notes
  | 'other'          // Other medical documents

// Enhanced error types
export type UploadError = {
  code: 
    | 'FILE_TOO_LARGE'
    | 'INVALID_FILE_TYPE'
    | 'NETWORK_ERROR'
    | 'SERVER_ERROR'
    | 'VALIDATION_ERROR'
    | 'PROCESSING_ERROR'
    | 'UNAUTHORIZED'
    | 'UNKNOWN'
  message: string
  details?: any
  retryable: boolean
}

export interface FileUpload {
  id: string
  name: string
  size: number
  progress: number
  status: 
    | 'preparing'    // Initial state
    | 'validating'   // Validating file type and size
    | 'uploading'    // Actively uploading
    | 'paused'       // Upload paused
    | 'processing'   // Processing/scanning the uploaded file
    | 'complete'     // Upload and processing complete
    | 'error'        // Error occurred
    | 'cancelled'    // Upload cancelled by user
  url?: string
  path?: string
  error?: UploadError
  type?: DocumentType
  mimeType?: string
  abortController?: AbortController
  statusMessage?: string // Detailed status message
  speed?: number        // Upload speed in bytes/second
  timeRemaining?: number // Estimated time remaining in seconds
  startTime?: number    // Upload start timestamp
  lastUpdate?: number   // Last progress update timestamp
  bytesUploaded?: number // Bytes uploaded so far
  retryCount?: number
  lastError?: Error
  recoveryOptions?: {
    canRetry: boolean
    canResume: boolean
    suggestedAction?: string
  }
}

export interface UploadMetadata {
  patientId?: string
  documentType?: DocumentType
  studyDate?: string
  description?: string
  tags?: string[]
}

// File type validation
const ALLOWED_MIME_TYPES = {
  'medical-image': [
    'image/jpeg',
    'image/png',
    'application/dicom',
    '.nii',
    'application/nii',
    'application/nifti'
  ],
  'document': [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/msword', // doc
    'text/plain',
    'text/markdown',
    'text/x-markdown'
  ],
  'report': [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown'
  ],
  'other': [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
    'application/xml',
    'text/xml',
    'application/json'
  ]
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export class StorageService {
  private supabase = createClient()
  private edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL  }/functions/v1`
  private activeUploads = new Map<string, XMLHttpRequest>()
  private pausedUploads = new Map<string, { file: File; metadata?: UploadMetadata; progress: number }>()
  private maxRetries = 3
  private retryDelays = [1000, 3000, 5000] // Delays in ms between retries

  // Enhanced validation with detailed error messages
  private validateFile(file: File, documentType?: DocumentType): { valid: boolean; error?: UploadError } {
    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File too large. Maximum size: ${formatBytes(MAX_FILE_SIZE)}`,
          retryable: false
        }
      }
    }

    // If no document type specified, accept all allowed types
    if (!documentType) {
      const allAllowedTypes = Object.values(ALLOWED_MIME_TYPES).flat()
      if (!allAllowedTypes.includes(file.type)) {
        return {
          valid: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Unsupported file type',
            details: { allowedTypes: allAllowedTypes },
            retryable: false
          }
        }
      }
      return { valid: true }
    }

    // Check against specific document type
    const allowedTypes = ALLOWED_MIME_TYPES[documentType]
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: `Invalid file type for ${documentType}`,
          details: { allowedTypes, documentType },
          retryable: false
        }
      }
    }

    return { valid: true }
  }

  // Helper function to handle retries
  private async retryWithBackoff(
    operation: () => Promise<any>,
    retryCount: number,
    uploadId: string
  ): Promise<any> {
    try {
      return await operation()
    } catch (error) {
      if (retryCount >= this.maxRetries) {
        throw error
      }

      const delay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1]
      await new Promise(resolve => setTimeout(resolve, delay))

      return this.retryWithBackoff(operation, retryCount + 1, uploadId)
    }
  }

  // Helper function to determine if an error is retryable
  private isRetryableError(error: any): boolean {
    if (error.name === 'NetworkError' || error.name === 'TimeoutError') {
      return true
    }
    
    const status = error.status || error.statusCode
    return status >= 500 || status === 429 // Server errors and rate limiting
  }

  // Helper function to create error object
  private createError(error: any): UploadError {
    if (error instanceof Error) {
      if (error.name === 'NetworkError') {
        return {
          code: 'NETWORK_ERROR',
          message: 'Network connection error',
          details: error,
          retryable: true
        }
      }
      
      if (error.message.includes('unauthorized')) {
        return {
          code: 'UNAUTHORIZED',
          message: 'Not authorized to perform this action',
          details: error,
          retryable: false
        }
      }
    }

    const status = error.status || error.statusCode
    if (status >= 500) {
      return {
        code: 'SERVER_ERROR',
        message: 'Server error occurred',
        details: error,
        retryable: true
      }
    }

    return {
      code: 'UNKNOWN',
      message: error.message || 'An unknown error occurred',
      details: error,
      retryable: this.isRetryableError(error)
    }
  }

  async uploadFile(
    file: File,
    metadata?: UploadMetadata,
    onProgress?: (progress: number, status: string, speed?: number, timeRemaining?: number) => void,
    uploadId?: string,
    startByte: number = 0,
    retryCount: number = 0
  ): Promise<FileUpload> {
    const currentUploadId = uploadId || crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Initial state
      onProgress?.(0, 'Preparing upload...')

      // Validate file
      onProgress?.(0, 'Validating file...')
      const validation = this.validateFile(file, metadata?.documentType)
      if (!validation.valid) {
        throw validation.error
      }

      // Get upload URL with retry
      onProgress?.(0, 'Getting upload URL...')
      const { uploadUrl, path } = await this.retryWithBackoff(
        async () => {
          const response = await fetch(`${this.edgeFunctionUrl}/process-upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              userId: (await this.supabase.auth.getUser()).data.user?.id,
              metadata: {
                ...metadata,
                mimeType: file.type,
                resumePosition: startByte
              }
            })
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to get upload URL')
          }

          return response.json()
        },
        retryCount,
        currentUploadId
      )

      // Upload file with progress tracking and retry support
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        let lastProgress = startByte
        let lastTime = Date.now()
        
        this.activeUploads.set(currentUploadId, xhr)
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const currentTime = Date.now()
            const bytesUploaded = event.loaded
            const totalBytes = event.total
            const progress = Math.round((bytesUploaded * 100) / totalBytes)
            
            const timeDiff = (currentTime - lastTime) / 1000
            const bytesDiff = bytesUploaded - lastProgress
            const speed = bytesDiff / timeDiff
            
            const remainingBytes = totalBytes - bytesUploaded
            const timeRemaining = speed > 0 ? remainingBytes / speed : 0
            
            onProgress?.(
              progress,
              `Uploading... ${progress}%`,
              speed,
              timeRemaining
            )
            
            lastProgress = bytesUploaded
            lastTime = currentTime
          }
        })

        xhr.addEventListener('load', () => {
          this.activeUploads.delete(currentUploadId)
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            const error = this.createError({ status: xhr.status, message: xhr.statusText })
            reject(error)
          }
        })

        xhr.addEventListener('error', () => {
          this.activeUploads.delete(currentUploadId)
          reject(this.createError({ name: 'NetworkError' }))
        })

        xhr.addEventListener('abort', () => {
          this.activeUploads.delete(currentUploadId)
          reject(new Error('Upload cancelled'))
        })

        xhr.open('PUT', uploadUrl)
        if (startByte > 0) {
          xhr.setRequestHeader('Content-Range', `bytes ${startByte}-${file.size - 1}/${file.size}`)
        }
        xhr.send(file)
      })

      // Process file with retry using Gemini 2.0 Flash for document analysis
      onProgress?.(95, 'Processing file...')
      const { analysisData } = await this.retryWithBackoff(
        async () => {
          const response = await fetch(`${this.edgeFunctionUrl}/analyze-document`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              filePath: path,
              userId: (await this.supabase.auth.getUser()).data.user?.id,
              metadata: {
                ...metadata,
                analysis: true
              }
            })
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Document analysis failed');
          }
          return response.json();
        },
        retryCount,
        currentUploadId
      );

      onProgress?.(100, 'Complete')
      return {
        id: currentUploadId,
        name: file.name,
        size: file.size,
        progress: 100,
        status: 'complete',
        statusMessage: 'Upload and analysis complete',
        path,
        url: await this.getDownloadUrl(path, metadata?.patientId),
        type: metadata?.documentType,
        mimeType: file.type,
        analysisData,
        startTime,
        lastUpdate: Date.now(),
        bytesUploaded: file.size,
        retryCount,
        recoveryOptions: {
          canRetry: false,
          canResume: false
        }
      }
    } catch (error) {
      this.activeUploads.delete(currentUploadId)
      
      console.error('Upload error:', error)
      const uploadError = error.code ? error : this.createError(error)
      const status = error.message === 'Upload cancelled' ? 'cancelled' : 'error'
      
      const canRetry = uploadError.retryable && retryCount < this.maxRetries
      const canResume = status !== 'cancelled' && startByte > 0
      
      return {
        id: currentUploadId,
        name: file.name,
        size: file.size,
        progress: startByte > 0 ? Math.round((startByte * 100) / file.size) : 0,
        status,
        statusMessage: uploadError.message,
        error: uploadError,
        mimeType: file.type,
        startTime,
        lastUpdate: Date.now(),
        retryCount,
        lastError: error instanceof Error ? error : new Error(error.message),
        recoveryOptions: {
          canRetry,
          canResume,
          suggestedAction: canRetry 
            ? 'Retry upload'
            : canResume 
              ? 'Resume from last position'
              : 'Contact support if the issue persists'
        }
      }
    }
  }

  // Add method to pause upload
  pauseUpload(uploadId: string, file: File, metadata?: UploadMetadata, progress: number): void {
    const xhr = this.activeUploads.get(uploadId)
    if (xhr) {
      xhr.abort()
      this.activeUploads.delete(uploadId)
      this.pausedUploads.set(uploadId, { file, metadata, progress })
    }
  }

  // Add method to resume upload
  async resumeUpload(
    uploadId: string,
    onProgress?: (progress: number, status: string, speed?: number, timeRemaining?: number) => void
  ): Promise<FileUpload> {
    const pausedUpload = this.pausedUploads.get(uploadId)
    if (!pausedUpload) {
      throw new Error('No paused upload found')
    }

    const { file, metadata, progress } = pausedUpload
    const startByte = Math.floor((progress * file.size) / 100)
    this.pausedUploads.delete(uploadId)

    return this.uploadFile(file, metadata, onProgress, uploadId, startByte)
  }

  // Add method to cancel upload
  cancelUpload(uploadId: string): void {
    const xhr = this.activeUploads.get(uploadId)
    if (xhr) {
      xhr.abort()
      this.activeUploads.delete(uploadId)
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      await this.supabase.storage.from('scans').remove([path])
    } catch (error) {
      console.error('Delete error:', error)
      throw error
    }
  }

  async getDownloadUrl(filePath: string, patientId?: string): Promise<string> {
    try {
      const response = await fetch(`${this.edgeFunctionUrl}/generate-download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filePath,
          userId: (await this.supabase.auth.getUser()).data.user?.id,
          patientId
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate download URL')
      }

      const { downloadUrl } = await response.json()
      return downloadUrl
    } catch (error) {
      console.error('Download URL error:', error)
      throw error
    }
  }

  async listFiles(): Promise<FileUpload[]> {
    const { data: files, error } = await this.supabase.storage
      .from('scans')
      .list('uploads')

    if (error) throw error

    return Promise.all(
      files.map(async (file) => {
        const url = await this.getDownloadUrl(`uploads/${file.name}`)
        return {
          id: file.name,
          name: file.name,
          size: file.metadata?.size || 0,
          progress: 100,
          status: 'complete',
          url,
          path: `uploads/${file.name}`
        }
      })
    )
  }
}

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
} 