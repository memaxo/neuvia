import Link from 'next/link'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'
import { buttonVariants } from '@/components/ui/button'

export function CookieButton() {
  return (
    <div className="fixed bottom-0 right-0 z-50">
      <div
        className={buttonVariants({
          size: 'icon',
          variant: 'ghost',
        })}
      >
        <Link href="#" className={cn('yourConsentManager')}>
          <Icons.cookie className="size-5" />
          <span className="sr-only">Cookie Preferences</span>
        </Link>
      </div>
    </div>
  )
}
