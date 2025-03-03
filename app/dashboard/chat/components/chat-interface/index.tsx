'use client'

import { AlertCircle, CheckCircle, FileText, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
// External dependencies
import { useCallback, useEffect, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
// Internal components
import { useToast } from '@/components/ui/use-toast'
import { useChatStore } from '@/stores/chat-store'
import { WorkflowProgressTracker } from '@/components/chat/workflow/workflow-progress-tracker'
import { WorkflowStatusDisplay } from '@/components/chat/workflow/workflow-status-display'
import { WorkflowIndicator } from '@/components/chat/workflow/workflow-indicator'
import { UnifiedDocumentUploader } from '@/components/upload/unified-document-uploader'
import { useErrorHandler } from '@/stores/chat-store'
// Import API client and service layer
import { apiClient } from '@/lib/api/client/api-client'
import { verificationService } from '@/lib/services/verification/verification-service'
// Import real-time sync hook
import { useWorkflowSync } from '@/lib/hooks/use-workflow-sync'
// Import error boundary
import { ChatErrorBoundary } from '@/components/chat/error/error-boundary'

import type {
  ChatMode,
  ChatState as ChatStateType,
  Message,
  UseProcessingWorkflowResult,
} from '@/lib/chat/types'
import type { ExtractedData } from '@/lib/processing/types/extraction'
import type { VerificationItem } from '@/lib/processing/types/verification'
import type { ProcessingPhase, WorkflowStep } from '@/lib/workflow/types'

import { ChatInput } from '@/components/chat/input/ChatInput'
import { ChatMessageList } from '@/components/chat/message/message-list'
import { ReportGenerationPanel } from '@/components/chat/workflow/report-panel'
// Import existing components from the codebase with correct paths
import { DocumentUploader } from '@/components/upload/document-uploader'

interface ChatInterfaceProps {
  readonly initialMode: string
  readonly patientId: string
}

/**
 * Main chat interface component for document processing workflows
 */
export function ChatInterface({
  initialMode: _initialMode,
  patientId,
}: ChatInterfaceProps) {
  const { toast } = useToast()
  const { handleError } = useErrorHandler()

  // Chat state and methods from Zustand store
  const messages = useChatStore(state => state.messages)
  const isLoading = useChatStore(state => state.isLoading)
  const sendMessage = useChatStore(state => state.sendMessage)
  const addSystemMessage = useChatStore(state => state.addSystemMessage)
  const processDocument = useChatStore(state => state.processDocument)
  const docProgress = useChatStore(state => state.docProgress)
  const isDocProcessing = useChatStore(state => state.isDocProcessing)
  const extractedDocument = useChatStore(state => state.extractedDocument)
  const startVerification = useChatStore(state => state.startVerification)
  const updateWorkflowStep = useChatStore(state => state.updateWorkflowStep)
  const completeVerification = useChatStore(state => state.completeVerification)
  const generateReport = useChatStore(state => state.generateReport)
  const formatReport = useChatStore(state => state.formatReport)
  const workflowStep = useChatStore(state => state.workflow?.currentStep || 'idle')
  const verification = useChatStore(state => state.verification)
  const error = useChatStore(state => state.error)
  
  // Initialize real-time workflow synchronization
  // This enables multiple users to see updates to the workflow in real-time
  const workflowId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_workflow_id') : null
  const { isConnected, lastSyncedAt, error: syncError, forceSync } = useWorkflowSync(workflowId || undefined)

  // Use Zustand store state directly instead of local state

  // Processed document state
  const [activeDocument, setActiveDocument] = useState<{
    readonly id: string
    readonly title: string
    readonly content: string
    readonly kind: 'text' | 'code' | 'spreadsheet'
  } | null>(null)

  // Only keep truly local state that doesn't duplicate the store
  const [currentUpload, setCurrentUpload] = useState<File | null>(null)

  // Function to update progress messages - now using Zustand's update function directly
  const updateProgressMessage = useCallback(
    (messageId: string, progress: number, phase: string) => {
      // Use the store's updateMessageProgress function instead of local state
      useChatStore.getState().updateMessageProgress(messageId, progress, phase)
        // Access the API client for direct service calls
  
  // Process document with the API client
  const handleProcessDocument = useCallback(
    async (file: File) => {
      setCurrentUpload(file)

      // Create AbortController for cancellation
      const abortController = new AbortController()

      // Add a system message indicating document processing has started
      const processingMsg = addSystemMessage(
        'Processing your document. This may take a moment...',
        'progress',
        { isProgress: true, progressValue: 0, progressPhase: 'extraction' }
      )

      try {
        // Get current user ID and create workflow if needed
        const userId = localStorage.getItem('current_user_id') || ''
        const workflowId = localStorage.getItem('current_workflow_id')

        // Create a new workflow if one doesn't exist
        let workflowData = { id: workflowId }
        if (!workflowId) {
          workflowData = await apiClient.workflows.createWorkflow({
            workflowType: 'document_processing',
            userId,
            patientId,
            initialStep: 'uploading',
            metadata: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              source: 'chat_interface',
              startedAt: new Date().toISOString()
            }
          })
          
          // Store workflow ID for future use
          if (workflowData?.id) {
            localStorage.setItem('current_workflow_id', workflowData.id)
          }
        }

        // Process the document using API client instead of store action
        const result = await apiClient.documents.processDocument({
          file,
          patientId,
          documentType: 'clinical',
          documentCategory: 'clinical',
          onStatusUpdate: (status) => {
            // Update progress message
            if (status?.progress) {
              updateMessageProgress(
                processingMsg.id,
                status.progress,
                status.phase || 'extraction'
              )
            }
          }
        }, {
          signal: abortController.signal // Pass abort signal for cancellation
        })

        // Set document info when processing completes
        if (result) {
          setActiveDocument({
            id: result.id || crypto.randomUUID(),
            title: file.name,
            content: result.extractedData?.rawText || 'Document processed',
            kind: 'text',
          })
          
          // Update workflow status
          if (workflowData?.id) {
            await apiClient.workflows.updateWorkflowState(workflowData.id, {
              step: 'verification',
              progress: 70,
              phase: 'verification',
              metadata: {
                documentId: result.id,
                extractedAt: new Date().toISOString()
              }
            })
          }
        }

        // Add document completion message and fetch actual summary from API
        if (result && workflowStep === 'verification') {
          addSystemMessage(
            "Document processed successfully. Please review the extracted information below and confirm it's accurate, or provide corrections.",
            'verification_prompt'
          )
          
          // Get actual extracted summary from verification service layer
          const verificationResult = await verificationService.generateVerification({
            document: result,
            workflowId: workflowData?.id || '',
            messageId: processingMsg.id,
            summaryId: crypto.randomUUID()
          })
          
          // Start verification with the actual extracted summary
          startVerification(verificationResult.success ? verificationResult.data.summary : result.extractedData?.rawText || '')
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'An unknown error occurred'

        // Use the existing error handler to handle document processing errors
        handleError(error, 'Failed to process document', {
          step: 'document_processing',
          details: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          }
        })
        
        // Also add a system message to provide context in the chat
        addSystemMessage(
          `There was an error processing your document. Would you like to try uploading it again?`,
          'error',
          { 
            isError: true,
            originalError: errorMsg,
            errorStep: 'document_processing',
            canRetry: true
          }
        )
      }
    },
    [
      patientId,
      updateMessageProgress,
      extractedDocument,
      workflowStep,
      addSystemMessage,
      startVerification,
      handleError,
    ]
  )
          'error',
          { isError: true }
        )
      }
    },
    [
      workflow,
      patientId,
      addSystemMessage,
      updateProgressMessage,
      processPhase,
      toast,
    ]
  )

  // Retry document processing with the current upload
  const retryProcessing = useCallback(() => {
    if (currentUpload) {
      void handleProcessDocument(currentUpload)
    } else {
      toast({
        title: 'No document to retry',
        description: 'Please upload a document first.',
        variant: 'destructive',
      })
    }
  }, [currentUpload, handleProcessDocument, toast])

  // Get document processing progress and phase directly from store
  const processingProgress = useChatStore(state => state.docProgress)
  const processingPhase = useChatStore(state => state.workflow.processingStatus.phase)

  // Helper to render the error recovery UI
  const renderErrorRecovery = () => {
    if (!error) return null

    return (
      <Alert className="mb-4">
        <AlertCircle className="size-4" />
        <AlertTitle>Document Processing Failed</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-2 flex gap-2">
            <Button
              className="gap-1"
              onClick={retryProcessing}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="size-3" /> Retry
            </Button>
            <Button
              onClick={() => setCurrentUpload(null)}
              size="sm"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Old renderWorkflowStatus removed - replaced with WorkflowIndicator component

  // Process a confirmation message based on the chat input
  const handleMessageSubmit = async (message: string) => {
    const lowerMessage = message.toLowerCase().trim()

    // Handle verification confirmations
    if (
      verification.isInVerificationMode &&
      (lowerMessage === 'confirm' || lowerMessage === 'approve')
    ) {
      await sendMessage(message)
      await completeVerification(true)
      return
    }

    // Handle report generation requests
    if (workflowStep === 'report_generation') {
      if (lowerMessage === 'yes' || lowerMessage.includes('generate report')) {
        await sendMessage(message)
        return
      } else if (lowerMessage === 'no' || lowerMessage.includes('skip')) {
        await sendMessage(message)
        await formatReport({ format: 'pdf' })
        return
      }
    }

    // Default handling for other messages
    await sendMessage(message)
  }

  // Get dynamic placeholder text based on current state
  const getDynamicPlaceholder = () => {
    if (verification.isInVerificationMode) {
      return "Type 'confirm' to approve or enter corrections..."
    } else if (workflowStep === 'report_generation') {
      return "Type 'yes' to generate a report or 'no' to skip..."
    }
    return 'Type a message...'
  }

  // Continue after verification is complete
  const handleContinueAfterVerification = useCallback(() => {
    generateReport()
    addSystemMessage(
      'Would you like to generate a report based on the verified information?',
      'verification_complete'
    )
  }, [generateReport, addSystemMessage])

  // Generate a report with the provided notes
  const handleGenerateReport = useCallback(
    (notes: string) => {
      // Add a progress message for report generation
      const progressMsg = addSystemMessage(
        'Generating your report. This may take a moment...',
        'progress',
        {
          isProgress: true,
          progressValue: 0,
          progressPhase: 'report_generation',
        }
      )

      // Track progress for the report generation
      let progress = 0
      const progressInterval = setInterval(() => {
        progress += 10
        if (progress >= 100) {
          clearInterval(progressInterval)

          setTimeout(() => {
            // Actually generate the report using the API
            try {
              // Get patient data from the service
              const patientData = await apiClient.patients.getPatientById(patientId)
              if (!patientData) throw new Error('Patient data not found')

              // Generate the report using the report service
              const report = await apiClient.reports.generateReport({
                patientId,
                workflowId: localStorage.getItem('current_workflow_id') || '',
                format: 'markdown',
                includeVerificationData: true,
                detailLevel: 'comprehensive',
                additionalNotes: notes || ''
              })

              // Format the report
              formatReport({ format: 'pdf' })

              // Add the generated report content to the chat
              const finalReportMarkdown = report.content || `**Final Report**\n\n- Patient: ${patientData.name || 'Unknown'}\n- Generated: ${new Date().toLocaleDateString()}\n${notes ? `\n**Additional Notes:** ${notes}` : ''}`

              addSystemMessage('Report generation complete!', 'report_complete')

            const newMessage: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: finalReportMarkdown,
              createdAt: new Date(),
              metadata: {
                isReport: true,
                reportId: report?.id || crypto.randomUUID(),
                generatedAt: report?.generatedAt || new Date().toISOString(),
                format: report?.format || 'markdown',
              },
            }

            // Add the report message using Zustand store
            useChatStore.getState().addMessage(newMessage)
            } catch (error) {
              console.error('Error generating report:', error);
              
              // Add error message
              addSystemMessage(
                `Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'error'
              );
              
              // Add a basic fallback report
              const fallbackReportMarkdown = `**Final Report (Generated Offline)**\n\n- Patient ID: ${patientId}\n- Generated: ${new Date().toLocaleDateString()}\n${notes ? `\n**Additional Notes:** ${notes}` : ''}\n\n*Note: This is a basic report as we encountered an error generating the detailed report.*`;
              
              const fallbackMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: fallbackReportMarkdown,
                createdAt: new Date(),
                metadata: {
                  isReport: true,
                  isFallback: true
                },
              };
              
              useChatStore.getState().addMessage(fallbackMessage);
            }
          }, 500)
        } else {
          useChatStore.getState().updateMessageProgress(
            progressMsg.id,
            progress,
            'Generating report'
          )
        }
      }, 400)

      return () => clearInterval(progressInterval)
    },
    [formatReport, addSystemMessage]
  )

  // Skip report generation
  const handleSkipReport = useCallback(() => {
    formatReport({ format: 'pdf' })
    addSystemMessage(
      'Report generation skipped. You can continue chatting or upload a new document.',
      'workflow_complete'
    )
  }, [formatReport, addSystemMessage])

  // State for report panel visibility
  const [showReportPanel, setShowReportPanel] = useState(false)

  // Toggle report panel based on workflow state
  useEffect(() => {
    setShowReportPanel(workflowStep === 'report_generation')
  }, [workflowStep])

  // Wrap component content with error boundary
  const content = (
    <div className="flex h-full flex-col">
      {/* Unified Document uploader */}
      <div className="border-b p-4">
        <UnifiedDocumentUploader
          patientId={patientId}
          documentType="clinical"
          documentCategory="patient_record"
          storageContext="chat"
          title=""
          description="Upload a document to begin processing"
          compact={true}
          showWorkflowStatus={true}
          autoVerify={true}
          onError={(error) => {
            toast({
              title: 'Upload Error',
              description: error,
              variant: 'destructive',
            })
          }}
          onProcessingComplete={(result) => {
            // Set document info when processing completes
            if (result) {
              setActiveDocument({
                id: crypto.randomUUID(),
                title: result.name || 'Document',
                content: result.text || 'Document processed',
                kind: 'text',
              })
              
              // Add document completion message
              setTimeout(() => {
                addSystemMessage(
                  "Document processed successfully. Please review the extracted information below and confirm it's accurate, or provide corrections.",
                  'verification_prompt'
                )
              }, 1000)
            }
          }}
        />
      </div>

      {/* Workflow status indicator - Replaced with new component */}
      {workflowStep !== 'idle' && (
        <div className="bg-muted/50 flex items-center justify-between gap-2 border-b px-4 py-2">
          <WorkflowIndicator showProgress={true} />
          
          {/* Real-time sync status indicator */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-green-500" />
                <span>Synced {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : ''}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                <span>Offline</span>
                <Button 
                  variant="ghost" 
                  size="xs" 
                  className="h-6 px-2 py-0 text-xs" 
                  onClick={() => void forceSync()}
                >
                  Sync
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error recovery UI - enhanced with stage-specific recovery options */}
      {error && (
        <div className="px-4 pt-4">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertTitle>Workflow Error</AlertTitle>
            <AlertDescription>
              {error}
              <div className="mt-4 space-y-3">
                {/* Recovery options based on workflow stage */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Recovery Options</div>
                  <div className="flex flex-wrap gap-2">
                    {handleError.getRecoveryPaths().map((path) => (
                      <Button
                        key={path}
                        className="gap-1 rounded-full px-3 py-1"
                        onClick={() => {
                          // Try stage-specific recovery
                          void handleError.recoverFromError(path, {
                            error,
                            previousStep: workflowStep,
                            currentUpload
                          });
                        }}
                        size="sm"
                        variant="outline"
                      >
                        {path === 'idle' ? 'Reset' : 
                         path === 'uploading' ? 'Retry Upload' :
                         path === 'extracting' ? 'Retry Extraction' :
                         path === 'verification' ? 'Resume Verification' :
                         path === 'report_generation' ? 'Retry Report' :
                         'Go to ' + path.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    className="gap-1"
                    onClick={retryProcessing}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="size-3" /> Retry Last Action
                  </Button>
                  
                  <Button
                    onClick={() => {
                      // Clear error state and current upload
                      handleError.clearError();
                      setCurrentUpload(null);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Workflow content based on current step */}
      <div className="px-4 pt-4">
        <WorkflowStatusDisplay
          activeDocument={activeDocument}
          onContinueAction={handleContinueAfterVerification}
          onGenerateReportAction={() => setShowReportPanel(true)}
          onSkipReportAction={handleSkipReport}
          hideWhenIdle={true}
        />
      </div>

      {/* Report generation panel */}
      <ReportGenerationPanel
        isGenerating={
          processProgress > 0 &&
          processProgress < 100 &&
          workflowStep === 'report_generation'
        }
        onCancel={() => setShowReportPanel(false)}
        onGenerateReport={handleGenerateReport}
        visible={showReportPanel}
      />

      {/* Chat message list - now uses Zustand store directly */}
      <ChatMessageList />

      {/* Message input - always available for continuation of chat */}
      <MessageInput
        isDisabled={
          isLoading || (processingProgress > 0 && processingProgress < 100)
        }
        onSendMessage={handleMessageSubmit}
        placeholder={getDynamicPlaceholder()}
      />
    </div>
  )
  
  // Return with error boundary
  return (
    <ChatErrorBoundary workflowStep={workflowStep} patientId={patientId}>
      {content}
    </ChatErrorBoundary>
  )
}