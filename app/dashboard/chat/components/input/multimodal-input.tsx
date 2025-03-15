'use client'

import { type Attachment, ChatInput } from '@/components/chat/input/ChatInput'
import { useChatStore } from '@/lib/stores/chat-store'
import { useState } from 'react'

export function MultimodalInput() {
  const isLoading = useChatStore((state) => state.isLoading)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const handleSendMessage = async (content: string, options?: any) => {
    if (!content.trim() && attachments.length === 0) return

    try {
      // TODO: Add proper attachment handling in sendMessage
      await sendMessage(content)
      setAttachments([])
    } catch (error) {
      // Error handling for failed messages
    }
  }

  return (
    <ChatInput
      allowAttachments
      attachments={attachments}
      className="max-h-[200px] min-h-[44px]"
      isDisabled={isLoading}
      onAttachmentsChange={setAttachments}
      onSendMessage={handleSendMessage}
      placeholder="Type your message..."
    />
  )
}