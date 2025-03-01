'use client'

import type { ChatRequestOptions } from '@/lib/types'
import type { CreateMessage, Message } from 'ai'
import { motion } from 'framer-motion'
import { memo } from 'react'
import { Button } from './ui/button'

interface SuggestedActionsProps {
  chatId: string
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>
}

function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  const suggestedActions = [
    {
      title: 'Research a topic',
      label: 'deep dive with AI',
      action:
        'Perform deep research on this topic and provide a comprehensive analysis: ',
    },
    {
      title: 'Compare and analyze',
      label: 'multiple perspectives',
      action: 'Research and analyze different viewpoints and evidence about: ',
    },
  ]

  return (
    <div className="grid w-full gap-2 sm:grid-cols-2">
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className={index > 1 ? 'hidden sm:block' : 'block'}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          transition={{ delay: 0.05 * index }}
        >
          <Button
            className="h-auto w-full flex-1 items-start justify-start gap-1 rounded-xl border px-4 py-3.5 text-left text-sm sm:flex-col"
            onClick={async () => {
              window.history.replaceState({}, '', `/chat/${chatId}`)

              append({
                role: 'user',
                content: suggestedAction.action,
              })
            }}
            variant="ghost"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  )
}

export const SuggestedActions = memo(PureSuggestedActions, () => true)
