"use client"

import { Bell, User } from "lucide-react"
import { usePathname } from "next/navigation"

export function DashboardHeader() {
  const pathname = usePathname()
  const pageTitle = pathname === "/dashboard" 
    ? "Dashboard" 
    : pathname.split("/").pop()?.charAt(0).toUpperCase() + pathname.split("/").pop()?.slice(1)

  return (
    <header className="flex justify-between items-center mb-8">
      <h2 className="text-2xl font-bold text-white">{pageTitle}</h2>
      <div className="flex items-center space-x-4">
        <button className="p-2 rounded-full bg-teal-800 hover:bg-teal-700 transition-colors duration-300">
          <Bell size={20} className="text-white" />
        </button>
        <button className="flex items-center space-x-2 p-2 rounded-full bg-teal-800 hover:bg-teal-700 transition-colors duration-300">
          <User size={20} className="text-white" />
          <span className="text-white">Dr. Smith</span>
        </button>
      </div>
    </header>
  )
} 