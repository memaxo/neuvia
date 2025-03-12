'use client'

import { useEffect, useState, useMemo } from 'react'
import { useWorkflowSync } from '@/lib/hooks/use-workflow-sync'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle2, AlertTriangle, CloudOff, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
// Import specialized workflow hooks
import { useDocumentWorkflow } from '@/lib/workflow/hooks/use-document-workflow'
import { useVerificationWorkflow } from '@/lib/workflow/hooks/use-verification-workflow'
import { useReportWorkflow } from '@/lib/workflow/hooks/use-report-workflow'

interface Props {
  className?: string
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
  hideWhenConnected?: boolean
  workflowId?: string
}

/**
 * Component that shows real-time sync status for workflow changes
 * Displays connection status, last sync time, and pending transactions
 * Uses specialized workflow hooks to determine the active workflow ID
 */
export function WorkflowSyncIndicator({
  className,
  showDetails = false,
  size = 'md',
  hideWhenConnected = false,
  workflowId: propWorkflowId
}: Props) {
  // Get the user ID and chat ID for workflow hook initialization
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_id') || undefined : undefined
  const chatId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_chat_id') || undefined : undefined
  
  // Initialize specialized workflow hooks with minimal dependencies
  const { workflowId: documentWorkflowId, state: documentState } = useDocumentWorkflow({
    userId,
    chatId
  })
  
  const { workflowId: verificationWorkflowId, state: verificationState } = useVerificationWorkflow({
    userId,
    chatId
  })
  
  const { workflowId: reportWorkflowId, state: reportState } = useReportWorkflow({
    userId,
    chatId
  })
  
  // Derive the active workflow ID using useMemo to prevent unnecessary calculations
  const activeWorkflowId = useMemo(() => {
    // If a workflow ID is explicitly provided via props, use it
    if (propWorkflowId) return propWorkflowId
    
    // Otherwise, determine which workflow is active based on state
    if (documentState.currentStep && documentState.currentStep !== 'idle') {
      return documentWorkflowId
    }
    
    if (verificationState.currentStep && verificationState.currentStep !== 'idle') {
      return verificationWorkflowId
    }
    
    if (reportState.currentStep && reportState.currentStep !== 'idle') {
      return reportWorkflowId
    }
    
    // If no workflow is active, return the first available ID
    return documentWorkflowId || verificationWorkflowId || reportWorkflowId || undefined
  }, [
    propWorkflowId, 
    documentWorkflowId, 
    verificationWorkflowId, 
    reportWorkflowId,
    documentState.currentStep,
    verificationState.currentStep,
    reportState.currentStep
  ])

  // Use the workflow sync hook with the active workflow ID
  const {
    isConnected,
    lastSyncedAt,
    error,
    pendingTransactions,
    forceSync
  } = useWorkflowSync(activeWorkflowId)
  
  const [lastSyncTimeText, setLastSyncTimeText] = useState<string>('')
  
  // Update the last sync time text every 5 seconds
  useEffect(() => {
    if (!lastSyncedAt) return
    
    // Initial update
    updateSyncTimeText()
    
    // Set up interval for updates
    const interval = setInterval(updateSyncTimeText, 5000)
    
    // Clean up
    return () => clearInterval(interval)
    
    function updateSyncTimeText() {
      try {
        setLastSyncTimeText(
          formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })
        )
      } catch (err) {
        setLastSyncTimeText('Unknown')
      }
    }
  }, [lastSyncedAt])
  
  // If we should hide when connected and everything is fine
  if (hideWhenConnected && isConnected && !error && pendingTransactions.length === 0) {
    return null
  }
  
  // Determine icon and color based on status
  const getStatusInfo = () => {
    // Check for errors in the specialized workflow hooks
    const workflowError = documentState.error || verificationState.error || reportState.error
    
    if (error || workflowError) {
      return {
        icon: <AlertTriangle className="text-destructive size-3" />,
        label: 'Error',
        variant: 'destructive',
        tooltip: error || workflowError || 'Sync error'
      }
    }
    
    if (!isConnected) {
      return {
        icon: <CloudOff className="size-3" />,
        label: 'Offline',
        variant: 'outline',
        tooltip: 'Not connected to real-time updates'
      }
    }
    
    if (pendingTransactions.length > 0) {
      return {
        icon: <Clock className="size-3 animate-pulse" />,
        label: `Syncing (${pendingTransactions.length})`,
        variant: 'secondary',
        tooltip: `${pendingTransactions.length} updates pending`
      }
    }
    
    return {
      icon: <CheckCircle2 className="size-3 text-green-500" />,
      label: 'Synced',
      variant: 'outline',
      tooltip: lastSyncTimeText ? `Last synced ${lastSyncTimeText}` : 'Connected'
    }
  }
  
  const status = getStatusInfo()
  
  // Compact version (icon only)
  if (size === 'sm' && !showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center rounded-full p-1 cursor-pointer", 
                {
                  "text-destructive": status.variant === 'destructive',
                  "text-secondary-foreground": status.variant === 'secondary',
                  "text-muted-foreground": status.variant === 'outline',
                },
                className
              )}
              onClick={() => forceSync()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  forceSync();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Force workflow sync"
            >
              {status.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{status.tooltip}</p>
            {pendingTransactions.length > 0 && (
              <p className="text-muted-foreground text-xs">Click to force sync</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  
  // Full badge with icon and text
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              "cursor-pointer transition-all",
              { "px-2 py-1": size === 'lg' },
              className
            )}
            onClick={() => forceSync()}
            variant={status.variant as any}
          >
            <span className="flex items-center gap-1.5">
              {status.icon}
              <span className={cn({ "text-xs": size !== 'lg' })}>
                {status.label}
              </span>
              {showDetails && lastSyncTimeText && (
                <span className="text-xs opacity-70">
                  ({lastSyncTimeText})
                </span>
              )}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-sm">
            <p>{status.tooltip}</p>
            {pendingTransactions.length > 0 && (
              <div className="mt-1 text-xs">
                <p className="font-semibold">Pending updates:</p>
                <ul className="list-disc pl-4">
                  {pendingTransactions.map((txId, index) => (
                    <li key={txId}>{`Update #${index + 1}`}</li>
                  ))}
                </ul>
                <p className="text-muted-foreground mt-1">Click to force sync</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}