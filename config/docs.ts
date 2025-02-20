import { MainNavItem, SidebarNavItem } from "types/nav"

interface DocsConfig {
  mainNav: MainNavItem[]
  sidebarNav: SidebarNavItem[]
}

export const docsConfig: DocsConfig = {
  mainNav: [
    { 
      title: "Account",
      href: "/account",
    },
    { 
      title: "Dashboard",
      href: "/dashboard",
    },
    { 
      title: "OpenAI",
      href: "/playground",
    },
    { 
      title: "Podcasts",
      href: "/music",
    },
    { 
      title: "Blog",
      href: "/blog",
    },
    { 
      title: "RBAC",
      href: "/dashboard/settings/members",
    },
  ],
  sidebarNav: [
    {
      title: "Tools",
      items: [
        {
          title: "Sign Out",
          href: "/signout",
          items: [],
        },
      ],
    },
  ],
}