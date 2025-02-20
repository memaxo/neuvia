"use client"

export function QuickStats() {
  return (
    <div className="bg-black/30 backdrop-blur-lg border border-spline-cyan/10 p-6 rounded-lg shadow-spline">
      <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-spline-cyan to-spline-blue bg-clip-text text-transparent">Quick Stats</h3>
      <ul className="space-y-2 text-white/80">
        <li className="flex justify-between items-center">
          <span>Total Patients</span>
          <span className="font-semibold text-spline-cyan">1,234</span>
        </li>
        <li className="flex justify-between items-center">
          <span>Pending Uploads</span>
          <span className="font-semibold text-spline-blue">5</span>
        </li>
        <li className="flex justify-between items-center">
          <span>High-Risk Patients</span>
          <span className="font-semibold text-spline-magenta">12</span>
        </li>
      </ul>
    </div>
  )
} 