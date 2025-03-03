'use client'

import { useToast } from '@/components/ui/use-toast'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import React from 'react'

// Import types from our centralized type system
import type {
  ChatAction,
  ChatMode,
  ChatState,
  ExtendedChatContextType,
  Message,
  MessageMetadata,
} from '@/lib/chat/types'

import { processMessage } from '@/lib/actions/message-processor'
import { initialChatState } from '@/lib/chat/types'

// Import for database operations
import type { ProcessingStatus } from '@/lib/processing/types/base'
import type {
  ProcessingPhase,
  VerificationStatusType,
  WorkflowStep,
  WorkflowOptions,
  VerificationMetadata,
} from '@/lib/workflow/types'

import type {
  VerificationItem,
  VerificationOptions,
  VerificationResult,
} from '@/lib/processing/types/verification'
import type { DocumentType } from '@/lib/processing/types/base'
import type { Database } from '@/lib/supabase'
import { createBrowserClient } from '@/lib/supabase/clients'
import { documentService } from '@/lib/services/document/document-service'
import { ApiClient } from '@/lib/api/client/api-client'
import { useWorkflow } from '@/lib/workflow/use-workflow'
import { useProcessingWorkflow } from '@/lib/hooks/use-processing-workflow'
import { validateWorkflowTransition, WorkflowStateError } from '@/lib/workflow/workflow-manager'

// Initialize API client
const apiClient = new ApiClient()

// Define initial workflow state
const initialWorkflowState = {
  currentStep: 'idle' as WorkflowStep,
  processingStatus: {
    status: 'idle' as 'idle' | 'processing' | 'success' | 'error',
    progress: 0,
    phase: 'initialization' as ProcessingPhase,
  },
  workflowError: null,
  data: {},
}

// Create an extended chat state with workflow state included
const extendedInitialState: ChatState = {
  ...initialChatState,
  workflow: initialWorkflowState,
}

// Function to generate unique IDs
const generateUniqueId = () => crypto.randomUUID()

// Import the workflow service
import { workflowService } from '@/lib/services/workflow/workflow-service'
import { chatService } from '@/lib/services/chat/chat-service'

// Function to update workflow state in database using the service layer
async function updateDatabaseWorkflowState(
  step: WorkflowStep,
  metadata?: Record<string, any>
) {
  try {
    const workflowId = localStorage.getItem('current_workflow_id')
    if (!workflowId) return

    // Call the service method instead of direct database access
    await workflowService.updateWorkflowState(workflowId, step, metadata)
  } catch (error) {
    console.error('Failed to update workflow state in database:', error)
  }
}

// Note: Client ID generation is now handled in the workflow service

// Define Zustand store with both state and actions
interface ChatStore extends ChatState {
  // Basic actions
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  setMode: (mode: ChatMode) => void
  resetChat: () => void

  // Message actions
  addMessage: (message: Message | Omit<Message, 'id'>) => void
  updateMessages: (messages: Message[]) => void
  updateMessageProgress: (
    messageId: string,
    progress: number,
    phase: string
  ) => void

  // Workflow actions
  updateWorkflowStep: (
    step: WorkflowStep,
    metadata?: Record<string, any>
  ) => void
  updateProgress: (progress: number, phase?: ProcessingPhase) => void

  // Verification actions
  startVerification: (content: string, options?: VerificationOptions) => void
  submitCorrection: (correction: string) => void
  completeVerification: (isApproved: boolean) => Promise<VerificationResult>
  handleCorrectionMessage: (correction: string) => Promise<void>

  // Report generation actions
  startReportGeneration: (reportOptions?: any) => void
  completeReportGeneration: (report: any) => void
  generateReport: () => Promise<void>
  formatReport: (format: any) => Promise<void>

  // Document processing
  docProgress: number
  isDocProcessing: boolean
  extractedDocument: any | null
  processDocument: (
    file: File,
    patientId: string,
    documentType?: string,
    abortSignal?: AbortSignal
  ) => Promise<any>
  uploadDocument: (
    file: File,
    patientId: string,
    documentType?: string
  ) => Promise<any>
  resetDocumentProcessing: () => void

  // Message sending
  sendMessage: (
    content: string,
    options?: { isCorrection?: boolean; metadata?: MessageMetadata }
  ) => Promise<void>

  // Helper functions for backward compatibility
  addSystemMessage: (content: string, type?: string, metadata?: any) => Message
  postSummaryMessage: (summary: string) => Message
  updateSummaryAfterCorrection: (newSummary: string) => Message
  confirmVerification: () => Promise<VerificationResult>
  clearMessages: () => void

  // Workflow methods from useWorkflow
  initiateVerification: (
    extractedDocument: any,
    messageId?: string
  ) => Promise<any>
  processCorrection: (
    correctionText: string,
    currentSummary: string,
    messageId?: string
  ) => Promise<any>
  resetVerification: () => Promise<any>
  beginReportGeneration: (reportMetadata?: Record<string, any>) => Promise<any>
}

