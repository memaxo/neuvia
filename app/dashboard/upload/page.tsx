import { DashboardHeader } from "../components/dashboard-header"
import { Upload } from "lucide-react"

export default function UploadPage() {
  return (
    <div className="flex-1 space-y-8">
      <DashboardHeader />
      
      {/* Upload area */}
      <div className="bg-teal-800/50 rounded-lg p-8">
        <div className="border-2 border-dashed border-teal-700 rounded-lg p-12 text-center">
          <Upload className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <h3 className="text-xl font-bold text-slate-100 mb-2">Document Upload Coming Soon</h3>
          <p className="text-slate-300 mb-4">
            Drag and drop medical documents or click to browse
          </p>
          <button className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-md transition-colors duration-300">
            Select Files
          </button>
          <p className="mt-4 text-sm text-slate-400">
            Supported formats: PDF, DOCX, JPG, PNG
          </p>
        </div>
      </div>

      {/* Recent uploads placeholder */}
      <div className="bg-teal-800/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Recent Uploads</h3>
        <p className="text-slate-300 text-center py-4">
          Your recent document uploads will appear here
        </p>
      </div>
    </div>
  )
} 