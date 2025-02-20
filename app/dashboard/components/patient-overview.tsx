"use client"

import { mockPatientDistribution, mockAppointments } from "./types"
import { PieChart } from "./visualizations/pie-chart"
import { MiniCalendar } from "./visualizations/mini-calendar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function PatientOverview() {
  return (
    <div className="card-premium rounded-lg backdrop-blur-xl bg-black/30 border border-white/10">
      <div className="card-premium-header border-b border-white/5">
        <div className="card-premium-header-content">
          <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
            Patient Overview
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="relative overflow-hidden group bg-black/20 hover:bg-black/40 
                     text-white/70 hover:text-white transition-all duration-300
                     hover:shadow-[0_0_20px_rgba(0,255,255,0.1)] hover:scale-105"
          >
            <span className="relative z-10">View All</span>
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent group-hover:animate-scan" />
            </div>
          </Button>
        </div>
      </div>
      <div className="card-premium-content">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Patient Distribution */}
          <div className="group relative p-4 rounded-xl bg-black/20 border border-white/5 
                        hover:border-cyan-500/30 hover:bg-black/40 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 
                          opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
            
            <div className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="relative group/chart">
                  <PieChart data={mockPatientDistribution} size={100} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent 
                               opacity-0 group-hover/chart:opacity-100 rounded-full transition-opacity duration-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white/90 mb-3">Distribution</h4>
                  <div className="space-y-2">
                    {mockPatientDistribution.map((item, index) => (
                      <TooltipProvider key={index}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center justify-between cursor-help 
                                        hover:bg-black/40 p-2 rounded-lg transition-all duration-300
                                        group/item">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full transition-transform duration-300
                                         group-hover/item:scale-125"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-sm text-white/70 group-hover/item:text-white transition-colors duration-300">
                                  {item.status}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-white/90 group-hover/item:text-white transition-colors duration-300">
                                {item.count}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">{item.status} Patients</p>
                              <p className="text-xs text-white/70">Count: {item.count}</p>
                              <p className="text-xs text-white/70">
                                {Math.round((item.count / mockPatientDistribution.reduce((acc, curr) => acc + curr.count, 0)) * 100)}% of total
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mini Calendar */}
          <div className="group relative p-4 rounded-xl bg-black/20 border border-white/5 
                        hover:border-cyan-500/30 hover:bg-black/40 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 
                          opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
            
            <div className="relative z-10">
              <h4 className="text-sm font-medium text-white/90 mb-3">Upcoming Appointments</h4>
              <div className="bg-black/30 rounded-lg p-3 backdrop-blur-sm">
                <MiniCalendar appointments={mockAppointments} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 