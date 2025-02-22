'use client'

import { AlertCircle, Key, Lock, Shield, Smartphone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const securityFeatures = [
  {
    id: '2fa',
    title: 'Two-Factor Authentication',
    description: 'Add an extra layer of security to your account',
    icon: Shield,
    enabled: true,
  },
  {
    id: 'biometric',
    title: 'Biometric Login',
    description: 'Use fingerprint or face recognition to log in',
    icon: Smartphone,
    enabled: false,
  },
  {
    id: 'session',
    title: 'Auto Session Timeout',
    description: 'Automatically log out after period of inactivity',
    icon: Lock,
    enabled: true,
  },
]

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      {/* Password Change */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white/90">Change Password</h3>
        <div className="space-y-3">
          {/* Current Password */}
          <div className="space-y-2">
            <Label className="text-white/70">Current Password</Label>
            <div className="group relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
                <Input
                  className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Enter current password"
                  type="password"
                />
              </div>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label className="text-white/70">New Password</Label>
            <div className="group relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
              <div className="relative">
                <Key className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
                <Input
                  className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Enter new password"
                  type="password"
                />
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label className="text-white/70">Confirm New Password</Label>
            <div className="group relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100" />
              <div className="relative">
                <Key className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
                <Input
                  className="border-white/5 bg-black/40 pl-10 text-white/70 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Confirm new password"
                  type="password"
                />
              </div>
            </div>
          </div>

          {/* Update Password Button */}
          <Button className="group relative w-full overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transition-all duration-300 hover:from-cyan-600 hover:to-blue-600 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]">
            Update Password
            <div className="absolute inset-0 overflow-hidden">
              <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            </div>
          </Button>
        </div>
      </div>

      {/* Security Features */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white/90">Security Features</h3>
        <div className="space-y-3">
          {securityFeatures.map((feature) => (
            <div
              className={cn(
                'group relative rounded-xl p-4',
                'bg-black/20 backdrop-blur-sm',
                'border border-white/5 hover:border-cyan-500/30',
                'transition-all duration-300',
                'hover:bg-black/40',
                'hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]'
              )}
              key={feature.id}
            >
              {/* Enhanced gradient overlay */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-2">
                    <feature.icon className="size-4 text-cyan-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white/90">
                      {feature.title}
                    </div>
                    <div className="text-sm text-white/50">
                      {feature.description}
                    </div>
                  </div>
                </div>
                <Switch
                  className="data-[state=checked]:bg-cyan-500"
                  defaultChecked={feature.enabled}
                />
              </div>

              {/* Enhanced scanning line effect */}
              <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warning Note */}
      <div className="relative rounded-xl border border-red-500/20 bg-red-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-500/20 p-1.5">
            <AlertCircle className="size-4 text-red-400" />
          </div>
          <div className="text-sm text-red-200/70">
            For enhanced security, we recommend enabling two-factor
            authentication and using a strong, unique password.
          </div>
        </div>
      </div>
    </div>
  )
}
