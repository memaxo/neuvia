import { Upload, FileType, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UploadZone } from "./components/upload-zone"
import { RecentUploads } from "./components/recent-uploads"
import { UploadGuidelines } from "./components/upload-guidelines"

export default function UploadPage() {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            Upload Scans
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Upload and manage patient scan files
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upload Zone */}
        <div className="xl:col-span-2 space-y-6">
          {/* Upload Area */}
          <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
                Upload Files
              </h2>
            </div>
            <div className="p-6">
              <UploadZone />
            </div>
          </div>

          {/* Recent Uploads */}
          <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
                Recent Uploads
              </h2>
            </div>
            <div className="p-6">
              <RecentUploads />
            </div>
          </div>
        </div>

        {/* Guidelines Sidebar */}
        <div className="xl:col-span-1">
          <div className="sticky top-6">
            <UploadGuidelines />
          </div>
        </div>
      </div>
    </div>
  )
} 