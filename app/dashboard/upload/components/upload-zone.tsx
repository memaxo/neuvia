'use client'

import { 
  FileType, Upload, X, StopCircle, Files, PlayCircle, PauseCircle, RefreshCw, Trash2,
  FileText, Image, FileImage, File, FileCode
} from 'lucide-react'
import React, { useState, useCallback, useEffect, useMemo, memo } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { StorageService, type FileUpload, type DocumentType, type UploadMetadata, type UploadError } from '../lib/storage-service'

// File type icons and labels
const DOCUMENT_TYPE_INFO = {
  'medical-image': {
    label: 'Medical Images',
    accept: '.dcm,.nii,.jpg,.jpeg,.png',
    description: 'DICOM, NIfTI, JPEG, PNG',
    icon: FileImage
  },
  'document': {
    label: 'Documents',
    accept: '.pdf,.docx,.doc,.txt,.md',
    description: 'PDF, Word, Text, Markdown',
    icon: FileText
  },
  'report': {
    label: 'Reports',
    accept: '.pdf,.docx,.doc,.txt,.md',
    description: 'PDF, Word, Text, Markdown',
    icon: FileText
  },
  'other': {
    label: 'Other Files',
    accept: '.pdf,.docx,.doc,.txt,.md,.xml,.json',
    description: 'PDF, Word, Text, XML, JSON',
    icon: File
  }
}

// File type specific icons
const FILE_TYPE_ICONS: Record<string, typeof FileType> = {
  'application/pdf': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'text/plain': FileText,
  'text/markdown': FileText,
  'text/x-markdown': FileText,
  'image/jpeg': Image,
  'image/png': Image,
  'application/dicom': FileImage,
  'application/nii': FileImage,
  'application/nifti': FileImage,
  'application/xml': FileCode,
  'text/xml': FileCode,
  'application/json': FileCode
}

// Maximum concurrent uploads
const MAX_CONCURRENT_UPLOADS = 3

interface UploadZoneProps {
  /** Optional metadata to attach to uploaded files */
  readonly metadata?: UploadMetadata

  /** Type of documents to accept (@default 'document') */
  readonly documentType?: DocumentType

  /** Called when an upload is successfully completed */
  readonly onUploadComplete?: (upload: FileUpload) => void

  /** Called when an upload encounters an error */
  readonly onUploadError?: (error: Error) => void

  /** Called when an upload starts (including retries) */
  readonly onUploadStart?: () => void

