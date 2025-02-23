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
    <div className="card-premium animate-fade-in">
      <div className="border-b border-[rgb(var(--border)/var(--opacity-10))] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-[rgb(var(--foreground)/var(--opacity-90))]">
            Patient Overview
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
      <div className="p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Patient Distribution */}
          <div className="card-premium group">
            <div className="gradient-overlay-primary duration-normal absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="group/chart relative">
                  <PieChart data={mockPatientDistribution} size={100} />
                  <div className="duration-normal absolute inset-0 rounded-full bg-gradient-to-t from-[rgb(var(--background)/var(--opacity-20))] to-transparent opacity-0 transition-opacity group-hover/chart:opacity-100" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="mb-3 text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-90))]">
                    Distribution
                  </h4>
                  <div className="space-y-2">
                    {mockPatientDistribution.map((item, index) => (
                      <TooltipProvider key={index}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="group/item duration-normal flex cursor-help items-center justify-between rounded-lg p-2 transition-all hover:bg-[rgb(var(--background)/var(--opacity-40))]">
                              <div className="flex items-center gap-2">
                                <div
                                  className="duration-normal size-2 rounded-full transition-transform group-hover/item:scale-125"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="duration-normal text-sm text-[rgb(var(--foreground)/var(--opacity-70))] transition-colors group-hover/item:text-[rgb(var(--foreground)/var(--opacity-100))]">
                                  {item.status}
                                </span>
                              </div>
                              <span className="duration-normal text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-90))] transition-colors group-hover/item:text-[rgb(var(--foreground)/var(--opacity-100))]">
                                {item.count}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">
                                {item.status} Patients
                              </p>
                              <p className="text-xs text-[rgb(var(--foreground)/var(--opacity-70))]">
                                Count: {item.count}
                              </p>
                              <p className="text-xs text-[rgb(var(--foreground)/var(--opacity-70))]">
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
          <div className="card-premium group">
            <div className="gradient-overlay-primary duration-normal absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="relative z-10">
              <h4 className="mb-3 text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-90))]">
                Upcoming Appointments
              </h4>
              <div className="rounded-lg bg-[rgb(var(--background)/var(--opacity-30))] p-3 backdrop-blur-sm">
                <MiniCalendar appointments={mockAppointments} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}