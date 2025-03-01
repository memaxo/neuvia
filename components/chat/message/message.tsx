'use client'

import type { Message as AIMessage, ChatRequestOptions } from 'ai'
import cx from 'classnames'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckIcon,
  File as DocumentIcon,
  FileIcon,
  Pencil as PencilEditIcon,
  Sparkles as SparklesIcon,
  XIcon,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import type { Vote } from '@/lib/types/vote'

import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useChatContext } from '@/contexts/chat-context'
import { cn } from '@/lib/utils'
import equal from 'fast-deep-equal'
import { DocumentPreview } from '../ui/document-preview'
import { SummaryDiffViewer } from '../ui/summary-diff-viewer'
import {
  ProgressIndicator,
  SectionCorrectionButtons,
  VerificationActions,
  VerificationStatus,
  VersionIndicator,
} from '../workflow/verification-ui'
import { MessageActions } from './message-actions'
import { MessageEditor } from './message-editor'

// Extend the AI Message type with metadata
interface Message extends AIMessage {
  metadata?: {
    documentId?: string
    title?: string
    isReport?: boolean
    isResearch?: boolean
    isVerificationRequest?: boolean
    isSummary?: boolean
    isCorrection?: boolean
    isProgress?: boolean
    summaryVersionId?: string
    progressValue?: number
    progressPhase?: string
    verificationMetadata?: {
      verificationStatus?: 'pending' | 'in_progress' | 'completed' | 'failed'
    }
    [key: string]: any
  }
}

