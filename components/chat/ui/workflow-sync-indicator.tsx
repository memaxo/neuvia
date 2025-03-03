'use client'

import { useEffect, useState } from 'react'
import { useWorkflowSync } from '@/lib/hooks/use-workflow-sync'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utils/cn'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LoaderCircle, CheckCircle2, AlertTriangle, CloudOff, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
 */
export function WorkflowSyncIndicator({
  className,
  showDetails = false,
  size = 'md',
  hideWhenConnected = false,
  workflowId
}: Props) {
  const {
    isConnected,
    lastSyncedAt,
    error,
    pendingTransactions,
    forceSync
  } = useWorkflowSync(workflowId)
  
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
          formatDistanceToNow(lastSyncedAt, { addSuffix: true })
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
    if (error) {
      return {
        icon: <AlertTriangle className="h-3 w-3 text-destructive" />,
        label: 'Error',
        variant: 'destructive',
        tooltip: error
      }
    }
    
    if (!isConnected) {
      return {
        icon: <CloudOff className="h-3 w-3" />,
        label: 'Offline',
        variant: 'outline',
        tooltip: 'Not connected to real-time updates'
      }
    }
    
    if (pendingTransactions.length > 0) {
      return {
        icon: <Clock className="h-3 w-3 animate-pulse" />,
        label: `Syncing (${pendingTransactions.length})`,
        variant: 'secondary',
        tooltip: `${pendingTransactions.length} updates pending`
      }
    }
    
    return {
      icon: <CheckCircle2 className="h-3 w-3 text-green-500" />,
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
                "flex items-center rounded-full p-1", 
                {
                  "text-destructive": status.variant === 'destructive',
                  "text-secondary-foreground": status.variant === 'secondary',
                  "text-muted-foreground": status.variant === 'outline',
                },
                className
              )}
              onClick={() => forceSync()}
            >
              {status.icon}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{status.tooltip}</p>
            {pendingTransactions.length > 0 && (
              <p className="text-xs text-muted-foreground">Click to force sync</p>
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
            variant={status.variant as any}
            className={cn(
              "cursor-pointer transition-all",
              { "px-2 py-1": size === 'lg' },
              className
            )}
            onClick={() => forceSync()}
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
                <p className="mt-1 text-muted-foreground">Click to force sync</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}