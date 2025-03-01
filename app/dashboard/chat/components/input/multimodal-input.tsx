'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChat } from '@/contexts/chat-context'
import { PaperClipIcon, SendIcon } from 'lucide-react'
import type { FormEvent} from 'react';
import { useRef, useState } from 'react'

export function MultimodalInput() {
  const { state, sendMessage } = useChat()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() && attachments.length === 0) return

    try {
      // TODO: Handle file uploads
      await sendMessage(input)
      setInput('')
      setAttachments([])
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments((prev) => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div
              className="bg-secondary flex items-center gap-1 rounded px-2 py-1 text-sm"
              key={index}
            >
              <span>{file.name}</span>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeAttachment(index)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          disabled={state.isLoading}
          onClick={handleFileSelect}
          size="icon"
          type="button"
          variant="outline"
        >
          <PaperClipIcon className="size-4" />
        </Button>

        <div className="flex flex-1 gap-2">
          <Textarea
            className="max-h-[200px] min-h-[44px]"
            disabled={state.isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Type your message..."
            value={input}
          />

          <Button
            disabled={
              (!input.trim() && attachments.length === 0) || state.isLoading
            }
            type="submit"
          >
            <SendIcon className="size-4" />
          </Button>
        </div>
      </div>

      <input
        className="hidden"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
    </form>
  )
}
