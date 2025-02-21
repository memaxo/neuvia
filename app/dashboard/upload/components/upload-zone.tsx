'use client'

import { useState } from 'react'
import { FileType, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FileUpload {
  id: string
  name: string
  size: number
  progress: number
  status: 'uploading' | 'complete' | 'error'
}

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<FileUpload[]>([])

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
    // Handle file drop
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleFiles = (files: File[]) => {
    const newUploads = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading' as const,
    }))
    setUploads((prev) => [...prev, ...newUploads])
    // Simulate upload progress
    newUploads.forEach((upload) => {
      simulateUpload(upload.id)
    })
  }

  const simulateUpload = (id: string) => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setUploads((prev) =>
        prev.map((upload) =>
          upload.id === id
            ? {
                ...upload,
                progress,
                status: progress === 100 ? 'complete' : 'uploading',
              }
            : upload
        )
      )
      if (progress === 100) clearInterval(interval)
    }, 500)
  }

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((upload) => upload.id !== id))
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
            Drop files to upload
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
          />

          <p className="mt-4 text-sm text-white/50">
            Supported formats: DICOM, NIfTI, JPEG, PNG
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
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
                      <FileType className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/90">
                        {upload.name}
                      </p>
                      <p className="text-xs text-white/50">
                        {(upload.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                          onClick={() => removeUpload(upload.id)}
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

                {/* Progress bar */}
                <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      upload.status === 'complete'
                        ? 'bg-gradient-to-r from-green-500 to-green-600'
                        : upload.status === 'error'
                          ? 'bg-gradient-to-r from-red-500 to-red-600'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    )}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>

                {/* Status */}
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      upload.status === 'complete'
                        ? 'text-green-400'
                        : upload.status === 'error'
                          ? 'text-red-400'
                          : 'text-white/50'
                    )}
                  >
                    {upload.status === 'complete'
                      ? 'Complete'
                      : upload.status === 'error'
                        ? 'Error'
                        : 'Uploading...'}
                  </span>
                  <span className="text-white/50">{upload.progress}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
