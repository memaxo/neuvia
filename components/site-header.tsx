import Link from "next/link"

import { siteConfig } from "@/config/site"
import { Icons } from "@/components/icons"
import { AuthNav } from "@/components/auth-nav"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <Icons.logo className="h-6 w-6" />
            <span className="inline-block font-bold">{siteConfig.name}</span>
          </Link>
          <nav className="flex gap-6">
            {siteConfig.mainNav?.map(
              (item, index) =>
                item.href && (
                  <Link
                    key={index}
                    href={item.href}
                    className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item.title}
                  </Link>
                )
            )}
          </nav>
        </div>
        <AuthNav />
      </div>
    </header>
  )
}
