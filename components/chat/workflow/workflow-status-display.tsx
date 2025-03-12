'use client'

import { useChatStore } from '@/stores/chat-store'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WorkflowProgressTracker } from './workflow-progress-tracker'
import { 
  AlertCircle, 
  ArrowRight, 
  CheckCircle, 
  ClipboardList, 
  FileOutput, 
  FileText, 
  Loader2
} from 'lucide-react'
import { useCallback } from 'react'
import type { WorkflowStep } from '@/lib/workflow/types'
// Import specialized workflow hooks
import { useDocumentWorkflow } from '@/lib/workflow/hooks/use-document-workflow'
import { useVerificationWorkflow } from '@/lib/workflow/hooks/use-verification-workflow'
import { useReportWorkflow } from '@/lib/workflow/hooks/use-report-workflow'

interface ActiveDocument {
  id: string
  title: string
  content: string
  kind: 'text' | 'code' | 'spreadsheet'
}

interface WorkflowStatusDisplayProps {
  activeDocument?: ActiveDocument | null
  onContinueAction?: () => void
  onGenerateReportAction?: () => void
  onSkipReportAction?: () => void
  hideWhenIdle?: boolean
}

/**
 * Displays the current workflow status and provides relevant actions
 * Now using the specialized workflow hooks instead of the Zustand store
 */
