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
 * Connects to the Zustand store for workflow state
 */
export function WorkflowStatusDisplay({
  activeDocument,
  onContinueAction,
  onGenerateReportAction,
  onSkipReportAction,
  hideWhenIdle = true
}: WorkflowStatusDisplayProps) {
  // Get all needed state in one go using multiple selectors 
  // This pattern minimizes rerenders by only subscribing to the exact state needed
  const {
    workflowStep,
    processingStatus,
    error,
    verification,
    progress,
    isProcessing,
    docType,
    // Actions
    completeVerification,
    generateReport,
    formatReport,
    beginReportGeneration
  } = useChatStore(state => ({
    // Workflow state
    workflowStep: state.workflow.currentStep,
    processingStatus: state.workflow.processingStatus,
    error: state.error,
    verification: state.verification,
    progress: state.docProgress,
    isProcessing: state.isDocProcessing,
    docType: state.workflow.data.documentType,
    // Actions
    completeVerification: state.completeVerification,
    generateReport: state.generateReport,
    formatReport: state.formatReport,
    beginReportGeneration: state.beginReportGeneration
  }))
  
  // Define actions based on current workflow step
  const handleContinue = useCallback(() => {
    if (onContinueAction) {
      onContinueAction()
    } else if (workflowStep === 'verification' || workflowStep === 'verification_completed') {
      beginReportGeneration()
    }
  }, [workflowStep, onContinueAction, beginReportGeneration])
  
  const handleGenerateReport = useCallback(() => {
    if (onGenerateReportAction) {
      onGenerateReportAction()
    } else {
      generateReport()
    }
  }, [onGenerateReportAction, generateReport])
  
  const handleSkipReport = useCallback(() => {
    if (onSkipReportAction) {
      onSkipReportAction()
    } else {
      formatReport({ format: 'pdf' })
    }
  }, [onSkipReportAction, formatReport])
  
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
          <Button onClick={handleContinue} className="gap-1">
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
          <Button onClick={handleContinue} className="gap-1">
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
      <Alert variant="destructive" className="mb-4">
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