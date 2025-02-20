import React from "react";
import AuthForm from "./components/AuthForm";
import { readUserSession } from "@/utils/actions";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils"
import Link from "next/link"
import { siteConfig } from "@/config/site"
import { buttonVariants } from "@/components/ui/button"
import Image from "next/image"

export default async function page() {
        const { data: userSession } = await readUserSession();

        if (userSession.session) {
                return redirect("/account");
        }
        return (
        <div className="min-h-screen flex items-center justify-center bg-background isolate">
          {/* Static background layer */}
          <div className="fixed inset-0 z-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] bg-[size:24px_24px] opacity-[0.05]" />
          </div>

          {/* Ambient effects layer */}
          <div className="fixed inset-0 z-10 pointer-events-none">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 animate-gradient" />
            
            {/* Glow effects */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse-subtle" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] animate-pulse-subtle" style={{ animationDelay: '-2s' }} />
            </div>
          </div>

          {/* Content layer */}
          <div className="relative z-20 w-full max-w-[420px] mx-4 animate-fade-up">
            {/* Auth card */}
            <div className="relative rounded-2xl overflow-hidden isolate">
              {/* Card glass effect - separate stacking context */}
              <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 backdrop-blur-xl bg-background/40" />
                <div className="absolute inset-0 bg-gradient-to-br from-background/30 to-background/10" />
                <div className="absolute inset-0 border border-border/50" />
              </div>

              {/* Card content */}
              <div className="relative z-10 p-8">
                {/* Logo section */}
                <div className="flex flex-col items-center space-y-2 mb-6">
                  <Link 
                    href="/" 
                    className="flex items-center space-x-2 mb-6 group relative overflow-hidden rounded-full"
                  >
                    <div className="absolute inset-0 backdrop-blur-sm bg-background/5 transition-all duration-300 group-hover:bg-background/10" />
                    <div className="relative z-10 px-4 py-2 flex items-center space-x-2">
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
                    </div>
                  </Link>
                  <h1 className="text-2xl font-semibold tracking-tight text-center text-foreground animate-fade-up" style={{ animationDelay: '200ms' }}>
                    Welcome back!
                  </h1>
                  <p className="text-sm text-muted-foreground text-center animate-fade-up" style={{ animationDelay: '400ms' }}>
                    Login to your Neuvia account
                  </p>
                </div>

                {/* Form section - isolated stacking context */}
                <div className="relative isolate animate-fade-up" style={{ animationDelay: '600ms' }}>
                  <div className="absolute inset-0 -z-10">
                    <div className="absolute inset-0 bg-card/40 rounded-xl" />
                    <div className="absolute inset-0 border border-border/50 rounded-xl" />
                    <div className="absolute inset-0 shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)] rounded-xl" />
                  </div>
                  <div className="relative z-0 p-6">
                    <AuthForm />
                  </div>
                </div>

                {/* Terms section */}
                <p className="text-center text-sm text-muted-foreground px-6 mt-6 animate-fade-up" style={{ animationDelay: '800ms' }}>
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
              </div>
            </div>
          </div>
        </div>
        );
}