'use client'

import Link from 'next/link'
import {
  Calendar,
  FileText,
  Info,
  MessageSquare,
  MoreVertical,
  Upload,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

interface Patient {
  id: number
  name: string
  status: 'High Risk' | 'At Risk' | 'Healthy' | 'New Patient' | 'Recent Upload'
  nextAppointment?: string
  lastActivity: string
  riskLevel: number // 0-100
}

const patients: Patient[] = [
  {
    id: 1,
    name: 'Jane Doe',
    status: 'Recent Upload',
    nextAppointment: 'Tomorrow, 2:00 PM',
    lastActivity: 'Scan uploaded 2h ago',
    riskLevel: 45,
  },
  {
    id: 2,
    name: 'John Smith',
    status: 'High Risk',
    nextAppointment: 'Today, 4:30 PM',
    lastActivity: 'Analysis completed',
    riskLevel: 85,
  },
  {
    id: 3,
    name: 'Alice Johnson',
    status: 'At Risk',
    nextAppointment: 'Next Week',
    lastActivity: 'Report generated',
    riskLevel: 65,
  },
  {
    id: 4,
    name: 'Bob Williams',
    status: 'New Patient',
    lastActivity: 'Profile created',
    riskLevel: 25,
  },
]

const statusColors = {
  'High Risk': {
    dot: 'rgb(248, 113, 113)',
    gradient: 'from-red-500/10 to-red-900/5',
  },
  'At Risk': {
    dot: 'rgb(251, 146, 60)',
    gradient: 'from-orange-500/10 to-orange-900/5',
  },
  Healthy: {
    dot: 'rgb(74, 222, 128)',
    gradient: 'from-green-500/10 to-green-900/5',
  },
  'New Patient': {
    dot: 'rgb(96, 165, 250)',
    gradient: 'from-blue-500/10 to-blue-900/5',
  },
  'Recent Upload': {
    dot: 'rgb(167, 139, 250)',
    gradient: 'from-purple-500/10 to-purple-900/5',
  },
}

const getRiskColor = (risk: number) => {
  if (risk >= 75) return 'text-red-400'
  if (risk >= 50) return 'text-orange-400'
  if (risk >= 25) return 'text-yellow-400'
  return 'text-green-400'
}

const getRiskDescription = (risk: number) => {
  if (risk >= 75) return 'Critical attention required'
  if (risk >= 50) return 'Elevated risk level'
  if (risk >= 25) return 'Moderate risk level'
  return 'Normal risk level'
}

export function PatientShortcuts() {
  return (
    <TooltipProvider>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
        {/* Enhanced header */}
        <div className="border-b border-white/5 p-6">
          <div className="flex items-center justify-between">
            <h3 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-2xl font-extrabold text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
              Recent Patients
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="group relative overflow-hidden bg-black/20 text-white/70 transition-all duration-300 hover:scale-105 hover:bg-black/40 hover:text-white hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]"
            >
              <span className="relative z-10">View All</span>
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              </div>
            </Button>
          </div>
        </div>

        {/* Enhanced content */}
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className={cn(
                  'group relative flex flex-col',
                  'rounded-xl p-4',
                  'bg-black/20 backdrop-blur-sm',
                  'border border-white/5 hover:border-cyan-500/30',
                  'transition-all duration-300',
                  'hover:-translate-y-1 hover:bg-black/40',
                  'hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]'
                )}
              >
                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {/* Content wrapper */}
                <div className="relative z-10">
                  {/* Header section */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-2.5 transition-all duration-300 group-hover:border-cyan-500/20 group-hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                          <User className="size-5 text-cyan-400 transition-colors duration-300 group-hover:text-cyan-300" />
                        </div>
                        <div
                          className="absolute -bottom-1 -right-1 size-3 animate-pulse rounded-full border-2 border-black"
                          style={{
                            backgroundColor: statusColors[patient.status].dot,
                          }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white/90 transition-colors duration-300 group-hover:text-white">
                            {patient.name}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'flex items-center gap-1 rounded-full px-2 py-1 text-xs',
                                  'bg-black/40 backdrop-blur-sm transition-colors duration-300 group-hover:bg-black/60',
                                  getRiskColor(patient.riskLevel)
                                )}
                              >
                                <span>{patient.riskLevel}%</span>
                                <Info className="size-3 opacity-50" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{getRiskDescription(patient.riskLevel)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-sm text-white/50 transition-colors duration-300 group-hover:text-white/70">
                          {patient.status}
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-white/40 transition-all hover:scale-110 hover:bg-black/40 hover:text-white/60"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 border-white/10 bg-black/80 backdrop-blur-xl"
                      >
                        <DropdownMenuItem className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white">
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white">
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-white/70 hover:bg-cyan-500/10 hover:text-white focus:bg-cyan-500/10 focus:text-white">
                          View History
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-2">
                    {patient.nextAppointment && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
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
                          variant="ghost"
                          size="icon"
                          className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
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
                          variant="ghost"
                          size="icon"
                          className="size-8 bg-black/40 text-white/60 transition-all hover:scale-110 hover:bg-black/60 hover:text-white"
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
                  <div className="mt-4 border-t border-white/5 pt-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help text-sm text-white/50 transition-colors duration-300 group-hover:text-white/70">
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
                    href={`/dashboard/patients/${patient.id}`}
                    className="absolute inset-0 z-20 rounded-xl"
                    aria-label={`View ${patient.name}'s profile`}
                  />

                  {/* Enhanced scanning line effect */}
                  <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
