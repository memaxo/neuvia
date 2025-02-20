import { PlusCircle } from "lucide-react"
import { QuickStats } from "./components/quick-stats"
import { RecentActivity } from "./components/recent-activity"
import { PatientShortcuts } from "./components/patient-shortcuts"
import { DashboardHeader } from "./components/dashboard-header"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-8">
      <DashboardHeader />
      
      {/* Dashboard content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuickStats />
        <RecentActivity />
        <PatientShortcuts />
      </div>

      {/* Add New Patient button */}
      <Link
        href="/dashboard/patients/new"
        className={buttonVariants({
          className: "mt-8 flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded transition-colors duration-300"
        })}
      >
        <PlusCircle className="h-5 w-5" />
        <span>Add New Patient</span>
      </Link>
    </div>
  )
} 