'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo } from 'react'
import { useWindowSize } from 'usehooks-ts'

import { Button } from '@/components/ui/button'
import { PlusIcon } from '@/components/ui/icons'
import { ModelSelector } from '@/components/ui/model-selector'
import { useSidebar } from '@/components/ui/sidebar'
import { SidebarToggle } from '@/components/ui/sidebar-toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { VisibilityType } from '@/components/ui/visibility-selector'
import { VisibilitySelector } from '@/components/ui/visibility-selector'
import { useDeepResearch } from '@/contexts/deep-research-context'
import { models, reasoningModels } from '@/lib/ai/models'

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedReasoningModelId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string
  selectedModelId: string
  selectedReasoningModelId: string
  selectedVisibilityType: VisibilityType
  isReadonly: boolean
}) {
  const router = useRouter()
  const { open } = useSidebar()

  const { width: windowWidth } = useWindowSize()

  const { clearState } = useDeepResearch()

  return (
    <header className="bg-background sticky top-0 flex items-center gap-2 px-2 py-1.5 md:px-2">
      <SidebarToggle />

      {(!open || windowWidth < 768) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="order-2 ml-auto px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
              onClick={() => {
                router.push('/')
                clearState()

                router.refresh()
              }}
              variant="outline"
            >
              <PlusIcon />
              <span className="md:sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      )}

      {!isReadonly && (
        <ModelSelector
          className="order-1 md:order-2"
          label="Router Model"
          models={models}
          selectedModelId={selectedModelId}
        />
      )}
      {!isReadonly && (
        <ModelSelector
          className="order-1 md:order-2"
          label="Reasoning Model"
          models={reasoningModels}
          selectedModelId={selectedReasoningModelId}
        />
      )}

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          className="order-1 md:order-3"
          selectedVisibilityType={selectedVisibilityType}
        />
      )}

      {/* <Button
        className="bg-orange-500 dark:bg-zinc-100 hover:bg-orange-800 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900 hidden md:flex py-1.5 px-2 h-fit md:h-[34px] order-4 md:ml-auto"
        asChild
      >
        <Link
          href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnickscamara%2Fextract-chat&env=AUTH_SECRET,OPENAI_API_KEY&envDescription=Learn%20more%20about%20how%20to%20get%20the%20API%20Keys%20for%20the%20application&envLink=https%3A%2F%2Fgithub.com%2Fvercel%2Fai-chatbot%2Fblob%2Fmain%2F.env.example&demo-title=AI%20Chatbot&demo-description=An%20Open-Source%20AI%20Chatbot%20Template%20Built%20With%20Next.js%20and%20the%20AI%20SDK%20by%20Vercel.&demo-url=https%3A%2F%2Fchat.vercel.ai&stores=%5B%7B%22type%22:%22postgres%22%7D,%7B%22type%22:%22blob%22%7D%5D"
          target="_noblank"
        >
          <VercelIcon size={16} />
          Deploy with Vercel
        </Link>
      </Button> */}

      <Button
        asChild
        className="order-4 hidden h-fit px-2 py-1.5 md:ml-auto md:flex md:h-[34px]"
        variant="outline"
      >
        <Link
          href="https://github.com/nickscamara/extract-chat"
          target="_blank"
        >
          <span className="flex items-center gap-2">
            <svg
              fill="none"
              height="16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Star on GitHub
          </span>
        </Link>
      </Button>

      <Button
        asChild
        className="order-4 hidden h-fit px-2 py-1.5 md:flex md:h-[34px] "
        variant="outline"
      >
        <Link href="https://firecrawl.dev/" target="_blank">
          <span className="flex items-center gap-2">
            <svg
              fill="none"
              height="16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            Get Firecrawl API Key
          </span>
        </Link>
      </Button>
    </header>
  )
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.selectedModelId === nextProps.selectedModelId &&
    prevProps.selectedReasoningModelId === nextProps.selectedReasoningModelId
  )
})