// Create the Zustand store
export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      // Initial state from chatReducer's initialState
      ...extendedInitialState,

      // Document processing state
      docProgress: 0,
      isDocProcessing: false,
      extractedDocument: null,

      // Basic state actions
      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) =>
        set((state) => ({
          error,
          isLoading: false,
          workflow: {
            ...state.workflow,
            workflowError: error,
          },
        })),

      setMode: (mode) => set({ mode }),

      resetChat: () =>
        set((state) => ({
          messages: [],
          isLoading: false,
          error: null,
          verification: {
            ...state.verification,
            isInVerificationMode: false,
            summaryVersions: [],
            currentSummary: null,
            verificationItems: [],
          },
          workflow: { ...initialWorkflowState },
        })),

      // Message actions
      addMessage: (message) =>
        set((state) => {
          const newMessage =
            'id' in message
              ? message
              : {
                  ...message,
                  id: crypto.randomUUID(),
                }

          return {
            messages: [...state.messages, newMessage],
          }
        }),

      updateMessages: (messages) => set({ messages }),

      updateMessageProgress: (messageId, progress, phase) =>
        set((state) => ({
          messages: state.messages.map((message) => {
            if (message.id === messageId) {
              return {
                ...message,
                metadata: {
                  ...message.metadata,
                  progressValue: progress,
                  progressPhase: phase,
                },
              }
            }
            return message
          }),
          workflow: phase
            ? {
                ...state.workflow,
                processingStatus: {
                  ...state.workflow.processingStatus,
                  progress,
                  phase: phase as ProcessingPhase,
                },
              }
            : state.workflow,
        })),

      // Workflow actions
      updateWorkflowStep: (step, metadata) =>
        set((state) => {
          // Use the imported validation functions
          
          // Current step from state
          const currentStep = state.workflow.currentStep
          
          // Check if this is a remote update from Supabase sync
          const isRemoteUpdate = metadata?._syncedFromRemote === true
          
          // Don't validate remote updates - these are already validated on another client
          // or during the transition if we're in the same step (metadata update only)
          if (!isRemoteUpdate && currentStep !== step) {
            // Validate the transition
            const validation = validateWorkflowTransition(currentStep, step, metadata)
            
            // If the transition is invalid, log the error but continue (to avoid breaking UI)
            // In development, you might want to throw an error instead
            if (!validation.isValid) {
              console.error(
                `Invalid workflow transition from '${currentStep}' to '${step}':`, 
                validation.error,
                { details: validation.details, metadata }
              )
              
              // In development, throw an error to catch invalid transitions early
              if (process.env.NODE_ENV === 'development') {
                // This is caught by the error boundary
                setTimeout(() => {
                  throw new WorkflowStateError(
                    validation.error || 'Invalid workflow transition',
                    { from: currentStep, to: step },
                    { 
                      ...metadata,
                      validationDetails: validation.details
                    }
                  )
                }, 0)
              }
              
              // Add to error log for tracking
              if (metadata) {
                metadata.transitionWarning = validation.error
                metadata.invalidTransition = true
                metadata.validationDetails = validation.details
              }
            }
          }
          
          // Helper to map workflow steps to chat modes
          const mapStepToMode = (
            step: WorkflowStep,
            currentMode: ChatMode
          ): ChatMode => {
            switch (step) {
              case 'verification':
              case 'verification_pending':
              case 'verification_in_progress':
                return 'verification'
              case 'report_generation':
                return 'default' // Use default mode for reports
              case 'error':
                return currentMode // Preserve current mode on error
              default:
                // Only switch mode if it was tied to a workflow step
                if (currentMode === 'verification') {
                  return 'default'
                }
                return currentMode
            }
          }

          const mode = mapStepToMode(step, state.mode)

          // For error steps, set the error state too
          if (step === 'error' && metadata?.error) {
            // Set the error in the workflow and main error state
            const errorMessage = metadata.error as string;
            state.error = errorMessage;
            state.workflow.workflowError = errorMessage;
          }

          // Track the transition in metadata for diagnostics
          const enrichedMetadata = {
            ...(metadata || {}),
            _transition: {
              from: currentStep,
              to: step,
              timestamp: new Date().toISOString()
            }
          }

          // Only update the database if this is a local change (not a remote sync)
          // This prevents endless loops of updates between clients
          if (!isRemoteUpdate) {
            updateDatabaseWorkflowState(step, enrichedMetadata)
          }

          return {
            workflow: {
              ...state.workflow,
              currentStep: step,
              data: {
                ...state.workflow.data,
                ...enrichedMetadata,
              },
            },
            mode,
            // If transitioning to error, also set the error state
            ...(step === 'error' && metadata?.error ? { error: metadata.error } : {}),
          }
        }),

      updateProgress: (progress, phase) =>
        set((state) => ({
          workflow: {
            ...state.workflow,
            processingStatus: {
              ...state.workflow.processingStatus,
              progress,
              phase: phase || state.workflow.processingStatus.phase,
            },
          },
        })),

      // Verification actions
      startVerification: (content, options) => {
        return Promise.resolve().then(() => {
          set((state) => {
            const summaryId = crypto.randomUUID()
            const timestamp = new Date().toISOString()

            return {
              mode: 'verification',
              verification: {
                ...state.verification,
                isInVerificationMode: true,
                currentSummary: content,
                verificationItems: options?.items || [],
                verificationStatus: 'in_progress',
                summaryVersions: [
                  ...state.verification.summaryVersions,
                  {
                    id: summaryId,
                    content,
                    timestamp,
                  },
                ],
              },
              workflow: {
                ...state.workflow,
                currentStep: 'verification',
                processingStatus: {
                  status: 'processing',
                  progress: 70,
                  phase: 'verification',
                },
                data: {
                  ...state.workflow.data,
                  verification: {
                    isInVerificationMode: true,
                    originalSummaryId: summaryId,
                    currentVersionId: summaryId,
                    correctionCount: 0,
                    startedAt: timestamp,
                  },
                },
              },
            }
          })
        })
      },

      submitCorrection: (correction) =>
        set((state) => ({
          verification: {
            ...state.verification,
            verificationStatus: 'in_progress',
          },
          workflow: {
            ...state.workflow,
            data: {
              ...state.workflow.data,
              lastCorrection: correction,
            },
          },
        })),

      completeVerification: async (isApproved) => {
        const state = get()

        // Update state
        set((state) => {
          const verification = state.workflow.data.verification || {}
          const nextStep = isApproved
            ? 'report_generation'
            : state.workflow.currentStep

          return {
            verification: {
              ...state.verification,
              isInVerificationMode: false,
              verificationStatus: isApproved ? 'completed' : 'failed',
            },
            workflow: {
              ...state.workflow,
              currentStep: nextStep,
              processingStatus: isApproved
                ? {
                    status: 'success',
                    progress: 100,
                    phase: 'verification' as ProcessingPhase,
                  }
                : state.workflow.processingStatus,
              data: {
                ...state.workflow.data,
                verification: {
                  ...verification,
                  isInVerificationMode: false,
                  isApproved,
                  completedAt: new Date().toISOString(),
                },
              },
            },
            mode: isApproved ? 'default' : state.mode,
          }
        })

        // Build the verification result
        return {
          isCompleted: true,
          isApproved,
          items: state.verification.verificationItems,
          completedAt: new Date().toISOString(),
          verificationMetadata: {
            verificationStatus: 'completed',
            originalSummaryId: state.verification.summaryVersions[0]?.id || '',
            currentVersionId:
              state.verification.summaryVersions[
                state.verification.summaryVersions.length - 1
              ]?.id || '',
            correctionCount: state.verification.summaryVersions.length - 1,
            corrections: state.verification.summaryVersions.map((version) => ({
              id: version.id,
              text: version.content,
              timestamp: version.timestamp,
            })),
            startedAt: state.verification.summaryVersions[0]?.timestamp,
            lastUpdated: new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
          },
        }
      },

      handleCorrectionMessage: async (correction) => {
        const state = get()

        // Add the correction message
        get().addMessage({
          role: 'user',
          content: correction,
          createdAt: new Date(),
          metadata: {
            isCorrection: true,
          },
        })

        // Add a processing message
        const progressMessageId = crypto.randomUUID()
        get().addMessage({
          id: progressMessageId,
          role: 'system',
          content: 'Processing your correction...',
          createdAt: new Date(),
          metadata: {
            isProgress: true,
            progressValue: 0,
            progressPhase: 'correction',
          },
        })

        // Update state to show we're processing the correction
        get().submitCorrection(correction)

        try {
          // Get the current summary from state
          const currentSummary = state.verification.currentSummary || ''

          // Call the verification API through the client
          const result = await apiClient.verification.submitCorrection({
            correction,
            currentSummary,
            workflowId: localStorage.getItem('current_workflow_id') || '',
            messageId: progressMessageId
          })
          
          // Get data from the API response
          const newSummaryId = result.summaryId || crypto.randomUUID()
          const timestamp = new Date().toISOString()
          const newSummary = result.summary || `${currentSummary}\n\nUpdate based on your feedback: ${correction}`

          // Update the progress message
          get().updateMessageProgress(progressMessageId, 100, 'completed')

          // Add the corrected summary
          get().addMessage({
            role: 'assistant',
            content: newSummary,
            createdAt: new Date(),
            metadata: {
              isSummary: true,
              summaryVersionId: newSummaryId,
              timestamp,
              verificationMetadata: {
                verificationStatus: 'in_progress',
                correctionCount: state.verification.summaryVersions.length,
              },
            },
          })

          // Ask for confirmation again
          get().addMessage({
            role: 'system',
            content:
              "I've updated the summary based on your correction. Please review it and type 'confirm' to approve or provide additional corrections.",
            createdAt: new Date(),
            metadata: {
              isVerificationRequest: true,
            },
          })

          // Update verification state with new summary
          set((state) => ({
            verification: {
              ...state.verification,
              currentSummary: newSummary,
              summaryVersions: [
                ...state.verification.summaryVersions,
                {
                  id: newSummaryId,
                  content: newSummary,
                  timestamp,
                },
              ],
            },
          }))
        } catch (error) {
          console.error('Error processing correction:', error)
          get().setError(
            error instanceof Error
              ? error.message
              : 'Failed to process correction'
          )
        }
      },

      // Report generation actions
      startReportGeneration: (reportOptions) =>
        set((state) => ({
          mode: 'default',
          reportGeneration: {
            isComplete: false,
            format: reportOptions || null,
          },
          workflow: {
            ...state.workflow,
            currentStep: 'report_generation',
            processingStatus: {
              status: 'processing',
              progress: 85,
              phase: 'report_generation',
            },
          },
        })),

      completeReportGeneration: (report) =>
        set((state) => ({
          reportGeneration: {
            ...state.reportGeneration,
            isComplete: true,
            format: report,
          },
          workflow: {
            ...state.workflow,
            currentStep: 'complete',
            processingStatus: {
              status: 'success',
              progress: 100,
              phase: 'completion',
            },
          },
        })),

      // Generate a report
      generateReport: async () => {
        // Start report generation in workflow
        get().startReportGeneration()

        try {
          // Get current workflow and patient data
          const state = get()
          const workflowId = localStorage.getItem('current_workflow_id') || ''
          const patientId = state.workflow.data.patientId as string || ''
          
          // Call the reports API
          const report = await apiClient.reports.generateReport({
            workflowId,
            patientId,
            format: 'pdf',
            includeVerificationData: true,
            detailLevel: 'comprehensive'
          })

          // Update workflow state to completion once report is done
          get().completeReportGeneration({
            format: report.format || 'pdf',
            content: report.content || 'Generated report content',
            generatedAt: report.generatedAt || new Date().toISOString(),
            reportId: report.id
          })
        } catch (error) {
          console.error('Error generating report:', error)
          get().setError(
            error instanceof Error ? error.message : 'Failed to generate report'
          )
        }
      },

      // Format a report
      formatReport: async (format) => {
        try {
          // Get current report data
          const state = get()
          const reportId = state.reportGeneration?.reportId || ''
          
          if (!reportId) {
            throw new Error('No report has been generated yet')
          }
          
          // Call the reports API to update format
          const formattedReport = await apiClient.reports.formatReport({
            reportId,
            format: format.format || 'pdf',
            style: format.style || 'clinical',
            metadataInFooter: format.metadataInFooter || false
          })
          
          get().completeReportGeneration({
            format,
            content: formattedReport.content || 'Formatted report content',
            formattedAt: new Date().toISOString(),
            reportId: formattedReport.id || reportId
          })
        } catch (error) {
          console.error('Error formatting report:', error)
          get().setError(
            error instanceof Error ? error.message : 'Failed to format report'
          )
        }
      },

      // Document processing
      processDocument: async (file, patientId, documentType, abortSignal) => {
        try {
          // Update state to show processing
          set({
            isDocProcessing: true,
            docProgress: 0,
            extractedDocument: null,
          })

          // Update workflow state to uploading
          get().updateWorkflowStep('uploading', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          })

          // Handle progress updates
          const onStatusUpdate = (status: ProcessingStatus) => {
            if (status.progress !== undefined) {
              set({ docProgress: status.progress })
            }

            if (status.phase) {
              get().updateProgress(
                status.progress || 0,
                status.phase as ProcessingPhase
              )
            }

            if (status.status === 'error') {
              get().setError(status.error || 'Processing failed')
            }
          }

          // Initialize document processing state with progress 0
          set({ docProgress: 0, isDocProcessing: true })

          // Convert string document type to DocumentType object if provided
          const docTypeObj = documentType
            ? ({
                category: 'clinical',
                type: documentType,
              } as DocumentType)
            : undefined

          // Call the API client instead of document service directly
          const result = await apiClient.documents.processDocument({
            file,
            patientId,
            documentType: docTypeObj?.type || 'clinical',
            documentCategory: docTypeObj?.category || 'clinical',
            onStatusUpdate: onStatusUpdate as any,
          })

          // Store the result
          set({
            extractedDocument: result,
            docProgress: 100,
            isDocProcessing: false,
          })

          // Update workflow state to verification
          get().updateWorkflowStep('verification')

          return result
        } catch (error) {
          console.error('Document processing failed:', error)

          // Update state for error
          set({
            isDocProcessing: false,
            docProgress: 0,
          })

          // Handle errors and update workflow state
          get().setError(
            error instanceof Error
              ? error.message
              : 'Document processing failed'
          )
          get().updateWorkflowStep('error')

          throw error
        }
      },

      // Upload document to storage
      uploadDocument: async (file, patientId, documentType) => {
        try {
          // Handle progress updates
          const onStatusUpdate = (status: ProcessingStatus) => {
            if (status.progress !== undefined) {
              set({ docProgress: status.progress })
            }

            if (status.phase) {
              get().updateProgress(
                status.progress || 0,
                status.phase as ProcessingPhase
              )
            }

            if (status.status === 'error') {
              get().setError(status.error || 'Upload failed')
            }
          }

          // Call the API client instead of document service directly
          const result = await apiClient.documents.uploadDocument({
            patientId,
            file,
            documentType: documentType || 'clinical',
            documentCategory: 'clinical',
            onStatusUpdate: onStatusUpdate as any,
          })

          // Update state after upload
          set({
            docProgress: 100,
            isDocProcessing: false,
          })

          return result
        } catch (error) {
          console.error('Document upload failed:', error)

          // Update state for error
          set({
            isDocProcessing: false,
            docProgress: 0,
          })

          // Handle errors and update workflow state
          get().setError(
            error instanceof Error ? error.message : 'Document upload failed'
          )
          get().updateWorkflowStep('error')

          throw error
        }
      },

      // Reset document processing state
      resetDocumentProcessing: () => {
        set({
          docProgress: 0,
          isDocProcessing: false,
          extractedDocument: null,
        })
      },

      // Send a message with queue
      sendMessage: async (content, options) => {
        if (!content.trim()) return

        try {
          get().setLoading(true)

          // Add user message
          const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content,
            createdAt: new Date(),
            metadata: options?.metadata,
          }

          get().addMessage(userMessage)

          // Process the message based on current mode
          await processMessage(content, get().mode, (action) => {
            // Handle different action types
            switch (action.type) {
              case 'ADD_MESSAGE':
                get().addMessage(action.payload.message)
                break
              case 'UPDATE_MESSAGES':
                get().updateMessages(action.payload.messages)
                break
              case 'SET_MODE':
                get().setMode(action.payload.mode)
                break
              case 'UPDATE_WORKFLOW_STEP':
                get().updateWorkflowStep(action.payload.step)
                break
              case 'SET_ERROR':
                get().setError(action.payload.error)
                break
              case 'UPDATE_PROGRESS':
                get().updateMessageProgress(
                  action.payload.messageId,
                  action.payload.progress,
                  action.payload.phase
                )
                break
              default:
                console.warn('Unhandled action type:', action.type)
            }
          })
        } catch (error) {
          console.error('Error sending message:', error)
          get().setError(
            error instanceof Error ? error.message : 'Failed to send message'
          )
        } finally {
          get().setLoading(false)
        }
      },

      // Additional methods for backward compatibility

      // Add a system message
      addSystemMessage: (content, type, metadata) => {
        const message: Message = {
          id: crypto.randomUUID(),
          role: 'system',
          content,
          createdAt: new Date(),
          metadata: {
            type,
            ...metadata,
          },
        }

        get().addMessage(message)
        return message
      },

      // Post a summary message
      postSummaryMessage: (summary) => {
        const summaryId = crypto.randomUUID()
        const timestamp = new Date().toISOString()

        // Create message
        const message: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: summary,
          createdAt: new Date(),
          metadata: {
            isSummary: true,
            summaryVersionId: summaryId,
            verificationMetadata: {
              verificationStatus: 'pending',
              originalSummaryId: summaryId,
              currentVersionId: summaryId,
              correctionCount: 0,
              startedAt: timestamp,
              lastUpdated: timestamp,
              corrections: [],
            },
          },
        }

        // Start verification
        get().startVerification(summary)

        // Add the message
        get().addMessage(message)

        return message
      },

      // Update summary after correction
      updateSummaryAfterCorrection: (newSummary) => {
        const state = get()
        const newVersionId = crypto.randomUUID()
        const timestamp = new Date().toISOString()

        // Create metadata
        const metadata: MessageMetadata = {
          isSummary: true,
          summaryVersionId: newVersionId,
          verificationMetadata: {
            verificationStatus: 'in_progress',
            originalSummaryId:
              state.verification.summaryVersions[0]?.id || newVersionId,
            currentVersionId: newVersionId,
            correctionCount: state.verification.summaryVersions.length,
            corrections: [
              ...state.verification.summaryVersions.map((v) => ({
                id: v.id,
                text: v.content,
                timestamp: v.timestamp,
              })),
              {
                id: newVersionId,
                text: newSummary,
                timestamp,
              },
            ],
            startedAt:
              state.verification.summaryVersions[0]?.timestamp || timestamp,
            lastUpdated: timestamp,
          },
        }

        // Create message
        const message: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: newSummary,
          createdAt: new Date(),
          metadata,
        }

        // Add the message
        get().addMessage(message)

        return message
      },

      // Confirm verification (alias for completeVerification with true)
      confirmVerification: async () => {
        return get().completeVerification(true)
      },

      // Clear messages (alias for resetChat)
      clearMessages: () => {
        get().resetChat()
      },

      // Methods from useWorkflow

      // Initialize verification process for a document using the useWorkflow hook
      initiateVerification: async (extractedDocument, messageId) => {
        try {
          // Get the auth user ID for the workflow using the API client
          const { data: userData } = await apiClient.auth.getCurrentUser()
          const userId = userData?.user?.id
          const chatId = localStorage.getItem('current_chat_id') || undefined
          
          if (!userId) {
            throw new Error('User not authenticated')
          }

          // Use API client first for compatibility
          const workflowId = localStorage.getItem('current_workflow_id') || ''
          
          const verificationResult = await apiClient.verification.generateVerification({
            document: extractedDocument,
            workflowId,
            messageId: messageId || '',
            summaryId: crypto.randomUUID()
          })
          
          // Update the store state with API result
          set((state) => ({
            workflow: {
              ...state.workflow,
              currentStep: 'verification_pending',
              processingStatus: {
                status: 'success',
                progress: 100,
                phase: 'verification',
              },
              data: {
                ...state.workflow.data,
                extractedData: verificationResult.structuredData || extractedDocument,
                summaryId: verificationResult.summaryId,
              }
            },
          }))

          return {
            summaryId: verificationResult.summaryId,
            summary: verificationResult.summary,
            structuredData: verificationResult.structuredData || {
              patient: {
                name: 'Sample Patient',
                age: 0,
                diagnosis: 'Pending diagnosis',
              },
            },
          }
        } catch (error) {
          console.error('Error initiating verification:', error)

          // Update to error state
          get().updateWorkflowStep('error', {
            error: error instanceof Error ? error.message : String(error),
            errorTimestamp: new Date().toISOString(),
          })

          throw error
        }
      },

      // Process a user correction to the summary
      processCorrection: async (correctionText, currentSummary, messageId) => {
        try {
          // Get the auth user ID for the workflow using the API client
          const { data: userData } = await apiClient.auth.getCurrentUser()
          const userId = userData?.user?.id
          const chatId = localStorage.getItem('current_chat_id') || undefined
          
          if (!userId) {
            throw new Error('User not authenticated')
          }

          // Initialize processing state
          set((state) => ({
            workflow: {
              ...state.workflow,
              currentStep: 'verification_in_progress',
              processingStatus: {
                status: 'processing',
                progress: 0,
                phase: 'correction',
              },
            },
            verification: {
              ...state.verification,
              verificationStatus: 'in_progress',
            },
          }))

          // Use API client for compatibility
          const workflowId = localStorage.getItem('current_workflow_id') || ''
          
          const correctionResult = await apiClient.verification.processCorrection({
            correction: correctionText,
            currentSummary,
            workflowId,
            messageId: messageId || ''
          })
          
          // Update local state with new summary
          set((state) => {
            const currVerificationMetadata =
              state.workflow.data.verificationMetadata || {}
            const currSummaryVersions = state.verification.summaryVersions || []
            const newSummaryId = correctionResult.summaryId || crypto.randomUUID()

            return {
              workflow: {
                ...state.workflow,
                currentStep: 'verification_in_progress',
                processingStatus: {
                  status: 'success',
                  progress: 100,
                  phase: 'correction',
                },
                data: {
                  ...state.workflow.data,
                  verificationMetadata: {
                    ...currVerificationMetadata,
                    currentVersionId: newSummaryId,
                    correctionCount:
                      (currVerificationMetadata.correctionCount || 0) + 1,
                  },
                },
              },
              verification: {
                ...state.verification,
                currentSummary: correctionResult.summary,
                summaryVersions: [
                  ...currSummaryVersions,
                  {
                    id: newSummaryId,
                    content: correctionResult.summary,
                    timestamp: new Date().toISOString(),
                  },
                ],
              },
            }
          })

          return {
            summaryId: correctionResult.summaryId,
            summary: correctionResult.summary,
            structuredData: correctionResult.structuredData || {
              patient: {
                name: 'Sample Patient',
                age: 45,
                diagnosis: 'Updated diagnosis based on correction',
              },
            },
            correctionCount: correctionResult.correctionCount || 
              ((get().workflow.data.verificationMetadata?.correctionCount || 0) + 1),
          }
        } catch (error) {
          console.error('Error processing correction:', error)

          // Update to error state
          get().updateWorkflowStep('error', {
            error: error instanceof Error ? error.message : String(error),
            errorTimestamp: new Date().toISOString(),
          })

          throw error
        }
      },

      // Reset verification state using useWorkflow hook
      resetVerification: async () => {
        try {
          // Get the auth user ID for the workflow using the API client
          const { data: userData } = await apiClient.auth.getCurrentUser()
          const userId = userData?.user?.id
          const chatId = localStorage.getItem('current_chat_id') || undefined
          
          if (!userId) {
            throw new Error('User not authenticated')
          }
          
          // Reset verification in database
          const workflowId = localStorage.getItem('current_workflow_id') || ''
          
          if (workflowId) {
            await workflowService.resetWorkflow(workflowId)
          }

          // Update local state
          set((state) => ({
            workflow: {
              ...state.workflow,
              currentStep: 'idle',
              processingStatus: {
                status: 'idle',
                progress: 0,
                phase: 'initialization',
              },
              data: {
                ...state.workflow.data,
                verificationMetadata: null,
              },
            },
            verification: {
              ...state.verification,
              isInVerificationMode: false,
              currentSummary: null,
              summaryVersions: [],
              verificationStatus: 'pending',
              verificationItems: [],
            },
          }))

          return {
            success: true,
          }
        } catch (error) {
          console.error('Error resetting verification:', error)
          throw error
        }
      },

      // Begin report generation using workflow hooks
      beginReportGeneration: async (reportMetadata) => {
        try {
          // Get the auth user ID for the workflow using the API client
          const { data: userData } = await apiClient.auth.getCurrentUser()
          const userId = userData?.user?.id
          const chatId = localStorage.getItem('current_chat_id') || undefined
          
          if (!userId) {
            throw new Error('User not authenticated')
          }
          
          // Get current workflow step for validation
          const currentStep = get().workflow.currentStep

          // Validate current state - this should be verification_completed
          const validSteps = ['verification_completed', 'verification', 'complete']
          if (!validSteps.includes(currentStep)) {
            throw new Error(
              `Verification must be completed before generating report, current step: ${currentStep}`
            )
          }

          // Update database workflow state
          const workflowId = localStorage.getItem('current_workflow_id') || ''
          
          if (workflowId) {
            await workflowService.updateWorkflowState(
              workflowId,
              'report_generation',
              {
                ...(reportMetadata || {}),
                reportGenerationStartedAt: new Date().toISOString(),
              }
            )
          }

          // Update local state
          set((state) => ({
            workflow: {
              ...state.workflow,
              currentStep: 'report_generation',
              processingStatus: {
                status: 'processing',
                progress: 0,
                phase: 'report_generation',
              },
              data: {
                ...state.workflow.data,
                reportMetadata: reportMetadata || {},
              },
            },
          }))

          return {
            success: true,
          }
        } catch (error) {
          console.error('Error starting report generation:', error)

          // Update to error state
          get().updateWorkflowStep('error', {
            error: error instanceof Error ? error.message : String(error),
            errorTimestamp: new Date().toISOString(),
          })

          throw error
        }
      },
    }),
    {
      name: 'chat-store',
    }
  )
)

