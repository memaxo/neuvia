'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  AlertCircle,
  Bell,
  Check,
  ChevronRight,
  Clock,
  Filter,
  MessageSquare,
  RefreshCw,
  X,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import type { Notification, NotificationType } from './types'
import { mockNotifications } from './types'

const notificationIcons: Record<NotificationType, any> = {
  alert: AlertCircle,
  update: RefreshCw,
  reminder: Clock,
  message: MessageSquare,
}

const notificationColors: Record<NotificationType, string> = {
  alert:
    'text-[#902D41] bg-gradient-to-r from-transparent via-[#004FFF]/60 to-transparent',
  update: 'text-[#004FFF] bg-[#004FFF]/10',
  reminder: 'text-[#31AFD4] bg-[#31AFD4]/10',
  message: 'text-[#004FFF] bg-[#004FFF]/10',
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState(mockNotifications)
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState({
    showRead: true,
    types: {
      alert: true,
      update: true,
      reminder: true,
      message: true,
    },
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  const filteredNotifications = notifications.filter((notification) => {
    if (!filters.showRead && notification.read) return false
    return filters.types[notification.type]
  })

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const NotificationItem = ({
    notification,
  }: {
    notification: Notification
  }) => {
    const Icon = notificationIcons[notification.type]

    return (
      <div
        className={cn(
          'group relative flex items-start gap-4 rounded-lg p-4',
          'transition-all duration-200',
          notification.read ? 'opacity-75' : 'opacity-100',
          'hover:bg-[#004FFF]/10'
        )}
      >
        <div
          className={cn(
            'flex-none rounded-full p-2',
            notificationColors[notification.type]
          )}
        >
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[#050505]">
                {notification.title}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {notification.message}
              </p>
            </div>
            {!notification.read && (
              <Button
                className="size-6 text-white/40 hover:text-white/60"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  markAsRead(notification.id)
                }}
                size="icon"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-4">
            <span className="text-xs text-[#6B818C]">
              {formatDistanceToNow(new Date(notification.timestamp), {
                addSuffix: true,
              })}
            </span>
            {notification.relatedTo && (
              <span className="text-xs text-white/40">
                {notification.relatedTo.type}: {notification.relatedTo.name}
              </span>
            )}
          </div>
        </div>

        {notification.actionUrl && (
          <ChevronRight className="size-4 text-[#6B818C]/20 transition-colors group-hover:text-[#6B818C]/40" />
        )}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="relative"
              onClick={() => setIsOpen(!isOpen)}
              size="icon"
              variant="ghost"
            >
              <Bell className="size-5 text-white/70" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#902D41] text-[10px] font-medium text-white">
                  {unreadCount}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Notifications</p>
          </TooltipContent>
        </Tooltip>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border border-[#6B818C]/5 bg-[#D8E4FF]/90 shadow-lg backdrop-blur-lg">
            <div className="flex items-center justify-between border-b border-white/5 p-4">
              <h3 className="text-sm font-medium text-[#050505]">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="size-8 text-white/40 hover:text-white/60"
                      size="icon"
                      variant="ghost"
                    >
                      <Filter className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuCheckboxItem
                      checked={filters.showRead}
                      onCheckedChange={(checked) =>
                        setFilters((prev) => ({ ...prev, showRead: checked }))
                      }
                    >
                      Show Read
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {Object.entries(filters.types).map(([type, enabled]) => (
                      <DropdownMenuCheckboxItem
                        checked={enabled}
                        key={type}
                        onCheckedChange={(checked) =>
                          setFilters((prev) => ({
                            ...prev,
                            types: { ...prev.types, [type]: checked },
                          }))
                        }
                      >
                        Show {type.charAt(0).toUpperCase() + type.slice(1)}s
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  className="text-xs text-white/40 hover:text-white/60"
                  onClick={markAllAsRead}
                  size="sm"
                  variant="ghost"
                >
                  <Check className="mr-1 size-3" />
                  Mark all as read
                </Button>
              </div>
            </div>

            <div className="max-h-[480px] overflow-y-auto">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notification) => (
                  <Link
                    className="block"
                    href={(notification.actionUrl || '/') as Route}
                    key={notification.id}
                  >
                    <NotificationItem notification={notification} />
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-white/40">No notifications</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
