"use client"

import { FileText, AlertTriangle } from "lucide-react"

const activities = [
  {
    id: 1,
    text: "New document added for Jane Doe",
    icon: FileText,
    timestamp: "2 hours ago"
  },
  {
    id: 2,
    text: "High A1c detected for John Smith",
    icon: AlertTriangle,
    type: "alert",
    timestamp: "4 hours ago"
  }
]

export function RecentActivity() {
  return (
    <div className="bg-teal-800 p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4 text-white">Recent Activity</h3>
      <ul className="space-y-4">
        {activities.map((activity) => {
          const Icon = activity.icon
          return (
            <li 
              key={activity.id} 
              className="flex items-start space-x-3 text-teal-100"
            >
              <Icon 
                className={`h-5 w-5 mt-1 ${
                  activity.type === "alert" ? "text-amber-400" : "text-teal-100"
                }`} 
              />
              <div className="flex-1">
                <p>{activity.text}</p>
                <span className="text-sm text-teal-300">{activity.timestamp}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
} 