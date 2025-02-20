"use client"

import { Activity } from "lucide-react"

const activities = [
  {
    id: 1,
    type: "Upload",
    description: "New scan uploaded for Jane Doe",
    timestamp: "2 hours ago",
  },
  {
    id: 2,
    type: "Analysis",
    description: "Analysis completed for John Smith",
    timestamp: "4 hours ago",
  },
  {
    id: 3,
    type: "Report",
    description: "Report generated for Alice Johnson",
    timestamp: "Yesterday",
  },
  {
    id: 4,
    type: "Review",
    description: "Dr. Wilson reviewed Bob's case",
    timestamp: "2 days ago",
  },
]

export function RecentActivity() {
  return (
    <div className="bg-black/30 backdrop-blur-lg border border-spline-cyan/10 p-6 rounded-lg shadow-spline">
      <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-spline-cyan to-spline-blue bg-clip-text text-transparent">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start space-x-3 p-3 rounded-md bg-spline-blue/10 hover:bg-spline-blue/20 transition-all duration-300 group cursor-pointer"
          >
            <div className="flex-shrink-0 mt-1">
              <Activity className="h-5 w-5 text-white/70 group-hover:text-spline-cyan transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-spline-cyan group-hover:text-spline-cyan/80 transition-colors">
                {activity.type}
              </p>
              <p className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
                {activity.description}
              </p>
              <p className="text-xs text-spline-magenta/70 mt-1">
                {activity.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 