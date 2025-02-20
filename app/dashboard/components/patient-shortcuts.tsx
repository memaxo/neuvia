"use client"

import Link from "next/link"
import { 
  User, 
  Calendar, 
  FileText, 
  MoreVertical,
  Upload,
  MessageSquare,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"
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

interface Patient {
  id: number
  name: string
  status: "High Risk" | "At Risk" | "Healthy" | "New Patient" | "Recent Upload"
  nextAppointment?: string
  lastActivity: string
  riskLevel: number // 0-100
}

const patients: Patient[] = [
  { 
    id: 1, 
    name: "Jane Doe", 
    status: "Recent Upload",
    nextAppointment: "Tomorrow, 2:00 PM",
    lastActivity: "Scan uploaded 2h ago",
    riskLevel: 45
  },
  { 
    id: 2, 
    name: "John Smith", 
    status: "High Risk",
    nextAppointment: "Today, 4:30 PM",
    lastActivity: "Analysis completed",
    riskLevel: 85
  },
  { 
    id: 3, 
    name: "Alice Johnson", 
    status: "At Risk",
    nextAppointment: "Next Week",
    lastActivity: "Report generated",
    riskLevel: 65
  },
  { 
    id: 4, 
    name: "Bob Williams", 
    status: "New Patient",
    lastActivity: "Profile created",
    riskLevel: 25
  }
]

const statusColors = {
  "High Risk": {
    dot: "rgb(248, 113, 113)",
    gradient: "from-red-500/10 to-red-900/5"
  },
  "At Risk": {
    dot: "rgb(251, 146, 60)",
    gradient: "from-orange-500/10 to-orange-900/5"
  },
  "Healthy": {
    dot: "rgb(74, 222, 128)",
    gradient: "from-green-500/10 to-green-900/5"
  },
  "New Patient": {
    dot: "rgb(96, 165, 250)",
    gradient: "from-blue-500/10 to-blue-900/5"
  },
  "Recent Upload": {
    dot: "rgb(167, 139, 250)",
    gradient: "from-purple-500/10 to-purple-900/5"
  }
}

const getRiskColor = (risk: number) => {
  if (risk >= 75) return "text-red-400"
  if (risk >= 50) return "text-orange-400"
  if (risk >= 25) return "text-yellow-400"
  return "text-green-400"
}

const getRiskDescription = (risk: number) => {
  if (risk >= 75) return "Critical attention required"
  if (risk >= 50) return "Elevated risk level"
  if (risk >= 25) return "Moderate risk level"
  return "Normal risk level"
}

export function PatientShortcuts() {
  return (
    <TooltipProvider>
      <div className="bg-black/30 backdrop-blur-lg border border-white/5 p-6 rounded-lg shadow-spline md:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold bg-gradient-to-r from-spline-cyan to-spline-blue bg-clip-text text-transparent">
            Recent Patients
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:text-white hover:bg-spline-blue/10"
          >
            View All
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patients.map((patient) => (
            <div
              key={patient.id}
              className={cn(
                "group relative flex flex-col",
                "p-4 rounded-lg",
                "bg-gradient-to-br from-black/30 to-black/10",
                "border border-white/5 hover:border-white/10",
                "transition-all duration-500 ease-in-out",
                "animate-fade-in motion-reduce:animate-none"
              )}
              style={{
                backgroundSize: "200% 200%",
                backgroundPosition: "0% 0%"
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="p-2 rounded-full bg-black/20 group-hover:scale-110 transition-transform duration-300">
                      <User className="h-5 w-5 text-white/70 group-hover:text-spline-cyan transition-colors" />
                    </div>
                    <div 
                      className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-black animate-pulse"
                      style={{ backgroundColor: statusColors[patient.status].dot }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-spline-cyan group-hover:text-spline-cyan/80 transition-colors">
                        {patient.name}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn(
                            "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full cursor-help",
                            "bg-black/20 group-hover:bg-black/30 transition-colors",
                            getRiskColor(patient.riskLevel)
                          )}>
                            <span>{patient.riskLevel}%</span>
                            <Info className="h-3 w-3 opacity-50" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getRiskDescription(patient.riskLevel)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xs text-white/50">{patient.status}</span>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/40 hover:text-white/60 transition-transform hover:scale-110"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem>View Profile</DropdownMenuItem>
                    <DropdownMenuItem>Edit Details</DropdownMenuItem>
                    <DropdownMenuItem>View History</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Info & Quick Actions */}
              <div className="flex items-center justify-between mt-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 text-xs text-white/40 cursor-help">
                      <Calendar className="h-3 w-3" />
                      <span>{patient.nextAppointment || 'No appointment'}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Next scheduled appointment</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white/40 hover:text-white/60 hover:bg-black/20 transition-transform hover:scale-110"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Upload new scan</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white/40 hover:text-white/60 hover:bg-black/20 transition-transform hover:scale-110"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View reports</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white/40 hover:text-white/60 hover:bg-black/20 transition-transform hover:scale-110"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Send message</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              
              {/* Last Activity */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-white/40 cursor-help">
                      {patient.lastActivity}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Most recent patient activity</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {/* Clickable overlay for main action */}
              <Link
                href={`/dashboard/patients/${patient.id}`}
                className="absolute inset-0 z-10"
                aria-label={`View ${patient.name}'s profile`}
              />

              {/* Hover gradient overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-black/20 to-transparent rounded-lg pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
} 