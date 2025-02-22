import { Search } from 'lucide-react'

export default function SearchMembers() {
  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-teal-300" />
      <input
        type="text"
        placeholder="Search members..."
        className="w-full rounded-md border border-teal-700 bg-teal-800/50 py-2 pl-10 pr-4 text-teal-100 placeholder:text-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    </div>
  )
}
