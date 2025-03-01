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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Summary Version History</DialogTitle>
          <DialogDescription>
            Comparing changes between versions
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 text-sm text-muted-foreground">
            Version {selectedVersionIndex + 1}:{' '}
            {formatTimestamp(selectedVersion.timestamp)}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={selectedVersionIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={comparisonVersionIndex === versions.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="flex-1 text-right text-sm text-muted-foreground">
            Version {comparisonVersionIndex + 1}:{' '}
            {formatTimestamp(comparisonVersion.timestamp)}
          </div>
        </div>

        <div className="border rounded-md p-4 bg-muted/10">
          <DiffView
            oldContent={selectedVersion.content}
            newContent={comparisonVersion.content}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
