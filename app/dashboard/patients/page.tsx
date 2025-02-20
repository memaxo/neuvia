import { PlusCircle, Search, Filter, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { PatientList } from "./components/patient-list"
import { PatientFilters } from "./components/patient-filters"

export default function PatientsPage() {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            Patients
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Manage and monitor patient records
          </p>
        </div>
        <Button
          className="relative overflow-hidden group bg-gradient-to-r from-cyan-500 to-blue-500 
                   hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg
                   hover:shadow-[0_0_30px_rgba(0,255,255,0.3)] transition-all duration-300"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Patient
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent group-hover:animate-scan" />
          </div>
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-black/30 border border-white/10 p-4">
        <div className="flex items-center gap-4">
          {/* Search Input */}
          <div className="relative flex-1 group">
            <div className="relative overflow-hidden rounded-xl backdrop-blur-sm transition-all duration-300
                        group-focus-within:shadow-[0_0_30px_rgba(0,255,255,0.1)]">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 
                               group-focus-within:text-cyan-400 transition-colors duration-300" />
              <Input
                type="search"
                placeholder="Search patients by name, ID, or status..."
                className="w-full bg-black/40 border-white/5 group-focus-within:border-cyan-500/30
                         pl-11 h-11 text-base text-white/70 placeholder:text-white/40
                         focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30
                         transition-all duration-300"
              />
              <div className="absolute inset-0 overflow-hidden opacity-0 group-focus-within:opacity-100 transition-opacity duration-300">
                <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent group-focus-within:animate-scan" />
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
                  className="h-11 w-11 bg-black/40 hover:bg-black/60 text-white/60 hover:text-white 
                           border border-white/5 hover:border-cyan-500/30 rounded-xl
                           transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]"
                >
                  <Filter className="h-4 w-4" />
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
                  className="h-11 w-11 bg-black/40 hover:bg-black/60 text-white/60 hover:text-white 
                           border border-white/5 hover:border-cyan-500/30 rounded-xl
                           transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,255,255,0.1)]"
                >
                  <SlidersHorizontal className="h-4 w-4" />
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
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
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