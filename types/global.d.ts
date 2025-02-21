import type { Route } from 'next'

declare global {
  // Add custom type augmentations here
  type NextLinkProps<T extends string = string> = {
    href: Route<T> | URL
  }
}

// This export is necessary to make this a module
export {} 