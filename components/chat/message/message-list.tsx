'use client'

import type { Message } from '@/lib/chat/types'
import { useEffect, useRef } from 'react'
import { Message as ChatMessage } from './message'
import { useChatStore } from '@/stores/chat-store'

// Props now optional since we can use store directly
interface ChatMessageListProps {
  messages?: Message[]
  isLoading?: boolean
  loadingMessage?: string
}

export function ChatMessageList({
  // Optional props allow for direct use or for use with passed props
  messages: propMessages,
  isLoading: propIsLoading,
  loadingMessage = 'Thinking...',
}: ChatMessageListProps) {
  // Get state directly from store if not provided via props
  const storeMessages = useChatStore(state => state.messages)
  const storeIsLoading = useChatStore(state => state.isLoading)
  
  // Use props if provided, otherwise use store values
  const messages = propMessages || storeMessages
  const isLoading = propIsLoading !== undefined ? propIsLoading : storeIsLoading
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-bold">Welcome!</h2>
            <p className="text-muted-foreground text-sm">
              Start a conversation or upload a document to begin.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <ChatMessage
              message={{
                id: 'loading',
                role: 'assistant',
                content: loadingMessage,
              }}
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  )
}
