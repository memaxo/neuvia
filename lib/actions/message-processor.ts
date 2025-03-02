import { Message } from '../chat/types'
import type {
  ChatAction,
  ChatMode,
  ReportFormat,
  UseProcessingWorkflowResult,
} from '../chat/types'
import type { Dispatch } from 'react'
import { chatActions } from '../../contexts/reducers/chat-reducer'

/**
 * Process a message based on the current chat mode
 */
export async function processMessage(
  content: string,
  mode: ChatMode,
  dispatch: Dispatch<ChatAction>
): Promise<void> {
  const normalizedContent = content.toLowerCase().trim()

  // Handle verification mode
  if (mode === 'verification') {
    await handleVerificationMessage(normalizedContent, content, dispatch)
    return
  }

  // Default chat handling - simulate a basic response
  dispatch(
    chatActions.addMessage({
      role: 'assistant',
      content: `I received your message: "${content}".`,
      createdAt: new Date(),
    })
  )
}

/**
 * Handle a message in verification mode
 */
async function handleVerificationMessage(
  normalizedContent: string,
  originalContent: string,
  dispatch: Dispatch<ChatAction>
): Promise<void> {
  // Check if confirmation message
  if (normalizedContent === 'confirm') {
    try {
      // First, let's update the progress to indicate we're working on it
      const progressMessageId = crypto.randomUUID()
      dispatch(
        chatActions.addMessage({
          id: progressMessageId,
          role: 'system',
          content: 'Processing verification...',
          createdAt: new Date(),
          metadata: {
            isProgress: true,
            progressValue: 50,
            progressPhase: 'verification',
          },
        })
      )

      // Get the verification state from a custom hook
      // We need to import and use it directly since we can't use hooks here
      // In a real implementation, you might handle this with a service call
      // For demo, use direct actions
      dispatch(chatActions.completeVerification(true))

      // Complete the progress message
      dispatch(
        chatActions.updateProgress(
          progressMessageId,
          100,
          'verification_completed'
        )
      )

      // Add a system message indicating success
      dispatch(
        chatActions.addMessage({
          role: 'system',
          content: 'Verification completed successfully.',
          createdAt: new Date(),
          metadata: {
            type: 'success',
          },
        })
      )

      // Transition to report generation
      dispatch(chatActions.startReportGeneration())
      return
    } catch (error) {
      console.error('Error during verification confirmation:', error)
      // Handle errors appropriately
      dispatch(chatActions.setError(String(error)))
      return
    }
  }

  // Handle rejection
  if (normalizedContent === 'reject' || normalizedContent === 'decline') {
    dispatch(
      chatActions.addMessage({
        role: 'system',
        content:
          'Verification rejected. Please provide details on what needs to be corrected.',
        createdAt: new Date(),
        metadata: {
          type: 'verification_rejected',
        },
      })
    )
    return
  }

  // Handle corrections
  if (
    normalizedContent.startsWith('correct:') ||
    normalizedContent.includes('needs correction') ||
    normalizedContent.includes('fix this') ||
    normalizedContent.includes('change this')
  ) {
    const correctionText = normalizedContent.startsWith('correct:')
      ? originalContent.substring(8).trim()
      : originalContent

    dispatch(chatActions.submitCorrection(correctionText))

    // Add a processing message
    const correctionProgressId = crypto.randomUUID()
    dispatch(
      chatActions.addMessage({
        id: correctionProgressId,
        role: 'system',
        content: 'Processing your correction...',
        createdAt: new Date(),
        metadata: {
          isProgress: true,
          progressValue: 0,
          progressPhase: 'correction',
        },
      })
    )

    try {
      // In a real app, you would call an API to process the correction
      // For now, simulate a delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Complete the progress message
      dispatch(
        chatActions.updateProgress(correctionProgressId, 100, 'completed')
      )

      // Get a placeholder for a corrected summary
      // In a real app, this would come from your API or service
      const correctedSummary = `This is a placeholder for the corrected summary based on: "${correctionText}"`
      const summaryId = crypto.randomUUID()

      // Add the corrected summary
      dispatch(
        chatActions.addMessage({
          role: 'assistant',
          content: correctedSummary,
          createdAt: new Date(),
          metadata: {
            isSummary: true,
            summaryVersionId: summaryId,
            verificationMetadata: {
              verificationStatus: 'in_progress',
            },
          },
        })
      )

      // Ask for confirmation again
      dispatch(
        chatActions.addMessage({
          role: 'system',
          content:
            "I've updated the summary based on your correction. Please review it and type 'confirm' to approve or provide additional corrections.",
          createdAt: new Date(),
          metadata: {
            isVerificationRequest: true,
          },
        })
      )

      return
    } catch (error) {
      console.error('Error processing correction:', error)
      dispatch(chatActions.setError(String(error)))
      return
    }
  }

  // Handle other messages in verification mode
  dispatch(
    chatActions.addMessage({
      role: 'assistant',
      content: `I'm in verification mode. You can type "confirm" to approve the document, or provide corrections.`,
      createdAt: new Date(),
    })
  )
}

