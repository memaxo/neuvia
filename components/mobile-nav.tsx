"use client"

import * as React from "react"
import Link, { LinkProps } from "next/link"
import { useRouter } from "next/navigation"
import { ViewVerticalIcon } from "@radix-ui/react-icons"
import AuthButton from '@/components/auth-button'
import Image from "next/image"

import { docsConfig } from "@/config/docs"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function MobileNav() {
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="ml-0 px-4 py-2 text-base hover:bg-spline-blue/10 focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden rounded-full backdrop-blur-sm"
        >
          <Image 
            src="/neuvia-comp.jpg" 
            alt="Neuvia Logo" 
            width={24} 
            height={24} 
            className="rounded-full mr-1 group-hover:opacity-90 transition-opacity"
          />
          <span className="font-bold text-white">{siteConfig.name}</span>
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0 bg-black/95 border-spline-cyan/10 backdrop-blur-xl">
        <MobileLink
          href="/"
          className="flex items-center group"
          onOpenChange={setOpen}
        >
          <Image 
            src="/neuvia-comp.jpg" 
            alt="Neuvia Logo" 
            width={24} 
            height={24} 
            className="rounded-full mr-1 group-hover:opacity-90 transition-opacity"
          />
          <span className="font-bold text-white group-hover:text-spline-cyan transition-colors">{siteConfig.name}</span>
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
                    className="text-white/80 hover:text-spline-cyan transition-colors relative group py-2"
                  >
                    {item.title}
                    <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-spline-cyan via-spline-blue to-spline-magenta scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
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
                            className="text-white/80 hover:text-spline-cyan transition-colors relative group py-2"
                          >
                            {item.title}
                            <span className="absolute inset-x-0 -bottom-1 h-0.5 bg-gradient-to-r from-spline-cyan via-spline-blue to-spline-magenta scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
                            {item.label && (
                              <span className="ml-2 rounded-full px-2 py-0.5 text-xs leading-none text-black bg-gradient-to-r from-spline-cyan to-spline-blue backdrop-blur-sm">
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