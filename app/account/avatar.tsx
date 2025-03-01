'use client'

import { AvatarUploader } from '@/components/upload/avatar-uploader'
import React from 'react'

interface AvatarProps {
  uid: string | null
  url: string | null
  size: number
  email: string | null
  onUpload: (url: string) => void
}

export default function Avatar({
  uid,
  url,
  size,
  email,
  onUpload,
}: AvatarProps) {
  // Ensure we have a user ID
  if (!uid) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div
          className="bg-secondary text-secondary-foreground flex items-center justify-center rounded-full"
          style={{ height: size, width: size }}
        >
          {email?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <p className="text-muted-foreground text-sm">
          Log in to update profile picture
        </p>
      </div>
    )
  }

  return (
    <AvatarUploader
      initialUrl={url}
      onError={(error) => console.error('Avatar upload error:', error)}
      onUpload={onUpload}
      size={size}
      userId={uid}
    />
  )
}
