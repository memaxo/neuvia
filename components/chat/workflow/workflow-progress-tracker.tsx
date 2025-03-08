'use client'

import { useChatStore } from '@/stores/chat-store'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useMemo, useEffect, useState } from 'react'
import { 
  AlertCircle, 
  CheckCircle, 
  FileText, 
  Loader2,
  FileUp,
  FileCheck,
  ClipboardCheck,
  FileOutput
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkflowStep, ProcessingPhase } from '@/lib/workflow/types'

interface WorkflowProgressTrackerProps {
  className?: string
  showLabels?: boolean
  size?: 'sm' | 'md' | 'lg'
  showPhase?: boolean
}

/**
 * Component to track and display workflow progress across the application
 * Uses the Zustand store to maintain consistent state
 */
export function WorkflowProgressTracker({
  className,
  showLabels = true,
  size = 'md',
  showPhase = true
}: WorkflowProgressTrackerProps) {
  // Get workflow state from Zustand store
  const workflowStep = useChatStore(state => state.workflow.currentStep)
  const processingStatus = useChatStore(state => state.workflow.processingStatus)
  const verification = useChatStore(state => state.verification)

  // Local state for animating progress changes
  const [displayProgress, setDisplayProgress] = useState(processingStatus.progress)
  
  // Update display progress with animation when actual progress changes
  useEffect(() => {
    if (processingStatus.progress !== displayProgress) {
      // Small delay for animation effect
      const timeout = setTimeout(() => {
        setDisplayProgress(processingStatus.progress)
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [processingStatus.progress, displayProgress])

  // Map workflow steps to progress percentage
  const workflowProgress = useMemo(() => {
    const stepsMap: Record<WorkflowStep, number> = {
      'idle': 0,
      'uploading': 10,
      'extracting': 30,
      'verification': 60,
      'verification_pending': 65,
      'verification_in_progress': 70,
      'verification_completed': 80,
      'verification_failed': 60,
      'report_generation': 90,
      'complete': 100,
      'error': 0,
      'research': 50,
      'report_presentation': 95,
      'chat_started': 20,
      'chat_in_progress': 50,
      'chat_completed': 100,
      'chat_error': 0
    }
    
    // If we're in a step with active progress, use that instead of the fixed value
    if (processingStatus.status === 'processing' && processingStatus.progress > 0) {
      // Scale the progress relative to the step's position in the workflow
      const baseProgress = stepsMap[workflowStep] || 0
      const maxStepProgress = 
        workflowStep === 'uploading' ? 30 :
        workflowStep === 'extracting' ? 60 : 
        workflowStep === 'verification' || 
        workflowStep === 'verification_pending' || 
        workflowStep === 'verification_in_progress' ? 80 :
        workflowStep === 'report_generation' ? 100 : 30
      
      const stepRange = maxStepProgress - baseProgress
      return baseProgress + (processingStatus.progress / 100 * stepRange)
    }
    
    return stepsMap[workflowStep] || 0
  }, [workflowStep, processingStatus])

  // Get current workflow phase description
  const phaseDescription = useMemo(() => {
    if (processingStatus.phase) {
      // Format the phase string for display
      return processingStatus.phase
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }
    
    // Default descriptions based on workflow step
    const descriptions: Record<WorkflowStep, string> = {
      'idle': 'Ready',
      'uploading': 'Uploading Document',
      'extracting': 'Extracting Data',
      'verification': 'Verifying Data',
      'verification_pending': 'Pending Verification',
      'verification_in_progress': 'Reviewing Data',
      'verification_completed': 'Verification Complete',
      'verification_failed': 'Verification Failed',
      'report_generation': 'Generating Report',
      'complete': 'Process Complete',
      'error': 'Error Occurred',
      'research': 'Researching',
      'report_presentation': 'Presenting Report',
      'chat_started': 'Chat Started',
      'chat_in_progress': 'Processing',
      'chat_completed': 'Chat Complete',
      'chat_error': 'Chat Error'
    }
    
    return descriptions[workflowStep] || 'Processing'
  }, [workflowStep, processingStatus.phase])

  // Get the appropriate icon for the current workflow step
  const StepIcon = useMemo(() => {
    if (processingStatus.status === 'error') return AlertCircle
    if (processingStatus.status === 'processing') return Loader2
    
    const icons: Record<WorkflowStep, any> = {
      'idle': FileText,
      'uploading': FileUp,
      'extracting': FileText,
      'verification': ClipboardCheck,
      'verification_pending': ClipboardCheck,
      'verification_in_progress': Loader2,
      'verification_completed': CheckCircle,
      'verification_failed': AlertCircle,
      'report_generation': FileOutput,
      'complete': CheckCircle,
      'error': AlertCircle,
      'research': FileText,
      'report_presentation': FileOutput,
      'chat_started': FileText,
      'chat_in_progress': Loader2,
      'chat_completed': CheckCircle,
      'chat_error': AlertCircle
    }
    
    return icons[workflowStep] || FileText
  }, [workflowStep, processingStatus.status])

  // Skip rendering for idle state
  if (workflowStep === 'idle') return null

  // Height based on size prop
  const heightClass = 
    size === 'sm' ? 'h-1.5' : 
    size === 'lg' ? 'h-4' : 
    'h-2.5'

  return (
    <div className={cn("w-full space-y-2", className)}>
      {showLabels && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <StepIcon className={cn("size-4", processingStatus.status === 'processing' && "animate-spin")} />
            <span className="text-sm font-medium">{phaseDescription}</span>
          </div>
          <Badge className="px-2" variant="outline">
            {Math.round(workflowProgress)}%
          </Badge>
        </div>
      )}
      
      <Progress className={cn(heightClass, "transition-all duration-300")} value={displayProgress} />
      
      {showPhase && processingStatus.phase && (
        <p className="text-muted-foreground text-xs">
          {processingStatus.phase.replace(/_/g, ' ')}
        </p>
      )}
    </div>
  )
}