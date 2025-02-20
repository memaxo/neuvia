import Link from "next/link"

import { siteConfig } from "@/config/site"
import { buttonVariants } from "@/components/ui/button"
import { readUserSession } from "@/utils/actions";
import Features from "@/components/features"
import { redirect } from "next/navigation";
import BackgroundPaths from "@/components/background-paths"

export default async function IndexPage() {
  const { data: userSession } = await readUserSession();

        if (userSession.session) {
                return redirect("/dashboard");
        }
  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      <BackgroundPaths />
      <div className="relative z-10 container mx-auto px-4 md:px-6 flex flex-col flex-grow">
        <div className="flex flex-col items-center justify-center min-h-[80vh] py-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight text-white">
              AI-Powered Medical Records Analysis
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-teal-100 leading-relaxed max-w-3xl mx-auto">
              Streamline clinical workflows with advanced LLM analysis. Extract insights, summarize patient histories, and receive evidence-based recommendations instantly.
            </p>
            <div className="flex flex-col items-center gap-6 pt-2">
              <Link
                href={siteConfig.links.signup}
                className={buttonVariants({
                  className: "rounded-full px-8 py-6 text-lg font-semibold bg-cyan-500 hover:bg-cyan-600 text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                })}
              >
                Get Started
                <span className="ml-2">→</span>
              </Link>
              <p className="text-sm text-teal-100/80 max-w-md text-center">
                HIPAA-compliant platform with advanced security and transparency in clinical decision support.
              </p>
            </div>
          </div>
        </div>
        <div className="w-full h-px bg-gradient-to-r from-transparent via-teal-200/20 to-transparent my-8 md:my-12"></div>
        <Features/>
      </div>
    </div>
  )
}
