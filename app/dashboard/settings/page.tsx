import {
  Settings as _,
  Bell,
  Database,
  Lock,
  Palette,
  User,
  Workflow,
} from 'lucide-react'
import { AccountSettings } from './components/account-settings'
import { AppearanceSettings } from './components/appearance-settings'
import { DataSettings } from './components/data-settings'
import { NotificationSettings } from './components/notification-settings'
import { SecuritySettings } from './components/security-settings'
import { WorkflowSettings } from './components/workflow-settings'

const settingsSections = [
  {
    id: 'account',
    title: 'Account',
    description: 'Manage your account settings and preferences',
    icon: User,
    component: AccountSettings,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Configure how you receive notifications',
    icon: Bell,
    component: NotificationSettings,
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Update your security preferences',
    icon: Lock,
    component: SecuritySettings,
  },
  {
    id: 'data',
    title: 'Data Management',
    description: 'Control your data and privacy settings',
    icon: Database,
    component: DataSettings,
  },
  {
    id: 'workflow',
    title: 'Workflow',
    description: 'Customize your workflow preferences',
    icon: Workflow,
    component: WorkflowSettings,
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Customize the look and feel of the app',
    icon: Palette,
    component: AppearanceSettings,
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-3xl font-extrabold text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            Settings
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Manage your account and application preferences
          </p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {settingsSections.map((section) => {
          const Component = section.component
          return (
            <div
              key={section.id}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl"
            >
              {/* Section Header */}
              <div className="border-b border-white/5 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 p-2.5">
                    <section.icon className="size-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-xl font-semibold text-transparent">
                      {section.title}
                    </h2>
                    <p className="text-sm text-white/70">
                      {section.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Section Content */}
              <div className="p-6">
                <Component />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
