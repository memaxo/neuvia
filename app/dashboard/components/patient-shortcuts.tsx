'use client'

import {
  Calendar,
  FileText,
  Info,
  MessageSquare,
  MoreVertical,
  Upload,
  User,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useState, useEffect } from 'react'

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

interface PatientData {
  id: number
  name: string
  status: 'High Risk' | 'At Risk' | 'Healthy' | 'New Patient' | 'Recent Upload'
  nextAppointment?: string
  lastActivity: string
  riskLevel: number // 0-100
}

const statusConfig = {
  'High Risk': {
    badge: 'status-badge-high-risk',
    icon: Info,
  },
  'At Risk': {
    badge: 'status-badge-at-risk',
    icon: Info,
  },
  'Healthy': {
    badge: 'status-badge-stable',
    icon: User,
  },
  'New Patient': {
    badge: 'status-badge-new',
    icon: User,
  },
  'Recent Upload': {
    badge: 'status-badge-new',
    icon: Upload,
  },
}

const getRiskScoreClass = (risk: number): string => {
  if (risk >= 75) return 'risk-score-high'
  if (risk >= 50) return 'risk-score-medium'
  return 'risk-score-low'
}

export function PatientShortcuts() {
  const [patients, setPatients] = useState<PatientData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPatients() {
      try {
        const response = await fetch('/api/patients')
        if (!response.ok) {
          throw new Error('Failed to fetch patients')
        }
        const data = await response.json()
        setPatients(data.patients)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [])

  if (loading) {
    return <div className="p-4 text-center text-[rgb(var(--foreground)/var(--opacity-70))]">Loading patients...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-[rgb(var(--error)/var(--opacity-100))]">{error}</div>
  }

  return (
    <TooltipProvider>
      <div className="card-premium animate-fade-in">
        {/* Enhanced header */}
        <div className="border-b border-[rgb(var(--border)/var(--opacity-10))] p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-extrabold text-[rgb(var(--foreground)/var(--opacity-90))]">
              Recent Patients
            </h3>
            <Button
              className="action-button px-4"
              size="sm"
              variant="ghost"
            >
              <span className="relative z-10">View All</span>
              <div className="absolute inset-0 overflow-hidden">
                <div className="scan-line-primary group-hover:animate-scan absolute -left-full top-0 h-px w-full" />
              </div>
            </Button>
          </div>
        </div>

        {/* Enhanced content */}
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {patients.map((patient) => {
              const StatusIcon = statusConfig[patient.status].icon
              const statusBadgeClass = statusConfig[patient.status].badge
              const riskScoreClass = getRiskScoreClass(patient.riskLevel)

              return (
                <div
                  className="patient-card group"
                  key={patient.id}
                >
                  {/* Enhanced gradient overlay */}
                  <div className="gradient-overlay-primary duration-normal absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100" />

                  {/* Content wrapper */}
                  <div className="relative z-10">
                    {/* Header section */}
                    <div className="patient-card-header">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="duration-normal rounded-xl border border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-20))] p-2.5 transition-all group-hover:border-[rgb(var(--primary)/var(--opacity-20))] group-hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]">
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
                            className="action-button"
                            size="icon"
                            variant="ghost"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-80))] backdrop-blur-xl"
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
                              className="action-button"
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
                            className="action-button"
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
                            className="action-button"
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

                    {/* Last activity with enhanced styling */}
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

                    {/* Enhanced clickable overlay */}
                    <Link
                      aria-label={`View ${patient.name}'s profile`}
                      className="absolute inset-0 z-20 rounded-xl"
                      href={`/dashboard/patients/${patient.id}` as Route}
                    />

                    {/* Enhanced scanning line effect */}
                    <div className="duration-normal absolute inset-0 overflow-hidden opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="scan-line-primary group-hover:animate-scan absolute -left-full top-0 h-px w-full" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}