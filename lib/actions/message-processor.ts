import { Message } from '../chat/types'
import type {
  ChatAction,
  ChatMode,
  ReportFormat,
  UseProcessingWorkflowResult,
} from '../chat/types'
import type { Dispatch } from 'react'
import { chatActions } from '../../contexts/reducers/chat-reducer'
import logger from '@/lib/logger'
import { SystemError, ValidationError, normalizeError } from '@/lib/errors'
import { chatWorkflowIntegration } from '@/lib/services/chat/chat-workflow-integration'
import { workflowMediator } from '@/lib/services/workflow/workflow-mediator'
import { eventService } from '@/lib/services/event-service'
import { EVENT_TYPES } from '@/lib/types/events'

/**
 * Process a message based on the current chat mode
 */
export async function processMessage(
  content: string,
  mode: ChatMode,
  dispatch: Dispatch<ChatAction>,
  chatId?: string,
  workflowId?: string
): Promise<void> {
  const moduleLogger = logger.withMetadata({
    module: 'MessageProcessor',
    method: 'processMessage',
    mode,
    chatId,
    workflowId
  });
  
  try {
    if (!content || content.trim() === '') {
      moduleLogger.warn('Empty message received');
      throw new ValidationError({
        message: 'Message content cannot be empty',
        code: 'EMPTY_MESSAGE'
      });
    }
    
    const normalizedContent = content.toLowerCase().trim();
    
    moduleLogger.info('Processing message', { 
      contentLength: content.length,
      mode
    });

    // Create user message
    const messageId = crypto.randomUUID();
    const messageType = mode === 'verification' ? 'correction' : 'chat';
    
    // Add message to UI first
    dispatch(
      chatActions.addMessage({
        id: messageId,
        role: 'user',
        content,
        createdAt: new Date(),
        metadata: {
          type: messageType
        }
      })
    );

    // If we have a chat ID and workflow ID, use the integration
    if (chatId && workflowId) {
      moduleLogger.info('Using chat workflow integration', { chatId, workflowId });
      
      // Create the message object
      const message = {
        id: messageId,
        role: 'user' as const,
        content,
        createdAt: new Date().toISOString(),
        type: messageType as any,
        metadata: {
          type: messageType
        }
      };
      
      // Process using the integration layer
      await chatWorkflowIntegration.processChatMessage(message, chatId, workflowId);
      return;
    }
    
    // Handle verification mode (fallback if no chatId/workflowId)
    if (mode === 'verification') {
      await handleVerificationMessage(normalizedContent, content, dispatch);
      return;
    }

    // Default chat handling - simulate a basic response
    dispatch(
      chatActions.addMessage({
        role: 'assistant',
        content: `I received your message: "${content}".`,
        createdAt: new Date(),
      })
    );
    
    moduleLogger.info('Message processed successfully');
  } catch (error) {
    const normalizedError = normalizeError(error);
    moduleLogger.error('Failed to process message', {}, normalizedError);
    
    dispatch(chatActions.setError(normalizedError.message));
    
    // Add error message to the chat
    dispatch(
      chatActions.addMessage({
        role: 'system',
        content: `Error: ${normalizedError.message}`,
        createdAt: new Date(),
        metadata: {
          type: 'error',
          isError: true,
          errorCode: normalizedError.code
        },
      })
    );
  }
}

/**
 * Handle a message in verification mode
 */
