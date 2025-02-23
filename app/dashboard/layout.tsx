import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import React from 'react'

import { readUserSession } from '@/utils/actions'

import DashboardBackground from './components/dashboard-background'

export const dynamic = 'force-dynamic'
import { DashboardSidebar } from './components/dashboard-sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: userSession } = await readUserSession()
  const h = await getHeaders()
  const nonce = h.get('x-nonce') || undefined

  if (!userSession.session) {
    return redirect('/auth')
  }

  return (
    <div className="relative isolate grid min-h-screen grid-cols-1 overflow-hidden bg-transparent">
      {/* Background wrapper - using grid layering instead of absolute */}
      <div className="fixed inset-0 -z-10">
        <DashboardBackground nonce={nonce} />
      </div>

      {/* Subtle gradient overlay */}
      <div className="-z-5 fixed inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30 backdrop-blur-[1px]" />

      {/* Main content wrapper */}
      <div className="relative z-10 flex">
        {/* Sidebar */}
        <div className="flex-none border-r border-white/10 bg-black/20 shadow-lg backdrop-blur-xl transition-all duration-300">
          <DashboardSidebar />
        </div>

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-transparent">
          <div className="mx-auto max-w-7xl space-y-6 p-4 md:space-y-8 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}