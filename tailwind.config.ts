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
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
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
      // Updated Medical AI Color System with Geist-inspired semantic naming
      colors: {
        // Base System Colors
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        
        // Medical Accent Scale (10 steps)
        accent: {
          1: 'rgb(var(--accent-1) / <alpha-value>)',
          2: 'rgb(var(--accent-2) / <alpha-value>)',
          3: 'rgb(var(--accent-3) / <alpha-value>)',
          4: 'rgb(var(--accent-4) / <alpha-value>)',
          5: 'rgb(var(--accent-5) / <alpha-value>)',
          6: 'rgb(var(--accent-6) / <alpha-value>)',
          7: 'rgb(var(--accent-7) / <alpha-value>)',
          8: 'rgb(var(--accent-8) / <alpha-value>)',
          9: 'rgb(var(--accent-9) / <alpha-value>)',
          10: 'rgb(var(--accent-10) / <alpha-value>)',
        },
        
        // Medical Primary (Teal)
        primary: {
          light: 'rgb(var(--primary-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          dark: 'rgb(var(--primary-dark) / <alpha-value>)',
        },
        
        // Tech Secondary (Blue)
        secondary: {
          light: 'rgb(var(--secondary-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          dark: 'rgb(var(--secondary-dark) / <alpha-value>)',
        },
        
        // Status Colors
        success: {
          light: 'rgb(var(--success-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          dark: 'rgb(var(--success-dark) / <alpha-value>)',
        },
        warning: {
          light: 'rgb(var(--warning-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          dark: 'rgb(var(--warning-dark) / <alpha-value>)',
        },
        error: {
          light: 'rgb(var(--error-light) / <alpha-value>)',
          DEFAULT: 'rgb(var(--error) / <alpha-value>)',
          dark: 'rgb(var(--error-dark) / <alpha-value>)',
        },

        // UI States
        processing: 'rgb(var(--processing) / <alpha-value>)',
        inactive: 'rgb(var(--inactive) / <alpha-value>)',
        
        // Neutral Scale (Geist-inspired)
        neutral: {
          1: 'rgb(var(--neutral-1) / <alpha-value>)',
          2: 'rgb(var(--neutral-2) / <alpha-value>)',
          3: 'rgb(var(--neutral-3) / <alpha-value>)',
          4: 'rgb(var(--neutral-4) / <alpha-value>)',
          5: 'rgb(var(--neutral-5) / <alpha-value>)',
          6: 'rgb(var(--neutral-6) / <alpha-value>)',
          7: 'rgb(var(--neutral-7) / <alpha-value>)',
          8: 'rgb(var(--neutral-8) / <alpha-value>)',
          9: 'rgb(var(--neutral-9) / <alpha-value>)',
          10: 'rgb(var(--neutral-10) / <alpha-value>)',
        },
      },
      
      // Updated gradient configurations
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(to right, rgb(var(--primary)), rgb(var(--primary-dark)))',
        'gradient-secondary': 'linear-gradient(to right, rgb(var(--secondary)), rgb(var(--secondary-dark)))',
        'gradient-success': 'linear-gradient(to right, rgb(var(--success)), rgb(var(--success-dark)))',
        'gradient-warning': 'linear-gradient(to right, rgb(var(--warning)), rgb(var(--warning-dark)))',
        'gradient-error': 'linear-gradient(to right, rgb(var(--error)), rgb(var(--error-dark)))',
      },
      
      // Updated box shadow configurations with Geist-inspired naming
      boxShadow: {
        'xs': '0 1px 2px rgb(var(--shadow) / 0.05)',
        'sm': '0 1px 3px rgb(var(--shadow) / 0.1)',
        DEFAULT: '0 1px 3px rgb(var(--shadow) / 0.1), 0 1px 2px rgb(var(--shadow) / 0.06)',
        'md': '0 4px 6px rgb(var(--shadow) / 0.1)',
        'lg': '0 10px 15px rgb(var(--shadow) / 0.1)',
        'xl': '0 20px 25px rgb(var(--shadow) / 0.1)',
        '2xl': '0 25px 50px rgb(var(--shadow) / 0.15)',
        'inner': 'inset 0 2px 4px rgb(var(--shadow) / 0.05)',
        'glow-primary': '0 0 20px rgb(var(--primary) / 0.35)',
        'glow-secondary': '0 0 20px rgb(var(--secondary) / 0.35)',
        'glow-success': '0 0 20px rgb(var(--success) / 0.35)',
        'glow-warning': '0 0 20px rgb(var(--warning) / 0.35)',
        'glow-error': '0 0 20px rgb(var(--error) / 0.35)',
      },
    },
  },
  plugins: [
    typography,
    forms,
    containerQueries,
  ],
} satisfies Config