async function handleVerificationMessage(
  normalizedContent: string,
  originalContent: string,
  dispatch: Dispatch<ChatAction>,
  chatId?: string,
  workflowId?: string
): Promise<void> {
  const moduleLogger = logger.withMetadata({
    module: 'MessageProcessor',
    method: 'handleVerificationMessage',
    normalizedContent: normalizedContent.substring(0, 20) + (normalizedContent.length > 20 ? '...' : ''),
    chatId,
    workflowId
  });
  
  // Check if confirmation message
  if (normalizedContent === 'confirm') {
    try {
      moduleLogger.info('Processing verification confirmation');
      
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

      // If we have workflowId and chatId, use the mediator
      if (workflowId && chatId) {
        // Publish verification confirmation event
        await eventService.publish(EVENT_TYPES.VERIFICATION_CONFIRMATION, {
          workflowId,
          chatId,
          messageId: progressMessageId
        });
        
        // Let the workflow mediator handle the confirmation
        await workflowMediator.completeVerification(workflowId, true);
      } else {
        // Fallback to direct action
        dispatch(chatActions.completeVerification(true));
      }

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
      const normalizedError = normalizeError(error);
      moduleLogger.error('Error during verification confirmation', {}, normalizedError);
      
      // Handle errors appropriately with improved error message
      dispatch(chatActions.setError(normalizedError.message));
      
      dispatch(
        chatActions.addMessage({
          role: 'system',
          content: `Error during verification: ${normalizedError.message}`,
          createdAt: new Date(),
          metadata: {
            type: 'error',
            isError: true,
            errorCode: normalizedError.code
          },
        })
      );
      return;
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

    moduleLogger.info('Processing correction', {
      correctionLength: correctionText.length
    });
    
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
      // If we have workflowId and chatId, use the mediator
      if (workflowId && chatId) {
        // Get the current summary from state
        // In a real implementation, we would get this from the workflow state
        // For now, we'll publish the event and let the handlers manage it
        await eventService.publish(EVENT_TYPES.VERIFICATION_CORRECTION, {
          workflowId,
          chatId,
          messageId: correctionProgressId,
          correction: correctionText,
          currentSummary: "Current summary" // This would be fetched from state
        });
      } else {
        // Fallback implementation for when we don't have IDs
        // In a real app, you would call an API to process the correction
        // For now, simulate a delay
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // Complete the progress message
        dispatch(
          chatActions.updateProgress(correctionProgressId, 100, 'completed')
        )

        // Get a placeholder for a corrected summary
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
      }

      return
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Error processing correction', {}, normalizedError);
      
      // Better error handling with clear message
      dispatch(chatActions.setError(normalizedError.message));
      
      dispatch(
        chatActions.addMessage({
          role: 'system',
          content: `There was an error processing your correction: ${normalizedError.message}. Please try again.`,
          createdAt: new Date(),
          metadata: {
            type: 'error',
            isError: true,
            errorCode: normalizedError.code
          },
        })
      );
      
      return;
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
  workflow: UseProcessingWorkflowResult,
  chatId?: string,
  workflowId?: string
): Promise<void> {
  const moduleLogger = logger.withMetadata({
    module: 'MessageProcessor',
    method: 'handleReportGenerationMessage',
    normalizedContent: normalizedContent.substring(0, 20) + (normalizedContent.length > 20 ? '...' : ''),
    chatId,
    workflowId
  });
  
  // Handle confirmation to generate report
  if (
    normalizedContent === 'yes' ||
    normalizedContent.includes('generate report') ||
    normalizedContent.includes('create report')
  ) {
    moduleLogger.info('Processing report generation request');
    
    // Add progress message
    const progressMessageId = crypto.randomUUID();
    dispatch(
      chatActions.addMessage({
        id: progressMessageId,
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

    let format = 'pdf'; // Default format
    
    // Choose a format based on user's message
    if (normalizedContent.includes('pdf')) {
      format = 'pdf';
    } else if (normalizedContent.includes('docx')) {
      format = 'docx';
    } else if (normalizedContent.includes('html')) {
      format = 'html';
    } else if (normalizedContent.includes('markdown') || normalizedContent.includes('md')) {
      format = 'markdown';
    }

    try {
      // If we have workflowId, use the mediator
      if (workflowId) {
        moduleLogger.info('Using workflow mediator for report generation', {
          format
        });
        
        // Update progress through event system
        const statusUpdateListener = eventService.subscribe(
          EVENT_TYPES.WORKFLOW_UPDATED,
          (payload: any) => {
            if (payload.workflowId === workflowId && payload.phase === 'report_generation') {
              // Update progress message
              dispatch(
                chatActions.updateProgress(
                  progressMessageId,
                  payload.progress,
                  'report_generation'
                )
              );
            }
          }
        );
        
        // Use workflow mediator to generate report
        // This will handle the full report generation process
        const reportData = await workflowMediator.generateReport(
          workflowId,
          "patientId", // This should come from state in a real implementation
          {}, // Research result would come from state
          {
            format,
            includeNotes: normalizedContent.includes('with notes')
          }
        );
        
        // Format the report
        const formattedReport = await workflowMediator.formatReport(
          workflowId,
          reportData,
          format
        );
        
        // Cleanup listener
        statusUpdateListener();
        
        // Add a report complete message
        dispatch(
          chatActions.updateProgress(
            progressMessageId,
            100,
            'report_generation_completed'
          )
        );
        
        dispatch(
          chatActions.addMessage({
            role: 'system',
            content: 'Report generation complete!',
            createdAt: new Date(),
            metadata: {
              type: 'report_complete',
            },
          })
        );
        
        // Add the report content
        dispatch(
          chatActions.addMessage({
            role: 'assistant',
            content: formattedReport || '**Final Report**\n\nReport content will be displayed here.',
            createdAt: new Date(),
            metadata: {
              isReport: true,
              reportId: reportData.id,
              format
            },
          })
        );
        
        // Complete report generation in store
        dispatch(
          chatActions.completeReportGeneration({
            content: formattedReport,
            format,
            reportId: reportData.id
          })
        );
      }
      // Fallback to workflow helper if available
      else if (workflow.formatReport) {
        moduleLogger.info('Using workflow helper for report generation', {
          format,
          hasWorkflowFormatReport: !!workflow.formatReport
        });
        
        await workflow.formatReport({
          format,
        });

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
        );

        // Generate report content
        const reportContent = `**Final Report**\n\n- Diagnosis: Example Condition\n- Recommendations: Follow instructions\n\n**Additional Notes:** ${
          normalizedContent.includes('with notes')
            ? 'User requested additional notes.'
            : ''
        }`;

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
        );

        // Complete report generation
        dispatch(
          chatActions.completeReportGeneration({
            content: reportContent,
            format,
          })
        );
      }
      // Fallback if no workflow services are available
      else {
        moduleLogger.info('Using fallback for report generation');
        
        // Add a report complete message after delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        dispatch(
          chatActions.updateProgress(
            progressMessageId,
            100,
            'report_generation_completed'
          )
        );
        
        // Generate report content
        const reportContent = `**Final Report**\n\n- Diagnosis: Example Condition\n- Recommendations: Follow instructions\n\n**Additional Notes:** ${
          normalizedContent.includes('with notes')
            ? 'User requested additional notes.'
            : ''
        }`;
        
        dispatch(
          chatActions.addMessage({
            role: 'system',
            content: 'Report generation complete!',
            createdAt: new Date(),
            metadata: {
              type: 'report_complete',
            },
          })
        );
        
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
        );

        // Complete report generation
        dispatch(
          chatActions.completeReportGeneration({
            content: reportContent,
            format,
          })
        );
      }
    } catch (error) {
      const normalizedError = normalizeError(error);
      moduleLogger.error('Error generating report', {}, normalizedError);

      // Set the error with improved error details
      dispatch(
        chatActions.setError(normalizedError.message)
      );

      // Show user-friendly error message
      dispatch(
        chatActions.addMessage({
          role: 'system',
          content: `Error generating report: ${normalizedError.message}. Please try again.`,
          createdAt: new Date(),
          metadata: {
            type: 'error',
            isError: true,
            errorCode: normalizedError.code
          },
        })
      );
    }
  }
  // Handle skipping report generation
  else if (
    normalizedContent === 'no' ||
    normalizedContent.includes('skip') ||
    normalizedContent.includes('cancel')
  ) {
    moduleLogger.info('Skipping report generation');
    
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
    );

    // Update workflow state to complete if available
    if (workflowId) {
      try {
        await workflowService.completeWorkflow(workflowId, {
          reportSkipped: true,
          skippedAt: new Date().toISOString()
        });
      } catch (error) {
        moduleLogger.warn('Error completing workflow after skipping report', {}, error);
        // Not critical, so we don't show to user
      }
    }

    dispatch(chatActions.completeReportGeneration(null));

    // Use workflow formatReport if available (minimal report)
    if (workflow.formatReport) {
      try {
        // Format a minimal report
        await workflow.formatReport({
          format: 'markdown',
        });
      } catch (error) {
        const normalizedError = normalizeError(error);
        moduleLogger.warn('Error completing workflow', {}, normalizedError);
        // Not showing to user since this is a non-critical error
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
    );
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
  const moduleLogger = logger.withMetadata({
    module: 'MessageProcessor',
    method: 'handleDefaultChatMessage',
    workflowStep: workflow.workflowStep
  });
  
  try {
    moduleLogger.info('Handling default chat message', { 
      contentLength: content.length
    });
    
    // Check current workflow step
    const currentWorkflowStep = workflow.workflowStep

    // In extraction or other processing steps
    if (currentWorkflowStep === 'extracting') {
      moduleLogger.info('Document extraction in progress, informing user to wait');
      
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
    moduleLogger.info('Processing default chat response');
    
    dispatch(
      chatActions.addMessage({
        role: 'assistant',
        content: `I received your message: "${content}".`,
        createdAt: new Date(),
      })
    )
    
    moduleLogger.info('Default chat message handled successfully');
  } catch (error) {
    const normalizedError = normalizeError(error);
    moduleLogger.error('Error handling default chat message', {}, normalizedError);
    
    dispatch(chatActions.setError(normalizedError.message));
    
    // Show user-friendly error
    dispatch(
      chatActions.addMessage({
        role: 'system',
        content: `There was an error processing your message: ${normalizedError.message}`,
        createdAt: new Date(),
        metadata: {
          type: 'error',
          isError: true,
          errorCode: normalizedError.code
        },
      })
    );
  }
}