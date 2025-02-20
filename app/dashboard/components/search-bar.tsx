"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SearchBar() {
  return (
    <div className="relative w-full max-w-lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <Input
          type="search"
          placeholder="Search patients, reports, or activities..."
          className={cn(
            "w-full bg-black/20 border-white/5",
            "pl-10 pr-4 h-10",
            "text-sm text-white/70 placeholder:text-white/40",
            "focus:ring-2 focus:ring-white/20 focus:border-white/30",
            "transition-all duration-300"
          )}
        />
      </div>
      {/* Quick suggestions - can be expanded later */}
      <div className="absolute top-full left-0 right-0 mt-1 hidden">
        <div className="bg-black/90 backdrop-blur-lg border border-white/5 rounded-lg shadow-lg py-2">
          <div className="px-2 py-1 text-xs text-white/40">Recent Searches</div>
          <div className="hover:bg-spline-blue/10 px-3 py-2 cursor-pointer">
            <div className="text-sm text-white/70">John Smith</div>
            <div className="text-xs text-white/40">Patient #1234</div>
          </div>
        </div>
      </div>
    </div>
  )
} 