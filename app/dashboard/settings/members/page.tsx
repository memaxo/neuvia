import React from "react"
import MemberTable from "./components/MemberTable"
import SearchMembers from "./components/SearchMembers"
import CreateMember from "./components/create/CreateMember"
import { DashboardHeader } from "../../components/dashboard-header"

export default function MembersPage() {
  return (
    <div className="flex-1 space-y-8">
      <DashboardHeader />
      
      <div className="space-y-6">
        {/* Header section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-teal-100">Team Members</h2>
            <p className="text-teal-300">Manage team members and their roles</p>
          </div>
          <CreateMember />
        </div>

        {/* Search and table */}
        <div className="space-y-4">
          <SearchMembers />
          <div className="bg-teal-800/50 rounded-lg">
            <MemberTable />
          </div>
        </div>
      </div>
    </div>
  )
} 