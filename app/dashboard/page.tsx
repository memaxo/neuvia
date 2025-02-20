import { PlusCircle } from "lucide-react"
import { QuickStats } from "./components/quick-stats"
import { RecentActivity } from "./components/recent-activity"
import { PatientShortcuts } from "./components/patient-shortcuts"
import { DashboardHeader } from "./components/dashboard-header"
import { PatientOverview } from "./components/patient-overview"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-3">
      <DashboardHeader />
      
      {/* Main content and sidebar layout */}
      <div className="flex gap-3">
        {/* Main content area */}
        <div className="flex-1 space-y-3">
          {/* Top row - Quick stats */}
          <div className="p-4 bg-gray-800 rounded-lg shadow-sm">
            <QuickStats />
          </div>
          
          <hr className="my-4 border-gray-700" />
          {/* Middle row - Patient overview */}
          <div className="p-4 bg-gray-800 rounded-lg shadow-sm">
            <PatientOverview />
          </div>
          
          {/* Bottom row - Patient shortcuts with grid view */}
          <div className="p-4 bg-gray-800 rounded-lg shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              <PatientShortcuts />
            </div>
          </div>
        </div>

        {/* Right sidebar for activity */}
        <div className="w-[300px] hidden xl:block">
          <RecentActivity />
        </div>
      </div>

      {/* Floating action button */}
      <Link
        href="/dashboard/patients/new"
        className={buttonVariants({
          className: "fixed bottom-4 right-4 flex items-center space-x-2 bg-[#4B6BFD] hover:bg-[#4B6BFD]/90 text-white font-medium py-2 px-3 rounded-full shadow-lg transition-all hover:shadow-xl duration-300"
        })}
      >
        <PlusCircle className="h-4 w-4" />
        <span className="text-sm">Add Patient</span>
      </Link>
    </div>
  )
} 