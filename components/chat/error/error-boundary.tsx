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

import { useChatStore } from '@/stores/chat-store'
import { workflowErrorHandler, useWorkflowErrorHandler } from '@/lib/errors/workflow-error-handler'
import type { WorkflowStep } from '@/lib/workflow/types'
import { apiClient } from '@/lib/api/client/api-client'

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
  
  // Get available recovery paths
  const recoveryPaths = error.recoveryPaths || 
    (workflowStep ? errorHandler.getRecoveryPaths(workflowStep) : ['idle'])
  
  // Set default recovery path
  useEffect(() => {
    if (recoveryPaths.length > 0 && !selectedRecoveryPath) {
      setSelectedRecoveryPath(recoveryPaths[0])
    }
  }, [recoveryPaths, selectedRecoveryPath])
  
  // Handle recovery attempt
  const handleRecovery = async () => {
    if (!selectedRecoveryPath) {
      return
    }
    
    try {
      // Attempt stage-specific recovery
      if (selectedRecoveryPath === 'idle') {
        // Full reset to idle state
        useChatStore.getState().resetChat()
        router.push(`/dashboard/chat?patientId=${patientId || ''}`)
      } else {
        // Stage-specific recovery
        await errorHandler.recoverFromError(
          selectedRecoveryPath,
          {
            errorMessage: error.message,
            workflowStep: workflowStep || 'error',
            previousStep: error.step,
            timestamp: new Date().toISOString(),
          }
        )
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
  // Function to handle errors caught by the boundary
  const handleError = (error: Error) => {
    console.error('Workflow error boundary caught error:', error)
    
    // Normalize error and get metadata
    const errorHandler = workflowErrorHandler
    
    // Create error metadata
    const metadata = errorHandler.createErrorMetadata(
      error,
      workflowStep || 'error'
    )
    
    // Log the error
    void errorHandler.logError(metadata)
    
    // Update global state with error
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