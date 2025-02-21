'use client'

import * as React from 'react'
import Image from 'next/image'
import Link, { LinkProps } from 'next/link'
import { useRouter } from 'next/navigation'
import { ViewVerticalIcon } from '@radix-ui/react-icons'
import { docsConfig } from '@/config/docs'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import AuthButton from '@/components/auth-button'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

export function MobileNav() {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="hover:bg-spline-blue/10 ml-0 rounded-full px-4 py-2 text-base backdrop-blur-sm focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
        >
          <Image
            src="/neuvia-comp.jpg"
            alt="Neuvia Logo"
            width={24}
            height={24}
            className="mr-1 rounded-full transition-opacity group-hover:opacity-90"
          />
          <span className="font-bold text-white">{siteConfig.name}</span>
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="border-white/5 bg-black/95 pr-0 backdrop-blur-xl"
      >
        <MobileLink
          href="/"
          className="group flex items-center"
          onOpenChange={setOpen}
        >
          <Image
            src="/neuvia-comp.jpg"
            alt="Neuvia Logo"
            width={24}
            height={24}
            className="mr-1 rounded-full transition-opacity group-hover:opacity-90"
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
                    key={item.href}
                    href={item.href}
                    onOpenChange={setOpen}
                    className="hover:text-spline-cyan group relative py-2 text-white/80 transition-colors"
                  >
                    {item.title}
                    <span className="from-spline-cyan via-spline-blue to-spline-magenta absolute inset-x-0 -bottom-1 h-0.5 origin-left scale-x-0 bg-gradient-to-r transition-transform group-hover:scale-x-100"></span>
                  </MobileLink>
                )
            )}
          </div>
          <div className="flex flex-col space-y-2">
            {docsConfig.sidebarNav.map((item, index) => (
              <div key={index} className="flex flex-col space-y-3 pt-6">
                <h4 className="font-medium text-white/90">{item.title}</h4>
                {item?.items?.length &&
                  item.items.map((item) => (
                    <React.Fragment key={item.href}>
                      {!item.disabled &&
                        (item.href ? (
                          <MobileLink
                            href={item.href}
                            onOpenChange={setOpen}
                            className="hover:text-spline-cyan group relative py-2 text-white/80 transition-colors"
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
      href={href}
      onClick={() => {
        router.push(href.toString())
        onOpenChange?.(false)
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </Link>
  )
}