// Keep the original contexts for backward compatibility
const ChatStateContext = createContext<ChatState | undefined>(undefined)
const ChatDispatchContext = createContext<
  React.Dispatch<ChatAction> | undefined
>(undefined)

// Create a provider that doesn't do anything but allows existing code to work
export function ChatProvider({ children }: { readonly children: ReactNode }) {
  // All the state is now in Zustand, so we just render children
  return <>{children}</>
}

// Access state - compatibility hook that gets data from Zustand
export function useChatState(): ChatState {
  return useChatStore()
}

// Access dispatch - compatibility function that translates to Zustand actions
export function useChatDispatch(): React.Dispatch<ChatAction> {
  return (action: ChatAction) => {
    switch (action.type) {
      case 'ADD_MESSAGE':
        useChatStore.getState().addMessage(action.payload.message)
        break
      case 'UPDATE_MESSAGES':
        useChatStore.getState().updateMessages(action.payload.messages)
        break
      case 'SET_MODE':
        useChatStore.getState().setMode(action.payload.mode)
        break
      case 'UPDATE_WORKFLOW_STEP':
        useChatStore.getState().updateWorkflowStep(action.payload.step)
        break
      case 'SET_ERROR':
        useChatStore.getState().setError(action.payload.error)
        break
      case 'UPDATE_PROGRESS':
        useChatStore
          .getState()
          .updateMessageProgress(
            action.payload.messageId,
            action.payload.progress,
            action.payload.phase
          )
        break
      case 'SET_LOADING':
        useChatStore.getState().setLoading(action.payload.isLoading)
        break
      case 'RESET_CHAT':
        useChatStore.getState().resetChat()
        break
      case 'START_VERIFICATION':
        useChatStore
          .getState()
          .startVerification(action.payload.content, action.payload.options)
        break
      case 'SUBMIT_CORRECTION':
        useChatStore.getState().submitCorrection(action.payload.correction)
        break
      case 'COMPLETE_VERIFICATION':
        useChatStore.getState().completeVerification(action.payload.isApproved)
        break
      case 'START_REPORT_GENERATION':
        useChatStore
          .getState()
          .startReportGeneration(action.payload.reportOptions)
        break
      case 'COMPLETE_REPORT_GENERATION':
        useChatStore.getState().completeReportGeneration(action.payload.report)
        break
      default:
        console.warn('Unhandled action type:', action.type)
    }
  }
}

