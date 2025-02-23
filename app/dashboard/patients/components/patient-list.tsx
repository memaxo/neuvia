'use client'

import {
  Calendar,
  FileText,
  Info,
  MessageSquare,
  MoreVertical,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Patient {
  id: string
  name: string
  status: 'Stable' | 'At Risk' | 'Critical' | 'New'
  riskLevel: number
  lastActivity: string
  nextAppointment?: string
}

const statusConfig = {
  Stable: {
    icon: Calendar,
    badge: 'status-badge-stable',
  },
  'At Risk': {
    icon: Info,
    badge: 'status-badge-at-risk',
  },
  Critical: {
    icon: Info,
    badge: 'status-badge-high-risk',
  },
  New: {
    icon: Calendar,
    badge: 'status-badge-new',
  },
}

function getRiskScoreClass(score: number): string {
  if (score >= 70) return 'status-badge-high-risk'
  if (score >= 40) return 'status-badge-at-risk'
  return 'status-badge-stable'
}

interface PatientListProps {
  patients: Patient[]
}

export function PatientList({ patients }: PatientListProps) {
  return (
    <TooltipProvider>
      <div className="animate-fade-in space-y-4">
        {patients.map((patient) => {
          const StatusIcon = statusConfig[patient.status].icon
          const statusBadgeClass = statusConfig[patient.status].badge
          const riskScoreClass = getRiskScoreClass(patient.riskLevel)

          return (
            <div
              className="duration-normal group relative overflow-hidden rounded-[var(--radius-lg)] border border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-40))] p-4 backdrop-blur-xl transition-all hover:border-[rgb(var(--primary)/var(--opacity-30))] hover:bg-[rgb(var(--background)/var(--opacity-60))] hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]"
              key={patient.id}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="duration-normal rounded-[var(--radius-lg)] border border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-20))] p-2.5 transition-all group-hover:border-[rgb(var(--primary)/var(--opacity-20))] group-hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                      <StatusIcon className="duration-normal size-5 text-[rgb(var(--primary)/var(--opacity-100))] transition-colors group-hover:text-[rgb(var(--primary)/var(--opacity-90))]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="duration-normal font-medium text-[rgb(var(--foreground)/var(--opacity-90))] transition-colors group-hover:text-[rgb(var(--foreground)/var(--opacity-100))]">
                        {patient.name}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn('status-badge', riskScoreClass)}>
                            <span>{patient.riskLevel}%</span>
                            <Info className="size-3 opacity-50" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Risk Level: {patient.riskLevel}%</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="duration-normal text-sm text-[rgb(var(--foreground)/var(--opacity-50))] transition-colors group-hover:text-[rgb(var(--foreground)/var(--opacity-70))]">
                      {patient.status}
                    </span>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="size-8 rounded-[var(--radius-lg)] bg-[rgb(var(--background)/var(--opacity-40))] text-[rgb(var(--foreground)/var(--opacity-60))] transition-all hover:scale-110 hover:bg-[rgb(var(--background)/var(--opacity-60))] hover:text-[rgb(var(--foreground)/var(--opacity-100))] hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                      size="icon"
                      variant="ghost"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-95))] backdrop-blur-xl"
                  >
                    <DropdownMenuItem className="text-[rgb(var(--foreground)/var(--opacity-70))] hover:bg-[rgb(var(--primary)/var(--opacity-10))] hover:text-[rgb(var(--foreground)/var(--opacity-100))] focus:bg-[rgb(var(--primary)/var(--opacity-10))] focus:text-[rgb(var(--foreground)/var(--opacity-100))]">
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-[rgb(var(--foreground)/var(--opacity-70))] hover:bg-[rgb(var(--primary)/var(--opacity-10))] hover:text-[rgb(var(--foreground)/var(--opacity-100))] focus:bg-[rgb(var(--primary)/var(--opacity-10))] focus:text-[rgb(var(--foreground)/var(--opacity-100))]">
                      Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-[rgb(var(--foreground)/var(--opacity-70))] hover:bg-[rgb(var(--primary)/var(--opacity-10))] hover:text-[rgb(var(--foreground)/var(--opacity-100))] focus:bg-[rgb(var(--primary)/var(--opacity-10))] focus:text-[rgb(var(--foreground)/var(--opacity-100))]">
                      View History
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Quick actions */}
              <div className="mt-4 flex items-center gap-2">
                {patient.nextAppointment && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="size-8 rounded-[var(--radius-lg)] bg-[rgb(var(--background)/var(--opacity-40))] text-[rgb(var(--foreground)/var(--opacity-60))] transition-all hover:scale-110 hover:bg-[rgb(var(--background)/var(--opacity-60))] hover:text-[rgb(var(--foreground)/var(--opacity-100))] hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                        size="icon"
                        variant="ghost"
                      >
                        <Calendar className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Next appointment: {patient.nextAppointment}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="size-8 rounded-[var(--radius-lg)] bg-[rgb(var(--background)/var(--opacity-40))] text-[rgb(var(--foreground)/var(--opacity-60))] transition-all hover:scale-110 hover:bg-[rgb(var(--background)/var(--opacity-60))] hover:text-[rgb(var(--foreground)/var(--opacity-100))] hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                      size="icon"
                      variant="ghost"
                    >
                      <FileText className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View medical records</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="size-8 rounded-[var(--radius-lg)] bg-[rgb(var(--background)/var(--opacity-40))] text-[rgb(var(--foreground)/var(--opacity-60))] transition-all hover:scale-110 hover:bg-[rgb(var(--background)/var(--opacity-60))] hover:text-[rgb(var(--foreground)/var(--opacity-100))] hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                      size="icon"
                      variant="ghost"
                    >
                      <MessageSquare className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send message</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Last activity */}
              <div className="mt-4 border-t border-[rgb(var(--border)/var(--opacity-10))] pt-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="duration-normal cursor-help text-sm text-[rgb(var(--foreground)/var(--opacity-50))] transition-colors group-hover:text-[rgb(var(--foreground)/var(--opacity-70))]">
                      {patient.lastActivity}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Most recent patient activity</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Clickable overlay */}
              <Link
                aria-label={`View ${patient.name}'s profile`}
                className="absolute inset-0 z-20 rounded-[var(--radius-lg)]"
                href={`/dashboard/patients/${patient.id}` as Route}
              />

              {/* Scanning line effect */}
              <div className="duration-normal absolute inset-0 overflow-hidden opacity-0 transition-opacity group-hover:opacity-100">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary)/var(--opacity-30))] to-transparent" />
              </div>
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}