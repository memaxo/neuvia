'use client'

import type { Message } from '@/lib/chat/types'
import { useEffect, useRef } from 'react'

// Define a simple message component to handle display
const ChatMessage = ({ message }: { message: Message }) => (
  <div className={`p-4 ${message.role === 'user' ? 'bg-muted' : 'bg-card'} rounded-lg`}>
    <p className="mb-1 font-medium">{message.role === 'user' ? 'You' : 'Assistant'}</p>
    <p>{message.content}</p>
  </div>
)

interface ChatMessageListProps {
  messages: Message[]
  isLoading: boolean
  loadingMessage?: string
}

export function ChatMessageList({
  messages,
  isLoading,
  loadingMessage = 'Thinking...',
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // The useEffect is triggered when messages or loading state changes
    // to scroll to the bottom of the chat
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, []) // We don't need these dependencies since we always want to scroll on any re-render

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
