'use client'

import { startTransition, useMemo, useOptimistic, useState } from 'react'

import { saveModelId } from '@/app/(chat)/actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Model } from '@/lib/ai/models'
import { cn } from '@/lib/utils'

import { CheckCircleFillIcon, ChevronDownIcon } from './icons'

export function ModelSelector({
  selectedModelId,
  className,
  models,
  label,
}: {
  selectedModelId: string
  models: Array<Model>
  label: string
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false)
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId)

  const selectedModel = useMemo(
    () => models.find((model) => model.id === optimisticModelId),
    [optimisticModelId]
  )

  return (
    <div className="flex flex-row gap-1">
      {/* <label className="text-sm text-muted-foreground">{label}</label> */}
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger
          asChild
          className={cn(
            'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-fit',
            className
          )}
        >
          <Button className="md:h-[34px] md:px-2" variant="outline">
            {selectedModel?.label}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[300px]">
          <div className="text-muted-foreground px-2 py-1.5 text-sm">
            {label}
          </div>
          {models.map((model) => (
            <DropdownMenuItem
              className="group/item flex flex-row items-center justify-between gap-4"
              data-active={model.id === optimisticModelId}
              key={model.id}
              onSelect={() => {
                setOpen(false)

                startTransition(() => {
                  setOptimisticModelId(model.id)
                  saveModelId(model.id)
                })
              }}
            >
              <div className="flex flex-col items-start gap-1">
                {model.label}
                {model.description && (
                  <div className="text-muted-foreground text-xs">
                    {model.description}
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
    </div>
  )
}
