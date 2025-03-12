'use client'

import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
// External dependencies
import { useCallback, useEffect, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
// Internal components
import { useToast } from '@/components/ui/use-toast'
import { useChatStore, useErrorHandler } from '@/stores/chat-store'
import { WorkflowStatusDisplay } from '@/components/chat/workflow/workflow-status-display'
import { WorkflowIndicator } from '@/components/chat/workflow/workflow-indicator'
import { UnifiedDocumentUploader } from '@/components/upload/unified-document-uploader'
// Import API client and service layer
import { apiClient } from '@/lib/api/client/api-client'
import { verificationService } from '@/lib/services/verification/verification-service'
// Import real-time sync hook
import { useWorkflowSync } from '@/lib/hooks/use-workflow-sync'
// Import specialized workflow hooks
import { useDocumentWorkflow } from '@/lib/workflow/hooks/use-document-workflow'
import { useVerificationWorkflow } from '@/lib/workflow/hooks/use-verification-workflow'
import { useReportWorkflow } from '@/lib/workflow/hooks/use-report-workflow'
// Import error boundary
import { ChatErrorBoundary } from '@/components/chat/error/error-boundary'

import type { Message } from '@/lib/chat/types'

import { ChatInput } from '@/components/chat/input/ChatInput'
import { ChatMessageList } from '@/components/chat/message/message-list'
import { ReportGenerationPanel } from '@/components/chat/workflow/report-panel'

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
  const errorHandler = useErrorHandler()

  // Chat state and methods from Zustand store
  const _messages = useChatStore((state) => state.messages)
  const isLoading = useChatStore((state) => state.isLoading)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const addSystemMessage = useChatStore((state) => state.addSystemMessage)
  const extractedDocument = useChatStore((state) => state.extractedDocument)
  const startVerification = useChatStore((state) => state.startVerification)
  const verification = useChatStore((state) => state.verification)
  
  // Get the user ID for workflow initialization
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_id') || undefined : undefined
  const chatId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_chat_id') || undefined : undefined
  
  // Initialize specialized workflow hooks
  const {
    processDocument,
    status: documentStatus,
    updateProgress: updateDocumentProgress,
    state: documentState
  } = useDocumentWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    initiateVerification,
    processCorrection,
    completeVerification,
    resetVerification,
    status: verificationStatus
  } = useVerificationWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    beginReportGeneration,
    state: reportState,
    status: reportStatus
  } = useReportWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Derive current workflow state from the specialized hooks
  const workflowStep = documentStatus.currentStep !== 'idle' ? documentStatus.currentStep : 
                      verificationStatus.currentStep !== 'idle' ? verificationStatus.currentStep :
                      reportStatus.currentStep !== 'idle' ? reportStatus.currentStep : 'idle'
                      
  const error = documentState.error || verificationStatus.isError ? documentState.error : null

  // Initialize real-time workflow synchronization
  // This enables multiple users to see updates to the workflow in real-time
  const workflowId =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('current_workflow_id')
      : null
  const {
    isConnected,
    lastSyncedAt,
    error: _syncError,
    forceSync,
  } = useWorkflowSync(workflowId || undefined)

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

  // Top-level hook extraction
  const updateMessageProgress = useChatStore(
    (state) => state.updateMessageProgress
  )

  // Process document with the specialized document workflow hook
  const handleProcessDocument = useCallback(
    async (file: File) => {
      setCurrentUpload(file)

      // Add a system message indicating document processing has started
      const processingMsg = addSystemMessage(
        'Processing your document. This may take a moment...',
        'progress',
        { isProgress: true, progressValue: 0, progressPhase: 'extraction' }
      )

      try {
        // Process the document using the specialized document workflow hook
        // This handles all database operations, workflow state management, and more
        const result = await processDocument(file, {
          patientId
        });

        // Update progress in the message
        const progressUpdater = (progress: number, phase: string) => {
          updateMessageProgress(
            processingMsg.id,
            progress,
            phase
          );
        };

        // Setup progress reporter
        documentState.progress && progressUpdater(documentState.progress, documentState.phase || 'extraction');

        // Set document info when processing completes
        if (result && result.success) {
          setActiveDocument({
            id: result.documentId || crypto.randomUUID(),
            title: file.name,
            content: result.extractedText || 'Document processed',
            kind: 'text',
          });

          // Add document completion message
          if (documentStatus.isComplete || verificationStatus.isVerifying) {
            addSystemMessage(
              "Document processed successfully. Please review the extracted information below and confirm it's accurate, or provide corrections.",
              'verification_prompt'
            );

            // Start verification with the extracted document data
            const verificationResult = await initiateVerification(
              result.extractedText || '', 
              processingMsg.id
            );

            if (verificationResult) {
              startVerification(
                verificationResult.summary || result.extractedText || ''
              );
            }
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'An unknown error occurred';

        // Use the existing error handler to handle document processing errors
        errorHandler.handleError(error, 'Failed to process document', {
          step: 'document_processing',
          details: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          },
        });

        // Also add a system message to provide context in the chat
        addSystemMessage(
          `There was an error processing your document. Would you like to try uploading it again?`,
          'error',
          {
            isError: true,
            originalError: errorMsg,
            errorStep: 'document_processing',
            canRetry: true,
          }
        );
      }
    },
    [
      patientId,
      processDocument,
      initiateVerification,
      updateMessageProgress,
      documentState,
      documentStatus,
      verificationStatus,
      addSystemMessage,
      startVerification,
      errorHandler,
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
  const processingProgress = useChatStore((state) => state.docProgress)
  const _processingPhase = useChatStore(
    (state) => state.workflow.processingStatus.phase
  )

  // Helper to render the error recovery UI
  const _renderErrorRecovery = () => {
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

    // Handle verification confirmations using the specialized verification workflow hook
    if (
      verification.isInVerificationMode &&
      (lowerMessage === 'confirm' || lowerMessage === 'approve')
    ) {
      await sendMessage(message)
      // Use the specialized verification workflow hook to complete verification
      await completeVerification()
      return
    }

    // Handle correction messages using the specialized verification workflow hook
    if (verification.isInVerificationMode && 
        !(lowerMessage === 'confirm' || lowerMessage === 'approve')) {
      await sendMessage(message)
      // Use the specialized verification workflow hook to process correction
      if (verification.summary) {
        await processCorrection(message, verification.summary)
      }
      return
    }

    // Handle report generation requests using the specialized report workflow hook
    if (workflowStep === 'report_generation') {
      if (lowerMessage === 'yes' || lowerMessage.includes('generate report')) {
        await sendMessage(message)
        // Additional report generation logic will be handled by WorkflowStatusDisplay
        return
      } else if (lowerMessage === 'no' || lowerMessage.includes('skip')) {
        await sendMessage(message)
        // Skip report generation using the specialized report workflow hook
        // (The actual report formatting will be handled when needed)
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

  // Continue after verification is complete - using specialized report workflow hook
  const handleContinueAfterVerification = useCallback(() => {
    // Use the specialized report workflow hook to begin report generation
    beginReportGeneration('comprehensive', { patientId })
    
    addSystemMessage(
      'Would you like to generate a report based on the verified information?',
      'verification_complete'
    )
  }, [beginReportGeneration, addSystemMessage, patientId])

  // Generate a report with the provided notes - using specialized report workflow hook
  const handleGenerateReport = useCallback(
    async (notes: string) => {
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

      try {
        // Use the specialized report workflow hook to generate the report
        // The generateReport method handles all the database operations and state management
        const reportResult = await beginReportGeneration('comprehensive', {
          patientId,
          additionalNotes: notes
        });
        
        // Setup progress updater based on report workflow state
        const updateReportProgress = () => {
          if (reportState.progress) {
            updateMessageProgress(
              progressMsg.id,
              reportState.progress,
              reportState.phase || 'report_generation'
            )
          }
        }
        
        // Initial progress update
        updateReportProgress();
        
        // If report generation was successful, process the result
        if (reportResult) {
          try {
            // Get patient data for the report
            const patientData = await apiClient.patients.getPatient(patientId)
            
            // The result will contain the report data or we'll create a simple version
            const finalReportMarkdown = reportResult.content || 
              `**Final Report**\n\n- Patient: ${patientData?.name || 'Unknown'}\n- Generated: ${new Date().toLocaleDateString()}\n${notes ? `\n**Additional Notes:** ${notes}` : ''}`
              
            addSystemMessage('Report generation complete!', 'report_complete')
            
            // Create a message with the report content
            const newMessage: Message = {
              id: reportResult.reportId || crypto.randomUUID(),
              role: 'assistant',
              content: finalReportMarkdown,
              createdAt: new Date(),
              metadata: {
                isReport: true,
                reportId: reportResult.reportId || crypto.randomUUID(),
                generatedAt: reportResult.timestamp || new Date().toISOString(),
                format: 'markdown',
              },
            }
            
            useChatStore.getState().addMessage(newMessage)
          } catch (error) {
            handleReportGenerationError(error, notes)
          }
        }
      } catch (error) {
        handleReportGenerationError(error, notes)
      }
    },
    [beginReportGeneration, reportState, addSystemMessage, updateMessageProgress, patientId]
  )
  
  // Helper function to handle report generation errors
  const handleReportGenerationError = useCallback((error: unknown, notes?: string) => {
    console.error('Error generating report:', error)
    
    addSystemMessage(
      `Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
    
    // Create a fallback report message
    const fallbackReportMarkdown = `**Final Report (Generated Offline)**\n\n- Patient ID: ${patientId}\n- Generated: ${new Date().toLocaleDateString()}\n${notes ? `\n**Additional Notes:** ${notes}` : ''}\n\n*Note: This is a basic report as we encountered an error generating the detailed report.*`
    
    const fallbackMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: fallbackReportMarkdown,
      createdAt: new Date(),
      metadata: {
        isReport: true,
        isFallback: true,
      },
    }
    
    useChatStore.getState().addMessage(fallbackMessage)
  }, [addSystemMessage, patientId])

  // Skip report generation - using specialized report workflow hook
  const handleSkipReport = useCallback(() => {
    // Reset the report workflow to idle
    beginReportGeneration('none', { patientId })
    
    addSystemMessage(
      'Report generation skipped. You can continue chatting or upload a new document.',
      'workflow_complete'
    )
  }, [beginReportGeneration, addSystemMessage, patientId])

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
          autoVerify={true}
          compact={true}
          description="Upload a document to begin processing"
          documentCategory="patient_record"
          documentType="clinical"
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
          patientId={patientId}
          showWorkflowStatus={true}
          storageContext="chat"
          title=""
        />
      </div>

      {/* Workflow status indicator - Replaced with new component */}
      {workflowStep !== 'idle' && (
        <div className="bg-muted/50 flex items-center justify-between gap-2 border-b px-4 py-2">
          <WorkflowIndicator showProgress={true} />

          {/* Real-time sync status indicator */}
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            {isConnected ? (
              <>
                <Wifi className="size-3.5 text-green-500" />
                <span>
                  Synced{' '}
                  {lastSyncedAt
                    ? new Date(lastSyncedAt).toLocaleTimeString()
                    : ''}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="size-3.5 text-amber-500" />
                <span>Offline</span>
                <Button
                  className="h-6 px-2 py-0 text-xs"
                  onClick={() => void forceSync()}
                  size="sm"
                  variant="ghost"
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
          <Alert className="mb-4" variant="error">
            <AlertCircle className="size-4" />
            <AlertTitle>Workflow Error</AlertTitle>
            <AlertDescription>
              {error}
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <div className="text-muted-foreground text-xs font-medium">
                    Recovery Options
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(errorHandler.getRecoveryPaths() || []).map(
                      (path: string) => (
                        <Button
                          className="gap-1 rounded-full px-3 py-1"
                          key={path}
                          onClick={() => {
                            // Try stage-specific recovery
                            void errorHandler.recoverFromError(path, {
                              error,
                              previousStep: workflowStep,
                              currentUpload,
                            })
                          }}
                          size="sm"
                          variant="outline"
                        >
                          {path === 'idle'
                            ? 'Reset'
                            : path === 'uploading'
                              ? 'Retry Upload'
                              : path === 'extracting'
                                ? 'Retry Extraction'
                                : path === 'verification'
                                  ? 'Resume Verification'
                                  : path === 'report_generation'
                                    ? 'Retry Report'
                                    : `Go to ${path.replace('_', ' ')}`}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="gap-1"
                    onClick={retryProcessing}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="size-3" /> Retry
                  </Button>
                  <Button
                    onClick={() => {
                      // Clear error state and current upload
                      errorHandler.clearError()
                      setCurrentUpload(null)
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
          hideWhenIdle={true}
          onContinueAction={handleContinueAfterVerification}
          onGenerateReportAction={() => setShowReportPanel(true)}
          onSkipReportAction={handleSkipReport}
        />
      </div>

      {/* Report generation panel */}
      <ReportGenerationPanel
        isGenerating={
          processingProgress > 0 &&
          processingProgress < 100 &&
          workflowStep === 'report_generation'
        }
        onCancel={() => setShowReportPanel(false)}
        onGenerateReport={handleGenerateReport}
        visible={showReportPanel}
      />

      {/* Chat message list - now uses Zustand store directly */}
      <ChatMessageList />

      {/* Message input - always available for continuation of chat */}
      <ChatInput
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
    <ChatErrorBoundary patientId={patientId} workflowStep={workflowStep}>
      {content}
    </ChatErrorBoundary>
  )
}
