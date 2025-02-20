import React from "react";
import { readUserSession } from "@/utils/actions";
import { redirect } from "next/navigation";
import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { siteConfig } from "@/config/site"
import { buttonVariants } from "@/components/ui/button"
import RegisterForm from "@/app/auth-server-action/components/RegisterForm"

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Onyx new customer onboarding",
}

export default async function OnboardingPage() {
  const { data: userSession } = await readUserSession();

  if (userSession.session) {
    return redirect("/account");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Enhanced background with multiple layers */}
      <div className="absolute inset-0">
        {/* Grid pattern - theme aware */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.05]" />
        
        {/* Gradient overlay - theme aware */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 animate-gradient" />
        
        {/* Additional ambient glow - theme aware */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse-subtle" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] animate-pulse-subtle" style={{ animationDelay: '-2s' }} />
        </div>
      </div>

      {/* Enhanced main container */}
      <div className="relative w-full max-w-[420px] mx-4 animate-fade-up">
        {/* Card with enhanced glass effect and depth */}
        <div className="relative p-8 rounded-2xl overflow-hidden backdrop-blur-xl border border-border/50 shadow-lg transition-all duration-300 bg-card/30">
          {/* Inner gradient for depth - theme aware */}
          <div className="absolute inset-0 bg-gradient-to-br from-background/30 to-background/10" />
          
          {/* Card background with enhanced glass effect */}
          <div className="absolute inset-0 bg-background/40 -z-10" />
          
          {/* Content */}
          <div className="relative z-10 flex flex-col space-y-6">
            {/* Logo section */}
            <div className="flex flex-col items-center space-y-2 mb-2">
              <Link 
                href="/" 
                className="flex items-center space-x-2 mb-6 group backdrop-blur-sm bg-background/5 px-4 py-2 rounded-full transition-all duration-300 hover:bg-background/10 hover:shadow-lg hover:shadow-primary/10"
              >
                <Image 
                  src="/neuvia-comp.jpg" 
                  alt="Neuvia Logo" 
                  width={24} 
                  height={24} 
                  className="rounded-full group-hover:opacity-90 transition-opacity"
                />
                <span className="inline-block font-bold text-foreground group-hover:text-primary transition-colors">
                  {siteConfig.name}
                </span>
              </Link>
              <h1 className="text-2xl font-semibold tracking-tight text-center text-foreground animate-fade-up" style={{ animationDelay: '200ms' }}>
                Create your account
              </h1>
              <p className="text-sm text-muted-foreground text-center animate-fade-up" style={{ animationDelay: '400ms' }}>
                Join Neuvia and start your journey
              </p>
            </div>

            {/* Auth form container with enhanced depth */}
            <div className="bg-card/40 p-6 rounded-xl border border-border/50 shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)] animate-fade-up" style={{ animationDelay: '600ms' }}>
              <RegisterForm />
            </div>

            {/* Enhanced terms section */}
            <p className="text-center text-sm text-muted-foreground px-6 animate-fade-up" style={{ animationDelay: '800ms' }}>
              By clicking continue, you agree to our{" "}
              <Link
                href="/terms"
                className="text-primary/90 hover:text-primary underline underline-offset-4 transition-colors"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-primary/90 hover:text-primary underline underline-offset-4 transition-colors"
              >
                Privacy Policy
              </Link>
              .
            </p>

            {/* Sign in link */}
            <div className="text-center text-sm animate-fade-up" style={{ animationDelay: '1000ms' }}>
              <span className="text-muted-foreground">Already have an account?</span>{" "}
              <Link
                href="/auth"
                className="text-primary/90 hover:text-primary underline underline-offset-4 transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}