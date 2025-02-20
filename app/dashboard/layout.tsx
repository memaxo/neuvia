import React from "react"
import { readUserSession } from "@/utils/actions"
import { redirect } from "next/navigation"
import { DashboardSidebar } from "./components/dashboard-sidebar"

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
		<div className="flex h-screen bg-navy-900">
			<DashboardSidebar />
			<main className="flex-1 overflow-y-auto p-8">
				{children}
			</main>
		</div>
	)
}