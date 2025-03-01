'use client'

import { useToast } from '@/components/ui/use-toast'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

// Import types from our centralized type system
import type {
  ChatAction,
  ChatMode,
  ChatState,
  ExtendedChatContextType,
  Message,
  MessageMetadata,
} from '@/lib/chat/types'

// Import the reducer and action creators
import {
  chatReducer,
  initialWorkflowState,
} from '@/contexts/reducers/chat-reducer'
import { chatActions } from '@/lib/actions/chat-actions'
import { processMessage } from '@/lib/actions/message-processor'
import { initialChatState } from '@/lib/chat/types'

// Import our specialized workflow hook instead of the base one
import { useChatProcessingWorkflow } from '@/lib/hooks/use-chat-processing-workflow'
import type { UseChatProcessingWorkflowResult } from '@/lib/hooks/use-chat-processing-workflow'
import type { ProcessingStatus } from '@/lib/processing/types/base'
import type {
  ProcessingPhase,
  VerificationStatusType,
  WorkflowStep,
} from '@/lib/workflow/types'
import { workflowManager } from '@/lib/workflow/workflow-manager'

import type {
  VerificationItem,
  VerificationOptions,
  VerificationResult,
} from '@/lib/processing/types/verification'
import type { Database } from '@/lib/supabase'
import { createBrowserClient } from '@/lib/supabase/clients'

// Create separate contexts for state and dispatch
const ChatStateContext = createContext<ChatState | undefined>(undefined)
const ChatDispatchContext = createContext<
  React.Dispatch<ChatAction> | undefined
>(undefined)
const WorkflowContext = createContext<
  ReturnType<typeof useChatProcessingWorkflow> | undefined
>(undefined)

// Create an extended chat state with workflow state included
const extendedInitialState: ChatState = {
  ...initialChatState,
  workflow: initialWorkflowState,
}

export function ChatProvider({ children }: { readonly children: ReactNode }) {
  // Use the reducer for state management
  const [state, dispatch] = useReducer(chatReducer, extendedInitialState)

  // Use our specialized workflow hook
  const workflow = useChatProcessingWorkflow()

  // Store the Supabase client in a ref
  const supabaseRef = useRef<SupabaseClient<Database>>()

  // Initialize Supabase client
  useEffect(() => {
    supabaseRef.current = createBrowserClient()
  }, [])

  // Set up message handler
  useEffect(() => {
    workflow.setMessageHandler((message: Message) => {
      dispatch(chatActions.addMessage(message))
    })
  }, [workflow])

  // Sync with workflow changes
  useEffect(() => {
    // Update chat state based on workflow step changes
    dispatch(chatActions.updateWorkflowStep(workflow.workflowStep))

    // Handle workflow errors
    if (workflow.error) {
      dispatch(chatActions.setError(workflow.error))
    }
  }, [workflow.workflowStep, workflow.error])

  // Syncs workflow state between the state machine and the chat reducer
  useEffect(() => {
    if (workflow?.stateMachine) {
      // Manual state sync without using subscribe/onStateChange
      // Just sync the current step which we know exists
      const currentStep = workflow.stateMachine.state.currentStep
      if (currentStep !== state.workflow?.currentStep) {
        dispatch(chatActions.updateWorkflowStep(currentStep))
      }
    }
  }, [workflow, state.workflow, dispatch])

  return (
    <ChatStateContext.Provider value={state}>
      <ChatDispatchContext.Provider value={dispatch}>
        <WorkflowContext.Provider value={workflow}>
          {children}
        </WorkflowContext.Provider>
      </ChatDispatchContext.Provider>
    </ChatStateContext.Provider>
  )
}

// Access state
export function useChatState(): ChatState {
  const context = useContext(ChatStateContext)
  if (context === undefined) {
    throw new Error('useChatState must be used within a ChatProvider')
  }
  return context
}

// Access dispatch
export function useChatDispatch(): React.Dispatch<ChatAction> {
  const context = useContext(ChatDispatchContext)
  if (context === undefined) {
    throw new Error('useChatDispatch must be used within a ChatProvider')
  }
  return context
}

// Access workflow
export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a ChatProvider')
  }
  return context
}

