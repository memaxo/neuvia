'use client'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { mockAppointments, mockPatientDistribution } from './types'
import { MiniCalendar } from './visualizations/mini-calendar'
import { PieChart } from './visualizations/pie-chart'

export function PatientOverview() {
  return (
    <div className="card-premium rounded-lg border border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="card-premium-header border-b border-white/5">
        <div className="card-premium-header-content">
          <h3 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-xl font-bold text-transparent">
            Patient Overview
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
      <div className="card-premium-content">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Patient Distribution */}
          <div className="group relative rounded-xl border border-white/5 bg-black/20 p-4 transition-all duration-300 hover:border-cyan-500/30 hover:bg-black/40">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="group/chart relative">
                  <PieChart data={mockPatientDistribution} size={100} />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover/chart:opacity-100" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="mb-3 text-sm font-medium text-white/90">
                    Distribution
                  </h4>
                  <div className="space-y-2">
                    {mockPatientDistribution.map((item, index) => (
                      <TooltipProvider key={index}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="group/item flex cursor-help items-center justify-between rounded-lg p-2 transition-all duration-300 hover:bg-black/40">
                              <div className="flex items-center gap-2">
                                <div
                                  className="size-2 rounded-full transition-transform duration-300 group-hover/item:scale-125"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="text-sm text-white/70 transition-colors duration-300 group-hover/item:text-white">
                                  {item.status}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-white/90 transition-colors duration-300 group-hover/item:text-white">
                                {item.count}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">
                                {item.status} Patients
                              </p>
                              <p className="text-xs text-white/70">
                                Count: {item.count}
                              </p>
                              <p className="text-xs text-white/70">
                                {Math.round(
                                  (item.count /
                                    mockPatientDistribution.reduce(
                                      (acc, curr) => acc + curr.count,
                                      0
                                    )) *
                                    100
                                )}
                                % of total
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
          <div className="group relative rounded-xl border border-white/5 bg-black/20 p-4 transition-all duration-300 hover:border-cyan-500/30 hover:bg-black/40">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="relative z-10">
              <h4 className="mb-3 text-sm font-medium text-white/90">
                Upcoming Appointments
              </h4>
              <div className="rounded-lg bg-black/30 p-3 backdrop-blur-sm">
                <MiniCalendar appointments={mockAppointments} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
