import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { DashboardHeader } from './components/dashboard-header'
import { PatientOverview } from './components/patient-overview'
import { PatientShortcuts } from './components/patient-shortcuts'
import { QuickStats } from './components/quick-stats'
import { RecentActivity } from './components/recent-activity'

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-3">
      <DashboardHeader />

      {/* Main content and sidebar layout */}
      <div className="flex gap-3">
        {/* Main content area */}
        <div className="flex-1 space-y-3">
          {/* Top row - Quick stats */}
          <div className="rounded-lg bg-gray-800 p-4 shadow-sm">
            <QuickStats />
          </div>

          <hr className="my-4 border-gray-700" />
          {/* Middle row - Patient overview */}
          <div className="rounded-lg bg-gray-800 p-4 shadow-sm">
            <PatientOverview />
          </div>

          {/* Bottom row - Patient shortcuts with grid view */}
          <div className="rounded-lg bg-gray-800 p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              <PatientShortcuts />
            </div>
          </div>
        </div>

        {/* Right sidebar for activity */}
        <div className="hidden w-[300px] xl:block">
          <RecentActivity />
        </div>
      </div>

      {/* Floating action button */}
      <Link
        href="/dashboard/patients/new"
        className={buttonVariants({
          className:
            'fixed bottom-4 right-4 flex items-center space-x-2 rounded-full bg-[#4B6BFD] px-3 py-2 font-medium text-white shadow-lg transition-all duration-300 hover:bg-[#4B6BFD]/90 hover:shadow-xl',
        })}
      >
        <PlusCircle className="h-4 w-4" />
        <span className="text-sm">Add Patient</span>
      </Link>
    </div>
  )
}
