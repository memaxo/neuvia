"use client"

import { Bell, Mail, MessageSquare, AlertCircle } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const notificationTypes = [
  {
    id: "email",
    title: "Email Notifications",
    description: "Receive notifications via email",
    icon: Mail
  },
  {
    id: "push",
    title: "Push Notifications",
    description: "Receive notifications on your device",
    icon: Bell
  },
  {
    id: "messages",
    title: "In-App Messages",
    description: "Receive messages within the app",
    icon: MessageSquare
  }
]

const notificationEvents = [
  {
    id: "new-upload",
    title: "New Uploads",
    description: "When new scans are uploaded"
  },
  {
    id: "analysis-complete",
    title: "Analysis Complete",
    description: "When scan analysis is completed"
  },
  {
    id: "high-risk",
    title: "High Risk Alerts",
    description: "When high-risk conditions are detected"
  },
  {
    id: "system-updates",
    title: "System Updates",
    description: "Important system and maintenance updates"
  }
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
              key={type.id}
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
                    <type.icon className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white/90">
                      {type.title}
                    </div>
                    <div className="text-sm text-white/50">
                      {type.description}
                    </div>
                  </div>
                </div>
                <Switch className="data-[state=checked]:bg-cyan-500" />
              </div>

              {/* Enhanced scanning line effect */}
              <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover:animate-scan" />
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
              key={event.id}
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
                <div>
                  <div className="font-medium text-white/90">
                    {event.title}
                  </div>
                  <div className="text-sm text-white/50">
                    {event.description}
                  </div>
                </div>
                <Switch className="data-[state=checked]:bg-cyan-500" />
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
      <div className="relative p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-yellow-500/20">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
          </div>
          <div className="text-sm text-yellow-200/70">
            Critical notifications related to patient safety and system security cannot be disabled.
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <Button
          className="relative overflow-hidden group w-full bg-gradient-to-r from-cyan-500 to-blue-500 
                   hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg
                   hover:shadow-[0_0_30px_rgba(0,255,255,0.3)] transition-all duration-300"
        >
          Save Preferences
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent group-hover:animate-scan" />
          </div>
        </Button>
      </div>
    </div>
  )
} 