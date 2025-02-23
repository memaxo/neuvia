'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import type { SidebarNavItem } from 'types/nav'

export interface DocsSidebarNavProps {
  items: SidebarNavItem[]
}

export function DocsSidebarNav({ items }: DocsSidebarNavProps) {
  const pathname = usePathname()

  return items.length ? (
    <div className="w-full">
      {items.map((item, index) => (
        <div className={cn('pb-4')} key={index}>
          <h4 className="mb-1 rounded-md px-2 py-1 text-sm font-semibold text-[rgb(var(--foreground)/0.9)]">
            {item.title}
          </h4>
          {item?.items?.length && (
            <DocsSidebarNavItems items={item.items} pathname={pathname} />
          )}
        </div>
      ))}
    </div>
  ) : null
}

interface DocsSidebarNavItemsProps {
  items: SidebarNavItem[]
  pathname: string | null
}

export function DocsSidebarNavItems({
  items,
  pathname,
}: DocsSidebarNavItemsProps) {
  return items?.length ? (
    <div className="grid grid-flow-row auto-rows-max text-sm">
      {items.map((item, index) =>
        item.href && !item.disabled ? (
          <Link
            className={cn(
              'group flex w-full items-center rounded-md border border-transparent px-2 py-1 transition-colors duration-normal',
              'hover:bg-[rgb(var(--primary)/0.1)] hover:text-[rgb(var(--primary))]',
              item.disabled && 'cursor-not-allowed opacity-60',
              pathname === item.href
                ? 'bg-[rgb(var(--primary)/0.1)] font-medium text-[rgb(var(--primary))]'
                : 'text-[rgb(var(--foreground)/0.7)]'
            )}
            href={item.href}
            key={index}
            rel={item.external ? 'noreferrer' : ''}
            target={item.external ? '_blank' : ''}
          >
            {item.title}
            {item.label && (
              <span className="ml-2 rounded-md bg-[rgb(var(--primary)/0.1)] px-1.5 py-0.5 text-xs leading-none text-[rgb(var(--primary))] no-underline group-hover:bg-[rgb(var(--primary)/0.15)]">
                {item.label}
              </span>
            )}
          </Link>
        ) : (
          <span
            className={cn(
              'flex w-full cursor-not-allowed items-center rounded-md p-2 text-[rgb(var(--foreground)/0.5)]',
              item.disabled && 'opacity-60'
            )}
            key={index}
          >
            {item.title}
            {item.label && (
              <span className="ml-2 rounded-md bg-[rgb(var(--foreground)/0.1)] px-1.5 py-0.5 text-xs leading-none text-[rgb(var(--foreground)/0.7)] no-underline">
                {item.label}
              </span>
            )}
          </span>
        )
      )}
    </div>
  ) : null
}
