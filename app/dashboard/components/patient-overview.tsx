"use client"

import { mockPatientDistribution, mockAppointments } from "./types"
import { PieChart } from "./visualizations/pie-chart"
import { MiniCalendar } from "./visualizations/mini-calendar"
import { Button } from "@/components/ui/button"

export function PatientOverview() {
  return (
    <div className="card-premium rounded-lg">
      <div className="card-premium-header">
        <div className="card-premium-header-content">
          <h3 className="card-premium-title">Patient Overview</h3>
          <Button
            variant="ghost"
            size="sm"
            className="card-premium-action"
          >
            View All
          </Button>
        </div>
      </div>
      <div className="card-premium-content">
        <div className="card-premium-grid grid-cols-2">
          {/* Patient Distribution */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <PieChart data={mockPatientDistribution} size={80} />
              <div className="flex-1">
                <h4 className="text-[10px] font-medium text-white/70 mb-2">Distribution</h4>
                <div className="space-y-1.5">
                  {mockPatientDistribution.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="stat-label">{item.status}</span>
                      </div>
                      <span className="stat-label font-medium">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mini Calendar */}
          <div>
            <MiniCalendar appointments={mockAppointments} />
          </div>
        </div>
      </div>
    </div>
  )
} 