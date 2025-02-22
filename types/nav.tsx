import type { Icons } from '@/components/icons'

export interface NavItem {
  title: string
  href?: string
  disabled?: boolean
  external?: boolean
  icon?: keyof typeof Icons
  label?: string
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[]
}

// Re-export base types with more descriptive names
export type MainNavItem = NavItem
export type SidebarNavItem = NavItemWithChildren

export interface FooterItem extends NavItem {
  items?: FooterItem[]
}
