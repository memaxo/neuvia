'use client'

import { format, isSameDay } from 'date-fns'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { Appointment } from '../types'

interface MiniCalendarProps {
  appointments: Appointment[]
}

export function MiniCalendar({ appointments }: MiniCalendarProps) {
  const today = new Date()
  const upcomingDays = Array.from({ length: 4 }, (_, i) => {
    const date = new Date()
    date.setDate(today.getDate() + i)
    return date
  })

  return (
    <div className="space-y-0.5">
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-xs font-medium text-white/70">
          Upcoming Appointments
        </h4>
        <div className="flex items-center gap-1">
          <Button
            className="h-5 px-1.5 text-[10px] text-white/60 hover:text-white"
            size="sm"
            variant="ghost"
          >
            Week
          </Button>
          <Button
            className="h-5 px-1.5 text-[10px] text-white/60 hover:text-white"
            size="sm"
            variant="ghost"
          >
            Month
          </Button>
        </div>
      </div>
      {upcomingDays.map((date) => {
        const dayAppointments = appointments.filter((apt) =>
          isSameDay(new Date(apt.date), date)
        )

        return (
          <div
            className={cn(
              'flex items-start gap-1.5 rounded px-1.5 py-1',
              isSameDay(date, today) ? 'bg-[#4B6BFD]/10' : 'hover:bg-black/20'
            )}
            key={date.toISOString()}
          >
            <div className="w-6 flex-none text-center">
              <div className="text-[10px] text-white/40">
                {format(date, 'EEE')}
              </div>
              <div className="text-[10px] font-medium text-white/70">
                {format(date, 'd')}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {dayAppointments.length > 0 ? (
                <div className="space-y-0.5">
                  {dayAppointments.map((apt) => (
                    <div
                      className="truncate text-[10px] text-white/60 hover:text-white/80"
                      key={apt.id}
                    >
                      {apt.patientName} - {apt.type}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] italic text-white/40">
                  No appointments
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
