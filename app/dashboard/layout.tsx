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
		<div className="flex h-screen bg-black">
			<div className="absolute inset-0 z-0">
				<DashboardBackground />
			</div>
			<div className="relative z-10 flex w-full">
				<DashboardSidebar />
				<main className="flex-1 overflow-y-auto p-8">
					{children}
				</main>
			</div>
		</div>
	)
}