  /** Called when upload status changes */
  readonly onStatusChange?: (status: {
    uploading: number
    queued: number
    completed: number
    failed: number
    totalProgress: number
  }) => void
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

// Helper function to format time
function formatTime(seconds: number): string {
  if (!seconds || seconds === Infinity) return '--:--'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const getProgressBarClass = (status: FileUpload['status']): string => {
  switch (status) {
    case 'complete':
      return 'bg-gradient-to-r from-green-500 to-green-600';
    case 'error':
      return 'bg-gradient-to-r from-red-500 to-red-600';
    case 'cancelled':
      return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
    case 'processing':
      return 'bg-gradient-to-r from-purple-500 to-purple-600';
    default:
      return 'bg-gradient-to-r from-cyan-500 to-blue-500';
  }
};

// Helper function to get upload status class
function getUploadStatusClass(status: FileUpload['status']): string {
  if (status === 'complete') return 'text-green-400';
  if (status === 'error') return 'text-red-400';
  if (status === 'cancelled') return 'text-yellow-400';
  if (status === 'processing') return 'text-purple-400';
  return 'text-white/50';
}

// Helper function to get upload error
function getUploadError(error: unknown): UploadError {
  if (error instanceof Error) {
    return { code: 'UNKNOWN', message: error.message, retryable: true };
  }
  if (typeof error === 'object' && error && 'code' in error) {
    return error as UploadError;
  }
  return { code: 'UNKNOWN', message: 'Upload failed', retryable: true };
}

// Helper function to check upload status message
function getStatusMessage(upload: FileUpload): string {
  const message = upload.statusMessage;
  if (message !== null && message !== undefined && message.length > 0) {
    return message;
  }
  return upload.status;
}

// Helper function to check upload conditions
function shouldShowUploadControls(upload: FileUpload): boolean {
  return Boolean(upload.status === 'uploading' || upload.status === 'paused');
}

function shouldShowCancelButton(upload: FileUpload): boolean {
  return Boolean(upload.status === 'uploading');
}

function shouldShowRetryButton(upload: FileUpload): boolean {
  return Boolean(upload.status === 'error' || upload.status === 'cancelled');
}

// Helper function to check batch action conditions
function getBatchActionVisibility(uploads: FileUpload[]): {
  showPause: boolean;
  showResume: boolean;
  showCancel: boolean;
  showClear: boolean;
} {
  return {
    showPause: Boolean(uploads.some(u => u.status === 'uploading')),
    showResume: Boolean(uploads.some(u => u.status === 'paused')),
    showCancel: Boolean(uploads.some(u => u.status === 'uploading' || u.status === 'paused')),
    showClear: Boolean(
      uploads.some(u => ['complete', 'error', 'cancelled'].includes(u.status))
    )
  };
}

// Helper function to check upload conditions
function getUploadConditions(upload: FileUpload): {
  showSpeed: boolean;
  showTime: boolean;
} {
  const hasSpeed = upload.speed !== null && upload.speed !== undefined;
  const hasTime = upload.timeRemaining !== null && upload.timeRemaining !== undefined;
  const isUploading = upload.status === 'uploading';
  
  return {
    showSpeed: Boolean(hasSpeed && isUploading),
    showTime: Boolean(hasTime && isUploading)
  };
}

// Helper function to get status counts
function getStatusCounts(uploadCounts: Record<FileUpload['status'], number>): {
  showUploading: boolean;
  showProcessing: boolean;
  showError: boolean;
  showCancelled: boolean;
} {
  return {
    showUploading: Boolean(uploadCounts.uploading),
    showProcessing: Boolean(uploadCounts.processing),
    showError: Boolean(uploadCounts.error),
    showCancelled: Boolean(uploadCounts.cancelled)
  };
}

// Helper function to handle upload progress updates
function handleUploadProgress(
  uploadId: string,
  setUploads: React.Dispatch<React.SetStateAction<FileUpload[]>>,
  progress: number,
  status: string,
  speed?: number,
  timeRemaining?: number
): void {
  setUploads(prev =>
    prev.map(u =>
      u.id === uploadId
        ? {
            ...u,
            progress,
            statusMessage: status,
            status: progress === 100 ? 'complete' : 'uploading',
            speed,
            timeRemaining
          }
        : u
    )
  );
}

// Helper function to handle upload error state
function handleUploadError(
  uploadId: string,
  setUploads: React.Dispatch<React.SetStateAction<FileUpload[]>>,
  error: unknown,
  file?: File
): void {
  const uploadError = getUploadError(error);
  toast.error(uploadError.message);
  setUploads(prev =>
    prev.map(u =>
      u.id === uploadId
        ? {
            ...u,
            progress: 0,
            status: uploadError.message === 'Upload cancelled' ? 'cancelled' : 'error',
            statusMessage: uploadError.message,
            error: uploadError,
            file
          }
        : u
    )
  );
}

// Helper function to handle upload completion
function handleUploadComplete(
  uploadId: string,
  setUploads: React.Dispatch<React.SetStateAction<FileUpload[]>>,
  result: FileUpload,
  file?: File
): void {
  setUploads(prev =>
    prev.map(u => (u.id === uploadId ? { ...result, file } : u))
  );
}

export function UploadZone({ 
  metadata,
  documentType = 'document',
  onUploadComplete,
  onUploadError,
  onUploadStart,
  onStatusChange
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [uploadQueue, setUploadQueue] = useState<File[]>([])
  const storageService = useMemo(() => new StorageService(), [])

  const typeInfo = DOCUMENT_TYPE_INFO[documentType]

  // Update status whenever uploads change
  useEffect(() => {
    const status = {
      uploading: uploads.filter(u => u.status === 'uploading').length,
      queued: uploadQueue.length,
      completed: uploads.filter(u => u.status === 'complete').length,
      failed: uploads.filter(u => ['error', 'cancelled'].includes(u.status)).length,
      totalProgress: uploads.length > 0
        ? Math.round(
            uploads.reduce((sum, upload) => sum + upload.progress, 0) / uploads.length
          )
        : 0
    }
    onStatusChange?.(status)
  }, [uploads, uploadQueue, onStatusChange])

  const handleFiles = useCallback(async (files: File[]) => {
    const newUploads = files.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'preparing' as const,
      statusMessage: 'Preparing upload...',
      mimeType: file.type,
      file
    }));
    setUploads(prev => [...prev, ...newUploads]);

    for (const [index, file] of files.entries()) {
      try {
        onUploadStart?.();
        const progressHandler = (progress: number, status: string, speed?: number, timeRemaining?: number) => {
          handleUploadProgress(newUploads[index].id, setUploads, progress, status, speed, timeRemaining);
        };
        
        const result = await storageService.uploadFile(
          file,
          { ...metadata, documentType },
          progressHandler,
          newUploads[index].id
        );

        handleUploadComplete(newUploads[index].id, setUploads, result, file);

        if (result.status === 'complete') {
          onUploadComplete?.(result);
        } else if (result.status === 'error' && result.error) {
          handleUploadError(newUploads[index].id, setUploads, result.error, file);
          onUploadError?.(new Error(result.error.message));
        }
      } catch (_error) {
        const uploadError = getUploadError(_error);
        handleUploadError(newUploads[index].id, setUploads, uploadError, file);
        onUploadError?.(new Error(uploadError.message));
      }
    }
  }, [metadata, documentType, onUploadComplete, onUploadError, onUploadStart, storageService]);

