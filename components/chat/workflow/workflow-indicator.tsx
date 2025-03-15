'use client'

import { useChatStore } from '@/lib/stores/chat-store'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  AlertCircle, 
  CheckCircle, 
  ClipboardCheck, 
  FileText, 
  Loader2
} from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { WorkflowStep } from '@/lib/workflow/types'
// Import specialized workflow hooks
import { useDocumentWorkflow } from '@/lib/workflow/hooks/use-document-workflow'
import { useVerificationWorkflow } from '@/lib/workflow/hooks/use-verification-workflow'
import { useReportWorkflow } from '@/lib/workflow/hooks/use-report-workflow'

interface WorkflowIndicatorProps {
  className?: string
  showProgress?: boolean
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Compact workflow indicator for use in navigation/header contexts
 * Shows current workflow step with icon, label, and optional progress bar
 */
export function WorkflowIndicator({
  className,
  showProgress = true,
  size = 'sm'
}: WorkflowIndicatorProps) {
  // Get the user ID and chat ID for workflow hook initialization
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_id') || undefined : undefined
  const chatId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_chat_id') || undefined : undefined
  
  // Initialize specialized workflow hooks
  const {
    state: documentState,
    status: documentStatus
  } = useDocumentWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    state: verificationState,
    status: verificationStatus
  } = useVerificationWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    state: reportState,
    status: reportStatus
  } = useReportWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Derive the current workflow step from all specialized hooks
  const workflowStep = documentStatus.currentStep !== 'idle' ? documentStatus.currentStep : 
                      verificationStatus.currentStep !== 'idle' ? verificationStatus.currentStep :
                      reportStatus.currentStep !== 'idle' ? reportStatus.currentStep : 'idle'
                      
  // Derive processing status from the specialized hooks
  const error = documentState.error || verificationState.error || reportState.error
  const processingStatus = {
    status: error ? 'error' : 
            documentStatus.isComplete || verificationStatus.isVerificationComplete || reportStatus.isComplete ? 'complete' : 
            'processing',
    progress: documentState.progress || verificationState.progress || reportState.progress || 0,
    phase: documentState.phase || verificationState.phase || reportState.phase
  }

  // Always declare hooks at the top level
  const [displayProgress, setDisplayProgress] = useState(processingStatus.progress)
  
  // Update display progress with animation when actual progress changes
  useEffect(() => {
    if (processingStatus.progress !== displayProgress) {
      const timeout = setTimeout(() => {
        setDisplayProgress(processingStatus.progress)
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [processingStatus.progress, displayProgress])
  
  // No need to show anything for idle state
  if (workflowStep === 'idle') {
    return null
  }
  
  // Choose icon based on workflow step
  const getStepIcon = () => {
    if (processingStatus.status === 'error') return <AlertCircle className="size-3.5" />
    if (processingStatus.status === 'processing') return <Loader2 className="size-3.5 animate-spin" />
    
    const stepToIcon: Record<string, JSX.Element> = {
      'verification': <ClipboardCheck className="size-3.5" />,
      'verification_pending': <ClipboardCheck className="size-3.5" />,
      'verification_in_progress': <Loader2 className="size-3.5 animate-spin" />,
      'verification_completed': <CheckCircle className="size-3.5" />,
      'report_generation': <FileText className="size-3.5" />,
      'complete': <CheckCircle className="size-3.5" />
    }
    
    return stepToIcon[workflowStep] || <FileText className="size-3.5" />
  }
  
  // Get color based on workflow step
  const getStepColorClass = () => {
    if (processingStatus.status === 'error') {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    }
    
    if (workflowStep === 'verification_completed' || workflowStep === 'complete') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    }
    
    if (processingStatus.status === 'processing') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    }
    
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  }
  
  // Get label based on workflow step
  const getStepLabel = () => {
    const labels: Record<WorkflowStep, string> = {
      'idle': 'Ready',
      'uploading': 'Uploading',
      'extracting': 'Extracting',
      'verification': 'Verification',
      'verification_pending': 'Verification',
      'verification_in_progress': 'Verifying',
      'verification_completed': 'Verified',
      'verification_failed': 'Failed',
      'report_generation': 'Reporting',
      'complete': 'Complete',
      'error': 'Error',
      'research': 'Research',
      'report_presentation': 'Report',
      'chat_started': 'Chat',
      'chat_in_progress': 'Processing',
      'chat_completed': 'Complete',
      'chat_error': 'Error'
    }
    
    return labels[workflowStep] || 'Processing'
  }
  
  // Get progress height based on size
  const progressHeight = size === 'sm' ? 'h-1' : size === 'lg' ? 'h-2' : 'h-1.5'
  
  return (
    <div className={cn("inline-flex flex-col", className)}>
      <Badge className={cn(
        "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs",
        getStepColorClass()
      )} variant="outline">
        {getStepIcon()}
        <span>{getStepLabel()}</span>
      </Badge>
      
      {showProgress && processingStatus.status === 'processing' && (
        <Progress 
          className={cn(
            progressHeight, 
            "mt-1 w-full transition-all duration-300"
          )} 
          value={displayProgress} 
        />
      )}
    </div>
  )
}