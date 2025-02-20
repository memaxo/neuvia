"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SearchBar() {
  return (
    <div className="relative w-full max-w-lg group">
      <div className="relative">
        {/* Enhanced search input */}
        <div className="relative overflow-hidden rounded-xl backdrop-blur-sm transition-all duration-300
                    group-focus-within:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 
                           group-focus-within:text-cyan-400 transition-colors duration-300" />
          <Input
            type="search"
            placeholder="Search patients, reports, or activities..."
            className={cn(
              "w-full bg-black/40 border-white/5 group-focus-within:border-cyan-500/30",
              "pl-11 pr-4 h-11",
              "text-base text-white/70 placeholder:text-white/40",
              "focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30",
              "transition-all duration-300"
            )}
          />
          
          {/* Enhanced scanning line effect */}
          <div className="absolute inset-0 overflow-hidden opacity-0 group-focus-within:opacity-100 transition-opacity duration-300">
            <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-focus-within:animate-scan" />
          </div>
        </div>
      </div>

      {/* Enhanced quick suggestions panel */}
      <div className="absolute top-full left-0 right-0 mt-2 hidden group-focus-within:block">
        <div className="relative overflow-hidden rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-lg py-3">
          {/* Section: Recent Searches */}
          <div className="px-3 py-1.5">
            <div className="text-sm font-medium bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
              Recent Searches
            </div>
          </div>
          
          {/* Enhanced suggestion items */}
          <div className="mt-1">
            <div className="group/item relative px-3 py-2 hover:bg-black/40 cursor-pointer transition-all duration-300">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" />
              
              {/* Content */}
              <div className="relative z-10">
                <div className="text-sm text-white/90 font-medium group-hover/item:text-white transition-colors duration-300">
                  John Smith
                </div>
                <div className="text-xs text-white/50 group-hover/item:text-white/70 transition-colors duration-300">
                  Patient #1234
                </div>
              </div>

              {/* Scanning line effect */}
              <div className="absolute inset-0 overflow-hidden opacity-0 group-hover/item:opacity-100 transition-opacity duration-300">
                <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-hover/item:animate-scan" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 