"use client"

import { useState } from "react"
import { User, Upload, Search, BarChart2, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const tabs = [
  { name: "Dashboard", icon: BarChart2, href: "/dashboard" },
  { name: "Patients", icon: User, href: "/dashboard/patients" },
  { name: "Document Upload", icon: Upload, href: "/dashboard/upload" },
  { name: "Insights", icon: Search, href: "/dashboard/insights" },
  { name: "Settings", icon: Settings, href: "/dashboard/settings" }
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-teal-900 p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-teal-50">Neuvia</h1>
      </div>
      <nav>
        <ul className="space-y-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = pathname === tab.href
            
            return (
              <li key={tab.name}>
                <Link
                  href={tab.href}
                  className={`w-full text-left py-2 px-4 rounded transition-colors duration-300 flex items-center ${
                    isActive ? "bg-teal-800 text-white" : "text-teal-100 hover:bg-teal-800"
                  }`}
                >
                  <Icon className="inline-block mr-2 h-5 w-5" />
                  {tab.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
} 