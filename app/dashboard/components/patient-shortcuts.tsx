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
    <div className="bg-teal-800 p-6 rounded-lg shadow-lg md:col-span-2">
      <h3 className="text-xl font-bold mb-4 text-white">Patient Shortcuts</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {patients.map((patient) => (
          <Link
            key={patient.id}
            href={`/dashboard/patients/${patient.id}`}
            className="flex items-center space-x-3 p-3 rounded-md bg-teal-700/50 hover:bg-teal-700 transition-colors duration-300"
          >
            <div className="flex-shrink-0">
              <User className="h-5 w-5 text-teal-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cyan-500">{patient.name}</p>
              <p className="text-xs text-teal-300 truncate">{patient.status}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
} 