'use client'

import { useState, useCallback } from 'react'
import { 
  FileType, Upload, X, StopCircle, Files, PlayCircle, PauseCircle, RefreshCw, Trash2,
  FileText, Image, FileImage, File, FilePdf, FileJson, FileCode
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StorageService, type FileUpload, type DocumentType, type UploadMetadata } from '../lib/storage-service'

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
    icon: FilePdf
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
  'application/pdf': FilePdf,
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
  'application/json': FileJson
}

// Maximum concurrent uploads
const MAX_CONCURRENT_UPLOADS = 3

interface UploadZoneProps {
  metadata?: UploadMetadata
  documentType?: DocumentType
  onUploadComplete?: (upload: FileUpload) => void
  onUploadError?: (error: Error) => void
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

export function UploadZone({ 
  metadata,
  documentType = 'document',
  onUploadComplete,
  onUploadError
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [uploadQueue, setUploadQueue] = useState<File[]>([])
  const storageService = new StorageService()

  const typeInfo = DOCUMENT_TYPE_INFO[documentType]

  // Process upload queue
  const processQueue = useCallback(async () => {
    const activeUploads = uploads.filter(u => u.status === 'uploading').length
    const availableSlots = MAX_CONCURRENT_UPLOADS - activeUploads

    if (availableSlots > 0 && uploadQueue.length > 0) {
      const filesToUpload = uploadQueue.slice(0, availableSlots)
      setUploadQueue(prev => prev.slice(availableSlots))
      await handleFiles(filesToUpload)
    }
  }, [uploads, uploadQueue])

  // Calculate total progress
  const totalProgress = uploads.length > 0
    ? Math.round(
        uploads.reduce((sum, upload) => sum + upload.progress, 0) / uploads.length
      )
    : 0

  // Count uploads by status
  const uploadCounts = uploads.reduce(
    (acc, upload) => ({
      ...acc,
      [upload.status]: (acc[upload.status] || 0) + 1
    }),
    {} as Record<FileUpload['status'], number>
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleFiles = async (files: File[]) => {
    // Add files to uploads with initial state
    const newUploads = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'preparing' as const,
      statusMessage: 'Preparing upload...',
      mimeType: file.type
    }))
    setUploads((prev) => [...prev, ...newUploads])

    // Upload each file
    for (const [index, file] of files.entries()) {
      try {
        const result = await storageService.uploadFile(
          file,
          {
            ...metadata,
            documentType
          },
          (progress, status) => {
            // Update progress and status for this specific file
            setUploads((prev) =>
              prev.map((upload) =>
                upload.id === newUploads[index].id
                  ? { 
                      ...upload, 
                      progress,
                      statusMessage: status,
                      status: progress === 100 ? 'complete' : 'uploading'
                    }
                  : upload
              )
            )
          },
          newUploads[index].id
        )

        // Update upload with result
        setUploads((prev) =>
          prev.map((upload) =>
            upload.id === newUploads[index].id ? result : upload
          )
        )

        if (result.status === 'complete') {
          onUploadComplete?.(result)
        } else if (result.status === 'error') {
          onUploadError?.(new Error(result.error))
        }
      } catch (error) {
        console.error('Upload error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        setUploads((prev) =>
          prev.map((upload) =>
            upload.id === newUploads[index].id
              ? {
                  ...upload,
                  progress: 0,
                  status: error.message === 'Upload cancelled' ? 'cancelled' : 'error' as const,
                  statusMessage: errorMessage,
                  error: errorMessage
                }
              : upload
          )
        )
        onUploadError?.(error instanceof Error ? error : new Error(errorMessage))
      }
    }
  }

  const cancelUpload = (upload: FileUpload) => {
    storageService.cancelUpload(upload.id)
  }

