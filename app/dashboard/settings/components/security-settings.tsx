"use client"

import { Lock, Key, Smartphone, Shield, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const securityFeatures = [
  {
    id: "2fa",
    title: "Two-Factor Authentication",
    description: "Add an extra layer of security to your account",
    icon: Shield,
    enabled: true
  },
  {
    id: "biometric",
    title: "Biometric Login",
    description: "Use fingerprint or face recognition to log in",
    icon: Smartphone,
    enabled: false
  },
  {
    id: "session",
    title: "Auto Session Timeout",
    description: "Automatically log out after period of inactivity",
    icon: Lock,
    enabled: true
  }
]

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      {/* Password Change */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white/90">
          Change Password
        </h3>
        <div className="space-y-3">
          {/* Current Password */}
          <div className="space-y-2">
            <Label className="text-white/70">Current Password</Label>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 rounded-xl" />
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-cyan-400 transition-colors duration-300" />
                <Input
                  type="password"
                  placeholder="Enter current password"
                  className="pl-10 bg-black/40 border-white/5 text-white/70 placeholder:text-white/40
                           focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30"
                />
              </div>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label className="text-white/70">New Password</Label>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 rounded-xl" />
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-cyan-400 transition-colors duration-300" />
                <Input
                  type="password"
                  placeholder="Enter new password"
                  className="pl-10 bg-black/40 border-white/5 text-white/70 placeholder:text-white/40
                           focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30"
                />
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label className="text-white/70">Confirm New Password</Label>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-transparent to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 rounded-xl" />
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-cyan-400 transition-colors duration-300" />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  className="pl-10 bg-black/40 border-white/5 text-white/70 placeholder:text-white/40
                           focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30"
                />
              </div>
            </div>
          </div>

          {/* Update Password Button */}
          <Button
            className="relative overflow-hidden group w-full bg-gradient-to-r from-cyan-500 to-blue-500 
                     hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg
                     hover:shadow-[0_0_30px_rgba(0,255,255,0.3)] transition-all duration-300"
          >
            Update Password
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent group-hover:animate-scan" />
            </div>
          </Button>
        </div>
      </div>

      {/* Security Features */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white/90">
          Security Features
        </h3>
        <div className="space-y-3">
          {securityFeatures.map((feature) => (
            <div
              key={feature.id}
              className={cn(
                "group relative p-4 rounded-xl",
                "bg-black/20 backdrop-blur-sm",
                "border border-white/5 hover:border-cyan-500/30",
                "transition-all duration-300",
                "hover:bg-black/40",
                "hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]"
              )}
            >
              {/* Enhanced gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10">
                    <feature.icon className="h-4 w-4 text-cyan-400" />
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
                  defaultChecked={feature.enabled}
                  className="data-[state=checked]:bg-cyan-500"
                />
              </div>

              {/* Enhanced scanning line effect */}
              <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover:animate-scan" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warning Note */}
      <div className="relative p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-sm text-red-200/70">
            For enhanced security, we recommend enabling two-factor authentication and using a strong, unique password.
          </div>
        </div>
      </div>
    </div>
  )
} 