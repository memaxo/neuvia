/**
 * Next.js Configuration
 * Implements security headers, CORS policies, and PWA configuration
 * @type {import('next').NextConfig}
 */

import withPWA from '@ducanh2912/next-pwa'
import withMDX from '@next/mdx'
import withPlugins from 'next-compose-plugins'

/**
 * Security Headers Configuration
 * Implements various security headers to protect against common web vulnerabilities
 */
const securityHeaders = [
  // Controls how much referrer information should be included with requests
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Prevents the browser from rendering the page in a frame/iframe
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Prevents MIME type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Controls DNS prefetching
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  // Forces HTTPS for a specified duration
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  // Legacy XSS protection for older browsers
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // Controls browser features and APIs
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
]

const nextConfig = {
  eslint: {
    // Only run ESLint on these directories during production builds
    dirs: ['app', 'components', 'lib', 'utils', 'hooks', 'types'],
    // Warning: Disabling this will allow production builds to successfully complete even with ESLint errors
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@splinetool/react-spline/next': '@splinetool/react-spline',
    }

    // Add support for WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }

    // Ensure proper handling of Spline's dependencies
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      type: 'asset/resource',
    })

    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
  experimental: {
    typedRoutes: true,
    mdxRs: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'quantumone.b-cdn.net',
        port: '',
        pathname: '/neuvia/**',
      },
      {
        protocol: 'https',
        hostname: 'unpkg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'youtube.com',
        port: '',
        pathname: '/embed/HR6a2aHhY_c?si=L2O3Cf7pQ-0HHhsP',
      },
      {
        protocol: 'https',
        hostname: 'quantumone.b-cdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  /**
   * Headers Configuration
   * Sets up:
   * 1. Global security headers for all routes
   * 2. CORS headers for manifest.json to support PWA functionality
   */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // CORS configuration for manifest.json
        // Required for PWA functionality in development
        source: '/manifest.json',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Consider restricting to specific domains in production
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: '*',
          },
        ],
      },
    ]
  },
  pageExtensions: ['ts', 'tsx', 'mdx', 'js', 'jsx', 'rs'],
}

// Apply plugins with proper typing
const withMDXConfig = withMDX()
const withPWAConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  workbox: {
    exclude: [/middleware-manifest\.json$/],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 365 days
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-font-assets',
          expiration: {
            maxEntries: 4,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-image-assets',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
        },
      },
      {
        urlPattern: /\/_next\/image\?url=.+$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'next-image',
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          },
        },
      },
    ],
  },
})

// Export the final config with all plugins applied
export default withPlugins([[withMDXConfig], [withPWAConfig]], nextConfig)
