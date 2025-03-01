import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[rgb(var(--primary)/0.9)] text-white shadow hover:bg-[rgb(var(--primary)/0.8)]',
        secondary:
          'border-transparent bg-[rgb(var(--accent)/0.9)] text-white hover:bg-[rgb(var(--accent)/0.8)]',
        destructive:
          'border-transparent bg-[rgb(var(--error)/0.9)] text-white shadow hover:bg-[rgb(var(--error)/0.8)]',
        outline: 'text-foreground border-dashed',
        success:
          'border-transparent bg-[rgb(var(--success)/0.9)] text-white shadow hover:bg-[rgb(var(--success)/0.8)]',
        processing:
          'border-transparent bg-[rgb(var(--processing)/0.9)] text-white shadow hover:bg-[rgb(var(--processing)/0.8)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
