'use client'

import { Activity, Eye, FileText, Upload, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { Notification } from '../types'

const categoryColors = {
  file: 'from-blue-500/20 to-blue-500/5',
  process: 'from-green-500/20 to-green-500/5',
  document: 'from-purple-500/20 to-purple-500/5',
  action: 'from-amber-500/20 to-amber-500/5',
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const response = await fetch('/api/notifications')
        if (!response.ok) {
          throw new Error('Failed to fetch notifications')
        }
        const data = await response.json()
        setActivities(data.notifications)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    }
    fetchNotifications()
  }, [])

  if (loading) {
    return <div className="p-6 text-center text-white/70">Loading notifications...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-red-400">{error}</div>
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
      {/* Enhanced header */}
      <div className="border-b border-white/5 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-2xl font-extrabold text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
              Recent Activity
            </h3>
            <span className="text-sm text-white/70">Last 48 hours</span>
          </div>
        </div>
      </div>

      {/* Enhanced content */}
      <div className="p-6">
        <div className="relative">
          {/* Timeline line with gradient */}
          <div className="absolute inset-y-0 left-[27px] w-px bg-gradient-to-b from-cyan-500/20 via-blue-500/20 to-purple-500/20" />

          <div className="space-y-4">
            {activities.length > 0 ? (
              activities.map((activity) => {
                const Icon = activity.type === 'Upload' ? Upload
                        : activity.type === 'Analysis' ? Activity
                        : activity.type === 'Report' ? FileText
                        : activity.type === 'Review' ? Eye : Upload

                return (
                  <div
                    className={cn(
                      'group relative flex items-start gap-4 rounded-xl p-4',
                      'bg-black/20 backdrop-blur-sm',
                      'border border-white/5 hover:border-cyan-500/30',
                      'transition-all duration-300',
                      'hover:translate-x-1 hover:bg-black/40',
                      'hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]',
                      'cursor-pointer'
                    )}
                    key={activity.id}
                  >
                    {/* Enhanced gradient overlay */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* Icon container with enhanced styling */}
                    <div className="relative z-10">
                      <div className="flex size-[32px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 transition-colors duration-300 group-hover:border-cyan-500/20">
                        <Icon className="size-4 text-cyan-400 transition-colors duration-300 group-hover:text-cyan-300" />
                      </div>
                    </div>

                    {/* Content with enhanced typography */}
                    <div className="relative z-10 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white/90">{activity.title}</p>
                          <p className="mt-1 text-xs text-white/60">{activity.message}</p>
                        </div>
                        {!activity.read && (
                          <Button className="size-6 text-white/40 hover:text-white/60" size="icon" variant="ghost">
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                        <span>{new Date(activity.timestamp).toLocaleString()}</span>
                        {activity.relatedTo && (
                          <span>{activity.relatedTo.type}: {activity.relatedTo.name}</span>
                        )}
                      </div>
                    </div>

                    {/* Enhanced scanning line effect */}
                    <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-white/40">No notifications</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}