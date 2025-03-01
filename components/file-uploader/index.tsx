'use client'

import { FileText, Upload, X } from 'lucide-react'
import Image from 'next/image'
import React, { useState, useRef, useCallback, useEffect } from 'react'
import Dropzone from 'react-dropzone'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

/**
 * Consolidated FileUploaderProps
 */
export interface FileUploaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * If passing multiple files
   * @default false
   */
  multiple?: boolean

  /**
   * If specifying the maximum file count
   * @default 1
   */
  maxFileCount?: number

  /**
   * If specifying max file size
   * @default 100 * 1024 * 1024 (100MB)
   */
  maxSize?: number

  /**
   * Accepted file types
   * e.g. { "image/*": [], "application/pdf": [] }
   */
  accept?: Record<string, string[]>

  /**
   * If disabled
   */
  disabled?: boolean

  /**
   * Current array of files
   */
  value?: File[]

  /**
   * Called whenever the file array changes
   */
  onValueChange?: (files: File[]) => void

  /**
   * Called immediately after dropping or browsing.
   * If provided, this is responsible for the actual "upload" logic.
   * The component can show progress in "progresses" or a single numeric "progress".
   */
  onUpload?: (
    files: File[],
    progressCallback: (progress: number, file: File) => void
  ) => Promise<void>

  /**
   * A map of file.name -> progress
   * e.g. { "myFile.pdf": 50 }
   */
  progresses?: Record<string, number>

  /**
   * A single "global" progress if the user only wants to track overall progress
   * This is optional.
   */
  overallProgress?: number

  /**
   * Optional status message
   */
  statusMessage?: string

  /**
   * Label for the top text. Defaults to "Upload Files"
   */
  label?: string

  /**
   * Whether or not to show the big "or click to browse" UI
   * @default true
   */
  showBrowseButton?: boolean
}

/**
 * Consolidated FileUploader component that supports:
 * - Drag & Drop
 * - "Browse" selection
 * - Single or multiple file acceptance
 * - Integration with an onUpload callback that can update progress
 */
export function FileUploader({
  multiple = false,
  maxFileCount = 1,
  maxSize = 100 * 1024 * 1024,
  accept = { '*/*': [] },
  disabled = false,
  value,
  onValueChange,
  onUpload,
  progresses,
  overallProgress,
  statusMessage,
  label = 'Upload Files',
  showBrowseButton = true,
  className,
  ...props
}: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>(value || [])
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync local files with incoming value
  useEffect(() => {
    if (value) {
      setFiles(value)
    }
  }, [value])

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      setDragActive(false)

      if (!multiple && maxFileCount === 1 && acceptedFiles.length > 1) {
        toast.error('Cannot upload more than 1 file at a time')
        return
      }

      const newFiles: File[] = []
      for (const file of acceptedFiles) {
        if (file.size > maxSize) {
          toast.error(
            `${file.name}: File too large (max ${formatBytes(maxSize)})`
          )
          continue
        }
        newFiles.push(file)
      }

      const combined = multiple ? [...files, ...newFiles] : newFiles
      if (combined.length > maxFileCount) {
        toast.error(`Cannot upload more than ${maxFileCount} files`)
        return
      }

      setFiles(combined)
      onValueChange?.(combined)

      if (onUpload && combined.length > 0) {
        void toast.promise(
          onUpload(combined, (progress, file) => {
            // The user can store progress in "progresses" if they'd like
            // We do not forcibly manage it here, we just allow usage
            // E.g. setInternalProgresses or something
          }),
          {
            loading: `Uploading ${combined.length} file(s)...`,
            success: 'Files uploaded successfully',
            error: 'Failed to upload files',
          }
        )
      }
    },
    [multiple, maxFileCount, maxSize, files, onValueChange, onUpload]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      handleDrop(acceptedFiles)
    },
    [handleDrop]
  )

  const onDropRejected = useCallback(() => {
    // We can handle rejections more granularly if needed
    toast.error('File type not accepted or too large.')
  }, [])

  const handleBrowseClick = () => {
    if (inputRef.current) {
      inputRef.current.click()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const selectedFiles = Array.from(e.target.files)
    handleDrop(selectedFiles)
    // reset input
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    onValueChange?.(updated)
  }

  return (
    <div className="space-y-4">
      <Dropzone
        accept={accept}
        disabled={disabled}
        maxSize={maxSize}
        multiple={multiple || maxFileCount > 1}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onDropRejected={onDropRejected}
      >
        {({ getRootProps, getInputProps, isDragActive }) => {
          return (
            <div
              {...getRootProps()}
              className={cn(
                'relative flex h-52 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all',
                isDragActive || dragActive
                  ? 'border-cyan-500/50 bg-cyan-500/5'
                  : 'border-white/10 bg-black/20 hover:border-cyan-500/30',
                disabled && 'pointer-events-none opacity-60',
                className
              )}
              {...props}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-full border border-dashed p-3">
                  <Upload
                    aria-hidden="true"
                    className="size-7 text-[#6B818C]"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground font-medium">
                    Drag &amp; drop files here
                  </p>
                  <p className="text-muted-foreground text-sm">
                    or click to browse
                  </p>
                </div>
              </div>
            </div>
          )
        }}
      </Dropzone>
      {showBrowseButton && (
        <div className="flex justify-center">
          <Button onClick={handleBrowseClick}>Select Files</Button>
          <input
            accept={Object.keys(accept).join(',')}
            className="hidden"
            multiple={multiple || maxFileCount > 1}
            onChange={handleFileSelect}
            ref={inputRef}
            type="file"
          />
        </div>
      )}

      {/* If files are present, show them */}
      {files?.length > 0 && (
        <ScrollArea className="h-fit w-full px-3">
          <div className="flex max-h-48 flex-col gap-4">
            {files.map((file, index) => {
              const fileProgress = progresses?.[file.name] || 0
              return (
                <FileCard
                  file={file}
                  key={index}
                  onRemove={() => removeFile(index)}
                  progress={fileProgress}
                />
              )
            })}
          </div>
        </ScrollArea>
      )}

      {/* If user wants to show overall progress, do so */}
      {typeof overallProgress === 'number' && (
        <div className="mt-2">
          <Progress value={overallProgress} />
          {statusMessage && (
            <p className="text-muted-foreground mt-1 text-sm">
              {statusMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

interface FileCardProps {
  file: File
  progress?: number
  onRemove: () => void
}

function FileCard({ file, progress, onRemove }: FileCardProps) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  return (
    <div className="relative flex items-center gap-2.5">
      <div className="flex flex-1 gap-2.5">
        {preview ? (
          <Image
            alt={file.name}
            className="size-12 shrink-0 rounded-md object-cover"
            height={48}
            src={preview}
            width={48}
          />
        ) : (
          <FileText
            aria-hidden="true"
            className="text-muted-foreground size-12"
          />
        )}
        <div className="flex w-full flex-col gap-2">
          <div className="flex flex-col">
            <p className="text-foreground/80 line-clamp-1 text-sm font-medium">
              {file.name}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatBytes(file.size)}
            </p>
          </div>
          {typeof progress === 'number' && <Progress value={progress} />}
        </div>
      </div>
      <Button
        className="size-7"
        onClick={onRemove}
        size="icon"
        type="button"
        variant="outline"
      >
        <X aria-hidden="true" className="size-4" />
        <span className="sr-only">Remove file</span>
      </Button>
    </div>
  )
}

/**
 * Format bytes helper
 */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
