'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <Button
      className="relative size-9 rounded-lg bg-[rgb(var(--background)/var(--opacity-40))] text-[rgb(var(--foreground)/var(--opacity-70))] transition-colors hover:bg-[rgb(var(--primary)/var(--opacity-10))] hover:text-[rgb(var(--primary))]"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      size="icon"
      variant="ghost"
    >
      <Sun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
