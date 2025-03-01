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
import { useChatContext } from '@/contexts/chat-context'
import type {
  ChatMode,
  ChatState as ChatStateType,
  Message,
  UseProcessingWorkflowResult,
} from '@/lib/chat/types'
import type { ExtractedData } from '@/lib/processing/types/extraction'
import type { VerificationItem } from '@/lib/processing/types/verification'
import type { ProcessingPhase, WorkflowStep } from '@/lib/workflow/types'

import { MessageInput } from '@/components/chat/input/text-input'
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

  // Chat context / methods
  const { messages, isLoading, workflow, sendMessage, addSystemMessage } =
    useChatContext()

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

  // Process document with progress tracking
  const processDocument = useCallback(
    async (file: File) => {
      setProcessProgress(0)
      setProcessPhase('Preparing document')
      setCurrentUpload(file)

      // Create AbortController for cancellation
      const abortController = new AbortController()

      // Add a system message indicating document processing has started
      const processingMsg = addSystemMessage(
        'Processing your document. This may take a moment...',
        'progress',
        { isProgress: true, progressValue: 0, progressPhase: 'extraction' }
      )

      // Set up a progress simulation interval
      const progressInterval = setInterval(() => {
        setProcessProgress((prev) => {
          const newProgress = prev + 5
          let currentPhase = processPhase

          // Update phases based on progress
          if (newProgress <= 25) {
            currentPhase = 'Preparing document'
          } else if (newProgress <= 50) {
            currentPhase = 'Extracting content'
          } else if (newProgress <= 75) {
            currentPhase = 'Analyzing document'
          } else if (newProgress < 100) {
            currentPhase = 'Preparing for verification'
          } else {
            currentPhase = 'Processing complete'
          }

          // Update the processing phase
          setProcessPhase(currentPhase)

          // Update progress message
          if (processingMsg && processingMsg.id) {
            updateProgressMessage(processingMsg.id, newProgress, currentPhase)
          }

          return newProgress >= 100 ? 100 : newProgress
        })
      }, 300)

      try {
        // Use the unified workflow to process the document
        await workflow.processDocument(file, patientId, abortController.signal)

        // Set document info when processing completes
        setActiveDocument({
          id: crypto.randomUUID(),
          title: file.name,
          content:
            workflow.extractedDocument?.extractedData?.rawText ||
            'Document processed',
          kind: 'text',
        })

        // Clear interval when done
        clearInterval(progressInterval)
        setProcessProgress(100)
        setProcessPhase('Processing complete')

        // Add document completion message and start verification if appropriate
        setTimeout(() => {
          if (workflow.workflowStep === 'verification') {
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
            workflow.startVerification(extractedSummary)
          }
        }, 1000)
      } catch (error) {
        // Handle processing errors
        clearInterval(progressInterval)

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
      void processDocument(currentUpload)
    } else {
      toast({
        title: 'No document to retry',
        description: 'Please upload a document first.',
        variant: 'destructive',
      })
    }
  }, [currentUpload, processDocument, toast])

  // Use context messages when they change
  useEffect(() => {
    if (messages && messages.length > 0) {
      setChatState((prev) => ({
        ...prev,
        messages: messages as Message[],
      }))
    }
  }, [messages])

  // Use context loading state
  useEffect(() => {
    setChatState((prev) => ({
      ...prev,
      isLoading,
    }))
  }, [isLoading])

  // Helper to render the error recovery UI
  const renderErrorRecovery = () => {
    if (!workflow.error) return null

    return (
      <Alert className="mb-4">
        <AlertCircle className="size-4" />
        <AlertTitle>Document Processing Failed</AlertTitle>
        <AlertDescription>
          {workflow.error}
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
      workflow.workflowStep === 'idle' ||
      workflow.workflowStep === 'complete'
    ) {
      return null
    }

    return (
      <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-2">
        <Badge className="gap-1" variant="outline">
          {workflow.verification.isInVerificationMode ? (
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
        {processProgress > 0 && processProgress < 100 && (
          <>
            <Progress className="h-2 flex-1" value={processProgress} />
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
      workflow.verification.isInVerificationMode &&
      (lowerMessage === 'confirm' || lowerMessage === 'approve')
    ) {
      await sendMessage(message)
      workflow.completeVerification(true)
      return
    }

    // Handle report generation requests
    if (workflow.workflowStep === 'report_generation') {
      if (lowerMessage === 'yes' || lowerMessage.includes('generate report')) {
        await sendMessage(message)
        return
      } else if (lowerMessage === 'no' || lowerMessage.includes('skip')) {
        await sendMessage(message)
        workflow.formatReport('pdf')
        return
      }
    }

    // Default handling for other messages
    await sendMessage(message)
  }

  // Get dynamic placeholder text based on current state
  const getDynamicPlaceholder = () => {
    if (workflow.verification.isInVerificationMode) {
      return "Type 'confirm' to approve or enter corrections..."
    } else if (workflow.workflowStep === 'report_generation') {
      return "Type 'yes' to generate a report or 'no' to skip..."
    }
    return 'Type a message...'
  }

  // Continue after verification is complete
  const handleContinueAfterVerification = useCallback(() => {
    workflow.generateReport()
    addSystemMessage(
      'Would you like to generate a report based on the verified information?',
      'verification_complete'
    )
  }, [workflow, addSystemMessage])

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
        updateProgressMessage(progressMsg.id, progress, 'Generating report')

        if (progress >= 100) {
          clearInterval(progressInterval)

          setTimeout(() => {
            // Format the report to complete the workflow
            workflow.formatReport('pdf')

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

            // Add the report message
            workflow.addMessage(newMessage)
          }, 500)
        }
      }, 400)

      return () => clearInterval(progressInterval)
    },
    [workflow, addSystemMessage, updateProgressMessage]
  )

  // Skip report generation
  const handleSkipReport = useCallback(() => {
    workflow.formatReport('pdf')
    addSystemMessage(
      'Report generation skipped. You can continue chatting or upload a new document.',
      'workflow_complete'
    )
  }, [workflow, addSystemMessage])

  // State for report panel visibility
  const [showReportPanel, setShowReportPanel] = useState(false)

  // Toggle report panel based on workflow state
  useEffect(() => {
    setShowReportPanel(workflow.workflowStep === 'report_generation')
  }, [workflow.workflowStep])

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
                return processDocument(file)
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
      {workflow.error && (
        <div className="px-4 pt-4">{renderErrorRecovery()}</div>
      )}

      {/* Workflow content based on current step */}
      {workflow.workflowStep !== 'idle' &&
        workflow.workflowStep !== 'complete' &&
        !workflow.verification.isInVerificationMode && (
          <div className="px-4 pt-4">
            <WorkflowStatusDisplay
              activeDocument={activeDocument}
              currentPhase={processPhase as ProcessingPhase}
              currentStep={workflow.workflowStep as WorkflowStep}
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
          workflow.workflowStep === 'report_generation'
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
