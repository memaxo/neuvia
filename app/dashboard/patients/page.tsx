import { DashboardHeader } from "../components/dashboard-header"
import { PlusCircle, Search } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

export default function PatientsPage() {
  return (
    <div className="flex-1 space-y-8">
      <DashboardHeader />
      
      {/* Search and filters */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-teal-300" />
          <input
            type="text"
            placeholder="Search patients..."
            className="pl-10 pr-4 py-2 rounded-md bg-teal-800/50 text-teal-100 placeholder:text-teal-300 border border-teal-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <Link
          href="/dashboard/patients/new"
          className={buttonVariants({
            className: "bg-cyan-600 hover:bg-cyan-500 text-white"
          })}
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Add Patient
        </Link>
      </div>

      {/* Placeholder content */}
      <div className="bg-teal-800/50 rounded-lg p-8 text-center">
        <h3 className="text-xl font-bold text-teal-100 mb-2">Patient Management Coming Soon</h3>
        <p className="text-teal-300">This section will include patient lists, records, and management tools.</p>
      </div>
    </div>
  )
} 