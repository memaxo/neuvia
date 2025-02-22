import { AlertTriangle, Cpu, FileText, Search } from 'lucide-react'
import { DashboardHeader } from '../components/dashboard-header'

export default function InsightsPage() {
  return (
    <div className="flex-1 space-y-8">
      <DashboardHeader />

      {/* Search bar */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search medical insights..."
          className="w-full rounded-md border border-teal-700 bg-teal-800/50 py-2 pl-10 pr-4 text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Placeholder content */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-teal-800/50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <Cpu className="size-6 text-teal-400" />
            <h3 className="text-lg font-semibold text-slate-100">
              AI Analysis
            </h3>
          </div>
          <p className="text-slate-300">
            Advanced medical record analysis and insights coming soon
          </p>
        </div>

        <div className="rounded-lg bg-teal-800/50 p-6">
          <div className="mb-4 flex items-center gap-3">
            <FileText className="size-6 text-teal-400" />
            <h3 className="text-lg font-semibold text-slate-100">
              Document Summary
            </h3>
          </div>
          <p className="text-slate-300">
            Automated document summarization and key findings extraction
          </p>
        </div>

        <div className="rounded-lg bg-teal-800/50 p-6 md:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <AlertTriangle className="size-6 text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-100">
              Clinical Alerts
            </h3>
          </div>
          <p className="text-slate-300">
            Real-time clinical alerts and recommendations based on patient data
          </p>
        </div>
      </div>
    </div>
  )
}
