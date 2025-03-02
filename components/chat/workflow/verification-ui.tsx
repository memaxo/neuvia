'use client'

import { cn } from '@/lib/utils'
import type { VerificationStatusType } from '@/lib/workflow/types'
import {
  AlertCircle,
  Check,
  CheckCircle,
  Clock,
  Edit,
  History,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import React, { useCallback } from 'react'
import { useChatStore } from '@/stores/chat-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Verification status indicator component
 */
export const VerificationStatus = ({
  status,
  className,
}: {
  status: VerificationStatusType
  className?: string
}) => {
  let statusText = ''
  let Icon = Clock
  let statusColor = ''

  switch (status) {
    case 'pending':
      statusText = 'Pending Verification'
      Icon = Clock
      statusColor =
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      break
    case 'in_progress':
      statusText = 'Verification In Progress'
      Icon = Loader2
      statusColor =
        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      break
    case 'completed':
      statusText = 'Verified'
      Icon = CheckCircle
      statusColor =
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      break
    case 'failed':
      statusText = 'Verification Failed'
      Icon = AlertCircle
      statusColor =
        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      break
  }

  return (
    <Badge
      className={cn(
        'flex items-center gap-1.5 px-2 py-1',
        statusColor,
        className
      )}
      variant="outline"
    >
      <Icon
        className={cn(
          'size-3.5',
          status === 'in_progress' && 'animate-spin'
        )}
      />
      <span>{statusText}</span>
    </Badge>
  )
}

/**
 * Verification action buttons component with Zustand store integration
 */
export const VerificationActions = ({
  onConfirm,
  onEdit,
  onHistory,
  className,
}: {
  onConfirm?: () => void
  onEdit?: () => void
  onHistory?: () => void
  className?: string
}) => {
  // Get actions from Zustand store
  const confirmVerification = useChatStore(state => state.completeVerification)
  const currentSummary = useChatStore(state => state.verification.currentSummary)
  
  // Use provided callbacks or default to store actions
  const handleConfirm = useCallback(() => {
    if (onConfirm) {
      onConfirm()
    } else {
      confirmVerification(true)
    }
  }, [onConfirm, confirmVerification])
  
  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit()
    } else {
      // No default edit action in store, could focus input or similar
      console.log('Edit action - implement in containing component')
    }
  }, [onEdit])
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="border-green-200 bg-green-100 text-green-800 hover:bg-green-200 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-800/50"
            onClick={handleConfirm}
            size="sm"
            variant="outline"
          >
            <CheckCircle className="mr-1 size-4" />
            Confirm
          </Button>
        </TooltipTrigger>
        <TooltipContent>Confirm this summary is correct</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-800/50"
            onClick={handleEdit}
            size="sm"
            variant="outline"
          >
            <Edit className="mr-1 size-4" />
            Edit
          </Button>
        </TooltipTrigger>
        <TooltipContent>Make changes to this summary</TooltipContent>
      </Tooltip>

      {onHistory && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onHistory} size="sm" variant="outline">
              <History className="mr-1 size-4" />
              History
            </Button>
          </TooltipTrigger>
          <TooltipContent>View previous versions</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

/**
 * Section-specific correction buttons component
 */
export const SectionCorrectionButtons = ({
  sectionTitle,
  onCorrect,
  className,
}: {
  sectionTitle: string
  onCorrect: (section: string) => void
  className?: string
}) => {
  return (
    <div
      className={cn(
        'flex gap-1 opacity-0 transition-opacity group-hover:opacity-100',
        className
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="h-6 px-2 text-xs"
            onClick={() => onCorrect(sectionTitle)}
            size="xs"
            variant="ghost"
          >
            <Edit className="mr-1 size-3" />
            Edit Section
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit this section</TooltipContent>
      </Tooltip>
    </div>
  )
}

/**
 * Progress visualization for extraction and verification with Zustand integration
 */
export const ProgressIndicator = ({
  value: propValue,
  phase: propPhase,
  className,
}: {
  value?: number
  phase?: string
  className?: string
}) => {
  // Get progress data from Zustand store if not provided
  const storeProgress = useChatStore(state => state.workflow.processingStatus.progress)
  const storePhase = useChatStore(state => state.workflow.processingStatus.phase)
  
  // Use props if provided, otherwise use store values
  const value = propValue !== undefined ? propValue : storeProgress
  const phase = propPhase || storePhase || 'Processing'
  return (
    <div className={cn('w-full space-y-1', className)}>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>{phase}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <Progress className="h-2" value={value} />
    </div>
  )
}

/**
 * Version indicator component with Zustand integration
 */
export const VersionIndicator = ({
  version: propVersion,
  total: propTotal,
  className,
}: {
  version?: number
  total?: number
  className?: string
}) => {
  // Get version data from Zustand store if not provided
  const summaryVersions = useChatStore(state => state.verification.summaryVersions)
  
  // Use props if provided, otherwise calculate from store
  const total = propTotal !== undefined ? propTotal : summaryVersions.length
  const version = propVersion !== undefined ? propVersion : total
  return (
    <Badge className={cn('text-xs', className)} variant="outline">
      Version {version}/{total}
    </Badge>
  )
}

/**
 * Thumbs up/down voting component for verification sections
 */
export const SectionVoting = ({
  onApprove,
  onReject,
  className,
}: {
  onApprove: () => void
  onReject: () => void
  className?: string
}) => {
  return (
    <div className={cn('flex gap-1', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="size-6 rounded-full p-0 text-green-600"
            onClick={onApprove}
            size="xs"
            variant="ghost"
          >
            <ThumbsUp className="size-3.5" />
            <span className="sr-only">Approve</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Approve this section</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="size-6 rounded-full p-0 text-red-600"
            onClick={onReject}
            size="xs"
            variant="ghost"
          >
            <ThumbsDown className="size-3.5" />
            <span className="sr-only">Reject</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reject this section</TooltipContent>
      </Tooltip>
    </div>
  )
}
