"use client"

import Link from "next/link"
import { User } from "lucide-react"

const patients = [
  { id: 1, name: "Jane Doe", status: "Recent Upload" },
  { id: 2, name: "John Smith", status: "High Risk" },
  { id: 3, name: "Alice Johnson", status: "Follow Up" },
  { id: 4, name: "Bob Williams", status: "New Patient" }
]

export function PatientShortcuts() {
  return (
    <div className="bg-black/30 backdrop-blur-lg border border-spline-cyan/10 p-6 rounded-lg shadow-spline md:col-span-2">
      <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-spline-cyan to-spline-blue bg-clip-text text-transparent">Patient Shortcuts</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patients.map((patient) => (
          <Link
            key={patient.id}
            href={`/dashboard/patients/${patient.id}`}
            className="flex items-center space-x-3 p-3 rounded-md bg-spline-blue/10 hover:bg-spline-blue/20 transition-all duration-300 group"
          >
            <div className="flex-shrink-0">
              <User className="h-5 w-5 text-white/70 group-hover:text-spline-cyan transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-spline-cyan group-hover:text-spline-cyan/80 transition-colors">{patient.name}</p>
              <p className="text-xs text-white/50 group-hover:text-white/70 transition-colors truncate">{patient.status}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
} 