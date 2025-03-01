'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

import { cn } from '@/utils/cn'

export const ActiveLink = (props: { href: string; children: ReactNode }) => {
  const pathname = usePathname()
  return (
    <Link
      className={cn(
        'flex items-center gap-2 whitespace-nowrap rounded-[18px] px-4 py-2 text-sm transition-all',
        pathname === props.href && 'bg-primary text-primary-foreground'
      )}
      href={props.href}
    >
      {props.children}
    </Link>
  )
}
