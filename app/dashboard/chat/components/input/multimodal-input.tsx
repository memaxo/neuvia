'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChat } from '@/contexts/chat-context'
import { PaperClipIcon, SendIcon } from 'lucide-react'
import { FormEvent, useRef, useState } from 'react'

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
    <form onSubmit={handleSubmit} className="w-full">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm"
            >
              <span>{file.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleFileSelect}
          disabled={state.isLoading}
        >
          <PaperClipIcon className="h-4 w-4" />
        </Button>

        <div className="flex-1 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[44px] max-h-[200px]"
            disabled={state.isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />

          <Button
            type="submit"
            disabled={
              (!input.trim() && attachments.length === 0) || state.isLoading
            }
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        multiple
      />
    </form>
  )
}
