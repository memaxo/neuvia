import { PlusCircle } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { ResearchGraph } from '@/app/deep-research/components/research-graph'
import { buttonVariants } from '@/components/ui/button'

import { DashboardHeader } from './components/dashboard-header'
import { PatientOverview } from './components/patient-overview'
import { PatientShortcuts } from './components/patient-shortcuts'
import { QuickStats } from './components/quick-stats'
import { RecentActivity } from './components/recent-activity'

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4">
      <DashboardHeader />

      {/* Main content and sidebar layout */}
      <div className="flex gap-4">
        {/* Main content area */}
        <div className="flex-1 space-y-4">
          {/* Quick stats card */}
          <div className="rounded-2xl border border-white/10 bg-black/30 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.16)]">
            <QuickStats />
          </div>

          <hr className="border-white/5" />

          {/* Patient overview card */}
          <div className="rounded-2xl border border-white/10 bg-black/30 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.16)]">
            <PatientOverview />
          </div>

          {/* Patient shortcuts grid */}
          <div className="rounded-2xl border border-white/10 bg-black/30 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.16)]">
            <div className="grid grid-cols-3 gap-4 p-4">
              <PatientShortcuts />
            </div>
          </div>

          {/* Research Graph integrated into main content */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl">
            <ResearchGraph />
          </div>
        </div>

        {/* Right sidebar for activity */}
        <div className="hidden w-[320px] xl:block">
          <div className="rounded-2xl border border-white/10 bg-black/30 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.16)]">
            <RecentActivity />
          </div>
        </div>
      </div>

      {/* Floating action button */}
      <Link
        className={buttonVariants({
          className:
            'fixed bottom-4 right-4 flex items-center space-x-2 rounded-full bg-[#4B6BFD] px-3 py-2 font-medium text-white shadow-lg transition-all duration-300 hover:bg-[#4B6BFD]/90 hover:shadow-xl',
        })}
        href="/dashboard/patients/new"
      >
        <PlusCircle className="size-4" />
        <span className="text-sm">Add Patient</span>
      </Link>
    </div>
  )
}