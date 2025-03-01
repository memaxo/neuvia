'use client'

// External dependencies
import type { ChatRequestOptions } from 'ai'
import { AlertCircle, CheckCircle, FileText, RefreshCw } from 'lucide-react'
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

// Import our modular components
import { DocumentUploader } from './document-uploader'
import { MessageInput } from './message-input'
import { ChatMessageList } from './message-list'
import { ReportGenerationPanel } from './report-panel'
import { WorkflowStatusDisplay } from './workflow-display'

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

  // Chat context / methods - updated to use the new structure
  const {
    messages: contextMessages,
    isLoading: contextIsLoading,
    sendMessage,
    mode,
    workflow,
    verification,
    addSystemMessage,
    startVerification,
  } = useChatContext()

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

  // This simulates original text for verification reference
  const [originalText, setOriginalText] = useState<string>('')

  // Processing states for various actions
  const [isProcessing, setIsProcessing] = useState(false)
  const [processProgress, setProcessProgress] = useState(0)
  const [processPhase, setProcessPhase] = useState('')
  const [processingError, setProcessingError] = useState<string | null>(null)

  // Report generation states
  const [showReportPanel, setShowReportPanel] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [reportProgress, setReportProgress] = useState(0)

  // Verification-specific states
  const [inVerificationMode, setInVerificationMode] = useState(false)
  const [verificationPrompted, setVerificationPrompted] = useState(false)

  // Track the current upload for retry support
  const [currentUpload, setCurrentUpload] = useState<File | null>(null)

  // Update verification mode based on context
  useEffect(() => {
    setInVerificationMode(
      verification?.isInVerificationMode ||
        workflow.workflowStep === 'verification'
    )
  }, [verification?.isInVerificationMode, workflow.workflowStep])

  // Workflow: after verification completes, do we show "report generation" step or finalize?
  const handleVerificationComplete = useCallback(
    (verificationItems: VerificationItem[]) => {
      // Use the workflow method to move to the next step
      workflow.generateReport()
      // Add a system message indicating we're ready to generate a report
      addSystemMessage(
        'Verification complete! Would you like to generate a report with the verified information?',
        'verification_complete'
      )
      setVerificationPrompted(false)
    },
    [workflow, addSystemMessage]
  )

  // Generate the final report
  const handleGenerateReport = useCallback(
    (notes: string) => {
      setIsGeneratingReport(true)
      setReportProgress(0)

      // Add a message indicating report generation has started
      addSystemMessage(
        'Generating your report. This may take a moment...',
        'progress',
        {
          isProgress: true,
          progressValue: 0,
          progressPhase: 'report_generation',
        }
      )

      // Simulate report generation with progress updates
      const progressInterval = setInterval(() => {
        setReportProgress((prev) => {
          const newProgress = prev + 10
          if (newProgress >= 100) {
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

              setChatState((prev) => ({
                ...prev,
                messages: [...prev.messages, newMessage],
              }))

              setIsGeneratingReport(false)
              setShowReportPanel(false)
            }, 500)
          }
          return newProgress
        })
      }, 400)

      return () => clearInterval(progressInterval)
    },
    [workflow, addSystemMessage]
  )

  // Skip report generation
  const handleSkipReport = useCallback(() => {
    workflow.formatReport('pdf')
    setShowReportPanel(false)
    addSystemMessage(
      'Report generation skipped. You can continue chatting or upload a new document.',
      'workflow_complete'
    )
  }, [workflow, addSystemMessage])

  // Handle continue after verification
  const handleContinueAfterVerification = useCallback(() => {
    workflow.generateReport()
    setVerificationPrompted(true)
    addSystemMessage(
      'Would you like to generate a report based on the verified information?',
      'verification_complete'
    )
  }, [workflow, addSystemMessage])

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

  // Helper function to get the phase based on progress
  const processingPhase = (progress: number): string => {
    if (progress < 25) return 'Preparing document'
    if (progress < 50) return 'Extracting content'
    if (progress < 75) return 'Analyzing document'
    return 'Preparing for verification'
  }

  // Handle document upload and processing
  const handleDocumentUpload = useCallback(
    async (file: File) => {
      // Declare progressInterval outside try-catch to make it available in catch block
      let progressInterval: NodeJS.Timeout | null = null

      try {
        setIsProcessing(true)
        setProcessProgress(0)
        setProcessPhase('Preparing document')
        setProcessingError(null)
        setCurrentUpload(file)

        // Add a system message indicating document processing has started
        const processingMsg = addSystemMessage(
          'Processing your document. This may take a moment...',
          'progress',
          { isProgress: true, progressValue: 0, progressPhase: 'extraction' }
        )

        // Progress interval for simulating document processing progress
        progressInterval = setInterval(() => {
          setProcessProgress((prev) => {
            const newProgress = prev + 5

            // Update the phases based on progress
            if (newProgress === 25) {
              setProcessPhase('Extracting content')
            } else if (newProgress === 50) {
              setProcessPhase('Analyzing document')
            } else if (newProgress === 75) {
              setProcessPhase('Preparing for verification')
            }

            // Update the processing message with current progress
            if (processingMsg && processingMsg.id) {
              updateProgressMessage(
                processingMsg.id,
                newProgress,
                processingPhase(newProgress)
              )
            }

            return newProgress >= 100 ? 100 : newProgress
          })
        }, 300)

        // Use workflow methods to process the document
        await workflow.processDocument(file, patientId)

        // If we want to access extracted document data:
        if (workflow.extractedDocument) {
          setExtractedData(
            workflow.extractedDocument as unknown as ExtractedData
          )

          // Mock setting some document preview data
          setActiveDocument({
            id: crypto.randomUUID(),
            title: file.name,
            content: 'Document content would appear here...',
            kind: 'text',
          })

          // After successful processing, add a message about the document
          if (progressInterval) {
            clearInterval(progressInterval)
          }
          setProcessProgress(100)
          setProcessPhase('Processing complete')

          // Add document completion message
          setTimeout(() => {
            // If appropriate for your flow, add a summary message that can be verified
            if (workflow.workflowStep === 'verification') {
              addSystemMessage(
                "Document processed successfully. Please review the extracted information below and confirm it's accurate, or provide corrections.",
                'verification_prompt'
              )

              setVerificationPrompted(true)

              // In a real application, you would have the actual extracted data here
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
              if (startVerification) {
                startVerification(extractedSummary)
              }
            }
          }, 1000)
        }
      } catch (error) {
        if (progressInterval) {
          clearInterval(progressInterval)
        }
        const errorMsg =
          error instanceof Error ? error.message : 'An unknown error occurred'
        setProcessingError(errorMsg)
        setProcessProgress(0)

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
      workflow,
      patientId,
      toast,
      addSystemMessage,
      updateProgressMessage,
      startVerification,
      processingPhase,
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
    if (workflow.workflowStep === 'report_generation') {
      setShowReportPanel(true)
    } else {
      setShowReportPanel(false)
    }
  }, [workflow.workflowStep])

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
    if (!processingError) return null

    return (
      <Alert className="mb-4">
        <AlertCircle className="size-4" />
        <AlertTitle>Document Processing Failed</AlertTitle>
        <AlertDescription>
          {processingError}
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
          {inVerificationMode ? (
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
        {isProcessing && (
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

    // Handle verification confirmations and report generation requests
    if (
      inVerificationMode &&
      (lowerMessage === 'confirm' || lowerMessage === 'approve')
    ) {
      await sendMessage(message)
      handleVerificationComplete([])
      return
    }

    if (workflow.workflowStep === 'report_generation') {
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
            (workflow.workflowStep !== 'idle' &&
              workflow.workflowStep !== 'complete')
          }
          onUpload={handleDocumentUpload}
        />
      </div>

      {/* Workflow status indicator */}
      {renderWorkflowStatus()}

      {/* Error recovery UI */}
      {processingError && (
        <div className="px-4 pt-4">{renderErrorRecovery()}</div>
      )}

      {/* Workflow content based on current step */}
      {workflow.workflowStep !== 'idle' &&
        workflow.workflowStep !== 'complete' &&
        !inVerificationMode && (
          <div className="px-4 pt-4">
            <WorkflowStatusDisplay
              activeDocument={activeDocument}
              currentStep={workflow.workflowStep as WorkflowStep}
              onContinue={handleContinueAfterVerification}
              onGenerateReport={() => setShowReportPanel(true)}
              onSkipReport={handleSkipReport}
            />
          </div>
        )}

      {/* Report generation panel */}
      <ReportGenerationPanel
        isGenerating={isGeneratingReport}
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
        isDisabled={chatState.isLoading || isProcessing || isGeneratingReport}
        onSendMessage={handleMessageSubmit}
        placeholder={
          inVerificationMode
            ? "Type 'confirm' to approve or enter corrections..."
            : workflow.workflowStep === 'report_generation'
              ? "Type 'yes' to generate a report or 'no' to skip..."
              : 'Type a message...'
        }
      />
    </div>
  )
}
