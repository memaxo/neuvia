import localFont from 'next/font/local'

// Load Geist Sans font
export const fontSans = localFont({
  src: [
    {
      path: '../node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../node_modules/geist/dist/fonts/geist-sans/Geist-Bold.woff2',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
})

// Load Geist Mono font
export const fontMono = localFont({
  src: [
    {
      path: '../node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../node_modules/geist/dist/fonts/geist-mono/GeistMono-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../node_modules/geist/dist/fonts/geist-mono/GeistMono-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../node_modules/geist/dist/fonts/geist-mono/GeistMono-Bold.woff2',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
})
