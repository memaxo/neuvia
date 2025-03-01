import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-all duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary)/var(--opacity-20))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[rgb(var(--primary))] text-white shadow-sm hover:bg-[rgb(var(--primary-dark))] hover:shadow-[0_0_20px_rgba(var(--primary),0.2)] active:scale-[0.98]',
        destructive:
          'bg-[rgb(var(--error))] text-white shadow-sm hover:bg-[rgb(var(--error-dark))] hover:shadow-[0_0_20px_rgba(var(--error),0.2)] active:scale-[0.98]',
        outline:
          'border border-[rgb(var(--border))] bg-background shadow-sm hover:bg-[rgb(var(--primary)/var(--opacity-10))] hover:text-[rgb(var(--primary))] hover:border-[rgb(var(--primary)/var(--opacity-30))] hover:shadow-[0_0_20px_rgba(var(--primary),0.1)] active:scale-[0.98]',
        secondary:
          'bg-[rgb(var(--secondary))] text-white shadow-sm hover:bg-[rgb(var(--secondary-dark))] hover:shadow-[0_0_20px_rgba(var(--secondary),0.2)] active:scale-[0.98]',
        ghost:
          'hover:bg-[rgb(var(--primary)/var(--opacity-10))] hover:text-[rgb(var(--primary))] active:scale-[0.98]',
        link: 'text-[rgb(var(--primary))] underline-offset-4 hover:underline',
        success:
          'bg-[rgb(var(--success))] text-white shadow-sm hover:bg-[rgb(var(--success-dark))] hover:shadow-[0_0_20px_rgba(var(--success),0.2)] active:scale-[0.98]',
        warning:
          'bg-[rgb(var(--warning))] text-white shadow-sm hover:bg-[rgb(var(--warning-dark))] hover:shadow-[0_0_20px_rgba(var(--warning),0.2)] active:scale-[0.98]',
        premium:
          'relative overflow-hidden bg-gradient-to-r from-[rgb(var(--primary))] to-[rgb(var(--secondary))] text-white shadow-lg transition-all hover:shadow-[0_0_30px_rgba(var(--primary),0.3)] active:scale-[0.98] group',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-[var(--radius-sm)] px-3',
        lg: 'h-11 rounded-[var(--radius-lg)] px-8',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
