"use client";
import { logout } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import React, { useTransition } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { toast } from "@/components/ui/use-toast";

export default function SignOut() {
	const [isPending, startTransition] = useTransition();

	const onSubmit = async () => {
		startTransition(async () => {
			try {
				await logout();
				toast({
					title: "Successfully logged out",
				});
			} catch (error) {
				toast({
					title: "Error logging out",
					description: "Please try again",
					variant: "destructive",
				});
			}
		});
	};

	return (
		<form action={onSubmit}>
			<Button
				className="w-full flex items-center gap-2"
				variant="outline"
				disabled={isPending}
			>
				{isPending ? "Signing out..." : "Sign Out"}{" "}
				<AiOutlineLoading3Quarters
					className={cn("animate-spin", { hidden: !isPending })}
				/>
			</Button>
		</form>
	);
}