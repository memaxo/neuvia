import Link from "next/link"

import { siteConfig } from "@/config/site"
import { buttonVariants } from "@/components/ui/button"
import { readUserSession } from "@/utils/actions";
import Features from "@/components/features"
import { redirect } from "next/navigation";
import BackgroundPaths from "@/components/kokonutui/background-paths"

export default async function IndexPage() {
  const { data: userSession } = await readUserSession();

        if (userSession.session) {
                return redirect("/dashboard");
        }
  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      <BackgroundPaths />
      <div className="relative z-10 container mx-auto px-4 md:px-6 flex flex-col flex-grow">
        <div className="flex flex-col items-center justify-center gap-4 flex-grow py-12">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-tight text-white mb-8">
            Illuminate Clinical Insights
          </h1>
          <p className="text-xl md:text-2xl text-teal-100 leading-relaxed max-w-3xl mx-auto text-center mb-12">
            Transform patient data into actionable insights, instantly
          </p>
          <div className="space-y-4">
            <Link
              href={siteConfig.links.login}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({
                className: "rounded-full px-8 py-6 text-lg font-semibold bg-cyan-500 hover:bg-cyan-600 text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              })}
            >
              Login
            </Link>
            <Link
              target="_blank"
              rel="noreferrer"
              href={siteConfig.links.signup}
              className={buttonVariants({ 
                variant: "outline",
                className: "rounded-full px-8 py-6 text-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              })}
            >
              Sign Up
            </Link>
            <Link
              href={siteConfig.links.signup}
              className={buttonVariants({
                className: "rounded-full px-8 py-6 text-lg font-semibold bg-cyan-500 hover:bg-cyan-600 text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 mt-4"
              })}
            >
              Get Started
              <span className="ml-2">→</span>
            </Link>
          </div>
        </div>
        <Features/>
      </div>
    </div>
  )
}