// Hook for handling errors with toast notifications
export function useErrorHandler() {
  const setError = useChatStore((state) => state.setError)
  const updateWorkflowStep = useChatStore((state) => state.updateWorkflowStep)
  const currentStep = useChatStore((state) => state.workflow.currentStep)
  
  // Import the workflow error handler
  const { 
    workflowErrorHandler, 
    useWorkflowErrorHandler 
  } = require('@/lib/errors/workflow-error-handler')
  
  // Get API client for error recovery
  const { apiClient } = require('@/lib/api/client/api-client')
  
  // Initialize the workflow error handler with API client
  const errorHandler = useWorkflowErrorHandler(apiClient)
  
  return {
    // Enhanced error handler that preserves workflow transition context
    handleError: async (
      error: unknown, 
      fallbackMessage = 'An error occurred',
      options?: {
        step?: string,
        details?: Record<string, any>,
        showToast?: boolean,
        attemptRecovery?: boolean
      }
    ) => {
      // Use the specialized workflow error handler
      const metadata = await errorHandler.handleError(
        error,
        currentStep as any,
        {
          previousStep: options?.step as any || currentStep as any,
          details: options?.details,
          showToast: options?.showToast,
          attemptRecovery: options?.attemptRecovery
        }
      )
      
      return metadata
    },
    
    // Attempt recovery from an error with a specific strategy
    recoverFromError: async (
      targetStage: string,
      metadata?: Record<string, any>
    ) => {
      try {
        return await errorHandler.recoverFromError(
          targetStage as any,
          {
            errorMessage: metadata?.error || 'Unknown error',
            workflowStep: currentStep as any,
            previousStep: metadata?.previousStep as any,
            timestamp: new Date().toISOString(),
            details: metadata,
          }
        )
      } catch (error) {
        console.error('Error recovery failed:', error)
        return false
      }
    },
    
    // Get recovery paths for current workflow step
    getRecoveryPaths: () => {
      return errorHandler.getRecoveryPaths(currentStep as any)
    },
    
    // Clear any error state
    clearError: (returnToStep?: string) => {
      setError(null)
      
      if (returnToStep) {
        updateWorkflowStep(returnToStep as any)
      }
    }
  }
}

