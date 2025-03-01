'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SendIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface MessageInputProps {
  onSendMessage: (message: string) => void
  isDisabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSendMessage,
  isDisabled = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      textareaRef.current.style.height = `${scrollHeight}px`
    }
  }, [message])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !isDisabled) {
      onSendMessage(message)
      setMessage('')

      // Reset the textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form
      className="bg-background flex items-end border-t p-4"
      onSubmit={handleSubmit}
    >
      <div className="relative mr-2 flex-1">
        <Textarea
          className="max-h-[200px] min-h-[50px] resize-none py-3 pr-10"
          disabled={isDisabled}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={textareaRef}
          style={{ height: 'auto' }}
          value={message}
        />
      </div>
      <Button
        className="size-10"
        disabled={isDisabled || !message.trim()}
        size="icon"
        type="submit"
      >
        <SendIcon className="size-5" />
      </Button>
    </form>
  )
}
