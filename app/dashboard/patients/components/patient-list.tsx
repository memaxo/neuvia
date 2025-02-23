'use client'

import {
  AlertCircle,
  Calendar,
  FileText,
  MoreVertical,
  User,
} from 'lucide-react'

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
  status: 'High Risk' | 'At Risk' | 'Stable' | 'New'
  lastVisit: string
  nextAppointment?: string
  riskScore: number
  age: number
  condition: string
}

const mockPatients: Patient[] = [
  {
    id: 'P-1001',
    name: 'Emma Thompson',
    status: 'High Risk',
    lastVisit: '2 days ago',
    nextAppointment: 'Tomorrow, 2:00 PM',
    riskScore: 85,
    age: 45,
    condition: 'Post-surgical monitoring',
  },
  {
    id: 'P-1002',
    name: 'James Wilson',
    status: 'Stable',
    lastVisit: '1 week ago',
    nextAppointment: 'Next week',
    riskScore: 25,
    age: 62,
    condition: 'Regular checkup',
  },
  {
    id: 'P-1003',
    name: 'Sarah Chen',
    status: 'At Risk',
    lastVisit: '3 days ago',
    nextAppointment: 'Friday, 11:30 AM',
    riskScore: 65,
    age: 38,
    condition: 'Ongoing treatment',
  },
  {
    id: 'P-1004',
    name: 'Michael Brown',
    status: 'New',
    lastVisit: 'Today',
    riskScore: 45,
    age: 29,
    condition: 'Initial assessment',
  },
]

const statusConfig = {
  'High Risk': {
    badge: 'status-badge-high-risk',
    icon: AlertCircle,
  },
  'At Risk': {
    badge: 'status-badge-at-risk',
    icon: AlertCircle,
  },
  'Stable': {
    badge: 'status-badge-stable',
    icon: User,
  },
  'New': {
    badge: 'status-badge-new',
    icon: User,
  },
}

const getRiskScoreClass = (score: number): string => {
  if (score >= 75) return 'risk-score-high'
  if (score >= 50) return 'risk-score-medium'
  return 'risk-score-low'
}

export function PatientList() {
  return (
    <div className="card-premium animate-fade-in">
      <div className="p-6">
        <div className="space-y-4">
          {mockPatients.map((patient) => {
            const StatusIcon = statusConfig[patient.status].icon
            const statusBadgeClass = statusConfig[patient.status].badge
            const riskScoreClass = getRiskScoreClass(patient.riskScore)

            return (
              <div
                className="patient-card group"
                key={patient.id}
              >
                {/* Enhanced gradient overlay */}
                <div className="gradient-overlay-primary absolute inset-0 rounded-xl opacity-0 transition-opacity duration-normal group-hover:opacity-100" />

                {/* Content wrapper */}
                <div className="relative z-10 w-full">
                  <div className="patient-card-header">
                    {/* Patient info */}
                    <div className="patient-info">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="rounded-xl border border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-20))] p-2.5 transition-all duration-normal group-hover:border-[rgb(var(--primary)/var(--opacity-20))] group-hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                            <StatusIcon className="size-5 text-[rgb(var(--primary)/var(--opacity-100))] transition-colors duration-normal group-hover:text-[rgb(var(--primary)/var(--opacity-90))]" />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-[rgb(var(--foreground)/var(--opacity-90))] transition-colors duration-normal group-hover:text-[rgb(var(--foreground)/var(--opacity-100))]">
                              {patient.name}
                            </span>
                            <span className="text-sm text-[rgb(var(--foreground)/var(--opacity-50))]">
                              {patient.id}
                            </span>
                            <div className={cn('status-badge', statusBadgeClass)}>
                              {patient.status}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-[rgb(var(--foreground)/var(--opacity-70))]">
                            <span>Age: {patient.age}</span>
                            <span>Condition: {patient.condition}</span>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-[rgb(var(--foreground)/var(--opacity-50))]">
                            <span>Last visit: {patient.lastVisit}</span>
                            {Boolean(patient.nextAppointment) && (
                              <span>Next: {patient.nextAppointment}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
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
                            <p>Schedule appointment</p>
                          </TooltipContent>
                        </Tooltip>

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
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Risk score bar */}
                  <div className="risk-score-container">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[rgb(var(--foreground)/var(--opacity-70))]">Risk Score</span>
                      <span className={cn('font-medium', riskScoreClass)}>
                        {patient.riskScore}%
                      </span>
                    </div>
                    <div className="risk-score-bar">
                      <div
                        className={cn('risk-score-progress', riskScoreClass)}
                        style={{ width: `${patient.riskScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Enhanced scanning line effect */}
                  <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-normal group-hover:opacity-100">
                    <div className="scan-line-primary group-hover:animate-scan absolute -left-full top-0 h-px w-full" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}