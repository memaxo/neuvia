'use client'

import { useToast } from '@/components/ui/use-toast'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

// Import types from our centralized type system
import type {
  ChatAction,
  ChatMode,
  ChatState,
  ChatStoreSelector,
  ChatStoreState,
  ExtendedChatContextType,
  Message,
  MessageMetadata,
  ProcessingPhase,
  ProcessingStatus,
  ReportFormat,
  VerificationItem,
  VerificationMetadata,
  VerificationOptions,
  VerificationResult,
  VerificationStatusType,
  WorkflowState,
} from '@/lib/chat/types'

import { processMessage } from '@/lib/actions/message-processor'
import { initialChatState } from '@/lib/chat/types'

// Import for database operations
import type { DocumentType } from '@/lib/processing/types/base'
import type { WorkflowStep, WorkflowOptions } from '@/lib/workflow/types'

import { ApiClient } from '@/lib/api/client/api-client'
import { useWorkflow } from '@/lib/workflow/use-workflow'
import { useProcessingWorkflow } from '@/lib/hooks/use-processing-workflow'
import { validateWorkflowTransition } from '@/lib/workflow/workflow-manager'
import {
  WorkflowStateError,
  DocumentProcessingError,
  VerificationError,
  ReportGenerationError,
  normalizeError,
} from '@/lib/errors'

// Import the useWorkflowSync hook for transaction tracking
import { useWorkflowSync } from '@/lib/hooks/use-workflow-sync'

// Import error handling utilities
import { useWorkflowErrorHandler } from '@/lib/errors/workflow-error-handler'

// Initialize API client
const apiClientInstance = new ApiClient()

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

// Import the workflow services
import { workflowService } from '@/lib/services/workflow/workflow-service'
import { chatService } from '@/lib/services/chat/chat-service'
import { workflowStateManager } from '@/lib/services/workflow/workflow-state-manager'
import { verificationService } from '@/lib/services/verification/verification-service'

// Track pending workflow transactions
interface PendingTransaction {
  id: string
  step: WorkflowStep
  metadata: Record<string, any>
  timestamp: string
  status: 'pending' | 'committed' | 'failed' | 'conflict'
}

const pendingTransactions = new Map<string, PendingTransaction>()

// Function to update workflow state in database using the service layer with optimistic updates
async function updateDatabaseWorkflowState(
  step: WorkflowStep,
  metadata?: Record<string, any>,
  options: {
    optimistic?: boolean
    conflictStrategy?: 'client-wins' | 'server-wins' | 'merge' | 'manual'
    forceUpdate?: boolean
  } = {}
): Promise<string> {
  try {
    // Use the service to update the workflow state with optimistic updates
    const transactionId = await workflowService.updateWorkflowState(
      workflowStateManager.getCurrentWorkflowId() || '',
      step,
      metadata,
      options
    )

    // Store the transaction for tracking
    pendingTransactions.set(transactionId, {
      id: transactionId,
      step,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
      status: 'pending',
    })

    // Set up a timeout to check transaction status
    setTimeout(async () => {
      try {
        const status = await workflowService.getTransactionStatus(transactionId)
        if (status.status !== 'pending') {
          const transaction = pendingTransactions.get(transactionId)
          if (transaction) {
            // Handle the status safely with type checking
            if (
              status.status === 'committed' ||
              status.status === 'failed' ||
              status.status === 'conflict'
            ) {
              transaction.status = status.status
            }

            // Clean up transactions after a while
            if (status.status === 'committed' || status.status === 'failed') {
              setTimeout(() => {
                pendingTransactions.delete(transactionId)
              }, 60000) // Keep for 1 minute for debugging
            }
          }
        }
      } catch (err) {
        console.error('Error checking transaction status:', err)
      }
    }, 2000) // Check after 2 seconds

    return transactionId
  } catch (error) {
    console.error('Failed to update workflow state in database:', error)
    throw error
  }
}

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

// Extend the WorkflowState interface to properly type the data property
interface ExtendedWorkflowState extends WorkflowState {
  data: Record<string, unknown> & {
    verificationMetadata?: VerificationMetadata
    patientId?: string
  }
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

