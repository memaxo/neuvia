'use client'

import React, { useEffect, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { AlertOctagon, RefreshCw, RotateCcw, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useChatStore } from '@/lib/stores/chat-store'
import { workflowErrorHandler, useWorkflowErrorHandler } from '@/lib/errors/workflow-error-handler'
import type { WorkflowStep } from '@/lib/workflow/types'
import { apiClient } from '@/lib/api/client/api-client'
// Import specialized workflow hooks
import { useDocumentWorkflow } from '@/lib/workflow/hooks/use-document-workflow'
import { useVerificationWorkflow } from '@/lib/workflow/hooks/use-verification-workflow'
import { useReportWorkflow } from '@/lib/workflow/hooks/use-report-workflow'

interface WorkflowErrorBoundaryProps {
  children: React.ReactNode
  workflowStep?: WorkflowStep
  patientId?: string
  fallbackComponent?: React.ComponentType<{
    error: Error
    resetErrorBoundary: () => void
  }>
}

interface FallbackProps {
  error: Error & { step?: WorkflowStep; recoveryPaths?: WorkflowStep[] }
  resetErrorBoundary: () => void
  workflowStep?: WorkflowStep
  patientId?: string
}

const FRIENDLY_STEP_NAMES: Record<WorkflowStep, string> = {
  'idle': 'Start Over',
  'uploading': 'Document Upload',
  'extracting': 'Document Processing',
  'verification': 'Verification',
  'verification_pending': 'Verification',
  'verification_in_progress': 'Verification In Progress',
  'verification_completed': 'Verification Completed',
  'verification_failed': 'Verification Failed',
  'report_generation': 'Report Generation',
  'report_presentation': 'View Report',
  'complete': 'Completion',
  'chat_started': 'Chat',
  'chat_in_progress': 'Chat In Progress',
  'chat_completed': 'Chat Completed',
  'research': 'Research',
  'error': 'Error State',
}

/**
 * Default fallback UI for workflow errors
 */
function DefaultFallback({ 
  error, 
  resetErrorBoundary,
  workflowStep,
  patientId 
}: FallbackProps) {
  const router = useRouter()
  const [selectedRecoveryPath, setSelectedRecoveryPath] = useState<WorkflowStep | ''>('')
  const errorHandler = useWorkflowErrorHandler(apiClient)
  
  // Get the user ID and chat ID for workflow hook initialization
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_id') || undefined : undefined
  const chatId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_chat_id') || undefined : undefined
  
  // Initialize specialized workflow hooks to access their error handlers
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
  
  // Get available recovery paths from error or error handler
  const recoveryPaths = error.recoveryPaths || 
    (workflowStep ? errorHandler.getRecoveryPaths(workflowStep) : ['idle'])
  
  // Set default recovery path
  useEffect(() => {
    if (recoveryPaths.length > 0 && !selectedRecoveryPath) {
      setSelectedRecoveryPath(recoveryPaths[0])
    }
  }, [recoveryPaths, selectedRecoveryPath])
  
  // Handle recovery attempt with specialized hooks
  const handleRecovery = async () => {
    if (!selectedRecoveryPath) {
      return
    }
    
    try {
      // Attempt stage-specific recovery
      if (selectedRecoveryPath === 'idle') {
        // Full reset to idle state
        useChatStore.getState().resetChat()
        
        // Use the specialized hooks to reset state
        if (selectedRecoveryPath === 'uploading' || selectedRecoveryPath === 'extracting') {
          // Reset document workflow
          if (documentStatus.updateStep) {
            await documentStatus.updateStep('idle')
          }
        } else if (selectedRecoveryPath === 'verification' || 
                 selectedRecoveryPath === 'verification_pending' || 
                 selectedRecoveryPath === 'verification_in_progress') {
          // Reset verification workflow
          if (verificationStatus.resetVerification) {
            await verificationStatus.resetVerification()
          }
        } else if (selectedRecoveryPath === 'report_generation') {
          // Reset report workflow
          if (reportStatus.updateStep) {
            await reportStatus.updateStep('idle')
          }
        }
        
        // Navigate back to the chat view
        router.push(`/dashboard/chat?patientId=${patientId || ''}`)
      } else {
        // Stage-specific recovery using both the error handler and specialized hooks
        
        // Traditional error handler recovery
        await errorHandler.recoverFromError(
          selectedRecoveryPath,
          {
            errorMessage: error.message,
            workflowStep: workflowStep || 'error',
            previousStep: error.step,
            timestamp: new Date().toISOString(),
          }
        )
        
        // Also recover using the specialized hooks
        if (selectedRecoveryPath === 'uploading' || selectedRecoveryPath === 'extracting') {
          // Use document workflow hook for document-related steps
          if (documentStatus.updateStep) {
            await documentStatus.updateStep(selectedRecoveryPath)
          }
        } else if (selectedRecoveryPath === 'verification' || 
                 selectedRecoveryPath === 'verification_pending' || 
                 selectedRecoveryPath === 'verification_in_progress') {
          // Use verification workflow hook for verification-related steps
          if (verificationStatus.updateStep) {
            await verificationStatus.updateStep(selectedRecoveryPath)
          }
        } else if (selectedRecoveryPath === 'report_generation') {
          // Use report workflow hook for report-related steps
          if (reportStatus.updateStep) {
            await reportStatus.updateStep(selectedRecoveryPath)
          }
        }
      }
      
      // Reset the error boundary
      resetErrorBoundary()
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError)
      // Try again with a simple reset
      resetErrorBoundary()
    }
  }
  
  // Handle navigation to dashboard
  const handleDashboard = () => {
    router.push('/dashboard')
  }
  
  return (
    <div className="flex size-full flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="bg-destructive/10">
          <div className="flex items-center gap-2">
            <AlertOctagon className="text-destructive size-5" />
            <CardTitle>Workflow Error</CardTitle>
          </div>
          <CardDescription>
            There was a problem during the {workflowStep ? FRIENDLY_STEP_NAMES[workflowStep] : ''} step
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="mb-6">
            <h3 className="text-muted-foreground text-sm font-medium">Error Details</h3>
            <p className="mt-1 text-sm">{error.message}</p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-sm font-medium">Recovery Options</h3>
              <Select
                onValueChange={(value) => setSelectedRecoveryPath(value as WorkflowStep)}
                value={selectedRecoveryPath}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select recovery option" />
                </SelectTrigger>
                <SelectContent>
                  {recoveryPaths.map((path) => (
                    <SelectItem key={path} value={path}>
                      {FRIENDLY_STEP_NAMES[path]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="bg-muted/20 flex justify-between border-t px-6 py-4">
          <Button
            className="gap-1"
            onClick={handleDashboard}
            variant="outline"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Button>
          
          <div className="flex gap-2">
            <Button
              className="gap-1"
              onClick={resetErrorBoundary}
              variant="outline"
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
            
            <Button
              className="gap-1"
              disabled={!selectedRecoveryPath}
              onClick={handleRecovery}
            >
              <RefreshCw className="size-4" />
              Recover
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

/**
 * Enhanced error boundary for workflow components
 */
export function WorkflowErrorBoundary({
  children,
  workflowStep,
  patientId,
  fallbackComponent: FallbackComponent,
}: WorkflowErrorBoundaryProps) {
  // Function to handle errors caught by the boundary using specialized hooks
  const handleError = (error: Error) => {
    console.error('Workflow error boundary caught error:', error)
    
    // Get the user ID and chat ID from localStorage
    const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_id') || undefined : undefined
    const chatId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_chat_id') || undefined : undefined
    
    // Initialize specialized hooks to update error state
    // (This is a simplified pattern - in a real implementation you might use refs to
    // avoid multiple hook calls, but this illustrates the concept)
    try {
      // Normalize error and get metadata using the existing error handler
      const errorHandler = workflowErrorHandler
      
      // Create error metadata
      const metadata = errorHandler.createErrorMetadata(
        error,
        workflowStep || 'error'
      )
      
      // Log the error
      void errorHandler.logError(metadata)
      
      // Update specialized workflow hooks with error state (async but we don't await)
      if (userId && chatId) {
        const { updateStep: updateDocumentStep } = useDocumentWorkflow({
          userId,
          chatId,
          initialStep: 'idle'
        })
        
        const { updateStep: updateVerificationStep } = useVerificationWorkflow({
          userId,
          chatId,
          initialStep: 'idle'
        })
        
        const { updateStep: updateReportStep } = useReportWorkflow({
          userId,
          chatId,
          initialStep: 'idle'
        })
        
        // Determine which workflow is most likely active based on the workflowStep
        if (workflowStep === 'uploading' || workflowStep === 'extracting') {
          // Update document workflow with error
          if (updateDocumentStep) {
            void updateDocumentStep('error', {
              error: metadata.errorMessage,
              errorDetails: metadata.details,
              previousStep: workflowStep,
              recoveryPaths: metadata.recoveryPaths,
            })
          }
        } else if (workflowStep === 'verification' || 
                 workflowStep === 'verification_pending' || 
                 workflowStep === 'verification_in_progress') {
          // Update verification workflow with error
          if (updateVerificationStep) {
            void updateVerificationStep('error', {
              error: metadata.errorMessage,
              errorDetails: metadata.details,
              previousStep: workflowStep,
              recoveryPaths: metadata.recoveryPaths,
            })
          }
        } else if (workflowStep === 'report_generation') {
          // Update report workflow with error
          if (updateReportStep) {
            void updateReportStep('error', {
              error: metadata.errorMessage,
              errorDetails: metadata.details,
              previousStep: workflowStep,
              recoveryPaths: metadata.recoveryPaths,
            })
          }
        }
      }
      
      // For backward compatibility - update global state with error
      const store = useChatStore.getState()
      store.setError(metadata.errorMessage)
      store.updateWorkflowStep('error', {
        error: metadata.errorMessage,
        errorDetails: metadata.details,
        previousStep: workflowStep,
        recoveryPaths: metadata.recoveryPaths,
      })
      
      // Attach recovery paths to error for fallback component
      Object.assign(error, {
        step: workflowStep, 
        recoveryPaths: metadata.recoveryPaths
      })
    } catch (metadataError) {
      console.error('Error in error handling:', metadataError)
      // Minimal fallback in case error handling itself fails
      const store = useChatStore.getState()
      store.setError(error.message || 'An unknown error occurred')
      store.updateWorkflowStep('error', {
        error: error.message || 'An unknown error occurred',
      })
    }
  }
  
  return (
    <ErrorBoundary
      fallbackRender={(props) => 
        FallbackComponent ? (
          <FallbackComponent {...props} />
        ) : (
          <DefaultFallback 
            {...props} 
            patientId={patientId}
            workflowStep={workflowStep}
          />
        )
      }
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Chat-specific error boundary with enhanced recovery options
 */
export function ChatErrorBoundary({
  children,
  workflowStep,
  patientId,
}: {
  children: React.ReactNode
  workflowStep?: WorkflowStep
  patientId?: string
}) {
  return (
    <WorkflowErrorBoundary
      patientId={patientId}
      workflowStep={workflowStep}
    >
      {children}
    </WorkflowErrorBoundary>
  )
}