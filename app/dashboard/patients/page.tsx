import { Filter, PlusCircle, Search, SlidersHorizontal } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { PatientFilters } from './components/patient-filters'
import { PatientList } from './components/patient-list'

// Mock data for development
const mockPatients = [
  {
    id: 'P1001',
    name: 'John Smith',
    status: 'Stable' as const,
    riskLevel: 25,
    lastActivity: '2 hours ago',
    nextAppointment: 'Tomorrow at 10:00 AM',
  },
  {
    id: 'P1002',
    name: 'Sarah Johnson',
    status: 'At Risk' as const,
    riskLevel: 65,
    lastActivity: '1 day ago',
    nextAppointment: 'Next week',
  },
  {
    id: 'P1003',
    name: 'Michael Brown',
    status: 'Critical' as const,
    riskLevel: 85,
    lastActivity: '30 minutes ago',
  },
  {
    id: 'P1004',
    name: 'Emma Wilson',
    status: 'New' as const,
    riskLevel: 40,
    lastActivity: 'Just now',
    nextAppointment: 'Friday at 2:00 PM',
  },
]

export default function PatientsPage() {
  return (
    <div className="flex-1">
      {/* Main content and sidebar layout */}
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Main content area with padding */}
        <div className="relative flex-1 space-y-6 p-6">
          {/* Background layer for content area */}
          <div className="absolute inset-0 bg-[rgb(var(--background))] shadow-2xl" />

          {/* Content stack */}
          <div className="relative space-y-6">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] backdrop-blur-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="bg-gradient-to-r from-[rgb(var(--primary-light))] via-[rgb(var(--primary))] to-[rgb(var(--primary-dark))] bg-clip-text text-3xl font-extrabold text-transparent">
                    Patients
                  </h1>
                  <p className="mt-2 text-sm text-[rgb(var(--foreground))/var(--opacity-70)]">
                    Manage and monitor patient records
                  </p>
                </div>
                <Button className="group relative overflow-hidden bg-[rgb(var(--primary))] text-white shadow-lg transition-all duration-normal hover:bg-[rgb(var(--primary-dark))] hover:shadow-[0_0_30px_rgba(var(--primary),0.3)]">
                  <PlusCircle className="mr-2 size-4" />
                  Add New Patient
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  </div>
                </Button>
              </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] backdrop-blur-sm p-6">
              <div className="flex items-center gap-4">
                {/* Search Input */}
                <div className="group relative flex-1">
                  <div className="relative overflow-hidden rounded-xl backdrop-blur-sm transition-all duration-normal group-focus-within:shadow-[0_0_30px_rgba(var(--primary),0.1)]">
                    <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--foreground))/var(--opacity-40)] transition-colors duration-normal group-focus-within:text-[rgb(var(--primary))]" />
                    <Input
                      className="h-11 w-full border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] pl-11 text-base text-[rgb(var(--foreground))/var(--opacity-70)] transition-all duration-normal placeholder:text-[rgb(var(--foreground))/var(--opacity-40)] focus:border-[rgb(var(--primary))/var(--opacity-30)] focus:ring-2 focus:ring-[rgb(var(--primary))/var(--opacity-20)]"
                      placeholder="Search patients by name, ID, or status..."
                      type="search"
                    />
                    <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-normal group-focus-within:opacity-100">
                      <div className="group-focus-within:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary))/var(--opacity-60)] to-transparent" />
                    </div>
                  </div>
                </div>

                {/* Filter Buttons */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="size-11 rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] text-[rgb(var(--foreground))/var(--opacity-60)] transition-all duration-normal hover:border-[rgb(var(--primary))/var(--opacity-30)] hover:bg-[rgb(var(--background))/var(--opacity-60)] hover:text-[rgb(var(--foreground))] hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                        size="icon"
                        variant="ghost"
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
                        className="size-11 rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] text-[rgb(var(--foreground))/var(--opacity-60)] transition-all duration-normal hover:border-[rgb(var(--primary))/var(--opacity-30)] hover:bg-[rgb(var(--background))/var(--opacity-60)] hover:text-[rgb(var(--foreground))] hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                        size="icon"
                        variant="ghost"
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
            <div className="relative overflow-hidden rounded-xl border border-[rgb(var(--border))/var(--opacity-10)] bg-[rgb(var(--background))/var(--opacity-40)] backdrop-blur-sm">
              <div className="flex">
                {/* Filters Sidebar */}
                <div className="hidden w-[280px] border-r border-[rgb(var(--border))/var(--opacity-10)] p-6 xl:block">
                  <PatientFilters />
                </div>

                {/* Patient List */}
                <div className="flex-1 p-6">
                  <PatientList patients={mockPatients} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating action button */}
      <Link
        className={buttonVariants({
          className: cn(
            'fixed bottom-6 right-6 flex items-center gap-2 rounded-full',
            'bg-[rgb(var(--primary))] text-white shadow-lg',
            'transition-all duration-normal',
            'hover:bg-[rgb(var(--primary-dark))] hover:shadow-xl'
          )
        })}
        href={'/dashboard/patients/new' as Route}
      >
        <PlusCircle className="size-4" />
        <span className="text-sm font-medium">Add Patient</span>
      </Link>
    </div>
  )
}