      // Workflow actions with optimistic updates and transaction tracking
      updateWorkflowStep: (step, metadata) =>
        set((state) => {
          // Use the imported validation functions

          // Current step from state
          const currentStep = state.workflow.currentStep

          // Check if this is a remote update from Supabase sync
          const isRemoteUpdate = metadata?._syncedFromRemote === true

          // Check if this has a transaction ID, indicating it's part of an optimistic update
          const isTransactionalUpdate = metadata?._transactionId !== undefined

          // Always validate transitions unless it's a remote update, transactional, or same-state update
          // Remote updates are already validated on the originating client
          if (
            !isRemoteUpdate &&
            !isTransactionalUpdate &&
            currentStep !== step
          ) {
            // Validate the transition
            const validation = validateWorkflowTransition(
              currentStep,
              step,
              metadata
            )

            // If the transition is invalid, handle it more strictly
            if (!validation.isValid) {
              console.error(
                `Invalid workflow transition from '${currentStep}' to '${step}':`,
                validation.error,
                { details: validation.details, metadata }
              )

              // Add detailed error information to metadata for better debugging
              if (metadata) {
                metadata.transitionWarning = validation.error
                metadata.invalidTransition = true
                metadata.validationDetails = validation.details
                metadata.attemptedAt = new Date().toISOString()
              }

              // Create error object to use for state updates or throwing
              const transitionError = new WorkflowStateError({
                message: validation.error || 'Invalid workflow transition',
                transition: { from: currentStep, to: step },
                data: {
                  ...metadata,
                  validationDetails: validation.details,
                },
              })

              // In production, we'll update error state but stay on the current step
              // This prevents UI from breaking while still tracking the error
              if (process.env.NODE_ENV !== 'development') {
                // Set error in state instead of throwing
                state.error = transitionError.message
                state.workflow.workflowError = transitionError.message

                // Return early with updated metadata but keep the current step
                return {
                  workflow: {
                    ...state.workflow,
                    currentStep, // Stay on current step
                    data: {
                      ...state.workflow.data,
                      transitionError: {
                        message: transitionError.message,
                        from: currentStep,
                        to: step,
                        details: validation.details,
                        timestamp: new Date().toISOString(),
                      },
                    },
                  },
                  // Keep current mode
                  mode: state.mode,
                  // Set error state
                  error: transitionError.message,
                }
              } else {
                // In development, throw error to catch invalid transitions early
                // This is caught by the error boundary and helps during development
                setTimeout(() => {
                  throw transitionError
                }, 0)

                // Also prevent the transition by keeping the current step
                step = currentStep
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
            const errorMessage = metadata.error as string
            state.error = errorMessage
            state.workflow.workflowError = errorMessage
          }

          // Track the transition in metadata for diagnostics
          const enrichedMetadata = {
            ...(metadata || {}),
            _transition: {
              from: currentStep,
              to: step,
              timestamp: new Date().toISOString(),
            },
          }

          // Only update the database if this is a local change (not a remote sync or part of an optimistic update)
          // This prevents endless loops of updates between clients
          if (!isRemoteUpdate && !isTransactionalUpdate) {
            // Use options based on the update context
            const options = {
              // Use optimistic updates by default
              optimistic: true,

              // Use merge strategy by default but allow overrides
              conflictStrategy: metadata?._conflictStrategy || 'merge',

              // Force update for error states
              forceUpdate: step === 'error',
            }

            // Add transaction ID to state for tracking
            const transactionId = updateDatabaseWorkflowState(
              step,
              enrichedMetadata,
              options
            ).catch((error) => {
              console.error('Failed to update workflow state:', error)
              // Return a special value to indicate failure
              return '__FAILED__'
            })

            // If we're using async/await in a synchronous context, we need to handle the promise
            // but Zustand's set function should finish before the promise resolves
            transactionId
              .then((id) => {
                if (id !== '__FAILED__') {
                  // Store transaction ID in the state for reference
                  // This happens after the state update, so a subsequent render will pick it up
                  set((state) => ({
                    workflow: {
                      ...state.workflow,
                      data: {
                        ...state.workflow.data,
                        _latestTransactionId: id,
                      },
                    },
                  }))
                }
                return id // Return a value from then()
              })
              .catch((err) => {
                console.error('Transaction ID promise failed:', err)
                return '__ERROR__'
              })
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
            ...(step === 'error' && metadata?.error
              ? { error: metadata.error }
              : {}),
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

        return Promise.resolve(true)
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
          const result = await verificationService.submitCorrection({
            correction,
            currentSummary,
            workflowId: workflowStateManager.getCurrentWorkflowId() || '',
            messageId: progressMessageId,
          })

          // Get data from the service response
          const newSummaryId = result.success
            ? result.data.summaryId
            : crypto.randomUUID()
          const timestamp = new Date().toISOString()
          const newSummary = result.success
            ? result.data.summary
            : `${currentSummary}\n\nUpdate based on your feedback: ${correction}`

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
                correctionCount:
                  (get().workflow.data as ExtendedWorkflowState['data'])
                    .verificationMetadata?.correctionCount ||
                  state.verification.summaryVersions.length,
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

          // Normalize and create domain-specific error
          const normalizedError = normalizeError(error)

          const verificationError = new VerificationError({
            message: normalizedError.message || 'Failed to process correction',
            code: 'CORRECTION_PROCESSING_FAILED',
            verificationId: state.verification.summaryVersions[0]?.id,
            documentId: state.workflow.data.documentId as string,
            data: {
              correction,
              currentSummary: state.verification.currentSummary,
              correctionCount: state.verification.summaryVersions.length,
            },
            cause: error,
          })

          // Update workflow state with detailed error
          get().setError(verificationError.message)
          get().updateWorkflowStep('error', {
            error: verificationError.message,
            errorDetails: verificationError.data,
            errorCode: verificationError.code,
            errorTimestamp: verificationError.timestamp,
            errorStage: 'verification',
            previousStep: 'verification_in_progress',
          })
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

        // Get current workflow and patient data
        const state = get()
        const currentWorkflowId =
          workflowStateManager.getCurrentWorkflowId() || ''
        const currentPatientId = (state.workflow.data.patientId as string) || ''

        try {
          // Call the reports API
          const report = await apiClientInstance.reports.generateReport({
            workflowId: currentWorkflowId,
            patientId: currentPatientId,
            format: 'pdf',
            includeVerificationData: true,
            detailLevel: 'comprehensive',
          })

          // Update workflow state to completion once report is done
          get().completeReportGeneration({
            format: report.data.format || 'pdf',
            content: report.data.content || 'Generated report content',
            generatedAt: report.data.generatedAt || new Date().toISOString(),
            reportId: report.data.id,
          })
        } catch (error) {
          console.error('Error generating report:', error)

          // Normalize and create domain-specific error
          const normalizedError = normalizeError(error)

          const reportError = new ReportGenerationError({
            message: normalizedError.message || 'Failed to generate report',
            code: 'REPORT_GENERATION_FAILED',
            workflowId: currentWorkflowId,
            patientId: currentPatientId,
            data: {
              requestDetails: {
                format: 'pdf',
                includeVerificationData: true,
                detailLevel: 'comprehensive',
              },
            },
            cause: error,
          })

          // Update workflow state with detailed error
          get().setError(reportError.message)
          get().updateWorkflowStep('error', {
            error: reportError.message,
            errorDetails: reportError.data,
            errorCode: reportError.code,
            errorTimestamp: reportError.timestamp,
            errorStage: 'report_generation',
          })
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
          const formattedReport = await apiClientInstance.reports.formatReport(
            reportId,
            {
              format: format.format || 'pdf',
              style: format.style || 'clinical',
              metadataInFooter: format.metadataInFooter || false,
            }
          )

          get().completeReportGeneration({
            format,
            content: formattedReport.data.content || 'Formatted report content',
            formattedAt: new Date().toISOString(),
            reportId: formattedReport.data.id || reportId,
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
          const result = await apiClientInstance.documents.processDocument({
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

          // Normalize and log the error properly
          const normalizedError = normalizeError(error)

          // Create a domain-specific document processing error
          const documentError = new DocumentProcessingError({
            message: normalizedError.message,
            code: 'DOCUMENT_PROCESSING_FAILED',
            phase: 'extraction',
            data: {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              patientId,
            },
            cause: error,
          })

          // Update workflow state with detailed error
          get().setError(documentError.message)
          get().updateWorkflowStep('error', {
            error: documentError.message,
            errorDetails: documentError.data,
            errorCode: documentError.code,
            errorTimestamp: documentError.timestamp,
          })

          throw documentError
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
          const result = await apiClientInstance.documents.uploadDocument({
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
          const { data: userData } =
            await apiClientInstance.auth.getCurrentUser()
          const userId = userData?.user?.id
          const chatId = workflowStateManager.getCurrentChatId() || undefined

          if (!userId) {
            throw new Error('User not authenticated')
          }

          // Use API client first for compatibility
          const workflowId = workflowStateManager.getCurrentWorkflowId() || ''

          const verificationResult =
            await verificationService.generateVerification({
              document: extractedDocument,
              workflowId,
              messageId: messageId || '',
              summaryId: crypto.randomUUID(),
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
                extractedData:
                  verificationResult.data.structuredData || extractedDocument,
                summaryId: verificationResult.data.summaryId,
              },
            },
          }))

          return {
            summaryId: verificationResult.success
              ? verificationResult.data.summaryId
              : crypto.randomUUID(),
            summary: verificationResult.success
              ? verificationResult.data.summary
              : 'Summary extraction failed',
            structuredData: verificationResult.success
              ? verificationResult.data.structuredData || {
                  patient: {
                    name: 'Sample Patient',
                    age: 0,
                    diagnosis: 'Pending diagnosis',
                  },
                }
              : {
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
          const { data: userData } =
            await apiClientInstance.auth.getCurrentUser()
          const userId = userData?.user?.id
          const chatId = workflowStateManager.getCurrentChatId() || undefined

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
          const workflowId = workflowStateManager.getCurrentWorkflowId() || ''

          const correctionResult = await verificationService.processCorrection({
            correction: correctionText,
            currentSummary,
            workflowId,
            messageId: messageId || '',
          })

          // Update local state with new summary
          set((state) => {
            const currVerificationMetadata =
              state.workflow.data.verificationMetadata || {}
            const currSummaryVersions = state.verification.summaryVersions || []
            const newSummaryId =
              correctionResult.data.summaryId || crypto.randomUUID()

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
                currentSummary: correctionResult.data.summary,
                summaryVersions: [
                  ...currSummaryVersions,
                  {
                    id: newSummaryId,
                    content: correctionResult.data.summary,
                    timestamp: new Date().toISOString(),
                  },
                ],
              },
            }
          })

          return {
            summaryId: correctionResult.data.summaryId,
            summary: correctionResult.data.summary,
            structuredData: correctionResult.data.structuredData || {
              patient: {
                name: 'Sample Patient',
                age: 45,
                diagnosis: 'Updated diagnosis based on correction',
              },
            },
            correctionCount:
              correctionResult.data.correctionCount ||
              ((get().workflow.data as ExtendedWorkflowState['data'])
                .verificationMetadata?.correctionCount || 0) + 1,
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
          const { data: userData } =
            await apiClientInstance.auth.getCurrentUser()
          const userId = userData?.user?.id
          const chatId = workflowStateManager.getCurrentChatId() || undefined

          if (!userId) {
            throw new Error('User not authenticated')
          }

          // Reset verification in database - use the workflow state manager
          await workflowStateManager.resetWorkflow()

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
          const { data: userData } =
            await apiClientInstance.auth.getCurrentUser()
          const userId = userData?.user?.id
          const chatId = workflowStateManager.getCurrentChatId() || undefined

          if (!userId) {
            throw new Error('User not authenticated')
          }

          // Get current workflow step for validation
          const currentStep = get().workflow.currentStep

          // Validate current state - this should be verification_completed
          const validSteps = [
            'verification_completed',
            'verification',
            'complete',
          ]
          if (!validSteps.includes(currentStep)) {
            throw new Error(
              `Verification must be completed before generating report, current step: ${currentStep}`
            )
          }

          // Update database workflow state through the workflow state manager
          await workflowStateManager.updateWorkflowState('report_generation', {
            ...(reportMetadata || {}),
            reportGenerationStartedAt: new Date().toISOString(),
          })

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
  const { toast } = useToast()
  const setError = useChatStore((state) => state.setError)
  const updateWorkflowStep = useChatStore((state) => state.updateWorkflowStep)
  const currentStep = useChatStore((state) => state.workflow.currentStep)

  // Initialize the workflow error handler with API client
  const errorHandler = useWorkflowErrorHandler(apiClientInstance)

  return {
    // Enhanced error handler that preserves workflow transition context
    handleError: async (
      error: unknown,
      fallbackMessage = 'An error occurred',
      options?: {
        step?: string
        details?: Record<string, any>
        showToast?: boolean
        attemptRecovery?: boolean
      }
    ) => {
      // Use the specialized workflow error handler
      const metadata = await errorHandler.handleError(
        error,
        currentStep as any,
        {
          previousStep: (options?.step as any) || (currentStep as any),
          details: options?.details,
          showToast: options?.showToast,
          attemptRecovery: options?.attemptRecovery,
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
        return await errorHandler.recoverFromError(targetStage as any, {
          errorMessage: metadata?.error || 'Unknown error',
          workflowStep: currentStep as any,
          previousStep: metadata?.previousStep as any,
          timestamp: new Date().toISOString(),
          details: metadata,
        })
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
    },
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

    // Workflow - match the structure expected by UseProcessingWorkflowResult
    workflow: {
      workflowStep: store.workflow.currentStep,
      error: store.workflow.workflowError,
      resetWorkflow: store.resetChat,
      processDocument: store.processDocument,
      extractedDocument: store.extractedDocument,
      status: store.workflow.processingStatus.status,
      data: store.workflow.data as ExtendedWorkflowState['data'],
      // Add these methods to match the expected interface
      generateReport: store.generateReport,
      formatReport: store.formatReport,
      completeVerification: store.completeVerification,
      processCorrection: store.processCorrection,
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
