"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { signUpWithEmailAndPassword, signInWithGoogle } from '@/app/auth/actions'
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTransition, useState } from "react";
import { AuthTokenResponse } from "@supabase/supabase-js";
import { Eye, EyeOff, Check, X } from "lucide-react";

const RegisterSchema = z
	.object({
		email: z.string().email({ message: "Please enter a valid email address" }),
		password: z.string().min(8, {
			message: "Password must be at least 8 characters long",
		}).regex(/[0-9]/, {
			message: "Password must contain at least one number",
		}).regex(/[^a-zA-Z0-9]/, {
			message: "Password must contain at least one special character",
		}).regex(/[A-Z]/, {
			message: "Password must contain at least one uppercase letter",
		}).regex(/[a-z]/, {
			message: "Password must contain at least one lowercase letter",
		}),
		confirm: z.string(),
	})
	.refine((data) => data.confirm === data.password, {
		message: "Passwords do not match",
		path: ["confirm"],
	});

const passwordRequirements = [
	{ label: "At least 8 characters long", regex: /.{8,}/ },
	{ label: "Contains at least one number", regex: /[0-9]/ },
	{ label: "Contains at least one special character", regex: /[^a-zA-Z0-9]/ },
	{ label: "Contains uppercase letter", regex: /[A-Z]/ },
	{ label: "Contains lowercase letter", regex: /[a-z]/ }
];

export default function RegisterForm() {
	const [isPending, startTransition] = useTransition();
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);

	const form = useForm<z.infer<typeof RegisterSchema>>({
		resolver: zodResolver(RegisterSchema),
		defaultValues: {
			email: "",
			password: "",
			confirm: "",
		},
		mode: "onChange",
	});

	const password = form.watch("password");

	function onSubmit(data: z.infer<typeof RegisterSchema>) {
		startTransition(async () => {
			const { error } = JSON.parse(
				await signUpWithEmailAndPassword(data)
			) as AuthTokenResponse;
		
			if (error) {
				toast({
					variant: "destructive",
					title: "Registration failed",
					description: error.message,
				});
			} else {
				toast({
					title: "Welcome to Neuvia! 🎉",
					description: "Your account has been created successfully. Please check your email to verify your account.",
				});
			}
		});
	}

	async function handleGoogleSignUp() {
		setIsGoogleLoading(true);
		await signInWithGoogle();
		setIsGoogleLoading(false);
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="w-full space-y-4"
			>
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-foreground/70 font-medium">Email</FormLabel>
							<FormControl>
								<div className="relative group">
									<Input
										placeholder="email@example.com"
										className="bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground/50 
                      focus:border-primary/50 focus:ring-primary/25 
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] 
                      hover:border-border
                      transition-all duration-200"
										{...field}
										type="email"
									/>
									<div className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/0 via-primary/0 to-secondary/0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" style={{ padding: '1px' }} />
								</div>
							</FormControl>
							<FormMessage className="text-destructive text-sm animate-fade-down" />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-foreground/70 font-medium">Password</FormLabel>
							<FormControl>
								<div className="relative group">
									<Input
										placeholder="Create a strong password"
										type={showPassword ? "text" : "password"}
										className="bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground/50 
                      focus:border-primary/50 focus:ring-primary/25 
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]
                      hover:border-border pr-10
                      transition-all duration-200"
										{...field}
										onFocus={() => setShowPasswordRequirements(true)}
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:text-foreground transition-colors p-1 rounded-md hover:bg-background/10"
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
									<div className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/0 via-primary/0 to-secondary/0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" style={{ padding: '1px' }} />
								</div>
							</FormControl>
							<FormMessage className="text-destructive text-sm animate-fade-down" />
							{showPasswordRequirements && (
								<div className="text-xs space-y-1.5 text-muted-foreground bg-background/40 p-3 rounded-md mt-2 animate-fade-down border border-border/50">
									{passwordRequirements.map((req, index) => (
										<p key={index} className="flex items-center gap-2">
											{req.regex.test(password) ? (
												<Check className="h-3 w-3 text-emerald-500" />
											) : (
												<X className="h-3 w-3 text-destructive/70" />
											)}
											<span className={cn(
												req.regex.test(password) ? "text-emerald-500" : "text-muted-foreground"
											)}>{req.label}</span>
										</p>
									))}
								</div>
							)}
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="confirm"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="text-foreground/70 font-medium">Confirm Password</FormLabel>
							<FormControl>
								<div className="relative group">
									<Input
										placeholder="Confirm your password"
										type={showConfirmPassword ? "text" : "password"}
										className="bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground/50 
                      focus:border-primary/50 focus:ring-primary/25 
                      shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]
                      hover:border-border pr-10
                      transition-all duration-200"
										{...field}
									/>
									<button
										type="button"
										onClick={() => setShowConfirmPassword(!showConfirmPassword)}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:text-foreground transition-colors p-1 rounded-md hover:bg-background/10"
									>
										{showConfirmPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
									<div className="absolute inset-0 rounded-md bg-gradient-to-r from-primary/0 via-primary/0 to-secondary/0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" style={{ padding: '1px' }} />
								</div>
							</FormControl>
							<FormMessage className="text-destructive text-sm animate-fade-down" />
						</FormItem>
					)}
				/>

				<Button
					type="submit"
					disabled={isPending}
					className="w-full bg-gradient-to-r from-primary to-primary-foreground hover:from-primary/90 hover:to-primary-foreground/90 
          text-primary-foreground font-medium py-5 rounded-lg transition-all duration-300 
          transform hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(var(--primary),0.3)]
          focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background
          disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:transform-none"
				>
					{isPending ? (
						<div className="flex items-center justify-center gap-2">
							<AiOutlineLoading3Quarters className="animate-spin" />
							<span className="animate-pulse">Creating account...</span>
						</div>
					) : (
						"Create Account"
					)}
				</Button>
			</form>

			<div className="mt-4">
				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<span className="w-full border-t border-border/50" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-background px-2 text-muted-foreground">
							Or continue with
						</span>
					</div>
				</div>
				<Button
					type="button"
					onClick={handleGoogleSignUp}
					disabled={isGoogleLoading}
					className="w-full flex items-center gap-2 bg-background/20 border-border/50 text-foreground hover:bg-background/30 hover:border-border focus:ring-2 focus:ring-primary/25 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200"
				>
					{isGoogleLoading ? (
						<AiOutlineLoading3Quarters className="mr-2 h-4 w-4 animate-spin" />
					) : (
						<svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
							<path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
						</svg>
					)}
					Continue with Google
				</Button>
			</div>
		</Form>
	);
}
