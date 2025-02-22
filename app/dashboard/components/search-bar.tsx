'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export function SearchBar() {
  return (
    <div className="group relative w-full max-w-lg">
      <div className="relative">
        {/* Enhanced search input */}
        <div className="relative overflow-hidden rounded-xl backdrop-blur-sm transition-all duration-300 group-focus-within:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
          <Input
            type="search"
            placeholder="Search patients, reports, or activities..."
            className={cn(
              'w-full border-white/5 bg-black/40 group-focus-within:border-cyan-500/30',
              'h-11 pl-11 pr-4',
              'text-base text-white/70 placeholder:text-white/40',
              'focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20',
              'transition-all duration-300'
            )}
          />

          {/* Enhanced scanning line effect */}
          <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-focus-within:opacity-100">
            <div className="group-focus-within:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          </div>
        </div>
      </div>

      {/* Enhanced quick suggestions panel */}
      <div className="absolute inset-x-0 top-full mt-2 hidden group-focus-within:block">
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/60 py-3 shadow-lg backdrop-blur-xl">
          {/* Section: Recent Searches */}
          <div className="px-3 py-1.5">
            <div className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-sm font-medium text-transparent">
              Recent Searches
            </div>
          </div>

          {/* Enhanced suggestion items */}
          <div className="mt-1">
            <div className="group/item relative cursor-pointer px-3 py-2 transition-all duration-300 hover:bg-black/40">
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover/item:opacity-100" />

              {/* Content */}
              <div className="relative z-10">
                <div className="text-sm font-medium text-white/90 transition-colors duration-300 group-hover/item:text-white">
                  John Smith
                </div>
                <div className="text-xs text-white/50 transition-colors duration-300 group-hover/item:text-white/70">
                  Patient #1234
                </div>
              </div>

              {/* Scanning line effect */}
              <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover/item:opacity-100">
                <div className="group-hover/item:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
