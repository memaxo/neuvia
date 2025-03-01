'use client'

import {
  Calendar,
  FileText,
  Info,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Upload,
  User,
  UserPlus,
  Users,
} from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface PatientData {
  id: number
  name: string
  status: 'High Risk' | 'At Risk' | 'Healthy' | 'New Patient' | 'Recent Upload'
  nextAppointment?: string
  lastActivity: string
  riskLevel: number // 0-100
}

const statusConfig = {
  'High Risk': {
    badge: 'status-badge-high-risk',
    icon: Info,
  },
  'At Risk': {
    badge: 'status-badge-at-risk',
    icon: Info,
  },
  Healthy: {
    badge: 'status-badge-stable',
    icon: User,
  },
  'New Patient': {
    badge: 'status-badge-new',
    icon: User,
  },
  'Recent Upload': {
    badge: 'status-badge-new',
    icon: Upload,
  },
}

const getRiskScoreClass = (risk: number): string => {
  if (risk >= 75) return 'risk-score-high'
  if (risk >= 50) return 'risk-score-medium'
  return 'risk-score-low'
}

export function PatientShortcuts() {
  const [patients, setPatients] = useState<PatientData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPatients() {
      try {
        const response = await fetch('/api/patients')
        if (!response.ok) {
          throw new Error('Failed to fetch patients')
        }
        const data = await response.json()
        setPatients(data.patients)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [])

  if (loading) {
    return (
      <div className="p-4 text-center text-[rgb(var(--foreground)/var(--opacity-70))]">
        Loading patients...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-[rgb(var(--error)/var(--opacity-100))]">
        {error}
      </div>
    )
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Add New Patient */}
          <Link href={'/dashboard/patients/new' as Route}>
            <Button
              className="group relative h-24 w-full overflow-hidden border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-40))] transition-all hover:border-[rgb(var(--primary)/var(--opacity-30))] hover:bg-[rgb(var(--background)/var(--opacity-60))] hover:shadow-[0_0_20px_rgba(var(--primary),0.1)]"
              variant="outline"
            >
              <div className="flex flex-col items-center gap-2">
                <UserPlus className="size-5 text-[rgb(var(--primary))]" />
                <span className="text-sm">New Patient</span>
              </div>
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary)/var(--opacity-30))] to-transparent" />
              </div>
            </Button>
          </Link>

          {/* Search Patients */}
          <Link href={'/dashboard/patients' as Route}>
            <Button
              className="group relative h-24 w-full overflow-hidden border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-40))] transition-all hover:border-[rgb(var(--secondary)/var(--opacity-30))] hover:bg-[rgb(var(--background)/var(--opacity-60))] hover:shadow-[0_0_20px_rgba(var(--secondary),0.1)]"
              variant="outline"
            >
              <div className="flex flex-col items-center gap-2">
                <Search className="size-5 text-[rgb(var(--secondary))]" />
                <span className="text-sm">Search</span>
              </div>
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--secondary)/var(--opacity-30))] to-transparent" />
              </div>
            </Button>
          </Link>

          {/* View All Patients */}
          <Link href={'/dashboard/patients' as Route}>
            <Button
              className="group relative h-24 w-full overflow-hidden border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-40))] transition-all hover:border-[rgb(var(--success)/var(--opacity-30))] hover:bg-[rgb(var(--background)/var(--opacity-60))] hover:shadow-[0_0_20px_rgba(var(--success),0.1)]"
              variant="outline"
            >
              <div className="flex flex-col items-center gap-2">
                <Users className="size-5 text-[rgb(var(--success))]" />
                <span className="text-sm">All Patients</span>
              </div>
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--success)/var(--opacity-30))] to-transparent" />
              </div>
            </Button>
          </Link>

          {/* Recent Records */}
          <Link href={'/dashboard/records' as Route}>
            <Button
              className="group relative h-24 w-full overflow-hidden border-[rgb(var(--border)/var(--opacity-10))] bg-[rgb(var(--background)/var(--opacity-40))] transition-all hover:border-[rgb(var(--warning)/var(--opacity-30))] hover:bg-[rgb(var(--background)/var(--opacity-60))] hover:shadow-[0_0_20px_rgba(var(--warning),0.1)]"
              variant="outline"
            >
              <div className="flex flex-col items-center gap-2">
                <FileText className="size-5 text-[rgb(var(--warning))]" />
                <span className="text-sm">Records</span>
              </div>
              <div className="absolute inset-0 overflow-hidden">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-px w-full bg-gradient-to-r from-transparent via-[rgb(var(--warning)/var(--opacity-30))] to-transparent" />
              </div>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
