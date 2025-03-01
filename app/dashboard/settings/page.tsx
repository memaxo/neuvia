import {
  Bell,
  Database,
  Lock,
  Palette,
  User,
  Workflow,
  Settings as _,
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
    <div className="relative flex-1">
      {/* Background layer */}
      <div className="absolute inset-0 bg-[rgb(var(--background))] shadow-2xl" />

      {/* Content stack */}
      <div className="relative space-y-6 p-6">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-[rgb(var(--primary-light))] via-[rgb(var(--primary))] to-[rgb(var(--primary-dark))] bg-clip-text text-3xl font-extrabold text-transparent">
                Settings
              </h1>
              <p className="mt-2 text-sm text-[rgb(var(--foreground))/var(--opacity-70)]">
                Manage your account and application preferences
              </p>
            </div>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {settingsSections.map((section) => {
            const Component = section.component
            return (
              <div
                className="relative overflow-hidden rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] backdrop-blur-sm"
                key={section.id}
              >
                {/* Section Header */}
                <div className="border-b border-[rgb(var(--border))/var(--opacity-10)] p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[rgb(var(--primary))/var(--opacity-10)] p-2.5">
                      <section.icon className="size-5 text-[rgb(var(--primary))]" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-[rgb(var(--foreground))]">
                        {section.title}
                      </h2>
                      <p className="text-sm text-[rgb(var(--foreground))/var(--opacity-70)]">
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
    </div>
  )
}