  const processQueue = useCallback(async () => {
    const activeUploads = uploads.filter(u => u.status === 'uploading').length
    const availableSlots = MAX_CONCURRENT_UPLOADS - activeUploads
    if (availableSlots > 0 && uploadQueue.length > 0) {
      const filesToUpload = uploadQueue.slice(0, availableSlots)
      setUploadQueue(prev => prev.slice(availableSlots))
      await handleFiles(filesToUpload)
    }
  }, [uploads, uploadQueue, handleFiles])

  // Calculate total progress for UI
  const totalProgress = uploads.length > 0
    ? Math.round(
        uploads.reduce((sum, upload) => sum + upload.progress, 0) / uploads.length
      )
    : 0

  // Count uploads by status for UI
  const uploadCounts = uploads.reduce(
    (acc, upload) => ({
      ...acc,
      [upload.status]: (acc[upload.status] || 0) + 1
    }),
    {} as Record<FileUpload['status'], number>
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    void handleFiles(files)
  }, [handleFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      void handleFiles(files)
    }
  }, [handleFiles])

  const handleBrowseClick = useCallback(() => {
    document.getElementById('file-upload')?.click()
  }, [])

  const cancelUpload = useCallback((upload: FileUpload) => {
    storageService.cancelUpload(upload.id)
  }, [storageService])

  const handlePauseResume = useCallback(async (upload: FileUpload & { file?: File }) => {
    if (upload.status === 'uploading') {
      if (!upload.file) {
        toast.error('Cannot pause upload - original file not available')
        return
      }
      storageService.pauseUpload(upload.id, upload.file, metadata, upload.progress)
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? { ...u, status: 'paused', statusMessage: 'Paused' }
            : u
        )
      )
    } else if (upload.status === 'paused') {
      try {
        const result = await storageService.resumeUpload(
          upload.id,
          (progress, status, speed, timeRemaining) => {
            handleUploadProgress(upload.id, setUploads, progress, status, speed, timeRemaining);
          }
        )

        handleUploadComplete(upload.id, setUploads, result, upload.file);

        if (result.status === 'complete') {
          onUploadComplete?.(result)
        }
      } catch (error) {
        handleUploadError(upload.id, setUploads, error, upload.file);
        onUploadError?.(new Error(getUploadError(error).message))
      }
    }
  }, [metadata, onUploadComplete, onUploadError, storageService])

  const removeUpload = useCallback(async (upload: FileUpload) => {
    try {
      const path = upload.path;
      if (path !== null && path !== undefined && path.length > 0) {
        await storageService.deleteFile(path)
      }
      setUploads(prev => prev.filter(u => u.id !== upload.id))
    } catch (_error) {
      // Error handling removed as it was just logging
    }
  }, [storageService])

  const handleRetry = useCallback(async (upload: FileUpload & { file?: File }) => {
    if (!upload.file) {
      toast.error('Cannot retry upload - original file not available')
      return
    }
    
    onUploadStart?.()
    const newUpload = {
      ...upload,
      progress: 0,
      status: 'preparing' as const,
      statusMessage: 'Preparing upload...',
      error: undefined
    }
    
    setUploads(prev =>
      prev.map(u => (u.id === upload.id ? newUpload : u))
    )

    try {
      const progressHandler = (progress: number, status: string, speed?: number, timeRemaining?: number) => {
        handleUploadProgress(upload.id, setUploads, progress, status, speed, timeRemaining);
      };
      const result = await storageService.uploadFile(
        upload.file,
        { ...metadata, documentType },
        progressHandler,
        upload.id
      )

      handleUploadComplete(upload.id, setUploads, result, upload.file);

      if (result.status === 'complete') {
        onUploadComplete?.(result)
      }
    } catch (_error) {
      const uploadError = getUploadError(_error);
      handleUploadError(upload.id, setUploads, uploadError, upload.file);
      onUploadError?.(new Error(uploadError.message))
    }
  }, [metadata, documentType, onUploadComplete, onUploadError, onUploadStart, storageService])

  const clearCompleted = useCallback(() => {
    setUploads(prev => 
      prev.filter(u => !['complete', 'error', 'cancelled'].includes(u.status))
    )
  }, [])

  // Batch actions
  const pauseAllUploads = useCallback(() => {
    uploads.forEach(upload => {
      if (upload.status === 'uploading') {
        void handlePauseResume(upload)
      }
    })
  }, [uploads, handlePauseResume])

  const resumeAllUploads = useCallback(async () => {
    for (const upload of uploads) {
      if (upload.status === 'paused') {
        await handlePauseResume(upload)
      }
    }
    await processQueue()
  }, [uploads, handlePauseResume, processQueue])

  const handleResumeAllClick = useCallback(() => {
    void resumeAllUploads();
  }, [resumeAllUploads]);

  const cancelAllUploads = useCallback(() => {
    uploads.forEach(upload => {
      if (upload.status === 'uploading' || upload.status === 'paused') {
        cancelUpload(upload)
      }
    })
    setUploadQueue([])
  }, [uploads, cancelUpload])

  // Get batch action visibility and status counts
  const batchActions = getBatchActionVisibility(uploads);
  const statusCounts = getStatusCounts(uploadCounts);

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <button
        className={cn(
          'group relative w-full rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300',
          isDragging
            ? 'border-cyan-500/50 bg-cyan-500/5'
            : 'border-white/10 bg-black/20 hover:border-cyan-500/30'
        )}
        onClick={handleBrowseClick}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        type="button"
      >
        {/* Enhanced gradient overlay */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="relative z-10">
          <div className="mb-4">
            <div className="mx-auto size-16 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-4 transition-all duration-300 group-hover:border-cyan-500/20 group-hover:shadow-[0_0_30px_rgba(0,255,255,0.2)]">
              <Upload className="size-full text-cyan-400 transition-colors duration-300 group-hover:text-cyan-300" />
            </div>
          </div>

          <h3 className="mb-2 text-lg font-medium text-white/90">
            Drop {typeInfo.label.toLowerCase()} to upload
          </h3>
          <p className="mb-4 text-sm text-white/70">
            or click to browse from your computer
          </p>

          <Button
            className="group/btn relative overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transition-all duration-300 hover:from-cyan-600 hover:to-blue-600 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]"
            onClick={handleBrowseClick}
          >
            <FileType className="mr-2 size-4" />
            Select Files
            <div className="absolute inset-0 overflow-hidden">
              <div className="group-hover/btn:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
          </Button>

          <input
            accept={typeInfo.accept}
            className="hidden"
            id="file-upload"
            multiple
            onChange={handleFileSelect}
            type="file"
          />

          <p className="mt-4 text-sm text-white/50">
            Supported formats: {typeInfo.description}
          </p>
        </div>
      </button>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="space-y-4">
          {/* Total Progress */}
          <div className="rounded-lg border border-white/5 bg-black/20 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Files className="size-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white/90">
                    Total Progress
                  </h4>
                  <p className="text-xs text-white/50">
                    {uploads.length} file{uploads.length !== 1 ? 's' : ''}{' '}
                    {uploadQueue.length > 0 && `(${uploadQueue.length} queued)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Batch action buttons */}
                {batchActions.showPause && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                          onClick={pauseAllUploads}
                          size="icon"
                          variant="ghost"
                        >
                          <PauseCircle className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Pause all uploads</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {batchActions.showResume && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                          onClick={handleResumeAllClick}
                          size="icon"
                          variant="ghost"
                        >
                          <PlayCircle className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Resume all uploads</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {batchActions.showCancel && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                          onClick={cancelAllUploads}
                          size="icon"
                          variant="ghost"
                        >
                          <StopCircle className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cancel all uploads</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {batchActions.showClear && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                          onClick={clearCompleted}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Clear completed uploads</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Total progress bar */}
            <div className="h-2 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${totalProgress}%` }}
              />
            </div>

            {/* Status counts */}
            <div className="mt-2 flex gap-3 text-xs">
              {statusCounts.showUploading && (
                <span className="text-cyan-400">
                  {uploadCounts.uploading} uploading
                </span>
              )}
              {statusCounts.showProcessing && (
                <span className="text-purple-400">
                  {uploadCounts.processing} processing
                </span>
              )}
              {statusCounts.showError && (
                <span className="text-red-400">
                  {uploadCounts.error} failed
                </span>
              )}
              {statusCounts.showCancelled && (
                <span className="text-yellow-400">
                  {uploadCounts.cancelled} cancelled
                </span>
              )}
            </div>
          </div>

          {/* Individual Uploads */}
          <div className="space-y-3">
            {uploads.map((upload) => (
              <UploadItem 
                key={upload.id} 
                onCancelUpload={cancelUpload} 
                onPauseResume={handlePauseResume} 
                onRemove={removeUpload} 
                onRetry={handleRetry} 
                typeInfo={typeInfo} 
                upload={upload} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getFileIcon(upload: FileUpload, typeInfo: { icon: React.ComponentType<{ className?: string }> }) {
  const mimeType = upload.mimeType;

  if (mimeType === null || mimeType === undefined || mimeType.length === 0) {
    return typeInfo.icon;
  }

  return FILE_TYPE_ICONS[mimeType] ?? typeInfo.icon;
}

interface UploadItemProps {
  upload: FileUpload & { file?: File };
  typeInfo: { label: string; accept: string; description: string; icon: React.ComponentType<{ className?: string }> };
  onRetry: (upload: FileUpload & { file?: File }) => Promise<void>;
  onPauseResume: (upload: FileUpload & { file?: File }) => Promise<void>;
  onRemove: (upload: FileUpload) => Promise<void>;
  onCancelUpload: (upload: FileUpload) => void;
}

const UploadItem: React.FC<UploadItemProps> = memo(({ upload, typeInfo, onRetry, onPauseResume, onRemove, onCancelUpload }) => {
  const Icon = getFileIcon(upload, typeInfo);
  const progressBarClass = getProgressBarClass(upload.status);
  const statusClass = getUploadStatusClass(upload.status);
  const uploadConditions = getUploadConditions(upload);
  const statusMessage = getStatusMessage(upload);

  const handleRetryClick = useCallback(() => {
    void onRetry(upload);
  }, [onRetry, upload]);

  const handlePauseResumeClick = useCallback(() => {
    void onPauseResume(upload);
  }, [onPauseResume, upload]);

  const handleRemoveClick = useCallback(() => {
    void onRemove(upload);
  }, [onRemove, upload]);

  const handleCancelClick = useCallback(() => {
    onCancelUpload(upload);
  }, [onCancelUpload, upload]);

  const speed = typeof upload.speed === 'number' ? upload.speed : 0;
  const timeRemaining = typeof upload.timeRemaining === 'number' ? upload.timeRemaining : 0;
  const showSpeedInfo = uploadConditions.showSpeed && typeof upload.speed === 'number';
  const showTimeInfo = uploadConditions.showTime && typeof upload.timeRemaining === 'number';

  return (
    <div className="group relative rounded-xl border border-white/5 bg-black/20 p-4 transition-all duration-300 hover:border-cyan-500/30 hover:bg-black/40">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Icon className="size-4 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/90">{upload.name}</p>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span>{formatBytes(upload.size)}</span>
                {showSpeedInfo && (
                  <>
                    <span>•</span>
                    <span>{formatBytes(speed)}/s</span>
                  </>
                )}
                {showTimeInfo && (
                  <>
                    <span>•</span>
                    <span>{formatTime(timeRemaining)} remaining</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {shouldShowRetryButton(upload) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white" onClick={handleRetryClick} size="icon" variant="ghost">
                      <RefreshCw className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Retry upload</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {shouldShowUploadControls(upload) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white" onClick={handlePauseResumeClick} size="icon" variant="ghost">
                      {upload.status === 'uploading' ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{upload.status === 'uploading' ? 'Pause' : 'Resume'} upload</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {shouldShowCancelButton(upload) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white" onClick={handleCancelClick} size="icon" variant="ghost">
                      <StopCircle className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancel upload</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white" onClick={handleRemoveClick} size="icon" variant="ghost">
                    <X className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove file</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
          <div 
            className={cn('h-full rounded-full transition-all duration-300', progressBarClass)}
            style={{ width: `${upload.progress}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className={cn(statusClass)}>
            {statusMessage}
          </span>
          <span className="text-white/50">{upload.progress}%</span>
        </div>
      </div>
    </div>
  );
});

UploadItem.displayName = 'UploadItem';