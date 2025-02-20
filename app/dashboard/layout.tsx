import React from "react"
import { readUserSession } from "@/utils/actions"
import { redirect } from "next/navigation"
import { DashboardSidebar } from "./components/dashboard-sidebar"
import DashboardBackground from "./components/dashboard-background"

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const { data: userSession } = await readUserSession()

	if (!userSession.session) {
		return redirect("/auth")
	}

	return (
		<div className="grid grid-cols-1 min-h-screen bg-black relative isolate overflow-hidden">
			{/* Background wrapper - using grid layering instead of absolute */}
			<div className="col-start-1 row-start-1 row-span-full">
				<DashboardBackground />
			</div>

			{/* Subtle gradient overlay */}
			<div className="col-start-1 row-start-1 row-span-full bg-gradient-to-b from-black/40 via-black/20 to-black/40 backdrop-blur-[2px]" />

			{/* Main content wrapper */}
			<div className="col-start-1 row-start-1 row-span-full flex">
				{/* Sidebar */}
				<div className="flex-none transition-all duration-300 shadow-lg backdrop-blur-xl bg-black/30 border-r border-white/10">
					<DashboardSidebar />
				</div>

				{/* Main content */}
				<main className="flex-1 min-w-0 overflow-y-auto">
					<div className="px-4 py-4 md:px-6 md:py-6 mx-auto max-w-7xl space-y-6 md:space-y-8">
						{children}
					</div>
				</main>
			</div>
		</div>
	)
}