import type { Message } from '@/lib/chat/types'
import type { ReportFormat } from '@/lib/processing/types/report'
import type {
  VerificationItem,
  VerificationResult,
} from '@/lib/processing/types/verification'
import type { WorkflowStep } from '@/lib/workflow/types'
import { useCallback, useRef } from 'react'
import { useProcessingWorkflow } from './use-processing-workflow'
import { useWorkflowStateMachine } from './use-workflow-state-machine'

/**
 * Extended processing workflow hook with chat-specific functionality.
 * This hook combines the base processing workflow with additional methods
 * needed for chat-based document processing and verification.
 *
 * Enhanced with state machine architecture for more reliable workflow management.
 * All state management is now centralized in the workflow state machine.
 */
export function useChatProcessingWorkflow() {
  // Use the base processing workflow hook
  const baseWorkflow = useProcessingWorkflow()

  // Reference to message callback function
  const addMessageRef = useRef<((message: Message) => void) | null>(null)

  // Use the workflow state machine hook for all state management
  const stateMachine = useWorkflowStateMachine({
    initialStep: 'idle',
    onStateChange: (state) => {
      // Additional side effects when state changes could be added here if needed
    },
  })

  /**
   * Set the message handler callback
   */
  const setMessageHandler = useCallback(
    (handler: (message: Message) => void) => {
      addMessageRef.current = handler
    },
    []
  )

  /**
   * Process a document with signal handling for cancellation
   */
  const processDocumentWithSignal = useCallback(
    async (file: File, patientId: string, signal: AbortSignal | string) => {
      try {
        // Transition to uploading state
        stateMachine.transition('upload', { file, patientId })

        // Handle both string documentType and AbortSignal
        let result
        if (typeof signal === 'string') {
          // Handle string signal (document type)
          stateMachine.setStatus({
            status: 'processing',
            progress: 10,
            phase: 'uploading',
          })
          result = await baseWorkflow.processDocument(file, patientId, signal)
        } else {
          // Handle AbortSignal
          if (signal.aborted) {
            throw new Error('Document processing was aborted')
          }

          // Create abort handler
          const abortHandler = () => {
            stateMachine.setError('Document processing was aborted by user')
          }

          // Register the abort handler
          signal.addEventListener('abort', abortHandler)

          try {
            // Begin processing with status updates
            stateMachine.setStatus({
              status: 'processing',
              progress: 10,
              phase: 'uploading',
            })
            result = await baseWorkflow.processDocument(file, patientId)

            // Update state machine as extraction progresses
            stateMachine.transition('success')
            stateMachine.setStatus({
              status: 'processing',
              progress: 30,
              phase: 'extraction',
            })
          } finally {
            // Clean up the abort handler
            signal.removeEventListener('abort', abortHandler)
          }
        }

        // Store the result in the state machine
        stateMachine.setData('extractedDocument', result)

        // Transition to verification state after successful extraction
        stateMachine.transition('success')
        stateMachine.setStatus({ status: 'success', progress: 100 })

        return result
      } catch (error) {
        // Handle errors and state transitions
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            stateMachine.setError('Document processing was aborted by user')
          } else {
            stateMachine.setError(error.message)
          }
        } else {
          stateMachine.setError('Unknown error during document processing')
        }

        // Transition to error state
        stateMachine.transition('error')
        throw error
      }
    },
    [baseWorkflow, stateMachine]
  )

  /**
   * Start the verification process with a given summary
   */
  const startVerification = useCallback(
    (summary: string) => {
      // Generate IDs for tracking
      const summaryId = crypto.randomUUID()

      // Store all verification data in the state machine
      stateMachine.setData('verification', {
        isInVerificationMode: true,
        currentSummary: summary,
        originalSummaryId: summaryId,
        currentVersionId: summaryId,
        correctionCount: 0,
      })

      // Ensure we're in the verification state
      if (stateMachine.state.currentStep !== ('verification' as WorkflowStep)) {
        stateMachine.transition('success') // Transition to verification from previous state
      }
    },
    [stateMachine]
  )

  /**
   * Process a correction to a summary
   */
  const processCorrection = useCallback(
    async (
      currentSummary: string,
      correctionText: string,
      messageId?: string
    ) => {
      try {
        // Get current verification data from state machine
        const verification = stateMachine.state.data.verification || {
          isInVerificationMode: true,
          currentSummary,
          originalSummaryId: crypto.randomUUID(),
          currentVersionId: crypto.randomUUID(),
          correctionCount: 0,
        }

        // Increment correction count
        const correctionCount = (verification.correctionCount || 0) + 1

        // Update verification data with new correction count
        stateMachine.setData('verification', {
          ...verification,
          correctionCount,
        })

        // Store correction text
        stateMachine.setData('lastCorrection', correctionText)

        // Set processing status for the correction
        stateMachine.setStatus({
          status: 'processing',
          progress: 50,
          phase: 'correction',
        })

        // In a real implementation, this would call an API
        // to process the correction, but for now, we'll simulate it

        // Generate a new summary ID
        const summaryId = crypto.randomUUID()

        // For demonstration, append the correction to the summary
        // In a real implementation, this would use AI to properly
        // incorporate the correction
        const correctedSummary =
          verification.currentSummary || currentSummary || ''
        const newSummary = `${correctedSummary}\n\nCorrection applied: ${correctionText}`

        // Update the verification data in state machine
        stateMachine.setData('verification', {
          ...verification,
          currentSummary: newSummary,
          currentVersionId: summaryId,
          correctionCount,
        })

        stateMachine.setStatus({ status: 'success', progress: 100 })

        // Return the result
        return {
          summaryId,
          summary: newSummary,
          correctionCount,
        }
      } catch (error) {
        // Handle errors
        const errorMessage =
          error instanceof Error ? error.message : 'Error processing correction'
        stateMachine.setError(errorMessage)
        console.error('Error processing correction:', error)
        return null
      }
    },
    [stateMachine]
  )

  /**
   * Complete the verification process
   */
  const completeVerification = useCallback(
    async (isApproved: boolean) => {
      try {
        // Get verification data from state machine
        const verification = stateMachine.state.data.verification || {
          isInVerificationMode: true,
          currentSummary: null,
          originalSummaryId: null,
          currentVersionId: null,
          correctionCount: 0,
        }

        // Update verification state in state machine
        stateMachine.setData('verification', {
          ...verification,
          isInVerificationMode: false,
        })

        // Store approval status
        stateMachine.setData('isVerificationApproved', isApproved)

        // If approved, transition to report generation
        if (isApproved) {
          stateMachine.transition('success') // Move to report generation
        }

        // Build the verification result
        const result: VerificationResult = {
          isCompleted: true,
          isApproved,
          items: [] as VerificationItem[],
          completedAt: new Date().toISOString(),
          verificationMetadata: {
            verificationStatus: 'completed',
            originalSummaryId: verification.originalSummaryId || '',
            currentVersionId: verification.currentVersionId || '',
            correctionCount: verification.correctionCount || 0,
            corrections: [],
            startedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
          },
        }

        return result
      } catch (error) {
        // Handle errors
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Error completing verification'
        stateMachine.setError(errorMessage)
        console.error('Error completing verification:', error)
        return null
      }
    },
    [stateMachine]
  )

  /**
   * Generate a report based on verified data
   */
  const generateReport = useCallback(() => {
    // Ensure we're in the correct state
    if (
      stateMachine.state.currentStep !== ('report_generation' as WorkflowStep)
    ) {
      if (!stateMachine.transition('success')) {
        console.error('Failed to transition to report generation state')
        return false
      }
    }

    // Update status to indicate report generation is starting
    stateMachine.setStatus({
      status: 'processing',
      progress: 0,
      phase: 'report_generation',
    })

    return true
  }, [stateMachine])

  /**
   * Format the final report
   */
  const formatReport = useCallback(
    (format: ReportFormat) => {
      // Call the base workflow's formatReport if available
      if (
        'formatReport' in baseWorkflow &&
        typeof baseWorkflow.formatReport === 'function'
      ) {
        baseWorkflow.formatReport(format)
      }

      // Complete the workflow
      stateMachine.transition('success') // Move to complete state
      stateMachine.setStatus({ status: 'success', progress: 100 })

      return true
    },
    [baseWorkflow, stateMachine]
  )

  /**
   * Add a message to the chat
   */
  const addMessage = useCallback((message: Message) => {
    if (addMessageRef.current) {
      addMessageRef.current(message)
    }
  }, [])

  /**
   * Reset the workflow state
   */
  const resetWorkflow = useCallback(() => {
    // Reset the state machine
    stateMachine.reset()

    // Reset base workflow if it has a reset method
    if ('reset' in baseWorkflow && typeof baseWorkflow.reset === 'function') {
      baseWorkflow.reset()
    }
  }, [baseWorkflow, stateMachine])

  // Compute verification state from state machine
  const verificationState = {
    isInVerificationMode:
      stateMachine.state.currentStep === ('verification' as WorkflowStep) ||
      (stateMachine.state.data.verification?.isInVerificationMode ?? false),
    currentSummary:
      stateMachine.state.data.verification?.currentSummary ?? null,
  }

  // Return the enhanced workflow with state machine integration
  return {
    // Include all base workflow properties and methods
    ...baseWorkflow,

    // State machine specific properties
    workflowStep: stateMachine.state.currentStep,
    processingStatus: stateMachine.state.status,
    error: stateMachine.state.error,

    // Expose verification state for backward compatibility
    verification: verificationState,

    // Override processDocument with the signal-aware version
    processDocument: processDocumentWithSignal,

    // Additional chat-specific methods
    startVerification,
    processCorrection,
    completeVerification,
    generateReport,
    formatReport,
    addMessage,
    setMessageHandler,
    resetWorkflow,

    // State machine access
    stateMachine,
  }
}

// Export the hook type for use in other components
export type UseChatProcessingWorkflowResult = ReturnType<
  typeof useChatProcessingWorkflow
>
