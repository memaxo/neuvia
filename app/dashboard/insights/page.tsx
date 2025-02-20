import { DashboardHeader } from "../components/dashboard-header"
import { Search, Cpu, FileText, AlertTriangle } from "lucide-react"

export default function InsightsPage() {
  return (
    <div className="flex-1 space-y-8">
      <DashboardHeader />
      
      {/* Search bar */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search medical insights..."
          className="w-full pl-10 pr-4 py-2 rounded-md bg-teal-800/50 text-slate-200 placeholder:text-slate-400 border border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Placeholder content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-teal-800/50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="h-6 w-6 text-teal-400" />
            <h3 className="text-lg font-semibold text-slate-100">AI Analysis</h3>
          </div>
          <p className="text-slate-300">
            Advanced medical record analysis and insights coming soon
          </p>
        </div>

        <div className="bg-teal-800/50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-6 w-6 text-teal-400" />
            <h3 className="text-lg font-semibold text-slate-100">Document Summary</h3>
          </div>
          <p className="text-slate-300">
            Automated document summarization and key findings extraction
          </p>
        </div>

        <div className="bg-teal-800/50 rounded-lg p-6 md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-100">Clinical Alerts</h3>
          </div>
          <p className="text-slate-300">
            Real-time clinical alerts and recommendations based on patient data
          </p>
        </div>
      </div>
    </div>
  )
} 