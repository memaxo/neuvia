'use client'

import { FileUploader } from '@/components/file-uploader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { AlertCircle, CheckCircle, FileText, X } from 'lucide-react'
import React, { useCallback, useState, useEffect } from 'react'
import { useChatStore } from '@/stores/chat-store'

// Import workflow components
import { WorkflowProgressTracker } from '@/components/chat/workflow/workflow-progress-tracker'
import { WorkflowIndicator } from '@/components/chat/workflow/workflow-indicator'

// Import API client hooks
import { useDocumentUpload, useDocumentProcess } from '@/lib/api/client/hooks'

// Import specialized workflow hooks
import { useDocumentWorkflow } from '@/lib/workflow/hooks/use-document-workflow'
import { useVerificationWorkflow } from '@/lib/workflow/hooks/use-verification-workflow'
import type {
  DocumentType,
  DocumentUploadStatus,
  FileUpload,
} from '@/lib/types/upload'
import type { ProcessingPhase } from '@/lib/workflow/types'

/**
 * Props for the UnifiedDocumentUploader component
 */
export interface UnifiedDocumentUploaderProps {
  // Document metadata
  patientId: string
  departmentId?: string
  documentType?: DocumentType | string
  documentCategory?: string
  
  // Storage context
  storageContext?: 'chat' | 'patient' | 'general'
  chatId?: string
  messageId?: string
  
  // Processing options
  initiateProcessing?: boolean
  autoVerify?: boolean
  
  // UI options
  showProgressTracker?: boolean
  showFilePreview?: boolean
  showWorkflowStatus?: boolean
  previewPosition?: 'top' | 'left' | 'right'
  
  // File options
  allowedTypes?: string[]
  maxSize?: number
  multiple?: boolean
  
  // Display text
  title?: string
  description?: string
  
  // Callbacks
  onComplete?: (fileUpload: FileUpload) => void
  onProcessingComplete?: (result: any) => void
  onError?: (error: string) => void
  onStatusChange?: (status: DocumentUploadStatus) => void
  
  // Styling
  className?: string
  compact?: boolean
}

/**
 * A unified document uploader component that connects to workflow state
 * and provides a consistent experience across the application
 */