export function WorkflowStatusDisplay({
  activeDocument,
  onContinueAction,
  onGenerateReportAction,
  onSkipReportAction,
  hideWhenIdle = true
}: WorkflowStatusDisplayProps) {
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
    status: verificationStatus,
    completeVerification
  } = useVerificationWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    state: reportState,
    status: reportStatus,
    beginReportGeneration
  } = useReportWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Get the current chat verification state from the Zustand store
  // This is still needed for UI presentation as it contains the actual summary
  const verification = useChatStore(state => state.verification)
  
  // Derive the current workflow step from all specialized hooks
  const workflowStep = documentStatus.currentStep !== 'idle' ? documentStatus.currentStep : 
                      verificationStatus.currentStep !== 'idle' ? verificationStatus.currentStep :
                      reportStatus.currentStep !== 'idle' ? reportStatus.currentStep : 'idle'
                      
  // Derive other state information from the hooks
  const error = documentState.error || verificationState.error || reportState.error
  const processingStatus = {
    status: error ? 'error' : 
            documentStatus.isComplete || verificationStatus.isVerificationComplete || reportStatus.isComplete ? 'complete' : 
            'processing',
    progress: documentState.progress || verificationState.progress || reportState.progress || 0,
    phase: documentState.phase || verificationState.phase || reportState.phase
  }
  const progress = processingStatus.progress
  const isProcessing = documentStatus.isUploading || documentStatus.isExtracting || 
                      verificationStatus.isVerifying || reportStatus.isGeneratingReport
  const docType = activeDocument?.kind === 'text' ? 'text' : 'document'
  
  // Define actions based on current workflow step using specialized hooks
  const handleContinue = useCallback(() => {
    if (onContinueAction) {
      onContinueAction()
    } else if (workflowStep === 'verification' || workflowStep === 'verification_completed') {
      // Use the specialized report workflow hook to begin report generation
      // Get the patient ID from localStorage or another source
      const patientId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_patient_id') || undefined : undefined
      if (patientId) {
        beginReportGeneration('comprehensive', { patientId })
      } else {
        beginReportGeneration('comprehensive')
      }
    }
  }, [workflowStep, onContinueAction, beginReportGeneration])
  
  const handleGenerateReport = useCallback(() => {
    if (onGenerateReportAction) {
      onGenerateReportAction()
    } else {
      // Use the specialized report workflow hook to begin report generation
      const patientId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_patient_id') || undefined : undefined
      if (patientId) {
        beginReportGeneration('comprehensive', { patientId })
      } else {
        beginReportGeneration('comprehensive')
      }
    }
  }, [onGenerateReportAction, beginReportGeneration])
  
  const handleSkipReport = useCallback(() => {
    if (onSkipReportAction) {
      onSkipReportAction()
    } else {
      // Skip report generation using the specialized report workflow hook
      beginReportGeneration('none')
    }
  }, [onSkipReportAction, beginReportGeneration])
  
  // Skip rendering based on current state
  if (hideWhenIdle && workflowStep === 'idle') return null
  if (verification.isInVerificationMode) return null
  
  // Generate title and description based on workflow step
  const getCardContent = () => {
    const stepContent: Record<WorkflowStep, { 
      title: string, 
      description: string,
      icon: React.ReactNode,
      actions?: React.ReactNode
    }> = {
      'idle': { 
        title: 'Upload a Document', 
        description: 'You can upload a file to begin the extraction & verification process, or start chatting directly.',
        icon: <FileText className="size-5" />
      },
      'uploading': { 
        title: 'Uploading Document', 
        description: 'Your document is being uploaded. Please wait...',
        icon: <Loader2 className="size-5 animate-spin" />
      },
      'extracting': { 
        title: 'Extracting Data', 
        description: 'Your document is being processed. Please wait while data is extracted.',
        icon: <Loader2 className="size-5 animate-spin" />
      },
      'verification': { 
        title: 'Processing Complete', 
        description: 'Document processing is complete. The extracted information will be used to update patient summaries.',
        icon: <CheckCircle className="size-5 text-green-500" />,
        actions: (
          <Button className="gap-1" onClick={handleContinue}>
            Continue <ArrowRight className="size-4" />
          </Button>
        )
      },
      'verification_pending': { 
        title: 'Verification Pending', 
        description: 'Please review the extracted information to verify its accuracy.',
        icon: <ClipboardList className="size-5" />
      },
      'verification_in_progress': { 
        title: 'Verification In Progress', 
        description: 'Refining extracted data based on your feedback.',
        icon: <Loader2 className="size-5 animate-spin" />
      },
      'verification_completed': { 
        title: 'Verification Complete', 
        description: 'The information has been verified and is ready for report generation.',
        icon: <CheckCircle className="size-5 text-green-500" />,
        actions: (
          <Button className="gap-1" onClick={handleContinue}>
            Continue to Report <ArrowRight className="size-4" />
          </Button>
        )
      },
      'verification_failed': { 
        title: 'Verification Failed', 
        description: 'There was an issue with the verification process. Please try again.',
        icon: <AlertCircle className="size-5 text-red-500" />
      },
      'report_generation': { 
        title: 'Report Generation', 
        description: 'You can finalize the process by generating a comprehensive report, or skip.',
        icon: <FileOutput className="size-5" />,
        actions: (
          <div className="flex gap-2">
            <Button onClick={handleGenerateReport} variant="default">
              Generate Report
            </Button>
            <Button onClick={handleSkipReport} variant="outline">
              Skip
            </Button>
          </div>
        )
      },
      'complete': { 
        title: 'Process Complete', 
        description: 'You have completed the entire pipeline. You may continue the conversation or upload more documents.',
        icon: <CheckCircle className="size-5 text-green-500" />
      },
      'error': { 
        title: 'Error Occurred', 
        description: error || 'An error occurred during processing. Please try again.',
        icon: <AlertCircle className="size-5 text-red-500" />
      },
      // Additional states with default handling
      'research': { 
        title: 'Research in Progress', 
        description: 'Gathering information based on the uploaded document.',
        icon: <Loader2 className="size-5 animate-spin" />
      },
      'report_presentation': { 
        title: 'Report Ready', 
        description: 'Your report has been generated and is ready for review.',
        icon: <FileOutput className="size-5" />
      },
      'chat_started': { 
        title: 'Chat Started', 
        description: 'You can continue the conversation or upload a document for processing.',
        icon: <FileText className="size-5" />
      },
      'chat_in_progress': { 
        title: 'Processing Request', 
        description: 'Working on your request...',
        icon: <Loader2 className="size-5 animate-spin" />
      },
      'chat_completed': { 
        title: 'Request Completed', 
        description: 'Your request has been processed. You can continue the conversation.',
        icon: <CheckCircle className="size-5 text-green-500" />
      },
      'chat_error': { 
        title: 'Error Occurred', 
        description: error || 'An error occurred. Please try again.',
        icon: <AlertCircle className="size-5 text-red-500" />
      },
    }
    
    return stepContent[workflowStep] || stepContent['idle']
  }
  
  const { title, description, icon, actions } = getCardContent()
  
  // If there's an error, show an alert instead
  if (processingStatus.status === 'error' || workflowStep === 'error') {
    return (
      <Alert className="mb-4" variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>
          {error || 'An error occurred during processing. Please try again.'}
        </AlertDescription>
      </Alert>
    )
  }
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      
      <CardContent>
        <WorkflowProgressTracker />
      </CardContent>
      
      {actions && (
        <CardFooter className="flex justify-end">
          {actions}
        </CardFooter>
      )}
    </Card>
  )
}