// Hook for basic message operations - compatibility wrapper over Zustand
export function useMessageActions() {
  const store = useChatStore()
  const { handleError } = useErrorHandler()

  return {
    addMessage: (message: Message | Omit<Message, 'id'>): void => {
      try {
        store.addMessage(message)
      } catch (error) {
        handleError(error, 'Failed to add message')
      }
    },

    updateMessages: (messages: Message[]): void => {
      try {
        store.updateMessages(messages)
      } catch (error) {
        handleError(error, 'Failed to update messages')
      }
    },

    updateMessageProgress: (
      messageId: string,
      progress: number,
      phase: string
    ): void => {
      try {
        store.updateMessageProgress(messageId, progress, phase)
      } catch (error) {
        handleError(error, 'Failed to update message progress')
      }
    },
  }
}

// Hook for sending messages - compatibility wrapper
export function useSendMessage() {
  const sendMessage = useChatStore((state) => state.sendMessage)
  return { sendMessage }
}

// Document processing hook - compatibility wrapper
export function useDocumentProcessing() {
  const processDocument = useChatStore((state) => state.processDocument)
  return { processDocument }
}

// Verification-specific hook - compatibility wrapper
export function useVerification() {
  const store = useChatStore()

  return {
    startVerification: store.startVerification,
    handleCorrectionMessage: store.handleCorrectionMessage,
    completeVerification: store.completeVerification,
    verification: store.verification,
  }
}

