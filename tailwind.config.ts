import containerQueries from '@tailwindcss/container-queries'
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'
import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  future: {
    hoverOnlyWhenSupported: true,
    respectDefaultRingColorOpacity: true,
    disableColorOpacityUtilitiesByDefault: true,
  },
  theme: {
    extend: {
      // Animation durations from CSS variables
      transitionDuration: {
        'fast': 'var(--animation-fast)',
        'normal': 'var(--animation-normal)',
        'slow': 'var(--animation-slow)',
      },
      // Border radius from CSS variables
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      // Colors from CSS variables
      colors: {
        // Base colors
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        
        // Primary action colors
        primary: {
          light: 'rgb(var(--primary-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          dark: 'rgb(var(--primary-dark) / <alpha-value>)',
        },
        
        // Critical/Warning states
        error: {
          light: 'rgb(var(--error-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--error) / <alpha-value>)',
          dark: 'rgb(var(--error-dark) / <alpha-value>)',
        },
        
        // Secondary/Attention states
        success: {
          light: 'rgb(var(--success-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          dark: 'rgb(var(--success-dark) / <alpha-value>)',
        },
        
        // Processing states
        processing: {
          light: 'rgb(var(--processing-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--processing) / <alpha-value>)',
          dark: 'rgb(var(--processing-dark) / <alpha-value>)',
        },
        
        // UI states
        inactive: 'rgb(var(--inactive) / <alpha-value>)',
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        
        // Accent colors
        accent: {
          light: 'rgb(var(--accent-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          dark: 'rgb(var(--accent-dark) / <alpha-value>)',
        },
      },
      
      // Gradient configurations
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(to right, rgb(var(--primary)), rgb(var(--primary-dark)))',
        'gradient-accent': 'linear-gradient(to right, rgb(var(--accent)), rgb(var(--accent-dark)))',
        'gradient-success': 'linear-gradient(to right, rgb(var(--success)), rgb(var(--success-dark)))',
        'gradient-error': 'linear-gradient(to right, rgb(var(--error)), rgb(var(--error-dark)))',
        'gradient-processing': 'linear-gradient(to right, rgb(var(--processing)), rgb(var(--processing-dark)))',
      },
      
      // Box shadow configurations
      boxShadow: {
        'glow-primary': '0 0 20px rgb(var(--primary) / 0.35)',
        'glow-accent': '0 0 20px rgb(var(--accent) / 0.35)',
        'glow-success': '0 0 20px rgb(var(--success) / 0.35)',
        'glow-error': '0 0 20px rgb(var(--error) / 0.35)',
        'glow-processing': '0 0 20px rgb(var(--processing) / 0.35)',
      },
    },
  },
  plugins: [
    typography,
    forms,
    containerQueries,
  ],
} satisfies Config
