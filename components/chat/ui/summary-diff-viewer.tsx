'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { DiffView } from '../editor/diffview'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

interface SummaryVersion {
  id: string
  content: string
  timestamp: string
}

interface SummaryDiffViewerProps {
  isOpen: boolean
  onClose: () => void
  versions: SummaryVersion[]
  currentVersionId?: string
}

export function SummaryDiffViewer({
  isOpen,
  onClose,
  versions,
  currentVersionId,
}: SummaryDiffViewerProps) {
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(0)
  const [comparisonVersionIndex, setComparisonVersionIndex] =
    useState<number>(1)

  // Find the index of the current version when the component mounts or versions change
  useEffect(() => {
    if (currentVersionId && versions.length > 0) {
      const index = versions.findIndex((v) => v.id === currentVersionId)
      if (index !== -1) {
        setSelectedVersionIndex(index)
        setComparisonVersionIndex(Math.min(index + 1, versions.length - 1))
      }
    }
  }, [currentVersionId, versions])

  // Handle edge case where we don't have enough versions
  if (versions.length < 2) {
    return null
  }

  const selectedVersion = versions[selectedVersionIndex]
  const comparisonVersion = versions[comparisonVersionIndex]

  // Format the timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (e) {
      return timestamp
    }
  }

  // Navigate to previous version pair
  const handlePrevious = () => {
    if (comparisonVersionIndex > 1) {
      setComparisonVersionIndex(comparisonVersionIndex - 1)
      setSelectedVersionIndex(comparisonVersionIndex - 2)
    } else if (selectedVersionIndex > 0) {
      setSelectedVersionIndex(selectedVersionIndex - 1)
    }
  }

  // Navigate to next version pair
  const handleNext = () => {
    if (selectedVersionIndex < versions.length - 2) {
      setSelectedVersionIndex(selectedVersionIndex + 1)
      setComparisonVersionIndex(selectedVersionIndex + 2)
    } else if (comparisonVersionIndex < versions.length - 1) {
      setComparisonVersionIndex(comparisonVersionIndex + 1)
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={isOpen}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Summary Version History</DialogTitle>
          <DialogDescription>
            Comparing changes between versions
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex items-center justify-between">
          <div className="text-muted-foreground flex-1 text-sm">
            Version {selectedVersionIndex + 1}:{' '}
            {formatTimestamp(selectedVersion.timestamp)}
          </div>

          <div className="flex gap-2">
            <Button
              disabled={selectedVersionIndex === 0}
              onClick={handlePrevious}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="mr-1 size-4" />
              Previous
            </Button>

            <Button
              disabled={comparisonVersionIndex === versions.length - 1}
              onClick={handleNext}
              size="sm"
              variant="outline"
            >
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>

          <div className="text-muted-foreground flex-1 text-right text-sm">
            Version {comparisonVersionIndex + 1}:{' '}
            {formatTimestamp(comparisonVersion.timestamp)}
          </div>
        </div>

        <div className="bg-muted/10 rounded-md border p-4">
          <DiffView
            newContent={comparisonVersion.content}
            oldContent={selectedVersion.content}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
