'use client'

import {
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  FileType,
  MoreVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RecentUpload {
  id: string
  name: string
  type: string
  size: number
  uploadedAt: string
  status: 'processing' | 'complete' | 'error'
  patient: string
}

const mockUploads: RecentUpload[] = [
  {
    id: 'u1',
    name: 'brain_scan_001.dcm',
    type: 'DICOM',
    size: 15.4,
    uploadedAt: '2 minutes ago',
    status: 'complete',
    patient: 'Emma Thompson',
  },
  {
    id: 'u2',
    name: 'chest_xray_123.nii',
    type: 'NIfTI',
    size: 8.2,
    uploadedAt: '10 minutes ago',
    status: 'processing',
    patient: 'James Wilson',
  },
  {
    id: 'u3',
    name: 'mri_sequence_456.dcm',
    type: 'DICOM',
    size: 22.7,
    uploadedAt: '1 hour ago',
    status: 'complete',
    patient: 'Sarah Chen',
  },
  {
    id: 'u4',
    name: 'scan_analysis_789.jpg',
    type: 'JPEG',
    size: 3.5,
    uploadedAt: '2 hours ago',
    status: 'error',
    patient: 'Michael Brown',
  },
]

export function RecentUploads() {
  return (
    <div className="space-y-4">
      {mockUploads.map((upload) => (
        <div
          key={upload.id}
          className={cn(
            'group relative rounded-xl p-4',
            'bg-black/20 backdrop-blur-sm',
            'border border-white/5 hover:border-cyan-500/30',
            'transition-all duration-300',
            'hover:translate-x-1 hover:bg-black/40',
            'hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]'
          )}
        >
          {/* Enhanced gradient overlay */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="relative z-10">
            <div className="flex items-start justify-between">
              {/* File info */}
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-2.5 transition-all duration-300 group-hover:border-cyan-500/20 group-hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                    <FileType className="h-5 w-5 text-cyan-400 transition-colors duration-300 group-hover:text-cyan-300" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-3 w-3">
                    {upload.status === 'complete' ? (
                      <CheckCircle className="h-full w-full text-green-400" />
                    ) : upload.status === 'error' ? (
                      <AlertCircle className="h-full w-full text-red-400" />
                    ) : (
                      <div className="h-full w-full animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white/90 transition-colors duration-300 group-hover:text-white">
                      {upload.name}
                    </span>
                    <span className="text-sm text-white/50">{upload.type}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-white/70">
                    <span>Patient: {upload.patient}</span>
                    <span>{upload.size} MB</span>
                  </div>

                  <div className="text-sm text-white/50">
                    Uploaded {upload.uploadedAt}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View file</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download file</p>
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 border-white/10 bg-black/80 backdrop-blur-xl"
                    >
                      <DropdownMenuItem className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white">
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white">
                        Share File
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white">
                        Delete File
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipProvider>
              </div>
            </div>

            {/* Status indicator */}
            {upload.status === 'processing' && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Processing</span>
                  <span className="text-white/50">60%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                </div>
              </div>
            )}

            {/* Enhanced scanning line effect */}
            <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="group-hover:animate-scan absolute -left-full top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
