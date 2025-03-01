'use client'

import { Button } from '@/components/ui/button'
import { Loader2, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

interface DocumentUploaderProps {
  onUpload: (file: File) => Promise<void>
  disabled?: boolean
}

export function DocumentUploader({
  onUpload,
  disabled = false,
}: DocumentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset the input value to allow uploading the same file again
    e.target.value = ''

    try {
      setIsUploading(true)
      await onUpload(file)
      toast.success('Document uploaded successfully')
    } catch (error) {
      console.error('Error uploading document:', error)
      toast.error('Failed to upload document')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      <Button
        className="text-xs"
        disabled={disabled || isUploading}
        onClick={handleUploadClick}
        size="sm"
        variant="outline"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 size-3 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <UploadIcon className="mr-2 size-3" />
            Upload
          </>
        )}
      </Button>
      <span className="text-muted-foreground text-xs">PDF, DOC, DOCX, TXT</span>
    </div>
  )
}
