'use client'

import React from 'react'
import { AvatarUploader } from '@/components/upload/avatar-uploader'

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
          className="flex items-center justify-center rounded-full bg-secondary text-secondary-foreground"
          style={{ height: size, width: size }}
        >
          {email?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <p className="text-sm text-muted-foreground">Log in to update profile picture</p>
      </div>
    )
  }

  return (
    <AvatarUploader
      userId={uid}
      initialUrl={url}
      size={size}
      onUpload={onUpload}
      onError={(error) => console.error('Avatar upload error:', error)}
    />
  )
}
