'use client'

import { AlertCircle, CheckCircle, FileText, RefreshCw } from 'lucide-react'
// External dependencies
import { useCallback, useEffect, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
// Internal components
import { useToast } from '@/components/ui/use-toast'
import { useChatStore } from '@/stores/chat-store'
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
import { WorkflowStatusDisplay } from './workflow-display'

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

  // Local UI state
  const [chatState, setChatState] = useState<ChatStateType>({
    messages: [],
    isLoading: false,
    error: null,
    mode: 'default',
    chatId: null,
    verification: {
      isInVerificationMode: false,
      currentSummary: null,
      summaryVersions: [],
      verificationStatus: 'pending',
      verificationItems: [],
    },
  })

  // Processed document state
  const [activeDocument, setActiveDocument] = useState<{
    readonly id: string
    readonly title: string
    readonly content: string
    readonly kind: 'text' | 'code' | 'spreadsheet'
  } | null>(null)

  // Progress state
  const [processProgress, setProcessProgress] = useState(0)
  const [processPhase, setProcessPhase] = useState<string>('')
  const [currentUpload, setCurrentUpload] = useState<File | null>(null)

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
        // Process document with the Zustand store
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
        // Process the document using the store action
        await processDocument(file, patientId, undefined, abortController.signal)

        // Set document info when processing completes
        if (extractedDocument) {
          setActiveDocument({
            id: crypto.randomUUID(),
            title: file.name,
            content: extractedDocument.extractedData?.rawText || 'Document processed',
            kind: 'text',
          })
        }

        // Add document completion message and start verification if appropriate
        setTimeout(() => {
          if (workflowStep === 'verification') {
            addSystemMessage(
              "Document processed successfully. Please review the extracted information below and confirm it's accurate, or provide corrections.",
              'verification_prompt'
            )

            // In a real app, this would be the actual extracted data
            const extractedSummary = `
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
            startVerification(extractedSummary)
          }
        }, 1000)
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'An unknown error occurred'

        // Differentiate between network errors and processing errors
        const isNetworkError =
          error instanceof TypeError &&
          (error.message.includes('network') || error.message.includes('fetch'))

        toast({
          title: isNetworkError ? 'Network Error' : 'Processing Error',
          description: isNetworkError
            ? 'Failed to connect to the server. Please check your internet connection and try again.'
            : 'Failed to process document. Please try again or contact support.',
          variant: 'destructive',
        })

        addSystemMessage(
          `There was an error processing your document: ${errorMsg}. Would you like to try uploading it again?`,
          'error',
          { isError: true }
        )
      }
    },
    [
      patientId,
      processDocument,
      extractedDocument,
      workflowStep,
      addSystemMessage,
      startVerification,
      toast,
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

  // Sync local state with Zustand store state
  useEffect(() => {
    if (messages && messages.length > 0) {
      setChatState((prev) => ({
        ...prev,
        messages: messages as Message[],
      }))
    }
  }, [messages])

  // Sync loading state from Zustand store
  useEffect(() => {
    setChatState((prev) => ({
      ...prev,
      isLoading,
    }))
  }, [isLoading])
  
  // Sync document processing progress from Zustand store
  useEffect(() => {
    setProcessProgress(docProgress)
  }, [docProgress])
  
  // Sync workflow phase from Zustand store
  useEffect(() => {
    const processingPhase = useChatStore.getState().workflow.processingStatus.phase
    if (processingPhase) {
      setProcessPhase(processingPhase)
    }
  }, [useChatStore().workflow.processingStatus.phase])

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

  // Render the workflow status indicator
  const renderWorkflowStatus = () => {
    if (
      workflowStep === 'idle' ||
      workflowStep === 'complete'
    ) {
      return null
    }

    return (
      <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-2">
        <Badge className="gap-1" variant="outline">
          {verification.isInVerificationMode ? (
            <>
              <CheckCircle className="size-3" />
              <span>Verification Mode</span>
            </>
          ) : (
            <>
              <FileText className="size-3" />
              <span>Processing Document</span>
            </>
          )}
        </Badge>
        {docProgress > 0 && docProgress < 100 && (
          <>
            <Progress className="h-2 flex-1" value={docProgress} />
            <span className="text-muted-foreground text-xs">
              {processPhase}
            </span>
          </>
        )}
      </div>
    )
  }

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
            // Format the report to complete the workflow
            formatReport({ format: 'pdf' })

            // Add a report message to the chat
            const finalReportMarkdown = `**Final Report**\n\n- Diagnosis: Example Condition\n- Recommendations: Follow instructions\n${notes ? `\n**Additional Notes:** ${notes}` : ''}`

            addSystemMessage('Report generation complete!', 'report_complete')

            const newMessage: Message = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: finalReportMarkdown,
              createdAt: new Date(),
              metadata: {
                isReport: true,
              },
            }

            // Add the report message using Zustand store
            useChatStore.getState().addMessage(newMessage)
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

  return (
    <div className="flex h-full flex-col">
      {/* Document uploader */}
      <div className="border-b p-4">
        <DocumentUploader
          allowedTypes={['.pdf', '.docx', '.txt', '.jpg', '.png']}
          description="Upload a document to begin processing"
          multiple={false}
          onComplete={(fileUpload) => {
            // Handle the completed upload by fetching the file from the URL
            fetch(fileUpload.url)
              .then((response) => {
                if (!response.ok) {
                  throw new Error('Failed to fetch document')
                }
                return response.blob()
              })
              .then((blob) => {
                // Create a File object from the blob
                const file = new File(
                  [blob],
                  fileUpload.metadata?.originalFilename ?? 'document',
                  { type: fileUpload.contentType ?? '' }
                )
                return handleProcessDocument(file)
              })
              .catch((error) => {
                toast({
                  title: 'Processing Error',
                  description: 'Failed to process the uploaded document',
                  variant: 'destructive',
                })
                // eslint-disable-next-line no-console
                console.error('Document processing error:', error)
              })
          }}
          onError={(error) => {
            toast({
              title: 'Upload Error',
              description: error,
              variant: 'destructive',
            })
          }}
          onStatusChange={(status) => {
            // Update UI based on upload status if needed
            if (status.status === 'uploading') {
              // Show uploading state
            }
          }}
          showProgress={true}
        />
      </div>

      {/* Workflow status indicator */}
      {renderWorkflowStatus()}

      {/* Error recovery UI */}
      {error && (
        <div className="px-4 pt-4">{renderErrorRecovery()}</div>
      )}

      {/* Workflow content based on current step */}
      {workflowStep !== 'idle' &&
        workflowStep !== 'complete' &&
        !verification.isInVerificationMode && (
          <div className="px-4 pt-4">
            <WorkflowStatusDisplay
              activeDocument={activeDocument}
              currentPhase={processPhase as ProcessingPhase}
              currentStep={workflowStep as WorkflowStep}
              onContinueAction={handleContinueAfterVerification}
              onGenerateReportAction={() => setShowReportPanel(true)}
              onSkipReportAction={handleSkipReport}
            />
          </div>
        )}

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

      {/* Chat message list - always visible to maintain conversation flow */}
      <ChatMessageList
        isLoading={chatState.isLoading}
        messages={chatState.messages}
      />

      {/* Message input - always available for continuation of chat */}
      <MessageInput
        isDisabled={
          chatState.isLoading || (processProgress > 0 && processProgress < 100)
        }
        onSendMessage={handleMessageSubmit}
        placeholder={getDynamicPlaceholder()}
      />
    </div>
  )
}