// Interface for our enhanced message components
interface MessageUIProps {
  chatId: string
  message: Message
  vote?: Vote
  isLoading?: boolean
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[])
  ) => void
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>
  isReadonly?: boolean
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly = false,
}: MessageUIProps) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [correctionMode, setCorrectionMode] = useState<boolean>(false)
  const [correctionText, setCorrectionText] = useState<string>('')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [isDiffViewerOpen, setIsDiffViewerOpen] = useState<boolean>(false)

  // Get access to chat context for verification features
  const chatContext = useChatContext()

  // Determine if this is a verification-related message
  const isVerificationMessage = !!message.metadata?.isVerificationRequest
  const isSummaryMessage = !!message.metadata?.isSummary
  const isCorrectionMessage = !!message.metadata?.isCorrection
  const isProgressMessage = !!message.metadata?.isProgress
  const isSystemMessage = message.role === 'system'

  // Extract metadata for verification messages
  const verificationStatus = message.metadata?.verificationMetadata
    ?.verificationStatus as
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | undefined
  const summaryVersionId = message.metadata?.summaryVersionId
  const progressValue = message.metadata?.progressValue ?? 0
  const progressPhase = message.metadata?.progressPhase ?? 'Processing'

  // Get version info if available
  const summaryVersion = useMemo(() => {
    if (!summaryVersionId || !chatContext?.verification?.summaryVersions)
      return null

    const versions = chatContext.verification.summaryVersions
    const versionIndex = versions.findIndex((v) => v.id === summaryVersionId)

    if (versionIndex === -1) return null

    return {
      version: versionIndex + 1,
      total: versions.length,
    }
  }, [summaryVersionId, chatContext?.verification?.summaryVersions])

  // Track sources from search and extract results
  const [searchSources, setSearchSources] = useState<
    Array<{
      title: string
      url: string
      description: string
      source: string
      relevance: number
    }>
  >([])

  useEffect(() => {
    if (message.toolInvocations) {
      const sources: Array<{
        title: string
        url: string
        description: string
        source: string
        relevance: number
      }> = []

      message.toolInvocations.forEach((toolInvocation: any) => {
        try {
          if (
            toolInvocation.toolName === 'search' &&
            toolInvocation.state === 'result'
          ) {
            const searchResults = toolInvocation.result.data.map(
              (item: any, index: number) => ({
                title: item.title,
                url: item.url,
                description: item.description,
                source: new URL(item.url).hostname,
                relevance: 1 - index * 0.1, // Decrease relevance for each subsequent result
              })
            )
            sources.push(...searchResults)
          }
        } catch (error) {
          console.error('Error processing search results:', error)
        }
      })

      setSearchSources(sources)
    }
  }, [message.toolInvocations])

  // Function to handle correction submission
  const handleSubmitCorrection = useCallback(async () => {
    if (!correctionText.trim() || !chatContext) return

    try {
      await chatContext.handleCorrectionMessage(correctionText)
      setCorrectionMode(false)
      setCorrectionText('')
    } catch (error) {
      console.error('Failed to submit correction:', error)
    }
  }, [correctionText, chatContext])

  // Function to handle section correction
  const handleSectionCorrection = useCallback(
    (sectionTitle: string) => {
      setActiveSection(sectionTitle)
      setCorrectionMode(true)

      // Extract section content to pre-populate correction text
      const content = message.content as string
      const sectionRegex = new RegExp(
        `## ${sectionTitle}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
        'i'
      )
      const match = content.match(sectionRegex)

      if (match && match[1]) {
        setCorrectionText(`## ${sectionTitle}\n${match[1].trim()}`)
      } else {
        setCorrectionText(`## ${sectionTitle}\n`)
      }
    },
    [message.content]
  )

  // Function to handle confirmation
  const handleConfirmVerification = useCallback(async () => {
    if (!chatContext) return

    try {
      await chatContext.confirmVerification()
    } catch (error) {
      console.error('Failed to confirm verification:', error)
    }
  }, [chatContext])

  // Function to initiate correction
  const handleEditVerification = useCallback(() => {
    setCorrectionMode(true)
    setCorrectionText(message.content as string)
  }, [message.content])

  // Function to view history
  const handleViewHistory = useCallback(() => {
    setIsDiffViewerOpen(true)
  }, [])

  // Function to close the diff viewer
  const handleCloseDiffViewer = useCallback(() => {
    setIsDiffViewerOpen(false)
  }, [])

  return (
    <AnimatePresence>
      <motion.div
        animate={{ y: 0, opacity: 1 }}
        className={cn('group/message mx-auto w-full max-w-3xl px-4', {
          'mb-8': isSummaryMessage, // Extra margin for summary messages
        })}
        data-role={message.role}
        initial={{ y: 5, opacity: 0 }}
      >
        <div
          className={cn(
            'flex w-full gap-4 group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit' || correctionMode,
              'group-data-[role=user]/message:w-fit':
                mode !== 'edit' && !correctionMode,
            }
          )}
        >
          {message.role === 'assistant' && (
            <div className="ring-border bg-background flex size-8 shrink-0 items-center justify-center rounded-full ring-1">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

          <div className="flex w-full flex-col gap-2">
            {/* Verification status indicator */}
            {(isSummaryMessage || isVerificationMessage) &&
              verificationStatus && (
                <div className="mb-1 flex flex-row items-center justify-between">
                  <VerificationStatus status={verificationStatus} />

                  {summaryVersion && (
                    <VersionIndicator
                      total={summaryVersion.total}
                      version={summaryVersion.version}
                    />
                  )}
                </div>
              )}

            {/* Progress indicator for extraction */}
            {isProgressMessage && (
              <ProgressIndicator
                className="my-2"
                phase={progressPhase}
                value={progressValue}
              />
            )}

            {message.experimental_attachments && (
              <div className="flex flex-row justify-end gap-2">
                {message.experimental_attachments.map((attachment) => (
                  <div
                    className="flex items-center gap-2 rounded border p-2"
                    key={attachment.url}
                  >
                    <FileIcon size={16} />
                    <a
                      href={attachment.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {attachment.name || 'Attachment'}
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Summary message display with verification actions */}
            {message.content && isSummaryMessage && !correctionMode && (
              <div
                className={cn(
                  'flex flex-col gap-3',
                  'rounded-lg border p-4',
                  'bg-muted/20'
                )}
              >
                <div className="markdown-summary">
                  <Markdown>{message.content as string}</Markdown>
                </div>

                {!isReadonly && verificationStatus !== 'completed' && (
                  <VerificationActions
                    className="mt-2"
                    onConfirm={handleConfirmVerification}
                    onEdit={handleEditVerification}
                    onHistory={
                      chatContext?.verification?.summaryVersions?.length > 1
                        ? handleViewHistory
                        : undefined
                    }
                  />
                )}
              </div>
            )}

            {/* Correction mode text area */}
            {message.content && correctionMode && (
              <div className="flex w-full flex-col gap-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>
                    {activeSection
                      ? `Editing section: ${activeSection}`
                      : 'Make your corrections below'}
                  </span>

                  <Button
                    onClick={() => {
                      setCorrectionMode(false)
                      setActiveSection(null)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>

                <textarea
                  className="min-h-[200px] w-full rounded-md border p-3"
                  onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder="Enter your corrections here..."
                  value={correctionText}
                />

                <div className="flex justify-end">
                  <Button onClick={handleSubmitCorrection}>
                    Submit Corrections
                  </Button>
                </div>
              </div>
            )}

            {/* Regular user/assistant message display */}
            {message.content &&
              !isSummaryMessage &&
              mode === 'view' &&
              !correctionMode && (
                <div className="flex flex-row items-start gap-2">
                  {message.role === 'user' && !isReadonly && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="text-muted-foreground h-fit rounded-full px-2 opacity-0 group-hover/message:opacity-100"
                          onClick={() => {
                            setMode('edit')
                          }}
                          variant="ghost"
                        >
                          <PencilEditIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit message</TooltipContent>
                    </Tooltip>
                  )}

                  <div
                    className={cn('flex flex-col gap-4', {
                      'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                        message.role === 'user',
                      'bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-300 px-3 py-2 rounded-xl':
                        isSystemMessage && isCorrectionMessage,
                    })}
                  >
                    <Markdown>{message.content as string}</Markdown>
                  </div>
                </div>
              )}

            {message.content && mode === 'edit' && (
              <div className="flex flex-row items-start gap-2">
                <div className="size-8" />

                <MessageEditor
                  key={message.id}
                  message={message}
                  reload={reload}
                  setMessages={setMessages}
                  setMode={setMode}
                />
              </div>
            )}

            {message.toolInvocations && message.toolInvocations.length > 0 && (
              <div className="flex flex-col gap-4">
                {message.toolInvocations.map((toolInvocation) => {
                  const {
                    toolName,
                    toolCallId,
                    state,
                    args = {},
                  } = toolInvocation

                  if (state === 'result') {
                    const { result } = toolInvocation

                    return (
                      <div key={toolCallId}>
                        {toolName === 'search' ? (
                          <div className="rounded border p-3 text-sm">
                            <h4 className="mb-2 font-medium">Search Results</h4>
                            {result.data && Array.isArray(result.data) ? (
                              <ul className="space-y-2">
                                {result.data.map((item: any, idx: number) => (
                                  <li className="border-t pt-2" key={idx}>
                                    <a
                                      className="font-medium text-blue-600 dark:text-blue-400"
                                      href={item.url}
                                      rel="noopener noreferrer"
                                      target="_blank"
                                    >
                                      {item.title}
                                    </a>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      {item.description}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-gray-500">
                                No search results available
                              </div>
                            )}
                          </div>
                        ) : toolName === 'extract' || toolName === 'scrape' ? (
                          <div className="rounded border p-3 text-sm">
                            <h4 className="mb-2 font-medium">
                              {toolName === 'extract'
                                ? 'Extracted Content'
                                : 'Scraped Content'}
                            </h4>
                            <div className="whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400">
                              {result?.data
                                ? typeof result.data === 'string'
                                  ? result.data
                                  : JSON.stringify(result.data, null, 2)
                                : 'No content available'}
                            </div>
                            {args?.url && (
                              <div className="mt-2 text-xs">
                                <span className="text-gray-500">Source: </span>
                                <a
                                  className="text-blue-600 dark:text-blue-400"
                                  href={args.url}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {args.url}
                                </a>
                              </div>
                            )}
                          </div>
                        ) : toolName === 'deepResearch' ? (
                          <div className="text-muted-foreground text-sm">
                            {result.success
                              ? 'Research completed successfully.'
                              : 'Research failed.'}
                          </div>
                        ) : toolName === 'getDocument' ? (
                          <div className="rounded border p-3">
                            <h4 className="mb-2 font-medium">Document</h4>
                            {result?.data ? (
                              <div className="text-sm">
                                <p className="text-gray-600 dark:text-gray-400">
                                  {typeof result.data === 'string'
                                    ? result.data
                                    : JSON.stringify(result.data, null, 2)}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">
                                No document data available
                              </p>
                            )}
                          </div>
                        ) : toolName === 'getWeather' ? (
                          <div className="rounded border p-3">
                            <h4 className="mb-2 font-medium">Weather</h4>
                            {result?.data ? (
                              <div className="text-sm">
                                <p className="font-medium">{args.location}</p>
                                <p className="text-gray-600 dark:text-gray-400">
                                  {typeof result.data === 'string'
                                    ? result.data
                                    : JSON.stringify(result.data, null, 2)}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">
                                No weather data available
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )
                  }

                  if (state === 'call' || state === 'partial-call') {
                    return (
                      <div
                        className={cx('animate-pulse', {
                          skeleton: ['getWeather'].includes(toolName),
                        })}
                        key={toolCallId}
                      >
                        {toolName === 'extract' || toolName === 'scrape' ? (
                          <div className="h-24 rounded border bg-gray-100 p-3 dark:bg-gray-800"></div>
                        ) : toolName === 'search' ? (
                          <div className="h-24 rounded border bg-gray-100 p-3 dark:bg-gray-800"></div>
                        ) : toolName === 'deepResearch' ? (
                          <DeepResearchProgress
                            activity={
                              (
                                toolInvocation as unknown as {
                                  activity: any[]
                                }
                              ).activity || []
                            }
                            state={state}
                          />
                        ) : null}
                      </div>
                    )
                  }

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getDocument' ? (
                        <div className="animate-pulse rounded border p-3">
                          <h4 className="mb-2 font-medium">Loading Document</h4>
                          <p className="text-sm text-gray-500">
                            {args && 'query' in args
                              ? `Query: ${args.query}`
                              : 'Retrieving document...'}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}

            {!isReadonly && !isSummaryMessage && (
              <MessageActions
                chatId={chatId}
                isLoading={!!isLoading}
                key={`action-${message.id}`}
                message={message}
                vote={vote}
              />
            )}
          </div>
        </div>

        {/* Summary Diff Viewer */}
        {chatContext?.verification?.summaryVersions && (
          <SummaryDiffViewer
            currentVersionId={summaryVersionId}
            isOpen={isDiffViewerOpen}
            onClose={handleCloseDiffViewer}
            versions={chatContext.verification.summaryVersions}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false
    if (prevProps.message.content !== nextProps.message.content) return false
    if (
      !equal(
        prevProps.message.toolInvocations,
        nextProps.message.toolInvocations
      )
    )
      return false
    if (!equal(prevProps.vote, nextProps.vote)) return false

    return true
  }
)

export const ThinkingMessage = () => {
  const role = 'assistant'

  return (
    <motion.div
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      className="group/message mx-auto w-full max-w-3xl px-4 "
      data-role={role}
      initial={{ y: 5, opacity: 0 }}
    >
      <div className="flex w-full gap-4">
        <div className="ring-border flex size-8 shrink-0 items-center justify-center rounded-full ring-1">
          <SparklesIcon size={14} />
        </div>

        <div className="flex w-full flex-col gap-2">
          <div className="text-muted-foreground flex flex-col gap-4">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const DeepResearchProgress = ({
  state,
  activity,
}: {
  state: string
  activity: Array<{
    type: string
    status: string
    message: string
    timestamp: string
    depth?: number
    completedSteps?: number
    totalSteps?: number
  }>
}) => {
  const lastActivity = activity.at(-1)?.message || ''
  const completedSteps = activity.at(-1)?.completedSteps || 0
  const totalSteps = activity.at(-1)?.totalSteps || 100
  const progress = Math.min(
    Math.round((completedSteps / totalSteps) * 100),
    100
  )

  // Format time until timeout
  const timeUntilTimeout = 30000 // 30 seconds for now
  const timeProgress = 0 // Not calculating this for now

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${seconds}s`
  }

  return (
    <div className="w-full space-y-2">
      <div className="text-muted-foreground flex items-center justify-between text-sm">
        <div className="flex flex-col gap-1">
          <span>Research in progress...</span>
          <span>
            {completedSteps} of {totalSteps} steps completed
          </span>
        </div>
      </div>
      <Progress className="w-full" value={progress} />
      <div className="text-muted-foreground mt-2 flex items-center justify-end text-xs">
        <span>Time until timeout: {formatTime(timeUntilTimeout)}</span>
        {/* <span>{Math.round(timeProgress)}% of max time used</span> */}
      </div>
      {/* <Progress value={timeProgress} className="w-full" /> */}
      <div className="text-muted-foreground text-xs">{lastActivity}</div>
    </div>
  )
}
