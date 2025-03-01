import type { Vote } from '@/lib/db/schema'
import type { ChatRequestOptions } from '@/lib/types'
import type { Message } from 'ai'
import equal from 'fast-deep-equal'
import { memo } from 'react'
import { toast } from 'sonner'
import { PreviewMessage, ThinkingMessage } from './message'
import { Overview } from './overview'
import { useScrollToBottom } from './use-scroll-to-bottom'

interface MessagesProps {
  chatId: string
  isLoading: boolean
  votes: Array<Vote> | undefined
  messages: Array<Message>
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[])
  ) => void
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>
  isReadonly: boolean
  isBlockVisible: boolean
}

function PureMessages({
  chatId,
  isLoading,
  votes,
  messages,
  setMessages,
  reload,
  isReadonly,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>()

  // Handle rate limit error
  const handleError = async (error: any) => {
    if (error?.response?.status === 429) {
      const data = await error.response.json()
      const resetInSeconds = Math.ceil((data.reset - Date.now()) / 1000)
      toast.error(
        `Rate limit exceeded. Please wait ${resetInSeconds} seconds before trying again.`,
        {
          duration: Math.min(resetInSeconds * 1000, 5000),
        }
      )
    }
  }

  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-scroll pt-4"
      ref={messagesContainerRef}
    >
      {/* {messages.length === 0 && <Overview />} */}

      {messages.map((message, index) => (
        <PreviewMessage
          chatId={chatId}
          isLoading={isLoading && messages.length - 1 === index}
          isReadonly={isReadonly}
          key={message.id}
          message={message}
          reload={async (options?: ChatRequestOptions) => {
            try {
              return await reload(options)
            } catch (error) {
              handleError(error)
              return null
            }
          }}
          setMessages={setMessages}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
        />
      ))}

      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <div
        className="min-h-[24px] min-w-[24px] shrink-0"
        ref={messagesEndRef}
      />
    </div>
  )
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isBlockVisible && nextProps.isBlockVisible) return true

  if (prevProps.isLoading !== nextProps.isLoading) return false
  if (prevProps.isLoading && nextProps.isLoading) return false
  if (prevProps.messages.length !== nextProps.messages.length) return false
  if (!equal(prevProps.votes, nextProps.votes)) return false

  return true
})
