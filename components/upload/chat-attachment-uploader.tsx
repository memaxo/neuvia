'use client'

import { FileUploader } from '@/components/file-uploader'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { File, FileText, Image as ImageIcon, Paperclip, X } from 'lucide-react'
import React, { useState } from 'react'

import { uploadService } from '@/lib/services/upload-service'
import type { FileUpload } from '@/lib/types/upload'

interface ChatAttachmentUploaderProps {
  chatId: string
  messageId?: string
  onAttach?: (fileUploads: FileUpload[]) => void
  onError?: (error: string) => void
  multiple?: boolean
  maxCount?: number
  disabled?: boolean
  className?: string
  showPreview?: boolean
}

export function ChatAttachmentUploader({
  chatId,
  messageId,
  onAttach,
  onError,
  multiple = true,
  maxCount = 5,
  disabled = false,
  className,
  showPreview = true,
}: ChatAttachmentUploaderProps) {
  const [attachments, setAttachments] = useState<FileUpload[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [currentFiles, setCurrentFiles] = useState<File[]>([])

  const { toast } = useToast()

  /**
   * Handle file attachment and upload
   */
  const handleFileUpload = async (
    files: File[],
    progressCallback: (progress: number, file: File) => void
  ) => {
    if (files.length === 0) return

    // Initialize progress tracking for each file
    const initialProgress: Record<string, number> = {}
    files.forEach((file) => {
      initialProgress[file.name] = 0
    })
    setProgress(initialProgress)

    setUploading(true)
    const uploadResults: FileUpload[] = []
    const errors: string[] = []

    // Process each file
    for (const file of files) {
      try {
        // Upload the file
        const result = await uploadService.uploadChatAttachment(
          file,
          chatId,
          messageId,
          (progress, status) => {
            // Update progress tracking
            setProgress((prev) => ({
              ...prev,
              [file.name]: progress,
            }))

            // Update the progress callback for the FileUploader
            progressCallback(progress, file)
          }
        )

        // Add to results
        uploadResults.push(result)
      } catch (error) {
        // Track errors
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        errors.push(`${file.name}: ${errorMessage}`)

        // Notify via toast
        toast({
          title: 'Upload Error',
          description: `Failed to upload ${file.name}: ${errorMessage}`,
          variant: 'destructive',
        })
      }
    }

    setUploading(false)

    // Update attachments
    if (uploadResults.length > 0) {
      const newAttachments = [...attachments, ...uploadResults]
      setAttachments(newAttachments)

      // Notify parent component
      onAttach?.(newAttachments)

      // Show success toast
      toast({
        title: 'Files Attached',
        description: `${uploadResults.length} file(s) attached successfully.`,
      })
    }

    // Handle any errors
    if (errors.length > 0) {
      const errorMessage = errors.join('; ')
      onError?.(errorMessage)
    }
  }

  /**
   * Remove an attachment from the list
   */
  const removeAttachment = (index: number) => {
    const newAttachments = [...attachments]
    newAttachments.splice(index, 1)
    setAttachments(newAttachments)

    // Notify parent component
    onAttach?.(newAttachments)
  }

  /**
   * Get appropriate icon for file type
   */
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="size-4" />
    } else if (
      fileType === 'application/pdf' ||
      fileType.includes('document')
    ) {
      return <FileText className="size-4" />
    } else {
      return <File className="size-4" />
    }
  }

  /**
   * Render attachment previews
   */
  const renderAttachmentPreviews = () => {
    if (!showPreview || attachments.length === 0) return null

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.map((attachment, index) => (
          <div
            className="bg-card flex items-center rounded border px-3 py-1"
            key={attachment.id}
          >
            <span className="flex items-center gap-1">
              {getFileIcon(attachment.contentType)}
              <span className="text-sm">
                {attachment.metadata.originalFilename}
              </span>
            </span>
            <Button
              className="ml-2 size-5 p-0"
              onClick={() => removeAttachment(index)}
              size="sm"
              variant="ghost"
            >
              <X className="size-3" />
              <span className="sr-only">Remove</span>
            </Button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={className}>
      {renderAttachmentPreviews()}

      <FileUploader
        accept={{
          'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
          'application/pdf': ['.pdf'],
          'text/plain': ['.txt'],
          'application/json': ['.json'],
        }}
        disabled={
          disabled ||
          uploading ||
          (maxCount > 0 && attachments.length >= maxCount)
        }
        maxFileCount={maxCount}
        multiple={multiple}
        onUpload={handleFileUpload}
        onValueChange={setCurrentFiles}
        progresses={progress}
        value={currentFiles}
      />
    </div>
  )
}
