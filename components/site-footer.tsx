import { siteConfig } from '@/config/site'

export function SiteFooter() {
  return (
    <footer className="py-1 text-center md:px-8 md:py-0">
      <p className="text-balance text-center text-xs font-medium leading-loose text-muted-foreground">
        Copyright ©{' '}
        <a
          href={siteConfig.links.github}
          target="_blank"
          rel="noreferrer"
          className="text-center text-xs font-medium"
        >
          2024 Neuvia.
        </a>
      </p>
    </footer>
  )
}