export function UnifiedDocumentUploader({
  // Document metadata with defaults
  patientId,
  departmentId = '',
  documentType = { category: 'clinical', type: 'document' },
  documentCategory = 'clinical',
  
  // Storage context
  storageContext = 'patient',
  chatId,
  messageId,
  
  // Processing options
  initiateProcessing = true,
  autoVerify = false,
  
  // UI options
  showProgressTracker = true,
  showFilePreview = true,
  showWorkflowStatus = true,
  previewPosition = 'top',
  
  // File options
  allowedTypes,
  maxSize = 20 * 1024 * 1024, // 20MB default
  multiple = false,
  
  // Display text
  title = 'Upload Document',
  description = 'Upload a document to begin processing',
  
  // Callbacks
  onComplete,
  onProcessingComplete,
  onError,
  onStatusChange,
  
  // Styling
  className = '',
  compact = false,
}: UnifiedDocumentUploaderProps) {
  // File state
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<DocumentUploadStatus>({
    status: 'idle',
    progress: 0,
  })
  const [currentFiles, setCurrentFiles] = useState<File[]>([])
  const [fileUploadResult, setFileUploadResult] = useState<FileUpload | null>(null)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // Access toast for notifications
  const { toast } = useToast()
  
  // Get the user ID for workflow hook initialization
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_id') || undefined : undefined
  
  // Use specialized document workflow hook
  const {
    processDocument: processDocumentHook,
    updateProgress: updateProgressHook,
    updateStep: updateWorkflowStepHook,
    status: documentStatus,
    state: documentState
  } = useDocumentWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Derive the current workflow step from document status
  const workflowStep = documentStatus.currentStep
  
  // Maintain backward compatibility with Zustand store (still used in some parts)
  const updateWorkflowStep = useChatStore(state => state.updateWorkflowStep)
  const updateProgress = useChatStore(state => state.updateProgress)
  const processDocumentStore = useChatStore(state => state.processDocument)
  
  // API client hooks
  const documentUploadMutation = useDocumentUpload()
  const documentProcessMutation = useDocumentProcess()
  
  /**
   * Update the upload status and notify via callback if provided
   * Uses specialized hooks for workflow state management
   */
  const updateStatus = useCallback((status: Partial<DocumentUploadStatus>) => {
    const newStatus = { ...uploadStatus, ...status }
    setUploadStatus(newStatus)
    onStatusChange?.(newStatus)

    // Update workflow progress based on upload status using specialized hooks
    if (status.progress !== undefined) {
      // Update both hooks and store for backward compatibility
      updateProgressHook(status.progress, status.currentStep as ProcessingPhase)
      updateProgress(status.progress, status.currentStep as ProcessingPhase)
    }
    
    // Update workflow step based on status using specialized hooks
    if (status.status === 'uploading' && workflowStep !== 'uploading') {
      // Update both hooks and store for backward compatibility
      updateWorkflowStepHook('uploading', { fileName: file?.name, fileSize: file?.size })
      updateWorkflowStep('uploading', { fileName: file?.name, fileSize: file?.size })
    } else if (status.status === 'processing' && workflowStep !== 'extracting') {
      updateWorkflowStepHook('extracting')
      updateWorkflowStep('extracting')
    } else if (status.status === 'error' && workflowStep !== 'error') {
      updateWorkflowStepHook('error', { error: status.error })
      updateWorkflowStep('error', { error: status.error })
    }
  }, [uploadStatus, onStatusChange, updateProgressHook, updateProgress, updateWorkflowStepHook, updateWorkflowStep, workflowStep, file])
  
  /**
   * Handle file upload and connect to workflow state
   */
  const handleFileUpload = useCallback(async (
    files: File[],
    progressCallback: (progress: number, file: File) => void
  ) => {
    if (files.length === 0) return
    
    // For now, we only handle the first file if multiple is false
    const fileToUpload = files[0]
    setFile(fileToUpload)
    setUploading(true)
    
    // Create a new abort controller
    const controller = new AbortController()
    setAbortController(controller)
    
    // Initialize status and workflow
    updateStatus({
      status: 'uploading',
      progress: 0,
      currentStep: 'Starting upload',
    })
    
    try {
      // If we're using the chat store for processing, use the specialized hook
      if (storageContext === 'chat') {
        // Use the specialized document workflow hook
        const result = await processDocumentHook(
          fileToUpload, 
          { 
            patientId,
            documentType: typeof documentType === 'string' ? documentType : documentType.type
          }
        )
          
          // Update status to complete
          updateStatus({
            status: 'success',
            progress: 100,
            currentStep: 'Processing complete',
          })
          
          // Handle result
          onProcessingComplete?.(result)
          return
        }
      }
      
      // Otherwise, use the API client for upload and processing
      // First, upload the document
      const docType = typeof documentType === 'string' 
        ? { category: documentCategory, type: documentType }
        : documentType
      
      // Step 1: Upload the file
      const uploadRequest = {
        file: fileToUpload,
        patientId,
        documentType: docType,
        departmentId,
        onProgress: (progress: number, status: string) => {
          // Update progress tracking
          updateStatus({
            status: progress < 100 ? 'uploading' : 'processing',
            progress,
            currentStep: status,
          })
          
          // Update the FileUploader's progress indicator
          progressCallback(progress, fileToUpload)
        }
      }
      
      const uploadResult = await documentUploadMutation.mutateAsync(uploadRequest)
      setFileUploadResult(uploadResult)
      
      // Call onComplete with the upload result
      onComplete?.(uploadResult)
      
      // If processing should be initiated, do that next
      if (initiateProcessing) {
        updateStatus({
          status: 'processing',
          progress: 50,
          currentStep: 'Processing document',
        })
        
        // Import the API client
        import { apiClient } from '@/lib/api/client/api-client'
        
        // Step 2: Create workflow state for tracking
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData?.user?.id
        
        // Create a workflow state entry to track this processing
        let workflowId = localStorage.getItem('current_workflow_id')
        
        if (!workflowId && userId) {
          const workflowData = await apiClient.workflows.createWorkflow({
            workflowType: 'document_processing',
            userId,
            patientId,
            initialStep: 'extracting',
            metadata: {
              fileName: fileToUpload.name,
              fileSize: fileToUpload.size,
              fileType: fileToUpload.type,
              uploadId: uploadResult.id,
              departmentId,
              source: 'unified_uploader',
              startedAt: new Date().toISOString()
            }
          })
          
          // Store workflow ID for future use
          if (workflowData?.id) {
            workflowId = workflowData.id
            localStorage.setItem('current_workflow_id', workflowId)
          }
        }
        
        // Step 3: Process the document using the API client
        const processResult = await apiClient.documents.processDocument({
          file: fileToUpload,
          patientId,
          documentType: docType?.type || 'clinical',
          documentCategory: docType?.category || 'clinical',
          onStatusUpdate: (status: any) => {
            // Update progress based on the processing status
            if (status.progress !== undefined) {
              updateStatus({
                status: 'processing',
                progress: 50 + (status.progress / 2), // Scale to 50-100%
                currentStep: status.phase || 'Processing',
              })
              
              // Also update workflow state in database if we have a workflow ID
              if (workflowId) {
                apiClient.workflows.updateWorkflowState(workflowId, {
                  step: 'extracting',
                  progress: status.progress,
                  phase: status.phase,
                })
              }
            }
          }
        })
        
        // Update status to complete
        updateStatus({
          status: 'success',
          progress: 100,
          currentStep: 'Processing complete',
        })
        
        // If auto-verify is enabled, update workflow step to verification
        if (autoVerify) {
          updateWorkflowStep('verification')
        }
        
        // Notify parent of completion
        onProcessingComplete?.(processResult)
        
        // Show success toast
        toast({
          title: 'Document Processed',
          description: 'Document has been successfully uploaded and processed.',
        })
      } else {
        // If not processing, just mark as successful upload
        updateStatus({
          status: 'success',
          progress: 100,
          currentStep: 'Upload complete',
        })
        
        toast({
          title: 'Document Uploaded',
          description: 'Document has been successfully uploaded.',
        })
      }
    } catch (error) {
      // Detect if this is a network error
      const isNetworkIssue = [
        'network',
        'fetch',
        'connection',
        'timeout',
        'abort'
      ].some(term => (error instanceof Error ? error.message : String(error)).toLowerCase().includes(term))
      
      // Create user-friendly message
      const errorMessage = error instanceof Error ? error.message : String(error)
      let userFriendlyMessage = errorMessage
      
      // Map common error messages to more friendly versions
      if (isNetworkIssue) {
        userFriendlyMessage = 'Network connection issue - please check your internet connection and try again.'
      } else if (errorMessage.includes('size')) {
        userFriendlyMessage = 'The file is too large to upload. Please try a smaller file.'
      } else if (errorMessage.includes('format') || errorMessage.includes('type')) {
        userFriendlyMessage = 'The file format is not supported. Please try another file type.'
      } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
        userFriendlyMessage = 'You don\'t have permission to upload this document.'
      }
      
      // Update status to error
      updateStatus({
        status: 'error',
        progress: 0,
        error: userFriendlyMessage,
      })
      
      // Get error type based on current state
      const errorType = uploadStatus.status === 'uploading' ? 'Upload' : 'Processing'
      
      // Update workflow step with detailed error information using API client
      const errorMetadata = {
        error: userFriendlyMessage,
        errorType,
        errorStep: workflowStep,
        errorTimestamp: new Date().toISOString(),
        errorDetails: {
          originalError: error instanceof Error ? error.toString() : String(error),
          fileName: file?.name,
          fileSize: file?.size,
          fileType: file?.type,
          uploadState: uploadStatus.status,
          retriable: isNetworkIssue || uploadStatus.status === 'uploading',
          isNetworkIssue
        }
      }
      
      // Update local workflow state
      updateWorkflowStep('error', errorMetadata)
      
      // Update workflow in database using API client
      const workflowId = localStorage.getItem('current_workflow_id')
      if (workflowId) {
        try {
          apiClient.workflows.markWorkflowError(workflowId, {
            error: userFriendlyMessage,
            errorDetails: errorMetadata.errorDetails,
            previousStep: workflowStep as any
          })
        } catch (e) {
          // Silently handle API errors in the error handler
          console.error('Failed to update workflow error state:', e)
        }
      }
      
      // Show toast notification
      toast({
        title: isNetworkIssue 
          ? 'Network Error' 
          : `${errorType} Error`,
        description: userFriendlyMessage,
        variant: 'destructive',
      })
      
      // Call the error callback
      onError?.(userFriendlyMessage)
    } finally {
      setUploading(false)
      setAbortController(null)
    }
  }, [
    patientId, 
    documentType, 
    documentCategory, 
    departmentId, 
    storageContext, 
    initiateProcessing, 
    autoVerify, 
    updateStatus, 
    updateWorkflowStep, 
    processDocumentStore, 
    documentUploadMutation, 
    documentProcessMutation, 
    onComplete, 
    onProcessingComplete, 
    onError, 
    toast
  ])
  
  /**
   * Reset the uploader
   */
  const resetUploader = useCallback(() => {
    setFile(null)
    setCurrentFiles([])
    setFileUploadResult(null)
    updateStatus({
      status: 'idle',
      progress: 0,
      currentStep: undefined,
      error: undefined,
    })
  }, [updateStatus])
  
  /**
   * Cancel ongoing upload/processing
   */
  const cancelUpload = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    
    updateStatus({
      status: 'idle',
      progress: 0,
      currentStep: 'Cancelled',
    })
    
    toast({
      title: 'Upload Cancelled',
      description: 'Document upload has been cancelled.',
    })
  }, [abortController, updateStatus, toast])
  
  /**
   * Render file preview if a file is selected
   */
  const renderFilePreview = () => {
    if (!file || !showFilePreview) return null
    
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
        
        {uploadStatus.status === 'uploading' || uploadStatus.status === 'processing' ? (
          <Button 
            className="text-destructive hover:bg-destructive/10" 
            onClick={cancelUpload} 
            size="icon"
            variant="ghost"
          >
            <X className="size-4" />
            <span className="sr-only">Cancel</span>
          </Button>
        ) : null}
      </div>
    )
  }
  
  /**
   * Render progress tracker for upload and processing
   */
  const renderProgressTracker = () => {
    if (!showProgressTracker || uploadStatus.status === 'idle') return null
    
    // If using the workflow tracker, render that instead of the legacy progress UI
    if (showWorkflowStatus && (uploadStatus.status === 'uploading' || uploadStatus.status === 'processing')) {
      return <WorkflowProgressTracker className="mb-4" />
    }
    
    // Otherwise, use the legacy progress UI
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
              {Math.round(uploadStatus.progress)}% Complete
            </div>
          </div>
          
          <Progress className="mb-2" value={uploadStatus.progress} />
          
          <div className="text-muted-foreground text-sm">
            {uploadStatus.currentStep || 'Waiting...'}
          </div>
          
          {uploadStatus.status === 'error' && (
            <Alert className="mt-2" variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{uploadStatus.error}</AlertDescription>
            </Alert>
          )}
          
          {uploadStatus.status === 'success' && (
            <Alert className="mt-2">
              <CheckCircle className="size-4 text-green-600" />
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
  
  return (
    <div className={`space-y-4 ${className}`}>
      {title && !compact && (
        <h3 className="text-lg font-medium">{title}</h3>
      )}
      
      {description && !compact && (
        <p className="text-muted-foreground mb-2 text-sm">{description}</p>
      )}
      
      {renderFilePreview()}
      {renderProgressTracker()}
      
      <FileUploader
        accept={{
          'application/pdf': ['.pdf'],
          'text/plain': ['.txt'],
          'application/msword': ['.doc'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
          'image/jpeg': ['.jpg', '.jpeg'],
          'image/png': ['.png'],
          ...(allowedTypes ? { allowedTypes } : {}),
        }}
        className={
          file && uploadStatus.status !== 'error' && uploadStatus.status !== 'idle'
            ? 'hidden'
            : undefined
        }
        compact={compact}
        disabled={uploading}
        maxFileCount={multiple ? undefined : 1}
        maxSize={maxSize}
        multiple={multiple}
        onUpload={handleFileUpload}
        onValueChange={setCurrentFiles}
        value={currentFiles}
      />
      
      {uploadStatus.status === 'success' && (
        <div className="mt-4 flex justify-end">
          <Button onClick={resetUploader}>
            Upload Another Document
          </Button>
        </div>
      )}
    </div>
  )
}