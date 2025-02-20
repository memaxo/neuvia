import { DashboardHeader } from "../components/dashboard-header"
import { User, Bell, Lock, Database, Users } from "lucide-react"
import Link from "next/link"

const settingsSections = [
  {
    icon: User,
    title: "Profile Settings",
    description: "Update your personal information and preferences",
    href: "/dashboard/settings/profile"
  },
  {
    icon: Users,
    title: "Team Members",
    description: "Manage team members and their roles",
    href: "/dashboard/settings/members"
  },
  {
    icon: Bell,
    title: "Notification Settings",
    description: "Configure your notification preferences",
    href: "/dashboard/settings/notifications"
  },
  {
    icon: Lock,
    title: "Security Settings",
    description: "Manage your security and privacy preferences",
    href: "/dashboard/settings/security"
  },
  {
    icon: Database,
    title: "Data Management",
    description: "Control your data storage and backup settings",
    href: "/dashboard/settings/data"
  }
]

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-8">
      <DashboardHeader />
      
      {/* Settings sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <Link 
              key={section.title}
              href={section.href}
              className="bg-teal-800/50 rounded-lg p-6 hover:bg-teal-800/70 transition-colors duration-300 cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-teal-700/50">
                  <Icon className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-teal-100">{section.title}</h3>
              </div>
              <p className="text-teal-300 pl-11">
                {section.description}
              </p>
            </Link>
          )
        })}
      </div>

      {/* Version info */}
      <div className="text-sm text-teal-400 text-center pt-4">
        Version 1.0.0 • Last updated: {new Date().toLocaleDateString()}
      </div>
    </div>
  )
} 