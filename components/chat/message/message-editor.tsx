'use client'

import { deleteTrailingMessages } from '@/app/(chat)/actions'
import { useUserMessageId } from '@/hooks/use-user-message-id'
import type { ChatRequestOptions, Message } from 'ai'
import type { Dispatch, SetStateAction} from 'react';
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

export type MessageEditorProps = {
  message: Message
  setMode: Dispatch<SetStateAction<'view' | 'edit'>>
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[])
  ) => void
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>
}

export function MessageEditor({
  message,
  setMode,
  setMessages,
  reload,
}: MessageEditorProps) {
  const { userMessageIdFromServer } = useUserMessageId()
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const [draftContent, setDraftContent] = useState<string>(message.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight()
    }
  }, [])

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`
    }
  }

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value)
    adjustHeight()
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea
        className="w-full resize-none overflow-hidden rounded-xl bg-transparent !text-base outline-none"
        onChange={handleInput}
        ref={textareaRef}
        value={draftContent}
      />

      <div className="flex flex-row justify-end gap-2">
        <Button
          className="h-fit px-3 py-2"
          onClick={() => {
            setMode('view')
          }}
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          className="h-fit px-3 py-2"
          disabled={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true)
            const messageId = userMessageIdFromServer ?? message.id

            if (!messageId) {
              toast.error('Something went wrong, please try again!')
              setIsSubmitting(false)
              return
            }

            await deleteTrailingMessages({
              id: messageId,
            })

            setMessages((messages) => {
              const index = messages.findIndex((m) => m.id === message.id)

              if (index !== -1) {
                const updatedMessage = {
                  ...message,
                  content: draftContent,
                }

                return [...messages.slice(0, index), updatedMessage]
              }

              return messages
            })

            setMode('view')
            reload()
          }}
          variant="default"
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  )
}
