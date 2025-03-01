'use client'

import { ViewVerticalIcon } from '@radix-ui/react-icons'
import Image from 'next/image'
import type { LinkProps } from 'next/link'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as React from 'react'

import AuthButton from '@/components/auth-button'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { docsConfig } from '@/config/docs'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          className="hover:bg-spline-blue/10 ml-0 rounded-full px-4 py-2 text-base backdrop-blur-sm focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
          variant="ghost"
        >
          <Image
            alt="Neuvia Logo"
            className="mr-1 rounded-full transition-opacity group-hover:opacity-90"
            height={24}
            src="/neuvia-comp.jpg"
            width={24}
          />
          <span className="font-bold text-white">{siteConfig.name}</span>
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="border-white/5 bg-black/95 pr-0 backdrop-blur-xl"
        side="left"
      >
        <MobileLink
          className="group flex items-center"
          href="/"
          onOpenChange={setOpen}
        >
          <Image
            alt="Neuvia Logo"
            className="mr-1 rounded-full transition-opacity group-hover:opacity-90"
            height={24}
            src="/neuvia-comp.jpg"
            width={24}
          />
          <span className="group-hover:text-spline-cyan font-bold text-white transition-colors">
            {siteConfig.name}
          </span>
        </MobileLink>
        <ScrollArea className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
          <div className="flex flex-col space-y-3">
            {docsConfig.mainNav?.map(
              (item) =>
                item.href && (
                  <MobileLink
                    className="hover:text-spline-cyan group relative py-2 text-white/80 transition-colors"
                    href={item.href}
                    key={item.href}
                    onOpenChange={setOpen}
                  >
                    {item.title}
                    <span className="from-spline-cyan via-spline-blue to-spline-magenta absolute inset-x-0 -bottom-1 h-0.5 origin-left scale-x-0 bg-gradient-to-r transition-transform group-hover:scale-x-100"></span>
                  </MobileLink>
                )
            )}
          </div>
          <div className="flex flex-col space-y-2">
            {docsConfig.sidebarNav.map((item, index) => (
              <div className="flex flex-col space-y-3 pt-6" key={index}>
                <h4 className="font-medium text-white/90">{item.title}</h4>
                {item?.items?.length &&
                  item.items.map((item) => (
                    <React.Fragment key={item.href}>
                      {!item.disabled &&
                        (item.href ? (
                          <MobileLink
                            className="hover:text-spline-cyan group relative py-2 text-white/80 transition-colors"
                            href={item.href}
                            onOpenChange={setOpen}
                          >
                            {item.title}
                            <span className="from-spline-cyan via-spline-blue to-spline-magenta absolute inset-x-0 -bottom-1 h-0.5 origin-left scale-x-0 bg-gradient-to-r transition-transform group-hover:scale-x-100"></span>
                            {item.label && (
                              <span className="from-spline-cyan to-spline-blue ml-2 rounded-full bg-gradient-to-r px-2 py-0.5 text-xs leading-none text-black backdrop-blur-sm">
                                {item.label}
                              </span>
                            )}
                          </MobileLink>
                        ) : (
                          item.title
                        ))}
                    </React.Fragment>
                  ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

interface MobileLinkProps extends LinkProps {
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

function MobileLink({
  href,
  onOpenChange,
  className,
  children,
  ...props
}: MobileLinkProps) {
  const router = useRouter()
  return (
    <Link
      className={cn(className)}
      href={href}
      onClick={() => {
        router.push(href.toString())
        onOpenChange?.(false)
      }}
      {...props}
    >
      {children}
    </Link>
  )
}
