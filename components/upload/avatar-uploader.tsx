'use client'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Loader, User } from 'lucide-react'
import Image from 'next/image'
import React, { useState, useEffect } from 'react'

import { uploadService } from '@/lib/services/upload-service'

interface AvatarUploaderProps {
  userId: string
  initialUrl?: string | null
  size?: number
  onUpload?: (url: string) => void
  onError?: (error: string) => void
  className?: string
}

export function AvatarUploader({
  userId,
  initialUrl = null,
  size = 80,
  onUpload,
  onError,
  className,
}: AvatarUploaderProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { toast } = useToast()

  // Load initial avatar URL if provided
  useEffect(() => {
    if (initialUrl) {
      setAvatarUrl(initialUrl)
    }
  }, [initialUrl])

  /**
   * Handle avatar file selection and upload
   */
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files || event.target.files.length === 0) return

    const file = event.target.files[0]
    setUploading(true)
    setError(null)

    try {
      // Upload the avatar using the uploadService
      const filePath = await uploadService.uploadAvatar(
        file,
        userId,
        (progress, status) => {
          // Progress handling could be added here
        }
      )

      // Get the avatar URL
      const avatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${filePath}`
      setAvatarUrl(avatarUrl)

      toast({
        title: 'Avatar Updated',
        description: 'Your profile picture has been updated successfully.',
      })

      // Notify parent component
      onUpload?.(filePath)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      setError(errorMessage)

      toast({
        title: 'Upload Error',
        description: errorMessage,
        variant: 'destructive',
      })

      onError?.(errorMessage)
    } finally {
      setUploading(false)

      // Reset the input field so the same file can be selected again
      event.target.value = ''
    }
  }

  return (
    <div className={`flex flex-col items-center gap-4 ${className || ''}`}>
      <div className="relative">
        {avatarUrl ? (
          <Image
            alt="Avatar"
            className="rounded-full object-cover"
            height={size}
            src={avatarUrl}
            style={{ height: size, width: size }}
            width={size}
          />
        ) : (
          <div
            className="bg-secondary text-secondary-foreground flex items-center justify-center rounded-full"
            style={{ height: size, width: size }}
          >
            <User size={size * 0.5} />
          </div>
        )}

        {uploading && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50"
            style={{ height: size, width: size }}
          >
            <Loader className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      <div className="flex items-center gap-2">
        <label
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer rounded-md px-4 py-2 text-sm font-medium"
          htmlFor="avatar-upload"
        >
          {uploading ? 'Uploading...' : 'Change Image'}
        </label>
        <input
          accept="image/*"
          className="sr-only"
          disabled={uploading}
          id="avatar-upload"
          onChange={handleFileChange}
          type="file"
        />
      </div>
    </div>
  )
}