// Hook for handling errors with toast notifications
export function useErrorHandler() {
  const { toast } = useToast()
  const dispatch = useChatDispatch()

  const handleError = useCallback(
    (error: unknown, fallbackMessage = 'An error occurred') => {
      const errorMsg = error instanceof Error ? error.message : fallbackMessage

      // Set error in state
      dispatch(chatActions.setError(errorMsg))

      // Show toast notification
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      })

      // Report error to workflow manager to update database if needed
      if (workflowManager) {
        workflowManager.reportError(
          {
            onError: (msg) => console.error('Workflow error:', msg),
          },
          error
        )
      }
    },
    [dispatch, toast]
  )

  return { handleError }
}

// Hook for basic message operations
export function useMessageActions() {
  const dispatch = useChatDispatch()
  const { handleError } = useErrorHandler()
  const workflow = useWorkflow()

  const addMessage = useCallback(
    (message: Message | Omit<Message, 'id'>): void => {
      try {
        dispatch(chatActions.addMessage(message))

        // If this is an assistant message, also add it to the workflow if applicable
        if (message.role === 'assistant' && workflow?.addMessage) {
          workflow.addMessage(
            'id' in message
              ? message
              : {
                  ...message,
                  id: crypto.randomUUID(),
                }
          )
        }
      } catch (error) {
        handleError(error, 'Failed to add message')
      }
    },
    [dispatch, handleError, workflow]
  )

  const updateMessages = useCallback(
    (messages: Message[]): void => {
      try {
        dispatch(chatActions.updateMessages(messages))
      } catch (error) {
        handleError(error, 'Failed to update messages')
      }
    },
    [dispatch, handleError]
  )

  const updateMessageProgress = useCallback(
    (messageId: string, progress: number, phase: string): void => {
      try {
        dispatch(chatActions.updateProgress(messageId, progress, phase))

        // Also update workflow status
        if (workflow?.stateMachine?.setStatus) {
          workflow.stateMachine.setStatus({
            progress,
            phase: phase as ProcessingPhase,
          })
        }
      } catch (error) {
        handleError(error, 'Failed to update message progress')
      }
    },
    [dispatch, handleError, workflow]
  )

  return { addMessage, updateMessages, updateMessageProgress }
}

// Hook for sending messages with concurrency control
export function useSendMessage() {
  const state = useChatState()
  const dispatch = useChatDispatch()
  const workflow = useWorkflow()
  const { handleError } = useErrorHandler()
  const { addMessage } = useMessageActions()
  const [isProcessing, setIsProcessing] = useState(false)
  const messageQueue = useRef<
    {
      content: string
      options?: { isCorrection?: boolean; metadata?: MessageMetadata }
    }[]
  >([])

  // Function to process the next message in the queue
  const processNextMessage = async () => {
    if (messageQueue.current.length === 0 || isProcessing) return

    setIsProcessing(true)
    const { content, options } = messageQueue.current.shift()!

    try {
      dispatch(chatActions.setLoading(true))

      // Add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: new Date(),
        metadata: options?.metadata,
      }

      dispatch(chatActions.addMessage(userMessage))

      // Process the message based on current mode
      await processMessage(content, state.mode, dispatch, workflow)
    } catch (error) {
      handleError(error)
    } finally {
      dispatch(chatActions.setLoading(false))
      setIsProcessing(false)

      // Check if there are more messages to process
      if (messageQueue.current.length > 0) {
        setTimeout(processNextMessage, 0)
      }
    }
  }

  // Send a message, adding it to the queue if already processing
  const sendMessage = async (
    content: string,
    options?: { isCorrection?: boolean; metadata?: MessageMetadata }
  ): Promise<void> => {
    if (!content.trim()) return

    // Add to queue
    messageQueue.current.push({ content, options })

    // Start processing if not already
    if (!isProcessing) {
      await processNextMessage()
    }
  }

  return { sendMessage }
}

