import { Search } from "lucide-react"

export default function SearchMembers() {
  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-teal-300" />
      <input
        type="text"
        placeholder="Search members..."
        className="w-full pl-10 pr-4 py-2 rounded-md bg-teal-800/50 text-teal-100 placeholder:text-teal-300 border border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  )
} 