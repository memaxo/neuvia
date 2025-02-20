"use client"

import { 
  Activity,
  Upload,
  FileText,
  CheckCircle,
  Eye
} from "lucide-react"
import { cn } from "@/lib/utils"

const activities = [
  {
    id: 1,
    type: "Upload",
    description: "New scan uploaded for Jane Doe",
    timestamp: "2 hours ago",
    icon: Upload,
    category: "file"
  },
  {
    id: 2,
    type: "Analysis",
    description: "Analysis completed for John Smith",
    timestamp: "4 hours ago",
    icon: Activity,
    category: "process"
  },
  {
    id: 3,
    type: "Report",
    description: "Report generated for Alice Johnson",
    timestamp: "Yesterday",
    icon: FileText,
    category: "document"
  },
  {
    id: 4,
    type: "Review",
    description: "Dr. Wilson reviewed Bob's case",
    timestamp: "2 days ago",
    icon: Eye,
    category: "action"
  },
]

const categoryColors = {
  file: "from-blue-500/20 to-blue-500/5",
  process: "from-green-500/20 to-green-500/5",
  document: "from-purple-500/20 to-purple-500/5",
  action: "from-amber-500/20 to-amber-500/5"
}

export function RecentActivity() {
  return (
    <div className="card-premium rounded-lg">
      <div className="card-premium-header">
        <div className="card-premium-header-content">
          <h3 className="card-premium-title">Recent Activity</h3>
          <span className="stat-label">Last 48 hours</span>
        </div>
      </div>
      <div className="card-premium-content">
        <div className="relative">
          <div className="absolute top-0 bottom-0 left-[27px] w-px bg-white/10" />
          <div className="space-y-2">
            {activities.map((activity) => {
              const Icon = activity.icon
              return (
                <div
                  key={activity.id}
                  className={cn(
                    "relative flex items-start gap-3 p-3 rounded-lg",
                    "bg-black/20",
                    "border border-white/5 hover:border-white/10",
                    "transition-all duration-300",
                    "hover:translate-x-1",
                    "cursor-pointer group"
                  )}
                >
                  <div className="flex-shrink-0 z-10">
                    <div className="flex items-center justify-center w-[32px] h-[32px] rounded-full bg-black/40 border border-white/10">
                      <Icon className="h-4 w-4 text-white/80" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white/90 group-hover:text-white">
                        {activity.type}
                      </p>
                      <span className="stat-label tabular-nums">
                        {activity.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-white/70 mt-0.5 group-hover:text-white/80">
                      {activity.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
} 