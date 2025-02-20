"use client"

import { FileType, Info, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const guidelines = [
  {
    title: "Supported Formats",
    items: [
      { label: "DICOM (.dcm)", description: "Medical imaging standard format" },
      { label: "NIfTI (.nii)", description: "Neuroimaging format" },
      { label: "JPEG (.jpg)", description: "For general medical images" },
      { label: "PNG (.png)", description: "For high-quality static images" }
    ]
  },
  {
    title: "File Requirements",
    items: [
      { label: "Maximum file size", description: "500 MB per file" },
      { label: "Image resolution", description: "Minimum 1024x1024 pixels" },
      { label: "Metadata", description: "Must include patient information" },
      { label: "Compression", description: "Lossless compression only" }
    ]
  },
  {
    title: "Best Practices",
    items: [
      { label: "File naming", description: "Use descriptive, consistent names" },
      { label: "Patient info", description: "Verify before uploading" },
      { label: "Privacy", description: "Ensure PHI compliance" },
      { label: "Quality check", description: "Review before uploading" }
    ]
  }
]

export function UploadGuidelines() {
  return (
    <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10">
            <Info className="h-5 w-5 text-cyan-400" />
          </div>
          <h2 className="text-xl font-semibold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
            Upload Guidelines
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="space-y-6">
          {guidelines.map((section, index) => (
            <div key={index} className="space-y-3">
              <h3 className="text-lg font-medium text-white/90">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className={cn(
                      "group relative p-3 rounded-xl",
                      "bg-black/20 backdrop-blur-sm",
                      "border border-white/5 hover:border-cyan-500/30",
                      "transition-all duration-300",
                      "hover:bg-black/40",
                      "hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]"
                    )}
                  >
                    {/* Enhanced gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

                    <div className="relative z-10">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-white/90 group-hover:text-white transition-colors duration-300">
                            {item.label}
                          </div>
                          <div className="text-sm text-white/50 group-hover:text-white/70 transition-colors duration-300">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced scanning line effect */}
                    <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover:animate-scan" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Warning note */}
        <div className="mt-6 relative p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400" />
            </div>
            <div className="text-sm text-red-200/70">
              Ensure all uploads comply with HIPAA regulations and patient privacy guidelines. Non-compliant uploads may be automatically rejected.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 