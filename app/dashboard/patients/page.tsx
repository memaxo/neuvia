import { Filter, PlusCircle, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PatientFilters } from './components/patient-filters'
import { PatientList } from './components/patient-list'

export default function PatientsPage() {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-3xl font-extrabold text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            Patients
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Manage and monitor patient records
          </p>
        </div>
        <Button className="group relative overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg transition-all duration-300 hover:from-cyan-600 hover:to-blue-600 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]">
          <PlusCircle className="mr-2 size-4" />
          Add New Patient
          <div className="absolute inset-0 overflow-hidden">
            <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          {/* Search Input */}
          <div className="group relative flex-1">
            <div className="relative overflow-hidden rounded-xl backdrop-blur-sm transition-all duration-300 group-focus-within:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors duration-300 group-focus-within:text-cyan-400" />
              <Input
                type="search"
                placeholder="Search patients by name, ID, or status..."
                className="h-11 w-full border-white/5 bg-black/40 pl-11 text-base text-white/70 transition-all duration-300 placeholder:text-white/40 focus:border-cyan-500/30 focus:ring-2 focus:ring-cyan-500/20 group-focus-within:border-cyan-500/30"
              />
              <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-focus-within:opacity-100">
                <div className="group-focus-within:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
              </div>
            </div>
          </div>

          {/* Filter Buttons */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-xl border border-white/5 bg-black/40 text-white/60 transition-all duration-300 hover:border-cyan-500/30 hover:bg-black/60 hover:text-white hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]"
                >
                  <Filter className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Filter patients</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-xl border border-white/5 bg-black/40 text-white/60 transition-all duration-300 hover:border-cyan-500/30 hover:bg-black/60 hover:text-white hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]"
                >
                  <SlidersHorizontal className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Advanced filters</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Filters Sidebar */}
        <div className="hidden xl:block">
          <PatientFilters />
        </div>

        {/* Patient List */}
        <div className="xl:col-span-3">
          <PatientList />
        </div>
      </div>
    </div>
  )
}
