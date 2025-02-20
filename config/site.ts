export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: "Neuvia",
  description:
    "Neuvia SaaS PWA Template with validated CRUD ops, user authentication + RBAC, maximum header security, Rust API runtime, TanStack, and more.",
  mainNav: [
    {
      title: "Home",
      href: "/",
    },

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
      href: "/dashboard/members",
    },
    {
      title: "Contact",
      href: "/contact",
    },
  ],
  links: {
    twitter: "https://twitter.com/r_mourey_jr",
    github: "https://github.com/rmourey26/neuvia",
    login: "https://neuvia.vercel.app/auth",
    signup: "https://neuvia.vercel.app/onboarding",
  },
}
