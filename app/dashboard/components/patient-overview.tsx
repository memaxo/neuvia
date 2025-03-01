'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { mockAppointments, mockPatientDistribution } from './types'
import { MiniCalendar } from './visualizations/mini-calendar'
import { PieChart } from './visualizations/pie-chart'

interface PatientOverviewProps {
  patientCount: number
  activePatients: number
  criticalCases: number
  upcomingAppointments: number
}

export function PatientOverview({
  patientCount,
  activePatients,
  criticalCases,
  upcomingAppointments,
}: PatientOverviewProps) {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Patient Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Patients */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-[rgb(var(--primary))]" />
              <span className="text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-70))]">
                Total Patients
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[rgb(var(--foreground))]">
                {patientCount}
              </span>
              <span className="text-sm text-[rgb(var(--success))]">+12%</span>
            </div>
          </div>

          {/* Active Patients */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-[rgb(var(--secondary))]" />
              <span className="text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-70))]">
                Active Patients
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[rgb(var(--foreground))]">
                {activePatients}
              </span>
              <span className="text-sm text-[rgb(var(--success))]">+5%</span>
            </div>
          </div>

          {/* Critical Cases */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-[rgb(var(--error))]" />
              <span className="text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-70))]">
                Critical Cases
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[rgb(var(--foreground))]">
                {criticalCases}
              </span>
              <span className="text-sm text-[rgb(var(--error))]">+2</span>
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-[rgb(var(--success))]" />
              <span className="text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-70))]">
                Upcoming
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[rgb(var(--foreground))]">
                {upcomingAppointments}
              </span>
              <span className="text-sm text-[rgb(var(--warning))]">Today</span>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Risk Distribution */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-90))]">
            Risk Distribution
          </h4>
          <div className="grid gap-4">
            {/* High Risk */}
            <div className="flex items-center gap-4">
              <div className="size-2 rounded-full bg-[rgb(var(--error))]" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-90))]">
                    High Risk
                  </span>
                  <span className="text-sm text-[rgb(var(--foreground)/var(--opacity-60))]">
                    15%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[rgb(var(--background)/var(--opacity-20))]">
                  <div className="h-full w-[15%] rounded-full bg-[rgb(var(--error))] transition-all duration-500" />
                </div>
              </div>
            </div>

            {/* Medium Risk */}
            <div className="flex items-center gap-4">
              <div className="size-2 rounded-full bg-[rgb(var(--warning))]" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-90))]">
                    Medium Risk
                  </span>
                  <span className="text-sm text-[rgb(var(--foreground)/var(--opacity-60))]">
                    35%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[rgb(var(--background)/var(--opacity-20))]">
                  <div className="h-full w-[35%] rounded-full bg-[rgb(var(--warning))] transition-all duration-500" />
                </div>
              </div>
            </div>

            {/* Low Risk */}
            <div className="flex items-center gap-4">
              <div className="size-2 rounded-full bg-[rgb(var(--success))]" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-[rgb(var(--foreground)/var(--opacity-90))]">
                    Low Risk
                  </span>
                  <span className="text-sm text-[rgb(var(--foreground)/var(--opacity-60))]">
                    50%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[rgb(var(--background)/var(--opacity-20))]">
                  <div className="h-full w-[50%] rounded-full bg-[rgb(var(--success))] transition-all duration-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
