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
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt"
      />
      <Button
        onClick={handleUploadClick}
        variant="outline"
        size="sm"
        disabled={disabled || isUploading}
        className="text-xs"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <UploadIcon className="mr-2 h-3 w-3" />
            Upload
          </>
        )}
      </Button>
      <span className="text-xs text-muted-foreground">PDF, DOC, DOCX, TXT</span>
    </div>
  )
}
