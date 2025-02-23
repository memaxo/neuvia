import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

import { DashboardSidebar } from './components/dashboard-sidebar'
import DashboardBackground from './components/dashboard-background'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[rgb(var(--background))]">
      {/* Background layer */}
      <div className="fixed inset-0 z-0">
        <DashboardBackground />
      </div>

      {/* Content layer */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <DashboardSidebar />
          <main className="flex-1">
            {children}
          </main>
        </div>
        <SiteFooter />
      </div>
    </div>
  )
}