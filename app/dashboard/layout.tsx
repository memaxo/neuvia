import { redirect } from 'next/navigation'
import React from 'react'

import { readUserSession } from '@/utils/actions'

import DashboardBackground from './components/dashboard-background'
import { DashboardSidebar } from './components/dashboard-sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: userSession } = await readUserSession()

  if (!userSession.session) {
    return redirect('/auth')
  }

  return (
    <div className="relative isolate grid min-h-screen grid-cols-1 overflow-hidden bg-black">
      {/* Background wrapper - using grid layering instead of absolute */}
      <div className="col-start-1 row-span-full row-start-1">
        <DashboardBackground />
      </div>

      {/* Subtle gradient overlay */}
      <div className="col-start-1 row-span-full row-start-1 bg-gradient-to-b from-black/40 via-black/20 to-black/40 backdrop-blur-[2px]" />

      {/* Main content wrapper */}
      <div className="col-start-1 row-span-full row-start-1 flex">
        {/* Sidebar */}
        <div className="flex-none border-r border-white/10 bg-black/30 shadow-lg backdrop-blur-xl transition-all duration-300">
          <DashboardSidebar />
        </div>

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl space-y-6 p-4 md:space-y-8 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
