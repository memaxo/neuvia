'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

type AvatarError = {
  message: string
  code?: string
}

export default function Avatar({
  uid,
  url,
  size,
  onUpload,
}: {
  uid: string | null
  url: string | null
  size: number
  onUpload: (url: string) => void
}) {
  const supabase = createClient()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(url)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<AvatarError | null>(null)

  useEffect(() => {
    async function downloadImage(path: string) {
      try {
        setError(null)
        const { data, error } = await supabase.storage
          .from('avatars')
          .download(path)
        if (error) {
          throw error
        }

        const url = URL.createObjectURL(data)
        setAvatarUrl(url)
      } catch (error) {
        console.error('Error downloading image:', error)
        setError({ message: 'Failed to load avatar image' })
        toast.error('Failed to load avatar image')
      }
    }

    if (url) downloadImage(url)
  }, [url, supabase])

  const uploadAvatar: React.ChangeEventHandler<HTMLInputElement> = async (
    event
  ) => {
    try {
      setUploading(true)
      setError(null)

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.')
      }

      const file = event.target.files[0]
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file.')
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size should be less than 5MB.')
      }

      const fileExt = file.name.split('.').pop()
      const filePath = `${uid}-${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        throw uploadError
      }

      onUpload(filePath)
      toast.success('Avatar uploaded successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload avatar'
      setError({ message })
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {avatarUrl ? (
          <Image
            width={size}
            height={size}
            src={avatarUrl}
            alt="Avatar"
            className="rounded-full object-cover"
            style={{ height: size, width: size }}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            style={{ height: size, width: size }}
          >
            {user?.email?.charAt(0).toUpperCase() ?? '?'}
          </div>
        )}
        {uploading && (
          <div 
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50"
            style={{ height: size, width: size }}
          >
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive">
          {error.message}
        </div>
      )}

      <div className="flex items-center gap-2">
        <label
          htmlFor="single"
          className="cursor-pointer rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          {uploading ? 'Uploading...' : 'Upload Image'}
        </label>
        <input
          style={{
            visibility: 'hidden',
            position: 'absolute',
          }}
          type="file"
          id="single"
          accept="image/*"
          onChange={uploadAvatar}
          disabled={uploading}
        />
      </div>
    </div>
  )
}