/**
 * Interface for report format options
 */
interface ProcessingReportFormat {
  format: 'markdown' | 'pdf' | 'docx' | 'html' | 'json'
  style?: 'clinical' | 'academic' | 'simplified'
  metadataInFooter?: boolean
}

/**
 * Handle a message in report generation mode
 */
async function handleReportGenerationMessage(
  normalizedContent: string,
  originalContent: string,
  dispatch: Dispatch<ChatAction>,
  workflow: UseProcessingWorkflowResult
): Promise<void> {
  // Handle confirmation to generate report
  if (
    normalizedContent === 'yes' ||
    normalizedContent.includes('generate report') ||
    normalizedContent.includes('create report')
  ) {
    dispatch(
      chatActions.addMessage({
        role: 'system',
        content: 'Generating your report. This may take a moment...',
        createdAt: new Date(),
        metadata: {
          isProgress: true,
          progressValue: 0,
          progressPhase: 'report_generation',
        },
      })
    )

    if (workflow.formatReport) {
      try {
        // Choose a format based on user's message
        const format = normalizedContent.includes('pdf')
          ? 'pdf'
          : normalizedContent.includes('docx')
            ? 'docx'
            : normalizedContent.includes('html')
              ? 'html'
              : 'pdf' // Default format

        await workflow.formatReport({
          format,
        } as ProcessingReportFormat)

        // Add a report complete message
        dispatch(
          chatActions.addMessage({
            role: 'system',
            content: 'Report generation complete!',
            createdAt: new Date(),
            metadata: {
              type: 'report_complete',
            },
          })
        )

        // Generate mock report content
        const reportContent = `**Final Report**\n\n- Diagnosis: Example Condition\n- Recommendations: Follow instructions\n\n**Additional Notes:** ${
          normalizedContent.includes('with notes')
            ? 'User requested additional notes.'
            : ''
        }`

        // Add the report as a message
        dispatch(
          chatActions.addMessage({
            role: 'assistant',
            content: reportContent,
            createdAt: new Date(),
            metadata: {
              isReport: true,
            },
          })
        )

        // Complete report generation
        dispatch(
          chatActions.completeReportGeneration({
            content: reportContent,
            format,
          })
        )
      } catch (error) {
        console.error('Error generating report:', error)

        dispatch(
          chatActions.setError(
            error instanceof Error ? error.message : 'Error generating report'
          )
        )

        dispatch(
          chatActions.addMessage({
            role: 'system',
            content: `Error generating report: ${
              error instanceof Error ? error.message : 'Unknown error'
            }. Please try again.`,
            createdAt: new Date(),
            metadata: {
              type: 'error',
              isError: true,
            },
          })
        )
      }
    }
  }
  // Handle skipping report generation
  else if (
    normalizedContent === 'no' ||
    normalizedContent.includes('skip') ||
    normalizedContent.includes('cancel')
  ) {
    dispatch(
      chatActions.addMessage({
        role: 'system',
        content:
          'Report generation skipped. You can continue chatting or upload a new document.',
        createdAt: new Date(),
        metadata: {
          type: 'workflow_complete',
        },
      })
    )

    dispatch(chatActions.completeReportGeneration(null))

    if (workflow.formatReport) {
      try {
        // Format a minimal report
        await workflow.formatReport({
          format: 'markdown',
        } as ProcessingReportFormat)
      } catch (error) {
        console.error('Error completing workflow:', error)
      }
    }
  }
  // Handle other messages in report generation mode
  else {
    dispatch(
      chatActions.addMessage({
        role: 'assistant',
        content:
          'Would you like me to generate a report based on the verified information? Type "yes" to generate or "no" to skip.',
        createdAt: new Date(),
      })
    )
  }
}

/**
 * Handle a message in default chat mode
 */
async function handleDefaultChatMessage(
  content: string,
  dispatch: Dispatch<ChatAction>,
  workflow: UseProcessingWorkflowResult
): Promise<void> {
  // Check current workflow step
  const currentWorkflowStep = workflow.workflowStep

  // In extraction or other processing steps
  if (currentWorkflowStep === 'extracting') {
    dispatch(
      chatActions.addMessage({
        role: 'assistant',
        content:
          "I'm currently processing a document. Please wait for the extraction to complete.",
        createdAt: new Date(),
      })
    )
    return
  }

  // Default chat handling - simulate a basic response
  dispatch(
    chatActions.addMessage({
      role: 'assistant',
      content: `I received your message: "${content}".`,
      createdAt: new Date(),
    })
  )
}
