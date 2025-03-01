'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ReactNode} from 'react';
import { useMemo, useState } from 'react'

import { useChatVisibility } from '@/hooks/use-chat-visibility'
import {
  CheckCircleFillIcon,
  ChevronDownIcon,
  GlobeIcon,
  LockIcon,
} from './icons'

export type VisibilityType = 'private' | 'public'

const visibilities: Array<{
  id: VisibilityType
  label: string
  description: string
  icon: ReactNode
}> = [
  {
    id: 'private',
    label: 'Private',
    description: 'Only you can access this chat',
    icon: <LockIcon />,
  },
  {
    id: 'public',
    label: 'Public',
    description: 'Anyone with the link can access this chat',
    icon: <GlobeIcon />,
  },
]

export function VisibilitySelector({
  chatId,
  className,
  selectedVisibilityType,
}: {
  chatId: string
  selectedVisibilityType: VisibilityType
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false)

  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibility: selectedVisibilityType,
  })

  const selectedVisibility = useMemo(
    () => visibilities.find((visibility) => visibility.id === visibilityType),
    [visibilityType]
  )

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-fit',
          className
        )}
      >
        <Button
          className="hidden md:flex md:h-[34px] md:px-2"
          variant="outline"
        >
          {selectedVisibility?.icon}
          {selectedVisibility?.label}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[300px]">
        {visibilities.map((visibility) => (
          <DropdownMenuItem
            className="group/item flex flex-row items-center justify-between gap-4"
            data-active={visibility.id === visibilityType}
            key={visibility.id}
            onSelect={() => {
              setVisibilityType(visibility.id)
              setOpen(false)
            }}
          >
            <div className="flex flex-col items-start gap-1">
              {visibility.label}
              {visibility.description && (
                <div className="text-muted-foreground text-xs">
                  {visibility.description}
                </div>
              )}
            </div>
            <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
              <CheckCircleFillIcon />
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
