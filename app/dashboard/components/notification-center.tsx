'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { cn } from '@/lib/utils'
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
import { mockNotifications, Notification, NotificationType } from './types'

const notificationIcons: Record<NotificationType, any> = {
  alert: AlertCircle,
  update: RefreshCw,
  reminder: Clock,
  message: MessageSquare,
}

const notificationColors: Record<NotificationType, string> = {
  alert: 'text-red-400 bg-red-400/10',
  update: 'text-blue-400 bg-blue-400/10',
  reminder: 'text-yellow-400 bg-yellow-400/10',
  message: 'text-purple-400 bg-purple-400/10',
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
          'hover:bg-spline-blue/10'
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
              <p className="text-sm font-medium text-white/90">
                {notification.title}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {notification.message}
              </p>
            </div>
            {!notification.read && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-white/40 hover:text-white/60"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  markAsRead(notification.id)
                }}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-4">
            <span className="text-xs text-white/40">
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
          <ChevronRight className="size-4 text-white/20 transition-colors group-hover:text-white/40" />
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
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setIsOpen(!isOpen)}
            >
              <Bell className="size-5 text-white/70" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
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
          <div className="absolute right-0 top-full mt-2 w-96 rounded-lg border border-white/5 bg-black/90 shadow-lg backdrop-blur-lg">
            <div className="flex items-center justify-between border-b border-white/5 p-4">
              <h3 className="text-sm font-medium text-white/90">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-white/40 hover:text-white/60"
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
                        key={type}
                        checked={enabled}
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
                  variant="ghost"
                  size="sm"
                  className="text-xs text-white/40 hover:text-white/60"
                  onClick={markAllAsRead}
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
                    key={notification.id}
                    href={notification.actionUrl || '#'}
                    className="block"
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