  const removeUpload = async (upload: FileUpload) => {
    try {
      if (upload.path) {
        await storageService.deleteFile(upload.path)
      }
      setUploads((prev) => prev.filter((u) => u.id !== upload.id))
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const handleRetry = async (upload: FileUpload) => {
    if (!upload.file) return // Need original file to retry
    
    const newUpload = {
      ...upload,
      progress: 0,
      status: 'preparing' as const,
      statusMessage: 'Preparing upload...',
      error: undefined
    }
    
    setUploads((prev) =>
      prev.map((u) => (u.id === upload.id ? newUpload : u))
    )

    try {
      const result = await storageService.uploadFile(
        upload.file,
        {
          ...metadata,
          documentType
        },
        (progress, status, speed, timeRemaining) => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === upload.id
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
          )
        },
        upload.id
      )

      setUploads((prev) =>
        prev.map((u) => (u.id === upload.id ? result : u))
      )

      if (result.status === 'complete') {
        onUploadComplete?.(result)
      }
    } catch (error) {
      console.error('Retry error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Retry failed'
      setUploads((prev) =>
        prev.map((u) =>
          u.id === upload.id
            ? {
                ...u,
                progress: 0,
                status: 'error',
                statusMessage: errorMessage,
                error: errorMessage
              }
            : u
        )
      )
      onUploadError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }

  const handlePauseResume = async (upload: FileUpload) => {
    if (upload.status === 'uploading') {
      storageService.pauseUpload(upload.id, upload.file!, metadata, upload.progress)
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
            setUploads((prev) =>
              prev.map((u) =>
                u.id === upload.id
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
            )
          }
        )

        setUploads((prev) =>
          prev.map((u) => (u.id === upload.id ? result : u))
        )
      } catch (error) {
        console.error('Resume error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Resume failed'
        setUploads((prev) =>
          prev.map((u) =>
            u.id === upload.id
              ? {
                  ...u,
                  status: 'error',
                  statusMessage: errorMessage,
                  error: errorMessage
                }
              : u
          )
        )
      }
    }
  }

  const clearCompleted = () => {
    setUploads((prev) =>
      prev.filter((u) => !['complete', 'error', 'cancelled'].includes(u.status))
    )
  }

  // Batch actions
  const pauseAllUploads = () => {
    uploads.forEach(upload => {
      if (upload.status === 'uploading') {
        handlePauseResume(upload)
      }
    })
  }

  const resumeAllUploads = async () => {
    for (const upload of uploads) {
      if (upload.status === 'paused') {
        await handlePauseResume(upload)
      }
    }
    processQueue()
  }

  const cancelAllUploads = () => {
    uploads.forEach(upload => {
      if (upload.status === 'uploading' || upload.status === 'paused') {
        cancelUpload(upload)
      }
    })
    setUploadQueue([])
  }

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'group relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300',
          isDragging
            ? 'border-cyan-500/50 bg-cyan-500/5'
            : 'border-white/10 bg-black/20 hover:border-cyan-500/30'
        )}
      >
        {/* Enhanced gradient overlay */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="relative z-10">
          <div className="mb-4">
            <div className="mx-auto h-16 w-16 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-4 transition-all duration-300 group-hover:border-cyan-500/20 group-hover:shadow-[0_0_30px_rgba(0,255,255,0.2)]">
              <Upload className="h-full w-full text-cyan-400 transition-colors duration-300 group-hover:text-cyan-300" />
            </div>
          </div>

          <h3 className="mb-2 text-lg font-medium text-white/90">
            Drop {typeInfo.label.toLowerCase()} to upload
          </h3>
          <p className="mb-4 text-sm text-white/70">
            or click to browse from your computer
          </p>

          <Button
            onClick={() => document.getElementById('file-upload')?.click()}
            className="group/btn relative overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transition-all duration-300 hover:from-cyan-600 hover:to-blue-600 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]"
          >
            <FileType className="mr-2 h-4 w-4" />
            Select Files
            <div className="absolute inset-0 overflow-hidden">
              <div className="group-hover/btn:animate-scan absolute -left-full top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
          </Button>

          <input
            id="file-upload"
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept={typeInfo.accept}
          />

          <p className="mt-4 text-sm text-white/50">
            Supported formats: {typeInfo.description}
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="space-y-4">
          {/* Total Progress */}
          <div className="rounded-lg border border-white/5 bg-black/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Files className="h-5 w-5 text-blue-400" />
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
                {uploads.some(u => u.status === 'uploading') && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                          onClick={pauseAllUploads}
                        >
                          <PauseCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Pause all uploads</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {uploads.some(u => u.status === 'paused') && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                          onClick={resumeAllUploads}
                        >
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Resume all uploads</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {(uploads.some(u => u.status === 'uploading' || u.status === 'paused')) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                          onClick={cancelAllUploads}
                        >
                          <StopCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cancel all uploads</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {(uploadCounts.complete || uploadCounts.error || uploadCounts.cancelled) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                          onClick={clearCompleted}
                        >
                          <Trash2 className="h-4 w-4" />
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
              {uploadCounts.uploading && (
                <span className="text-cyan-400">
                  {uploadCounts.uploading} uploading
                </span>
              )}
              {uploadCounts.processing && (
                <span className="text-purple-400">
                  {uploadCounts.processing} processing
                </span>
              )}
              {uploadCounts.error && (
                <span className="text-red-400">
                  {uploadCounts.error} failed
                </span>
              )}
              {uploadCounts.cancelled && (
                <span className="text-yellow-400">
                  {uploadCounts.cancelled} cancelled
                </span>
              )}
            </div>
          </div>

          {/* Individual Uploads */}
          <div className="space-y-3">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="group relative rounded-xl border border-white/5 bg-black/20 p-4 transition-all duration-300 hover:border-cyan-500/30 hover:bg-black/40"
              >
                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-500/10 p-2">
                        {(() => {
                          const Icon = upload.mimeType 
                            ? FILE_TYPE_ICONS[upload.mimeType] || typeInfo.icon
                            : typeInfo.icon
                          return <Icon className="h-4 w-4 text-blue-400" />
                        })()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/90">
                          {upload.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                          <span>{formatBytes(upload.size)}</span>
                          {upload.speed && upload.status === 'uploading' && (
                            <>
                              <span>•</span>
                              <span>{formatBytes(upload.speed)}/s</span>
                            </>
                          )}
                          {upload.timeRemaining && upload.status === 'uploading' && (
                            <>
                              <span>•</span>
                              <span>{formatTime(upload.timeRemaining)} remaining</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(upload.status === 'error' || upload.status === 'cancelled') && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                                onClick={() => handleRetry(upload)}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Retry upload</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {(upload.status === 'uploading' || upload.status === 'paused') && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                                onClick={() => handlePauseResume(upload)}
                              >
                                {upload.status === 'uploading' ? (
                                  <PauseCircle className="h-4 w-4" />
                                ) : (
                                  <PlayCircle className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {upload.status === 'uploading' ? 'Pause' : 'Resume'} upload
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {upload.status === 'uploading' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                                onClick={() => cancelUpload(upload)}
                              >
                                <StopCircle className="h-4 w-4" />
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                              onClick={() => removeUpload(upload)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Remove file</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        upload.status === 'complete'
                          ? 'bg-gradient-to-r from-green-500 to-green-600'
                          : upload.status === 'error'
                            ? 'bg-gradient-to-r from-red-500 to-red-600'
                            : upload.status === 'cancelled'
                              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                              : upload.status === 'processing'
                                ? 'bg-gradient-to-r from-purple-500 to-purple-600'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                      )}
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>

                  {/* Status and Error Message */}
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span
                      className={cn(
                        upload.status === 'complete'
                          ? 'text-green-400'
                          : upload.status === 'error'
                            ? 'text-red-400'
                            : upload.status === 'cancelled'
                              ? 'text-yellow-400'
                              : upload.status === 'processing'
                                ? 'text-purple-400'
                                : 'text-white/50'
                      )}
                    >
                      {upload.statusMessage || upload.status}
                    </span>
                    <span className="text-white/50">{upload.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
