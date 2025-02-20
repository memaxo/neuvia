"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Icons } from "@/components/icons"
import { Button } from "@/components/ui/button";
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
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { cn } from "@/lib/utils";
import { useTransition, useState } from "react";
import { loginWithEmailAndPassword, signInWithGoogle } from "../actions";
import { AuthTokenResponse } from "@supabase/supabase-js";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";

const LoginSchema = z.object({
	email: z.string().email({ message: "Please enter a valid email address" }),
	password: z.string().min(1, { message: "Password cannot be empty" }),
	rememberMe: z.boolean().default(false).optional(),
});

const passwordRequirements = [
	"At least 8 characters long",
	"Contains at least one number",
	"Contains at least one special character",
	"Contains uppercase and lowercase letters"
];

export default function AuthForm() {
	const [isPending, startTransition] = useTransition();
	const [showPassword, setShowPassword] = useState(false);
	const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);

	const form = useForm<z.infer<typeof LoginSchema>>({
		resolver: zodResolver(LoginSchema),
		defaultValues: {
			email: "",
			password: "",
			rememberMe: false,
		},
	});

	function onSubmit(data: z.infer<typeof LoginSchema>) {
		startTransition(async () => {
			const { error } = JSON.parse(
				await loginWithEmailAndPassword(data)
			) as AuthTokenResponse;

			if (error) {
				toast({
					variant: "destructive",
					title: "Login failed",
					description: error.message,
				});
			} else {
				toast({
					title: "Welcome back! 🎉",
					description: "Successfully logged in to your account.",
				});
			}
		});
	}

	return (
		<div className="w-full">
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
										/>
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
											placeholder="Enter your password"
											type={showPassword ? "text" : "password"}
											className="bg-background/20 border-border/50 text-foreground placeholder:text-muted-foreground/50 
                        focus:border-primary/50 focus:ring-primary/25 
                        shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]
                        hover:border-border pr-10
                        transition-all duration-200"
											{...field}
											onFocus={() => setShowPasswordRequirements(true)}
											onBlur={() => setShowPasswordRequirements(false)}
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
									</div>
								</FormControl>
								<FormMessage className="text-destructive text-sm animate-fade-down" />
								{showPasswordRequirements && (
									<div className="text-xs space-y-1.5 text-muted-foreground bg-background/40 p-3 rounded-md mt-2 animate-fade-down border border-border/50">
										{passwordRequirements.map((req, index) => (
											<p key={index} className="flex items-center gap-2">
												<span className="w-1.5 h-1.5 rounded-full bg-foreground/30"></span>
												{req}
											</p>
										))}
									</div>
								)}
								<div className="flex justify-end mt-1">
									<button
										type="button"
										onClick={() => {/* Implement forgot password */}}
										className="text-sm text-primary/90 hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-primary/5"
									>
										Forgot password?
									</button>
								</div>
							</FormItem>
						)}
					/>
					
					<FormField
						control={form.control}
						name="rememberMe"
						render={({ field }) => (
							<FormItem className="flex items-center space-x-2 space-y-0">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={field.onChange}
										className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors"
									/>
								</FormControl>
								<FormLabel className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Remember me
                </FormLabel>
							</FormItem>
						)}
					/>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t border-border/50" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-card/30 backdrop-blur-sm px-2 text-muted-foreground">
								Or continue with
							</span>
						</div>
					</div>

					<Button
						type="button"
						variant="outline"
						disabled={isGoogleLoading}
						onClick={() => {
							setIsGoogleLoading(true);
							signInWithGoogle();
						}}
						className="w-full bg-background/20 border-border/50 text-foreground hover:bg-background/30 
							hover:border-border focus:ring-2 focus:ring-primary/25
							shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]
							disabled:opacity-70 disabled:cursor-not-allowed
							transition-all duration-200"
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
								<span className="animate-pulse">Signing in...</span>
							</div>
						) : (
							"Sign In"
						)}
					</Button>
				</form>
			</Form>
		</div>
	);
}