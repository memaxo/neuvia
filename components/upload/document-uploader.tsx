'use client'

import { FileUploader } from '@/components/file-uploader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import React, { useState } from 'react'

import { useDocumentUpload } from '@/lib/api/client/hooks'
import type {
  DocumentType,
  DocumentUploadStatus,
  FileUpload,
} from '@/lib/types/upload'

/**
 * Props for the DocumentUploader component
 */
export interface DocumentUploaderProps {
  patientId?: string
  departmentId?: string
  documentType?: DocumentType
  onComplete?: (fileUpload: FileUpload) => void
  onError?: (error: string) => void
  onStatusChange?: (status: DocumentUploadStatus) => void
  className?: string
  showProgress?: boolean
  allowedTypes?: string[]
  maxSize?: number
  multiple?: boolean
  description?: string
}

/**
 * A specialized uploader component for documents that uses the central UploadService
 */
export function DocumentUploader({
  patientId = '',
  departmentId = '',
  documentType = { category: 'clinical', type: 'document' },
  onComplete,
  onError,
  onStatusChange,
  className,
  showProgress = true,
  allowedTypes,
  maxSize,
  multiple = false,
  description,
}: DocumentUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<DocumentUploadStatus>({
    status: 'idle',
    progress: 0,
  })
  const [currentFiles, setCurrentFiles] = useState<File[]>([])

  const { toast } = useToast()

  /**
   * Update the upload status and notify via callback if provided
   */
  const updateStatus = (status: Partial<DocumentUploadStatus>) => {
    const newStatus = { ...uploadStatus, ...status }
    setUploadStatus(newStatus)
    onStatusChange?.(newStatus)
  }

  /**
   * Handle file upload using the API client
   */
  const documentUploadMutation = useDocumentUpload()

  const handleFileUpload = async (
    files: File[],
    progressCallback: (progress: number, file: File) => void
  ) => {
    if (files.length === 0) return

    // For now, we only handle the first file if multiple is false
    const fileToUpload = files[0]
    setFile(fileToUpload)
    setUploading(true)

    updateStatus({
      status: 'uploading',
      progress: 0,
      currentStep: 'Starting upload',
    })

    try {
      // Use the API client to handle the file upload
      const uploadRequest = {
        file: fileToUpload,
        patientId,
        documentType,
        departmentId,
        onProgress: (progress: number, status: string) => {
          // Update progress based on the progress reports
          updateStatus({
            status: progress < 100 ? 'uploading' : 'processing',
            progress,
            currentStep: status,
          })

          // Update the FileUploader's progress indicator
          progressCallback(progress, fileToUpload)
        }
      }

      const result = await documentUploadMutation.mutateAsync(uploadRequest)

      // Upload successful
      updateStatus({
        status: 'success',
        progress: 100,
        currentStep: 'Upload complete',
      })

      toast({
        title: 'Document Uploaded',
        description: 'Document has been successfully uploaded and processed.',
      })

      // Notify parent component
      onComplete?.(result)
    } catch (error) {
      // Handle upload error
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      updateStatus({
        status: 'error',
        progress: 0,
        error: errorMessage,
      })

      toast({
        title: 'Upload Error',
        description: errorMessage,
        variant: 'destructive',
      })

      onError?.(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  /**
   * Render progress indicator if showProgress is true
   */
  const renderProgress = () => {
    if (!showProgress || uploadStatus.status === 'idle') return null

    return (
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-medium">
              {uploadStatus.status === 'uploading'
                ? 'Uploading Document'
                : uploadStatus.status === 'processing'
                  ? 'Processing Document'
                  : uploadStatus.status === 'success'
                    ? 'Document Processed'
                    : 'Upload Error'}
            </div>
            <div className="text-muted-foreground text-sm">
              {uploadStatus.progress}% Complete
            </div>
          </div>

          <Progress className="mb-2" value={uploadStatus.progress} />

          <div className="text-muted-foreground text-sm">
            {uploadStatus.currentStep || 'Waiting...'}
          </div>

          {uploadStatus.status === 'error' && (
            <Alert className="mt-2" variant="error">
              <AlertCircle className="size-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{uploadStatus.error}</AlertDescription>
            </Alert>
          )}

          {uploadStatus.status === 'success' && (
            <Alert className="mt-2" variant="success">
              <CheckCircle2 className="size-4 text-green-600" />
              <AlertTitle className="text-green-600">Success</AlertTitle>
              <AlertDescription>
                Document processed successfully.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    )
  }

  /**
   * Render file preview if a file is selected
   */
  const renderFilePreview = () => {
    if (!file) return null

    return (
      <div className="bg-card mb-4 flex items-center justify-between rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex size-10 items-center justify-center rounded-full">
            <FileText className="text-primary size-5" />
          </div>
          <div>
            <div className="font-medium">{file.name}</div>
            <div className="text-muted-foreground text-sm">
              {(file.size / 1024).toFixed(0)} KB
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {description && (
        <p className="text-muted-foreground mb-2 text-sm">{description}</p>
      )}

      {renderFilePreview()}
      {renderProgress()}

      <FileUploader
        accept={{
          'application/pdf': ['.pdf'],
          'text/plain': ['.txt'],
          'application/msword': ['.doc'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            ['.docx'],
          ...(allowedTypes ? { allowedTypes } : {}),
        }}
        className={
          file && uploadStatus.status !== 'error' ? 'hidden' : undefined
        }
        disabled={uploading}
        maxFileCount={multiple ? undefined : 1}
        maxSize={maxSize || 20 * 1024 * 1024} // Default to 20MB unless specified
        multiple={multiple}
        onUpload={handleFileUpload}
        onValueChange={setCurrentFiles}
        value={currentFiles}
      />

      {uploadStatus.status === 'success' && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => {
              // Reset the uploader state
              setFile(null)
              setCurrentFiles([])
              updateStatus({
                status: 'idle',
                progress: 0,
                currentStep: undefined,
                error: undefined,
              })
            }}
          >
            Upload Another Document
          </Button>
        </div>
      )}
    </div>
  )
}