// Report generation specific hook - compatibility wrapper
export function useReportGeneration() {
  const store = useChatStore()

  return {
    generateReport: store.generateReport,
    formatReport: store.formatReport,
    reportGeneration: store.reportGeneration || {
      isComplete: false,
      format: null,
    },
  }
}

// Create a combined hook with actions for backwards compatibility
export function useChatContext(): ExtendedChatContextType {
  const store = useChatStore()

  // Return a compatibility object that matches the old context structure
  return {
    // State from store
    messages: store.messages,
    isLoading: store.isLoading,
    error: store.error,
    mode: store.mode,
    chatId: store.chatId,

    // Workflow
    workflow: {
      processDocument: store.processDocument,
      workflowStep: store.workflow.currentStep,
      processingStatus: store.workflow.processingStatus,
      error: store.workflow.workflowError,
      resetWorkflow: store.resetChat,
      startVerification: store.startVerification,
      processCorrection: store.processCorrection,
      completeVerification: store.completeVerification,
      generateReport: store.generateReport,
      formatReport: store.formatReport,
    },
    workflowStep: store.workflow.currentStep,

    // Message actions
    sendMessage: store.sendMessage,
    addMessage: store.addMessage,

    // Verification
    startVerification: async (content, options) => {
      return store.startVerification(content, options)
    },
    handleCorrectionMessage: store.handleCorrectionMessage,
    completeVerification: store.completeVerification,
    verification: store.verification,

    // Report generation
    generateReport: store.generateReport,
    formatReport: store.formatReport,
    reportGeneration: store.reportGeneration || {
      isComplete: false,
      format: null,
    },

    // Additional compatibility methods
    updateExtractionProgress: (
      messageId: string,
      progress: number,
      phase: string,
      replace: boolean = false
    ) => {
      store.updateMessageProgress(messageId, progress, phase)
    },

    postSummaryMessage: store.postSummaryMessage,
    updateSummaryAfterCorrection: store.updateSummaryAfterCorrection,
    resetChat: store.resetChat,
    addSystemMessage: store.addSystemMessage,
    confirmVerification: store.confirmVerification,
    submitCorrection: async (correction: string) => {
      store.submitCorrection(correction)
      await store.handleCorrectionMessage(correction)
    },
    setChatMode: store.setMode,
    clearMessages: store.resetChat,
  }
}
