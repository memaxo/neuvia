import { Pencil1Icon, TrashIcon } from '@radix-ui/react-icons'
import { Calendar, CircleIcon, Shield, User } from 'lucide-react'

import { Table as _ } from '@/components/ui/Table'
import { Button } from '@/components/ui/button'

// Temporary mock data
const members = [
  {
    id: 1,
    name: 'Dr. Sarah Smith',
    role: 'Admin',
    joined: 'Jan 15, 2024',
    status: 'Active',
  },
  {
    id: 2,
    name: 'Dr. John Doe',
    role: 'Doctor',
    joined: 'Feb 1, 2024',
    status: 'Active',
  },
  {
    id: 3,
    name: 'Jane Wilson',
    role: 'Nurse',
    joined: 'Jan 20, 2024',
    status: 'Pending',
  },
]

export default function MemberTable() {
  return (
    <div className="w-full overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-teal-700">
            <th className="px-4 py-3 text-left font-medium text-slate-300">
              Name
            </th>
            <th className="px-4 py-3 text-left font-medium text-slate-300">
              Role
            </th>
            <th className="px-4 py-3 text-left font-medium text-slate-300">
              Joined
            </th>
            <th className="px-4 py-3 text-left font-medium text-slate-300">
              Status
            </th>
            <th className="px-4 py-3 text-right font-medium text-slate-300">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr
              className="border-b border-teal-700/50 hover:bg-teal-800/30"
              key={member.id}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-teal-700/50">
                    <User className="size-4 text-slate-300" />
                  </div>
                  <span className="text-slate-200">{member.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-teal-400" />
                  <span className="text-slate-200">{member.role}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-slate-300" />
                  <span className="text-slate-200">{member.joined}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <CircleIcon
                    className={`size-3 ${
                      member.status === 'Active'
                        ? 'text-green-400'
                        : 'text-amber-400'
                    }`}
                  />
                  <span className="text-slate-200">{member.status}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    className="text-slate-300 hover:bg-teal-700 hover:text-slate-100"
                    size="sm"
                    variant="ghost"
                  >
                    <Pencil1Icon className="size-4" />
                  </Button>
                  <Button
                    className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                    size="sm"
                    variant="ghost"
                  >
                    <TrashIcon className="size-4" />
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
