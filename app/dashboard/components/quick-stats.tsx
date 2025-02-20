"use client"

export function QuickStats() {
  return (
    <div className="bg-teal-800 p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4 text-white">Quick Stats</h3>
      <ul className="space-y-2 text-teal-100">
        <li className="flex justify-between items-center">
          <span>Total Patients</span>
          <span className="font-semibold">1,234</span>
        </li>
        <li className="flex justify-between items-center">
          <span>Pending Uploads</span>
          <span className="font-semibold">5</span>
        </li>
        <li className="flex justify-between items-center">
          <span>High-Risk Patients</span>
          <span className="font-semibold text-red-400">12</span>
        </li>
      </ul>
    </div>
  )
} 