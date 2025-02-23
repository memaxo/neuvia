'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'


type Theme = 'light' | 'dark' | 'system'

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div className="space-y-3">
        <Label className="text-[#6B818C]">Theme</Label>
        <RadioGroup
          className="grid grid-cols-3 gap-4"
          defaultValue={theme}
          onValueChange={(value: Theme) => setTheme(value)}
        >
          <div>
            <RadioGroupItem
              className="peer sr-only"
              id="light"
              value="light"
            />
            <Label
              className="flex cursor-pointer flex-col items-center justify-between rounded-xl border border-[#6B818C]/10 bg-[#D8E4FF] p-4 hover:bg-[#D8E4FF]/80 peer-data-[state=checked]:border-[#004FFF]/50 peer-data-[state=checked]:bg-[#004FFF]/10 [&:has([data-state=checked])]:border-[#004FFF]/50"
              htmlFor="light"
            >
              <Sun className="mb-3 size-6" />
              <span className="text-sm font-medium">Light</span>
            </Label>
          </div>

          <div>
            <RadioGroupItem
              className="peer sr-only"
              id="dark"
              value="dark"
            />
            <Label
              className="flex cursor-pointer flex-col items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4 hover:bg-black/40 peer-data-[state=checked]:border-cyan-500/50 peer-data-[state=checked]:bg-cyan-500/10 [&:has([data-state=checked])]:border-cyan-500/50"
              htmlFor="dark"
            >
              <Moon className="mb-3 size-6" />
              <span className="text-sm font-medium">Dark</span>
            </Label>
          </div>

          <div>
            <RadioGroupItem
              className="peer sr-only"
              id="system"
              value="system"
            />
            <Label
              className="flex cursor-pointer flex-col items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4 hover:bg-black/40 peer-data-[state=checked]:border-cyan-500/50 peer-data-[state=checked]:bg-cyan-500/10 [&:has([data-state=checked])]:border-cyan-500/50"
              htmlFor="system"
            >
              <div className="mb-3 flex size-6 items-center justify-center">
                <Sun className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <Moon className="size-6 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              </div>
              <span className="text-sm font-medium">System</span>
            </Label>
          </div>
        </RadioGroup>
      </div>

        <Separator className="bg-[#6B818C]/5" />

      {/* UI Preferences */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-[#050505]">Interface Preferences</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[#6B818C]" htmlFor="animations">
              Enable animations
            </Label>
            <Switch id="animations" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-white/70" htmlFor="sounds">
              Interface sounds
            </Label>
            <Switch id="sounds" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-white/70" htmlFor="tooltips">
              Show tooltips
            </Label>
            <Switch defaultChecked id="tooltips" />
          </div>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* Save Changes */}
        <Button className="group relative w-full overflow-hidden bg-gradient-to-r from-[#004FFF] to-[#004FFF] text-white shadow-lg transition-all duration-300 hover:from-[#004FFF]/90 hover:to-[#004FFF]/90 hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]">
        Save Preferences
        <div className="absolute inset-0 overflow-hidden">
          <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>
      </Button>
    </div>
  )
} 