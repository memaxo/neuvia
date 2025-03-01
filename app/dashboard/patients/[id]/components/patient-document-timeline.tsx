'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileCheck,
  FileText,
  Filter,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface PatientDocument {
  id: string
  title: string
  category: string
  document_type: any
  file_type: string
  document_date: string
  processing_status: string
  is_processed: boolean
  created_at: string
  key_findings?: any
}

interface PatientDocumentTimelineProps {
  patientId: string
  documents: PatientDocument[]
}

interface TimelineEntry {
  date: Date
  documents: PatientDocument[]
}

export function PatientDocumentTimeline({
  patientId,
  documents = [],
}: PatientDocumentTimelineProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  )
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])

  // Extract all unique categories and statuses for filters
  const allCategories = Array.from(
    new Set(documents.map((doc) => doc.category || 'other'))
  )
  const allStatuses = Array.from(
    new Set(documents.map((doc) => doc.processing_status))
  )

  // Apply filters
  const filteredDocuments = documents.filter((doc) => {
    // If no categories selected, show all, otherwise filter by selected categories
    const categoryMatch =
      selectedCategories.length === 0 ||
      selectedCategories.includes(doc.category || 'other')

    // If no statuses selected, show all, otherwise filter by selected statuses
    const statusMatch =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(doc.processing_status)

    return categoryMatch && statusMatch
  })

  // Group documents by date (year-month for month view, year for year view)
  const groupedDocuments = filteredDocuments.reduce(
    (acc, doc) => {
      if (!doc.document_date) return acc

      const docDate = new Date(doc.document_date)
      const groupKey =
        viewMode === 'month'
          ? `${docDate.getFullYear()}-${docDate.getMonth() + 1}`
          : `${docDate.getFullYear()}`

      if (!acc[groupKey]) {
        acc[groupKey] = {
          date: docDate,
          documents: [],
        }
      }

      acc[groupKey].documents.push(doc)
      return acc
    },
    {} as Record<string, TimelineEntry>
  )

  // Convert to array and sort by date (newest first)
  const timelineEntries = Object.values(groupedDocuments).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }))
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <FileCheck className="size-4 text-green-500" />
      case 'processing':
        return <Clock className="size-4 text-yellow-500" />
      case 'pending':
        return <Clock className="size-4 text-blue-500" />
      case 'error':
        return <AlertCircle className="size-4 text-red-500" />
      default:
        return <FileText className="size-4 text-gray-500" />
    }
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">No documents uploaded yet</p>
        <Button asChild>
          <Link href={`/dashboard/patients/${patientId}/documents/upload`}>
            Upload First Document
          </Link>
        </Button>
      </div>
    )
  }

  if (filteredDocuments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No documents match your filters</p>
        <Button
          className="mt-4"
          onClick={() => {
            setSelectedCategories([])
            setSelectedStatuses([])
          }}
          size="sm"
          variant="outline"
        >
          Clear Filters
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select
            onValueChange={(value) => setViewMode(value as 'month' | 'year')}
            value={viewMode}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="View mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month View</SelectItem>
              <SelectItem value="year">Year View</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="flex items-center gap-1"
                size="sm"
                variant="outline"
              >
                <Filter className="size-4" />
                Filters
                {(selectedCategories.length > 0 ||
                  selectedStatuses.length > 0) && (
                  <Badge className="ml-1" variant="secondary">
                    {selectedCategories.length + selectedStatuses.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Categories</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {allCategories.map((category) => (
                      <div
                        className="flex items-center space-x-2"
                        key={category}
                      >
                        <Checkbox
                          checked={selectedCategories.includes(category)}
                          id={`category-${category}`}
                          onCheckedChange={() => toggleCategory(category)}
                        />
                        <Label
                          className="capitalize"
                          htmlFor={`category-${category}`}
                        >
                          {category}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Status</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {allStatuses.map((status) => (
                      <div className="flex items-center space-x-2" key={status}>
                        <Checkbox
                          checked={selectedStatuses.includes(status)}
                          id={`status-${status}`}
                          onCheckedChange={() => toggleStatus(status)}
                        />
                        <Label
                          className="capitalize"
                          htmlFor={`status-${status}`}
                        >
                          {status}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setSelectedCategories([])
                    setSelectedStatuses([])
                  }}
                  size="sm"
                  variant="outline"
                >
                  Clear All Filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="text-muted-foreground text-sm">
          {filteredDocuments.length}{' '}
          {filteredDocuments.length === 1 ? 'document' : 'documents'} found
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {timelineEntries.length > 0 ? (
          timelineEntries.map((entry, index) => {
            const dateLabel =
              viewMode === 'month'
                ? format(entry.date, 'MMMM yyyy')
                : format(entry.date, 'yyyy')

            const groupKey =
              viewMode === 'month'
                ? `${entry.date.getFullYear()}-${entry.date.getMonth() + 1}`
                : `${entry.date.getFullYear()}`

            const isExpanded = expandedGroups[groupKey] !== false // Default to expanded

            return (
              <div className="rounded-md border" key={index}>
                <div
                  className="bg-muted/50 flex cursor-pointer items-center justify-between px-4 py-3"
                  onClick={() => toggleGroup(groupKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleGroup(groupKey)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4" />
                    <h3 className="font-medium">{dateLabel}</h3>
                    <Badge className="ml-2" variant="outline">
                      {entry.documents.length}
                    </Badge>
                  </div>
                  <Button size="sm" variant="ghost">
                    {isExpanded ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="p-4">
                    <div className="ml-2 space-y-6">
                      {entry.documents.map((doc, docIndex) => (
                        <div className="relative ml-6" key={doc.id}>
                          {/* Timeline connector lines */}
                          {docIndex < entry.documents.length - 1 && (
                            <div className="bg-border absolute bottom-0 left-0 top-8 w-px -translate-x-[17px]" />
                          )}
                          <div className="border-background bg-muted absolute left-0 top-1.5 size-5 -translate-x-[20px] rounded-full border" />

                          <div className="bg-card rounded-lg border p-4 shadow-sm">
                            <div className="mb-2 flex items-center justify-between">
                              <h4 className="font-medium">{doc.title}</h4>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    {getStatusIcon(doc.processing_status)}
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="capitalize">
                                      {doc.processing_status}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>

                            <div className="text-muted-foreground mb-3 text-sm">
                              <div className="flex items-center gap-1">
                                <Calendar className="size-3" />
                                {doc.document_date &&
                                  format(
                                    new Date(doc.document_date),
                                    'MMM d, yyyy'
                                  )}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge className="capitalize" variant="outline">
                                  {doc.category || 'Other'}
                                </Badge>
                                <Badge
                                  className="capitalize"
                                  variant="secondary"
                                >
                                  {doc.document_type?.type || 'Unknown'}
                                </Badge>
                              </div>
                            </div>

                            {doc.key_findings && (
                              <div className="mb-3 text-sm">
                                <p className="font-medium">Key Findings</p>
                                <p className="text-muted-foreground line-clamp-2">
                                  {typeof doc.key_findings === 'string'
                                    ? doc.key_findings
                                    : JSON.stringify(doc.key_findings)}
                                </p>
                              </div>
                            )}

                            <div className="text-right">
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`/dashboard/patients/${patientId}/documents/${doc.id}`}
                                >
                                  <Eye className="mr-2 size-4" />
                                  View
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">
              No documents match the selected filters
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
