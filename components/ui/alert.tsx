'use client'

import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-[var(--radius-lg)] border border-[rgb(var(--border)/var(--opacity-10))] p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-5 [&>div]:pl-7',
  {
    variants: {
      variant: {
        default:
          'bg-[rgb(var(--background)/var(--opacity-40))] text-[rgb(var(--foreground)/var(--opacity-90))] backdrop-blur-sm [&>svg]:text-[rgb(var(--foreground)/var(--opacity-70))]',
        info: 'border-[rgb(var(--primary)/var(--opacity-20))] bg-[rgb(var(--primary)/var(--opacity-10))] text-[rgb(var(--primary))] backdrop-blur-sm [&>svg]:text-[rgb(var(--primary))]',
        success: 'border-[rgb(var(--success)/var(--opacity-20))] bg-[rgb(var(--success)/var(--opacity-10))] text-[rgb(var(--success))] backdrop-blur-sm [&>svg]:text-[rgb(var(--success))]',
        warning: 'border-[rgb(var(--warning)/var(--opacity-20))] bg-[rgb(var(--warning)/var(--opacity-10))] text-[rgb(var(--warning))] backdrop-blur-sm [&>svg]:text-[rgb(var(--warning))]',
        error: 'border-[rgb(var(--error)/var(--opacity-20))] bg-[rgb(var(--error)/var(--opacity-10))] text-[rgb(var(--error))] backdrop-blur-sm [&>svg]:text-[rgb(var(--error))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & {
    icon?: React.ReactNode
  }
>(({ className, variant, icon, children, ...props }, ref) => {
  const Icon = icon || {
    default: Info,
    info: Info,
    success: CheckCircle2,
    warning: AlertCircle,
    error: XCircle,
  }[variant || 'default']

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="size-4" />
      <div>{children}</div>
    </div>
  )
})
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  >
    {children}
  </h5>
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription } 