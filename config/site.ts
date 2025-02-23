export type SiteConfig = {
  name: string
  description: string
  url: string
  creator: string
  mainNav: Array<{
    title: string
    href: string
  }>
  links: {
    twitter: string
    github: string
    login: string
    signup: string
  }
}

export const siteConfig: SiteConfig = {
  name: 'Neuvia',
  description: 'An AI-powered medical platform for healthcare professionals.',
  url: 'https://neuvia.app',
  creator: 'Neuvia Team',
  mainNav: [],
  links: {
    twitter: 'https://twitter.com/neuvia',
    github: 'https://github.com/neuvia/neuvia-app',
    login: '/login',
    signup: '/signup',
  },
}
