"use client"

import { useState } from "react"
import { User, Bell, Search, PlusCircle, Upload, BarChart2, Settings } from "lucide-react"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard")

  const tabs = ["Dashboard", "Patients", "Document Upload", "Insights", "Settings"]

  return (
    <div className="flex h-screen bg-navy-900 text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-teal-900 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-teal-50">Neuvia</h1>
        </div>
        <nav>
          <ul className="space-y-4">
            {tabs.map((tab) => (
              <li key={tab}>
                <button
                  onClick={() => setActiveTab(tab)}
                  className={`w-full text-left py-2 px-4 rounded transition-colors duration-300 ${
                    activeTab === tab ? "bg-teal-800 text-white" : "text-teal-100 hover:bg-teal-800"
                  }`}
                >
                  {tab === "Dashboard" && <BarChart2 className="inline-block mr-2 h-5 w-5" />}
                  {tab === "Patients" && <User className="inline-block mr-2 h-5 w-5" />}
                  {tab === "Document Upload" && <Upload className="inline-block mr-2 h-5 w-5" />}
                  {tab === "Insights" && <Search className="inline-block mr-2 h-5 w-5" />}
                  {tab === "Settings" && <Settings className="inline-block mr-2 h-5 w-5" />}
                  {tab}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">{activeTab}</h2>
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full bg-teal-800 hover:bg-teal-700 transition-colors duration-300">
              <Bell size={20} />
            </button>
            <button className="flex items-center space-x-2 p-2 rounded-full bg-teal-800 hover:bg-teal-700 transition-colors duration-300">
              <User size={20} />
              <span>Dr. Smith</span>
            </button>
          </div>
        </header>

        {/* Dashboard content */}
        {activeTab === "Dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-teal-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4">Quick Stats</h3>
              <ul className="space-y-2">
                <li>Total Patients: 1,234</li>
                <li>Pending Uploads: 5</li>
                <li>High-Risk Patients: 12</li>
              </ul>
            </div>
            <div className="bg-teal-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
              <ul className="space-y-2">
                <li>New document added for Jane Doe</li>
                <li>High A1c detected for John Smith</li>
              </ul>
            </div>
            <div className="bg-teal-800 p-6 rounded-lg shadow-lg md:col-span-2">
              <h3 className="text-xl font-bold mb-4">Patient Shortcuts</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <li>
                  <a href="#" className="text-cyan-500 hover:underline">
                    Jane Doe
                  </a>
                </li>
                <li>
                  <a href="#" className="text-cyan-500 hover:underline">
                    John Smith
                  </a>
                </li>
                <li>
                  <a href="#" className="text-cyan-500 hover:underline">
                    Alice Johnson
                  </a>
                </li>
                <li>
                  <a href="#" className="text-cyan-500 hover:underline">
                    Bob Williams
                  </a>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Add New Patient button */}
        <button className="mt-8 flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded transition-colors duration-300">
          <PlusCircle size={20} />
          <span>Add New Patient</span>
        </button>
      </main>
    </div>
  )
}

