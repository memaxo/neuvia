"use client"

import { User, Calendar, FileText, MoreVertical, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface Patient {
  id: string
  name: string
  status: "High Risk" | "At Risk" | "Stable" | "New"
  lastVisit: string
  nextAppointment?: string
  riskScore: number
  age: number
  condition: string
}

const mockPatients: Patient[] = [
  {
    id: "P-1001",
    name: "Emma Thompson",
    status: "High Risk",
    lastVisit: "2 days ago",
    nextAppointment: "Tomorrow, 2:00 PM",
    riskScore: 85,
    age: 45,
    condition: "Post-surgical monitoring"
  },
  {
    id: "P-1002",
    name: "James Wilson",
    status: "Stable",
    lastVisit: "1 week ago",
    nextAppointment: "Next week",
    riskScore: 25,
    age: 62,
    condition: "Regular checkup"
  },
  {
    id: "P-1003",
    name: "Sarah Chen",
    status: "At Risk",
    lastVisit: "3 days ago",
    nextAppointment: "Friday, 11:30 AM",
    riskScore: 65,
    age: 38,
    condition: "Ongoing treatment"
  },
  {
    id: "P-1004",
    name: "Michael Brown",
    status: "New",
    lastVisit: "Today",
    riskScore: 45,
    age: 29,
    condition: "Initial assessment"
  }
]

const statusStyles = {
  "High Risk": {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: AlertCircle
  },
  "At Risk": {
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    icon: AlertCircle
  },
  "Stable": {
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    icon: User
  },
  "New": {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: User
  }
}

export function PatientList() {
  return (
    <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10">
      <div className="p-6">
        <div className="space-y-4">
          {mockPatients.map((patient) => {
            const StatusIcon = statusStyles[patient.status].icon
            return (
              <div
                key={patient.id}
                className={cn(
                  "group relative p-4 rounded-xl",
                  "bg-black/20 backdrop-blur-sm",
                  "border border-white/5 hover:border-cyan-500/30",
                  "transition-all duration-300",
                  "hover:translate-x-1 hover:bg-black/40",
                  "hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]"
                )}
              >
                {/* Enhanced gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

                {/* Content wrapper */}
                <div className="relative z-10">
                  <div className="flex items-start justify-between">
                    {/* Patient info */}
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 group-hover:border-cyan-500/20 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                          <StatusIcon className="h-5 w-5 text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-white/90 group-hover:text-white transition-colors duration-300">
                            {patient.name}
                          </span>
                          <span className="text-sm text-white/50">
                            {patient.id}
                          </span>
                          <div className={cn(
                            "px-2.5 py-1 rounded-full text-sm font-medium",
                            statusStyles[patient.status].bg,
                            statusStyles[patient.status].color,
                            statusStyles[patient.status].border
                          )}>
                            {patient.status}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-white/70">
                          <span>Age: {patient.age}</span>
                          <span>Condition: {patient.condition}</span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-white/50">
                          <span>Last visit: {patient.lastVisit}</span>
                          {patient.nextAppointment && (
                            <span>Next: {patient.nextAppointment}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white/60 hover:text-white transition-all hover:scale-110"
                            >
                              <Calendar className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Schedule appointment</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white/60 hover:text-white transition-all hover:scale-110"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View medical records</p>
                          </TooltipContent>
                        </Tooltip>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white/60 hover:text-white transition-all hover:scale-110"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-black/80 backdrop-blur-xl border-white/10">
                            <DropdownMenuItem className="text-white/70 hover:text-white focus:text-white hover:bg-cyan-500/10 focus:bg-cyan-500/10">
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-white/70 hover:text-white focus:text-white hover:bg-cyan-500/10 focus:bg-cyan-500/10">
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-white/70 hover:text-white focus:text-white hover:bg-cyan-500/10 focus:bg-cyan-500/10">
                              View History
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Risk score bar */}
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/70">Risk Score</span>
                      <span className={cn(
                        "font-medium",
                        patient.riskScore >= 75 ? "text-red-400" :
                        patient.riskScore >= 50 ? "text-orange-400" :
                        patient.riskScore >= 25 ? "text-yellow-400" :
                        "text-green-400"
                      )}>
                        {patient.riskScore}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          patient.riskScore >= 75 ? "bg-gradient-to-r from-red-500 to-red-600" :
                          patient.riskScore >= 50 ? "bg-gradient-to-r from-orange-500 to-orange-600" :
                          patient.riskScore >= 25 ? "bg-gradient-to-r from-yellow-500 to-yellow-600" :
                          "bg-gradient-to-r from-green-500 to-green-600"
                        )}
                        style={{ width: `${patient.riskScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Enhanced scanning line effect */}
                  <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover:animate-scan" />
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