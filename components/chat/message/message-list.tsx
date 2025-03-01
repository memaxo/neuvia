'use client'

import type { Message } from '@/lib/chat/types'
import { useEffect, useRef } from 'react'
import { Message as ChatMessage } from './message'

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
