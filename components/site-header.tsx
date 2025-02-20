import Link from "next/link"

import { siteConfig } from "@/config/site"
import { MainNav } from "@/components/main-nav"
import { MobileNav } from "@/components/mobile-nav"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-spline-cyan/10 bg-black/50 backdrop-blur-xl">
      <div className="container flex h-16 items-center px-4">
        <MainNav items={siteConfig.mainNav} />
        <MobileNav />
      </div>
    </header>
  )
}
