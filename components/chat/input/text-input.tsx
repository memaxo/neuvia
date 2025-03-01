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
      onSubmit={handleSubmit}
      className="flex items-end p-4 bg-background border-t"
    >
      <div className="relative flex-1 mr-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isDisabled}
          className="min-h-[50px] max-h-[200px] py-3 pr-10 resize-none"
          style={{ height: 'auto' }}
        />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={isDisabled || !message.trim()}
        className="h-10 w-10"
      >
        <SendIcon className="h-5 w-5" />
      </Button>
    </form>
  )
}
