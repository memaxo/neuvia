'use client'

// External dependencies
import type { ChatRequestOptions } from 'ai'
import { AlertCircle, CheckCircle, FileText, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
// Internal components
import { useToast } from '@/components/ui/use-toast'
import { useChatContext } from '@/contexts/chat-context'
import type { ChatMode, Message } from '@/lib/chat/types'
import type { ExtractedData } from '@/lib/processing/types/extraction'
import type { VerificationItem } from '@/lib/processing/types/verification'
import type { WorkflowStep } from '@/lib/workflow/types'
import { ProcessingPhase } from '@/lib/types/workflow'

// Import our modular components
import { DocumentUploader } from './document-uploader'
import { MessageInput } from './message-input'
import { ChatMessageList } from './message-list'
import { ReportGenerationPanel } from './report-panel'
import { WorkflowStatusDisplay } from './workflow-display'
import { WorkflowIndicator } from '@/components/chat/workflow/workflow-indicator'

// Import specialized workflow hooks
import { useDocumentWorkflow } from '@/lib/workflow/hooks/use-document-workflow'
import { useVerificationWorkflow } from '@/lib/workflow/hooks/use-verification-workflow'
import { useReportWorkflow } from '@/lib/workflow/hooks/use-report-workflow'
import { useWorkflowSync } from '@/lib/hooks/use-workflow-sync'

interface ChatInterfaceProps {
  initialMode: string
  patientId: string
}

interface ChatState {
  messages: Message[]
  isLoading: boolean
  extractResults: {
    url: string
    data: any
  }[]
}

export function ChatInterface({ initialMode, patientId }: ChatInterfaceProps) {
  const { toast } = useToast()

  // Chat context / methods
  const {
    messages: contextMessages,
    isLoading: contextIsLoading,
    sendMessage,
    mode,
    verification: contextVerification,
    addSystemMessage,
    startVerification,
  } = useChatContext()

  // Get the user ID for workflow initialization
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_user_id') || undefined : undefined
  const chatId = typeof localStorage !== 'undefined' ? localStorage.getItem('current_chat_id') || undefined : undefined
  
  // Initialize specialized workflow hooks
  const {
    processDocument,
    status: documentStatus,
    updateProgress: updateDocumentProgress,
    state: documentState,
    documentResult
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
    status: verificationStatus,
    state: verificationState
  } = useVerificationWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  const {
    beginReportGeneration,
    state: reportState,
    status: reportStatus,
    generateReport,
    formatReport
  } = useReportWorkflow({
    userId,
    chatId,
    initialStep: 'idle'
  })
  
  // Derive current workflow state from the specialized hooks
  const workflowStep = documentStatus.currentStep !== 'idle' ? documentStatus.currentStep : 
                      verificationStatus.currentStep !== 'idle' ? verificationStatus.currentStep :
                      reportStatus.currentStep !== 'idle' ? reportStatus.currentStep : 'idle'
                      
  const workflowError = documentState.error || verificationState.error || reportState.error

  // Initialize real-time workflow synchronization
  const workflowId = typeof localStorage !== 'undefined' 
    ? localStorage.getItem('current_workflow_id') 
    : null
    
  const {
    isConnected,
    lastSyncedAt,
    forceSync,
  } = useWorkflowSync(workflowId || undefined)

  // Chat messages / extraction data - now using the contextMessages directly
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    extractResults: [],
  })

  // For manual or inline doc preview
  const [activeDocument, setActiveDocument] = useState<{
    id: string
    title: string
    content: string
    kind: 'text' | 'code' | 'spreadsheet'
  } | null>(null)

  // If we extracted data to verify
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)

  // Processing states for various actions
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingError, setProcessingError] = useState<string | null>(null)

  // Report generation states
  const [showReportPanel, setShowReportPanel] = useState(false)

  // Verification-specific states
  const [inVerificationMode, setInVerificationMode] = useState(false)
  const [verificationPrompted, setVerificationPrompted] = useState(false)

  // Track the current upload for retry support
  const [currentUpload, setCurrentUpload] = useState<File | null>(null)

  // Update verification mode based on context and specialized hooks
  useEffect(() => {
    setInVerificationMode(
      contextVerification?.isInVerificationMode ||
      verificationStatus.isVerifying ||
      workflowStep === 'verification' ||
      workflowStep === 'verification_pending' ||
      workflowStep === 'verification_in_progress'
    )
  }, [
    contextVerification?.isInVerificationMode, 
    verificationStatus.isVerifying,
    workflowStep
  ])

  // Function to update progress messages
  const updateProgressMessage = useCallback(
    (messageId: string, progress: number, phase: string) => {
      setChatState((prev) => {
        const messages = [...prev.messages]
        const msgIndex = messages.findIndex((m) => m.id === messageId)

        if (msgIndex !== -1) {
          messages[msgIndex] = {
            ...messages[msgIndex],
            metadata: {
              ...messages[msgIndex].metadata,
              progressValue: progress,
              progressPhase: phase,
            },
          }
        }

        return {
          ...prev,
          messages,
        }
      })
    },
    []
  )

  // Handle verification complete action
  const handleVerificationComplete = useCallback(
    async () => {
      try {
        // Add a system message indicating verification is complete
        addSystemMessage(
          'Verification complete! Would you like to generate a report with the verified information?',
          'verification_complete'
        )
        
        // Complete verification using the specialized hook
        await completeVerification()
        
        // Start report generation workflow
        await beginReportGeneration('comprehensive', { patientId })
        
        setVerificationPrompted(false)
      } catch (error) {
        console.error('Error completing verification:', error)
        
        toast({
          title: 'Verification Error',
          description: error instanceof Error ? error.message : 'Failed to complete verification',
          variant: 'destructive',
        })
      }
    },
    [completeVerification, beginReportGeneration, addSystemMessage, patientId, toast]
  )

  // Generate the final report using the specialized report workflow hook
  const handleGenerateReport = useCallback(
    async (notes: string) => {
      try {
        // Add a message indicating report generation has started
        const progressMsg = addSystemMessage(
          'Generating your report. This may take a moment...',
          'progress',
          {
            isProgress: true,
            progressValue: 0,
            progressPhase: 'report_generation',
          }
        )

        // Use the specialized report workflow hook to generate the report
        const reportResult = await generateReport({
          patientId,
          notes,
          format: 'markdown',
          progressCallback: (progress, phase) => {
            // Update progress message
            updateProgressMessage(
              progressMsg.id,
              progress,
              phase || 'report_generation'
            )
          }
        })

        if (reportResult.success) {
          // Add the report completion message
          addSystemMessage('Report generation complete!', 'report_complete')

          // Add the report content as a message
          const newMessage: Message = {
            id: reportResult.reportId || crypto.randomUUID(),
            role: 'assistant',
            content: reportResult.content || `**Final Report**\n\n- Patient ID: ${patientId}\n- Generated: ${new Date().toLocaleDateString()}\n${notes ? `\n**Additional Notes:** ${notes}` : ''}`,
            createdAt: new Date(),
            metadata: {
              isReport: true,
              reportId: reportResult.reportId,
              format: 'markdown'
            },
          }

          setChatState((prev) => ({
            ...prev,
            messages: [...prev.messages, newMessage],
          }))
        }

        // Hide the report generation panel
        setShowReportPanel(false)
      } catch (error) {
        console.error('Error generating report:', error)
        
        // Add error message
        addSystemMessage(
          `Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'error',
          { isError: true }
        )
        
        // Create a fallback report
        const fallbackReport = `**Final Report (Fallback)**\n\n- Patient ID: ${patientId}\n- Generated: ${new Date().toLocaleDateString()}\n${notes ? `\n**Additional Notes:** ${notes}` : ''}\n\n*Note: This is a basic report as we encountered an error generating the detailed report.*`
        
        const newMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fallbackReport,
          createdAt: new Date(),
          metadata: {
            isReport: true,
            isFallback: true,
          },
        }
        
        setChatState((prev) => ({
          ...prev,
          messages: [...prev.messages, newMessage],
        }))
        
        setShowReportPanel(false)
      }
    },
    [generateReport, addSystemMessage, updateProgressMessage, patientId]
  )

  // Skip report generation
  const handleSkipReport = useCallback(() => {
    // Use the specialized report workflow hook to reset to idle
    resetVerification() // Reset verification state
    
    setShowReportPanel(false)
    addSystemMessage(
      'Report generation skipped. You can continue chatting or upload a new document.',
      'workflow_complete'
    )
  }, [resetVerification, addSystemMessage])

  // Handle continue after verification
  const handleContinueAfterVerification = useCallback(() => {
    // Use the specialized report workflow hook to begin report generation
    beginReportGeneration('comprehensive', { patientId })
    
    setVerificationPrompted(true)
    addSystemMessage(
      'Would you like to generate a report based on the verified information?',
      'verification_complete'
    )
  }, [beginReportGeneration, patientId, addSystemMessage])

  // Handle document upload and processing
  const handleDocumentUpload = useCallback(
    async (file: File) => {
      try {
        setIsProcessing(true)
        setProcessingError(null)
        setCurrentUpload(file)

        // Add a system message indicating document processing has started
        const processingMsg = addSystemMessage(
          'Processing your document. This may take a moment...',
          'progress',
          { isProgress: true, progressValue: 0, progressPhase: 'extraction' }
        )

        // Use the specialized document workflow hook to process the document
        const result = await processDocument(file, {
          patientId,
          onProgress: (progress, phase) => {
            // Update the processing message with current progress
            if (processingMsg && processingMsg.id) {
              updateProgressMessage(
                processingMsg.id,
                progress,
                phase.toString()
              )
            }
          }
        })

        // If we want to access extracted document data:
        if (result.success && result.extractedText) {
          setExtractedData(result as unknown as ExtractedData)

          // Set document preview data
          setActiveDocument({
            id: result.documentId || crypto.randomUUID(),
            title: file.name,
            content: result.extractedText || 'Document content would appear here...',
            kind: 'text',
          })

          // Add document completion message
          setTimeout(() => {
            // Start verification with the extracted document data
            if (verificationStatus.isVerifying || documentStatus.isComplete) {
              addSystemMessage(
                "Document processed successfully. Please review the extracted information below and confirm it's accurate, or provide corrections.",
                'verification_prompt'
              )

              setVerificationPrompted(true)

              // Use the actual extracted text, fallback to a sample if needed
              const extractedSummary = result.extractedText || `
## Patient Information
- **Name**: John Doe
- **Age**: 45
- **Date of Birth**: January 15, 1978

## Medical History
- Hypertension (diagnosed 2015)
- Type 2 Diabetes (diagnosed 2018)
- History of lower back pain

## Current Medications
- Lisinopril 10mg daily
- Metformin 500mg twice daily
- Ibuprofen as needed for pain

## Recent Test Results
- Blood Pressure: 135/85
- Blood Glucose: 142 mg/dL (fasting)
- A1C: 7.1%
`

              // Start verification with the extracted summary
              if (startVerification) {
                startVerification(extractedSummary)
              }
              
              // Also use the specialized verification workflow hook
              initiateVerification(extractedSummary, processingMsg.id)
            }
          }, 1000)
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'An unknown error occurred'
        setProcessingError(errorMsg)

        toast({
          title: 'Processing Error',
          description:
            'Failed to process document. Please try again or contact support.',
          variant: 'destructive',
        })

        addSystemMessage(
          `There was an error processing your document: ${errorMsg}. Would you like to try uploading it again?`,
          'error',
          { isError: true }
        )
      } finally {
        setIsProcessing(false)
      }
    },
    [
      processDocument,
      initiateVerification,
      patientId,
      toast,
      addSystemMessage,
      updateProgressMessage,
      startVerification,
      documentStatus.isComplete,
      verificationStatus.isVerifying
    ]
  )

  // Handle retry for failed document processing
  const handleRetryProcessing = useCallback(() => {
    if (currentUpload) {
      handleDocumentUpload(currentUpload)
    } else {
      toast({
        title: 'No document to retry',
        description: 'Please upload a document first.',
        variant: 'destructive',
      })
    }
  }, [currentUpload, handleDocumentUpload, toast])

  // Use context messages when they change
  useEffect(() => {
    if (contextMessages && contextMessages.length > 0) {
      setChatState((prev) => ({
        ...prev,
        messages: contextMessages as Message[],
      }))
    }
  }, [contextMessages])

  // Use context loading state
  useEffect(() => {
    setChatState((prev) => ({
      ...prev,
      isLoading: contextIsLoading,
    }))
  }, [contextIsLoading])

  // Show or hide the report generation panel based on workflow step
  useEffect(() => {
    setShowReportPanel(
      workflowStep === 'report_generation' || 
      reportStatus.isGeneratingReport
    )
  }, [workflowStep, reportStatus.isGeneratingReport])

  // Add verification instructions when entering verification mode
  useEffect(() => {
    if (inVerificationMode && !verificationPrompted) {
      setVerificationPrompted(true)

      // Delay the prompt slightly for better UX
      const timeoutId = setTimeout(() => {
        addSystemMessage(
          'Please review the information above. You can:\n\n' +
            "- Type 'confirm' to approve it as accurate\n" +
            '- Type corrections directly to fix any issues\n' +
            '- Ask questions if you need clarification',
          'verification_instructions'
        )
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [inVerificationMode, verificationPrompted, addSystemMessage])

  // Helper to render the error recovery UI
  const renderErrorRecovery = () => {
    if (!processingError && !workflowError) return null

    const errorMessage = processingError || workflowError || 'An error occurred'

    return (
      <Alert className="mb-4">
        <AlertCircle className="size-4" />
        <AlertTitle>Document Processing Failed</AlertTitle>
        <AlertDescription>
          {errorMessage}
          <div className="mt-2 flex gap-2">
            <Button
              className="gap-1"
              onClick={handleRetryProcessing}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="size-3" /> Retry
            </Button>
            <Button
              onClick={() => {
                setCurrentUpload(null)
                setProcessingError(null)
                // Reset workflow states
                resetVerification()
              }}
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

  // Process a confirmation message based on the chat input
  const handleMessageSubmit = async (message: string) => {
    const lowerMessage = message.toLowerCase().trim()

    // Handle verification confirmations using the specialized verification workflow hook
    if (
      inVerificationMode &&
      (lowerMessage === 'confirm' || lowerMessage === 'approve')
    ) {
      await sendMessage(message)
      await handleVerificationComplete()
      return
    }

    // Handle correction messages using the specialized verification workflow hook
    if (inVerificationMode && 
        !(lowerMessage === 'confirm' || lowerMessage === 'approve')) {
      await sendMessage(message)
      
      // Process the correction using the specialized verification workflow hook
      if (verificationState.currentSummary) {
        await processCorrection(message, verificationState.currentSummary)
      }
      return
    }

    // Handle report generation requests using the specialized report workflow hook
    if (reportStatus.isGeneratingReport || workflowStep === 'report_generation') {
      if (lowerMessage === 'yes' || lowerMessage.includes('generate report')) {
        await sendMessage(message)
        setShowReportPanel(true)
        return
      } else if (lowerMessage === 'no' || lowerMessage.includes('skip')) {
        await sendMessage(message)
        handleSkipReport()
        return
      }
    }

    // Default handling for other messages
    await sendMessage(message)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Document uploader */}
      <div className="border-b p-4">
        <DocumentUploader
          disabled={
            isProcessing ||
            (workflowStep !== 'idle' &&
              workflowStep !== 'complete')
          }
          onUpload={handleDocumentUpload}
        />
      </div>

      {/* Workflow status indicator */}
      {workflowStep !== 'idle' && (
        <div className="bg-muted/50 flex items-center justify-between gap-2 border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Badge className="gap-1" variant="outline">
              {inVerificationMode ? (
                <>
                  <CheckCircle className="size-3" />
                  <span>Verification Mode</span>
                </>
              ) : workflowStep === 'report_generation' ? (
                <>
                  <FileText className="size-3" />
                  <span>Report Generation</span>
                </>
              ) : (
                <>
                  <FileText className="size-3" />
                  <span>Processing Document</span>
                </>
              )}
            </Badge>
            
            {documentState.progress > 0 && documentState.progress < 100 && (
              <>
                <Progress className="h-2 w-32" value={documentState.progress} />
                <span className="text-muted-foreground text-xs">
                  {documentState.phase}
                </span>
              </>
            )}
          </div>
          
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

      {/* Error recovery UI */}
      {(processingError || workflowError) && (
        <div className="px-4 pt-4">{renderErrorRecovery()}</div>
      )}

      {/* Workflow content based on current step */}
      {workflowStep !== 'idle' &&
        workflowStep !== 'complete' &&
        !inVerificationMode && (
          <div className="px-4 pt-4">
            <WorkflowStatusDisplay
              activeDocument={activeDocument}
              currentStep={workflowStep as WorkflowStep}
              onContinue={handleContinueAfterVerification}
              onGenerateReport={() => setShowReportPanel(true)}
              onSkipReport={handleSkipReport}
            />
          </div>
        )}

      {/* Report generation panel */}
      <ReportGenerationPanel
        isGenerating={reportStatus.isGeneratingReport}
        onCancel={() => setShowReportPanel(false)}
        onGenerateReport={handleGenerateReport}
        visible={showReportPanel}
      />

      {/* Chat message list - always visible to maintain conversation flow */}
      <ChatMessageList
        isLoading={chatState.isLoading}
        messages={chatState.messages}
      />

      {/* Message input - always available for continuation of chat */}
      <MessageInput
        isDisabled={
          chatState.isLoading || 
          isProcessing || 
          reportStatus.isGeneratingReport
        }
        onSendMessage={handleMessageSubmit}
        placeholder={
          inVerificationMode
            ? "Type 'confirm' to approve or enter corrections..."
            : reportStatus.isGeneratingReport || workflowStep === 'report_generation'
              ? "Type 'yes' to generate a report or 'no' to skip..."
              : 'Type a message...'
        }
      />
    </div>
  )
}
