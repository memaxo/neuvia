import { PlusCircle } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

import { DashboardHeader } from './components/dashboard-header'
import { PatientOverview } from './components/patient-overview'
import { PatientShortcuts } from './components/patient-shortcuts'
import { QuickStats } from './components/quick-stats'
import { RecentActivity } from './components/recent-activity'

export default function DashboardPage() {
  return (
    <div className="flex-1">
      <DashboardHeader />

      {/* Main content and sidebar layout */}
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Main content area with padding */}
        <div className="relative flex-1 space-y-6 p-6">
          {/* Background layer for content area */}
          <div className="absolute inset-0 bg-[rgb(var(--background))] shadow-2xl" />

          {/* Content stack */}
          <div className="relative space-y-6">
            {/* Quick stats card */}
            <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] backdrop-blur-sm">
              <QuickStats />
            </div>

            <Separator className="border-[rgb(var(--border))/var(--opacity-10)]" />

            {/* Patient overview card */}
            <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] backdrop-blur-sm">
              <PatientOverview
                activePatients={856}
                criticalCases={12}
                patientCount={1234}
                upcomingAppointments={45}
              />
            </div>

            {/* Patient shortcuts grid */}
            <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] backdrop-blur-sm">
              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
                <PatientShortcuts />
              </div>
            </div>

            {/* Note: ResearchGraph has been removed from dashboard as it should only be shown when deep research is active */}
          </div>
        </div>

        {/* Right sidebar for activity */}
        <div className="hidden w-[320px] border-l border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-95)] backdrop-blur-sm xl:block">
          <div className="p-6">
            <RecentActivity />
          </div>
        </div>
      </div>

      {/* Floating action button */}
      <Link
        className={buttonVariants({
          className: cn(
            'fixed bottom-6 right-6 flex items-center gap-2 rounded-full',
            'bg-[rgb(var(--primary))] text-white shadow-lg',
            'duration-normal transition-all',
            'hover:bg-[rgb(var(--primary-dark))] hover:shadow-xl'
          ),
        })}
        href="/dashboard/patients/new"
      >
        <PlusCircle className="size-4" />
        <span className="text-sm font-medium">Add Patient</span>
      </Link>
    </div>
  )
}
