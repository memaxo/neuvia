'use client'

import { AlertCircle, Bell, Mail, MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label as _ } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const notificationTypes = [
  {
    id: 'email',
    title: 'Email Notifications',
    description: 'Receive notifications via email',
    icon: Mail,
  },
  {
    id: 'push',
    title: 'Push Notifications',
    description: 'Receive notifications on your device',
    icon: Bell,
  },
  {
    id: 'messages',
    title: 'In-App Messages',
    description: 'Receive messages within the app',
    icon: MessageSquare,
  },
]

const notificationEvents = [
  {
    id: 'new-upload',
    title: 'New Uploads',
    description: 'When new scans are uploaded',
  },
  {
    id: 'analysis-complete',
    title: 'Analysis Complete',
    description: 'When scan analysis is completed',
  },
  {
    id: 'high-risk',
    title: 'High Risk Alerts',
    description: 'When high-risk conditions are detected',
  },
  {
    id: 'system-updates',
    title: 'System Updates',
    description: 'Important system and maintenance updates',
  },
]

export function NotificationSettings() {
  return (
    <div className="space-y-6">
      {/* Notification Types */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white/90">
          Notification Channels
        </h3>
        <div className="space-y-3">
          {notificationTypes.map((type) => (
            <div
              className={cn(
                'group relative rounded-xl p-4',
                'bg-[#D8E4FF] backdrop-blur-sm',
                'border border-[#6B818C]/5 hover:border-[#004FFF]/30',
                'transition-all duration-300',
                'hover:bg-[#D8E4FF]/80',
                'hover:shadow-[0_0_20px_rgba(0,0,0,0.1)]'
              )}
              key={type.id}
            >
              {/* Enhanced gradient overlay */}
bg-gradient-to-br from-[#004FFF]/10 via-transparent to-[#004FFF]/10

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-2">
                    <type.icon className="size-4 text-[#004FFF]" />
                  </div>
                  <div>
                    <div className="font-medium text-[#050505]">
                      {type.title}
                    </div>
                    <div className="text-sm text-[#6B818C]">
                      {type.description}
                    </div>
                  </div>
                </div>
                data-[state=checked]:bg-[#004FFF]
              </div>

              {/* Enhanced scanning line effect */}
              <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                bg-gradient-to-r from-transparent via-[#004FFF]/60 to-transparent
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Events */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white/90">
          Notification Events
        </h3>
        <div className="space-y-3">
          {notificationEvents.map((event) => (
            <div
              className={cn(
                'group relative rounded-xl p-4',
                'bg-black/20 backdrop-blur-sm',
                'border border-white/5 hover:border-cyan-500/30',
                'transition-all duration-300',
                'hover:bg-black/40',
                'hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]'
              )}
              key={event.id}
            >
              {/* Enhanced gradient overlay */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white/90">{event.title}</div>
                  <div className="text-sm text-white/50">
                    {event.description}
                  </div>
                </div>
                <Switch className="data-[state=checked]:bg-cyan-500" />
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
        <div className="relative rounded-xl border border-[#902D41]/20 bg-[#902D41]/10 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-yellow-500/20 p-1.5">
            <AlertCircle className="size-4 text-[#902D41]" />
          </div>
            <div className="text-sm text-[#902D41]/70">
            Critical notifications related to patient safety and system security
            cannot be disabled.
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <Button className="group relative w-full overflow-hidden bg-gradient-to-r from-[#004FFF] to-[#004FFF] text-white shadow-lg transition-all duration-300 hover:from-[#004FFF]/90 hover:to-[#004FFF]/90 hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]">
          Save Preferences
          <div className="absolute inset-0 overflow-hidden">
            <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </Button>
      </div>
    </div>
  )
}