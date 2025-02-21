import { Upload as _, FileType as __, AlertCircle as ___ } from 'lucide-react'
import { Button as ____ } from '@/components/ui/button'
import { RecentUploads } from './components/recent-uploads'
import { UploadGuidelines } from './components/upload-guidelines'
import { UploadZone } from './components/upload-zone'

export default function UploadPage() {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-3xl font-extrabold text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            Upload Scans
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Upload and manage patient scan files
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Upload Zone */}
        <div className="space-y-6 xl:col-span-2">
          {/* Upload Area */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
            <div className="border-b border-white/5 p-6">
              <h2 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-xl font-semibold text-transparent">
                Upload Files
              </h2>
            </div>
            <div className="p-6">
              <UploadZone />
            </div>
          </div>

          {/* Recent Uploads */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl">
            <div className="border-b border-white/5 p-6">
              <h2 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-xl font-semibold text-transparent">
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