// Verification-specific hook
export function useVerification() {
  const state = useChatState()
  const dispatch = useChatDispatch()
  const workflow = useWorkflow()
  const { handleError } = useErrorHandler()
  const { addMessage } = useMessageActions()
  const { sendMessage } = useSendMessage()

  const completeVerification = async (
    isApproved: boolean
  ): Promise<VerificationResult> => {
    try {
      // Dispatch a complete verification action to update UI
      dispatch(chatActions.completeVerification(isApproved))

      // Build the verification result based on current state
      // Accessing state consistently from workflow

      // Get verification data from workflow state machine if available
      const verificationData = workflow?.stateMachine?.state?.data
        ?.verification || {
        originalSummaryId: null,
        currentVersionId: null,
        correctionCount: 0,
      }

      const result: VerificationResult = {
        isCompleted: true,
        isApproved,
        items: state.verification.verificationItems,
        completedAt: new Date().toISOString(),
        verificationMetadata: {
          verificationStatus: 'completed',
          originalSummaryId:
            verificationData.originalSummaryId ||
            state.verification.summaryVersions[0]?.id ||
            '',
          currentVersionId:
            verificationData.currentVersionId ||
            state.verification.summaryVersions[
              state.verification.summaryVersions.length - 1
            ]?.id ||
            '',
          correctionCount:
            verificationData.correctionCount ||
            state.verification.summaryVersions.length - 1,
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

      // Complete in workflow if available
      if (
        workflow &&
        'completeVerification' in workflow &&
        typeof workflow.completeVerification === 'function'
      ) {
        await workflow.completeVerification(isApproved)
      }

      return result
    } catch (error) {
      handleError(error, 'Error completing verification')
      throw error
    }
  }

  return useMemo(
    () => ({
      // Start verification process
      startVerification: async (
        content: string,
        options?: VerificationOptions
      ): Promise<void> => {
        try {
          // Set mode to verification
          dispatch(chatActions.setMode('verification'))

          // Start verification in state
          dispatch(chatActions.startVerification(content, options))

          // Also start verification in workflow if available
          if (
            workflow &&
            'startVerification' in workflow &&
            typeof workflow.startVerification === 'function'
          ) {
            workflow.startVerification(content)
          }

          // Post the summary for verification
          const summaryId = crypto.randomUUID()
          const timestamp = new Date().toISOString()

          // Add the summary message
          const message: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            createdAt: new Date(),
            metadata: {
              isSummary: true,
              summaryVersionId: summaryId,
              timestamp,
            },
          }

          addMessage(message)

          // Add a system message asking for verification
          addMessage({
            role: 'system',
            content:
              "Please review the summary above. Type 'confirm' to approve it, or provide corrections.",
            createdAt: new Date(),
            metadata: {
              isVerificationRequest: true,
            },
          })
        } catch (error) {
          handleError(error, 'Error starting verification')
        }
      },

      // Process correction to a summary
      handleCorrectionMessage: async (correction: string): Promise<void> => {
        try {
          dispatch(chatActions.submitCorrection(correction))

          // Add the correction message
          addMessage({
            role: 'user',
            content: correction,
            createdAt: new Date(),
            metadata: {
              isCorrection: true,
            },
          })

          // Add a processing message
          const progressMessageId = crypto.randomUUID()
          addMessage({
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

          // Process the correction in the workflow
          if (
            workflow &&
            'processCorrection' in workflow &&
            typeof workflow.processCorrection === 'function'
          ) {
            const currentSummary = state.verification.currentSummary || ''
            const result = await workflow.processCorrection(
              currentSummary,
              correction
            )

            if (result && result.summary) {
              // Update the progress message
              dispatch(
                chatActions.updateProgress(progressMessageId, 100, 'completed')
              )

              // Add the corrected summary
              addMessage({
                role: 'assistant',
                content: result.summary,
                createdAt: new Date(),
                metadata: {
                  isSummary: true,
                  summaryVersionId: result.summaryId,
                  verificationMetadata: {
                    verificationStatus: 'in_progress',
                    correctionCount: result.correctionCount,
                  },
                },
              })

              // Ask for confirmation again
              addMessage({
                role: 'system',
                content:
                  "I've updated the summary based on your correction. Please review it and type 'confirm' to approve or provide additional corrections.",
                createdAt: new Date(),
                metadata: {
                  isVerificationRequest: true,
                },
              })
            }
          }
        } catch (error) {
          handleError(error, 'Error processing correction')
        }
      },

      // Complete verification
      completeVerification,

      // Current verification state
      verification: state.verification,

      // Whether in verification mode
      isInVerificationMode: state.verification.isInVerificationMode,
    }),
    [
      state,
      dispatch,
      workflow,
      handleError,
      addMessage,
      sendMessage,
      completeVerification,
    ]
  )
}

// Report generation specific hook
export function useReportGeneration() {
  const dispatch = useChatDispatch()
  const workflow = useWorkflow()
  const { handleError } = useErrorHandler()

  return useMemo(
    () => ({
      // Generate a report
      generateReport: async (): Promise<void> => {
        try {
          dispatch(chatActions.startReportGeneration())

          if (workflow.generateReport) {
            await workflow.generateReport()
          }
        } catch (error) {
          handleError(error, 'Error starting report generation')
        }
      },

      // Format a report
      formatReport: async (format: any): Promise<void> => {
        try {
          if (workflow.formatReport) {
            await workflow.formatReport(format)
          }

          dispatch(chatActions.completeReportGeneration(null))
        } catch (error) {
          handleError(error, 'Error formatting report')
        }
      },
    }),
    [dispatch, workflow, handleError]
  )
}

// Create a combined hook with actions for backwards compatibility
export function useChatContext(): ExtendedChatContextType {
  const state = useChatState()
  const dispatch = useChatDispatch()
  const workflow = useWorkflow()
  const { sendMessage } = useSendMessage()
  const messageActions = useMessageActions()
  const verificationHook = useVerification()
  const reportGeneration = useReportGeneration()
  const { handleError } = useErrorHandler()

  // Function for both clearChat and resetChat
  const resetChatFn = () => {
    dispatch(chatActions.resetChat())
    workflow.resetWorkflow()
  }

  // Return a compatibility object that matches the old context structure
  const result: ExtendedChatContextType = {
    // State from reducer
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    mode: state.mode,
    chatId: state.chatId,

    // Pass workflow through
    workflow,
    workflowStep: workflow.workflowStep,

    // Message actions
    sendMessage,
    ...messageActions,

    // Verification actions - spread these first to avoid duplicate property issues
    ...verificationHook,

    // Report generation actions
    ...reportGeneration,

    // Additional methods for backward compatibility
    updateExtractionProgress: (
      messageId: string,
      progress: number,
      phase: string,
      replace: boolean = false
    ): void => {
      dispatch(chatActions.updateProgress(messageId, progress, phase))
    },

    postSummaryMessage: (summary: string): Message => {
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

      // Dispatch action to start verification
      dispatch(chatActions.startVerification(summary))

      // Add the message
      dispatch(chatActions.addMessage(message))

      return message
    },

    // Handle correction message
    handleCorrectionMessage: async (correctionText: string): Promise<void> => {
      await verificationHook.handleCorrectionMessage(correctionText)
    },

    updateSummaryAfterCorrection: (newSummary: string): Message => {
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
      dispatch(chatActions.addMessage(message))

      return message
    },

    // Reset chat (according to interface)
    resetChat: resetChatFn,

    // Add verification state with correct type
    verification: {
      isInVerificationMode: state.verification.isInVerificationMode,
      currentSummary: state.verification.currentSummary,
      summaryVersions: state.verification.summaryVersions,
      verificationStatus: (state.verification.verificationStatus === 'failed'
        ? 'in_progress'
        : state.verification.verificationStatus) as
        | 'pending'
        | 'in_progress'
        | 'completed',
      verificationItems: state.verification.verificationItems,
    },

    // Add missing methods required by ExtendedChatContextType
    addSystemMessage: (
      content: string,
      type?: string,
      metadata?: any
    ): Message => {
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

      dispatch(chatActions.addMessage(message))
      return message
    },

    confirmVerification: async (): Promise<VerificationResult> => {
      return verificationHook.completeVerification(true)
    },

    submitCorrection: async (correction: string): Promise<void> => {
      dispatch(chatActions.submitCorrection(correction))
      await verificationHook.handleCorrectionMessage(correction)
    },

    setChatMode: (mode: ChatMode): void => {
      dispatch(chatActions.setMode(mode))
    },

    clearMessages: (): void => {
      dispatch(chatActions.resetChat())
    },
  }

  return result
}
