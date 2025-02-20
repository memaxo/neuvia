import { Button } from "@/components/ui/button"
import { TrashIcon, Pencil1Icon } from "@radix-ui/react-icons"
import Table from "@/components/ui/Table"
import { User, Shield, Calendar, CircleIcon } from "lucide-react"

// Temporary mock data
const members = [
  { id: 1, name: "Dr. Sarah Smith", role: "Admin", joined: "Jan 15, 2024", status: "Active" },
  { id: 2, name: "Dr. John Doe", role: "Doctor", joined: "Feb 1, 2024", status: "Active" },
  { id: 3, name: "Jane Wilson", role: "Nurse", joined: "Jan 20, 2024", status: "Pending" },
]

export default function MemberTable() {
  return (
    <div className="w-full overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-teal-700">
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Name</th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Role</th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Joined</th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Status</th>
            <th className="text-right py-3 px-4 text-slate-300 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-b border-teal-700/50 hover:bg-teal-800/30">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-700/50 flex items-center justify-center">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                  <span className="text-slate-200">{member.name}</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-400" />
                  <span className="text-slate-200">{member.role}</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-300" />
                  <span className="text-slate-200">{member.joined}</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <CircleIcon className={`w-3 h-3 ${
                    member.status === "Active" ? "text-green-400" : "text-amber-400"
                  }`} />
                  <span className="text-slate-200">{member.status}</span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-300 hover:text-slate-100 hover:bg-teal-700"
                  >
                    <Pencil1Icon className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
} 