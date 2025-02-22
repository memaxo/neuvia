'use client'

import {
  Calendar,
  Download,
  FileText,
  MoreVertical,
  Share2,
  TrendingUp,
  Eye,
  RefreshCw,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useState, useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Report } from '@/lib/reports.types'
import filterXSS from 'xss'

const statusStyles = {
  completed: {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
  },
  processing: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  failed: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
} as const

const typeIcons = {
  diagnostic: FileText,
  progress: Calendar,
  analytics: TrendingUp,
} as const

interface ReportsListProps {
  reports: Report[]
  onRetry?: (reportId: string) => void
}

export function ReportsList({ reports, onRetry }: ReportsListProps) {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedReport && contentRef.current) {
      const sanitizedHTML = filterXSS(selectedReport.content || '', {
        whiteList: {
          p: ['class'],
          div: ['class'],
          span: ['class'],
          h1: ['class'],
          h2: ['class'],
          h3: ['class'],
          h4: ['class'],
          h5: ['class'],
          h6: ['class'],
          ul: ['class'],
          ol: ['class'],
          li: ['class'],
          a: ['href', 'title', 'target', 'rel'],
          br: [],
          strong: [],
          em: [],
          b: [],
          i: [],
        },
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style', 'xml']
      })
      contentRef.current.innerHTML = sanitizedHTML
    }
  }, [selectedReport])

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="p-6">
          <div className="space-y-4">
            {reports.map((report) => {
              const TypeIcon = typeIcons[report.type]
              return (
                <div
                  key={report.id}
                  className={cn(
                    'group relative rounded-xl p-4',
                    'bg-black/20 backdrop-blur-sm',
                    'border border-white/5 hover:border-cyan-500/30',
                    'transition-all duration-300',
                    'hover:translate-x-1 hover:bg-black/40',
                    'hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]'
                  )}
                >
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  {/* Content wrapper */}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between">
                      {/* Report info */}
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-2.5 transition-all duration-300 group-hover:border-cyan-500/20 group-hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                            <TypeIcon className="size-5 text-cyan-400 transition-colors duration-300 group-hover:text-cyan-300" />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-white/90 transition-colors duration-300 group-hover:text-white">
                              {report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report
                            </span>
                            <span className="text-sm text-white/50">
                              {report.id.slice(0, 8)}
                            </span>
                            <div
                              className={cn(
                                'rounded-full px-2.5 py-1 text-sm font-medium',
                                statusStyles[report.status].bg,
                                statusStyles[report.status].color,
                                statusStyles[report.status].border
                              )}
                            >
                              {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-white/70">
                            <span>Patient ID: {report.patient_id}</span>
                            <span>Symptoms: {report.metadata.patientInfo.symptoms.length}</span>
                          </div>

                          <div className="text-sm text-white/50">
                            Created: {formatDistanceToNow(new Date(report.created_at))} ago
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          {report.status === 'completed' && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                                    onClick={() => setSelectedReport(report)}
                                  >
                                    <Eye className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View report</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                                  >
                                    <Share2 className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Share report</p>
                                </TooltipContent>
                              </Tooltip>
                            </>
                          )}

                          {report.status === 'failed' && onRetry && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                                  onClick={() => onRetry(report.id)}
                                >
                                  <RefreshCw className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Retry report generation</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
                              >
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 border-white/10 bg-black/80 backdrop-blur-xl"
                            >
                              {report.status === 'completed' && (
                                <>
                                  <DropdownMenuItem 
                                    className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white"
                                    onClick={() => setSelectedReport(report)}
                                  >
                                    View Report
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white">
                                    Export as PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white">
                                    Share via Email
                                  </DropdownMenuItem>
                                </>
                              )}
                              {report.status === 'failed' && onRetry && (
                                <DropdownMenuItem 
                                  className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white"
                                  onClick={() => onRetry(report.id)}
                                >
                                  Retry Generation
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TooltipProvider>
                      </div>
                    </div>

                    {report.status === 'failed' && report.error_message && (
                      <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                        Error: {report.error_message}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Report View Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReport?.type.charAt(0).toUpperCase() + selectedReport?.type.slice(1)} Report
            </DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="rounded-lg bg-black/20 p-4">
                <h3 className="mb-2 font-medium text-white/90">Patient Information</h3>
                <div className="space-y-2 text-sm text-white/70">
                  <p>Symptoms: {selectedReport.metadata.patientInfo.symptoms.join(", ")}</p>
                  <p>Medical History: {selectedReport.metadata.patientInfo.medicalHistory}</p>
                  <p>Current Medications: {selectedReport.metadata.patientInfo.currentMedications.join(", ")}</p>
                  <p>Allergies: {selectedReport.metadata.patientInfo.allergies.join(", ")}</p>
                </div>
              </div>

              <div className="prose prose-invert max-w-none" ref={contentRef} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
} 