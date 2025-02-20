"use client"

import { useState } from "react"
import { Upload, FileType, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FileUpload {
  id: string
  name: string
  size: number
  progress: number
  status: "uploading" | "complete" | "error"
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
    const newUploads = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading" as const
    }))
    setUploads(prev => [...prev, ...newUploads])
    // Simulate upload progress
    newUploads.forEach(upload => {
      simulateUpload(upload.id)
    })
  }

  const simulateUpload = (id: string) => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setUploads(prev => 
        prev.map(upload => 
          upload.id === id 
            ? { 
                ...upload, 
                progress,
                status: progress === 100 ? "complete" : "uploading"
              }
            : upload
        )
      )
      if (progress === 100) clearInterval(interval)
    }, 500)
  }

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(upload => upload.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative group border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300",
          isDragging 
            ? "border-cyan-500/50 bg-cyan-500/5" 
            : "border-white/10 hover:border-cyan-500/30 bg-black/20"
        )}
      >
        {/* Enhanced gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

        <div className="relative z-10">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 p-4 group-hover:border-cyan-500/20 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(0,255,255,0.2)]">
              <Upload className="w-full h-full text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300" />
            </div>
          </div>
          
          <h3 className="text-lg font-medium text-white/90 mb-2">
            Drop files to upload
          </h3>
          <p className="text-sm text-white/70 mb-4">
            or click to browse from your computer
          </p>
          
          <Button
            onClick={() => document.getElementById("file-upload")?.click()}
            className="relative overflow-hidden group/btn bg-gradient-to-r from-cyan-500 to-blue-500 
                     hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg
                     hover:shadow-[0_0_30px_rgba(0,255,255,0.3)] transition-all duration-300"
          >
            <FileType className="mr-2 h-4 w-4" />
            Select Files
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent group-hover/btn:animate-scan" />
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
          {uploads.map(upload => (
            <div
              key={upload.id}
              className="relative group p-4 rounded-xl bg-black/20 border border-white/5 
                       hover:border-cyan-500/30 hover:bg-black/40 transition-all duration-300"
            >
              {/* Enhanced gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <FileType className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/90">{upload.name}</p>
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
                          className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white/60 hover:text-white 
                                   transition-all hover:scale-110"
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
                <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      upload.status === "complete"
                        ? "bg-gradient-to-r from-green-500 to-green-600"
                        : upload.status === "error"
                        ? "bg-gradient-to-r from-red-500 to-red-600"
                        : "bg-gradient-to-r from-cyan-500 to-blue-500"
                    )}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>

                {/* Status */}
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className={cn(
                    upload.status === "complete" ? "text-green-400" :
                    upload.status === "error" ? "text-red-400" :
                    "text-white/50"
                  )}>
                    {upload.status === "complete" ? "Complete" :
                     upload.status === "error" ? "Error" :
                     "Uploading..."}
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