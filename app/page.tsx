import Link from "next/link"
import { siteConfig } from "@/config/site"
import { buttonVariants } from "@/components/ui/button"
import { readUserSession } from "@/utils/actions"
import Features from "@/components/features"
import { redirect } from "next/navigation"
import BackgroundSpline from "@/components/background-spline"
import { TechnicalText } from "@/components/technical-text"
import { SecurityBadge } from "@/components/security-badge"
import { Shield, CheckCircle } from "lucide-react"

export default async function IndexPage() {
  const { data: userSession } = await readUserSession();

  if (userSession.session) {
    return redirect("/dashboard");
  }

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <BackgroundSpline />
      </div>
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6 flex flex-col flex-grow">
        <div className="flex flex-col items-center justify-center min-h-[80vh] py-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-6xl sm:text-7xl md:text-7xl font-bold tracking-tight leading-tight text-white drop-shadow-[0_0_25px_rgba(0,255,255,0.2)] animate-fade-in font-sans">
              Transform Patient Care with{' '}
              <TechnicalText variant="highlight" animate className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text">
                AI-Powered Analysis
              </TechnicalText>
            </h1>
            
            <p className="text-lg sm:text-xl md:text-2xl text-white/90 leading-relaxed max-w-3xl mx-auto font-light tracking-wide animate-slide-up">
              Our advanced{' '}
              <TechnicalText variant="technical" className="text-cyan-300">LLM analysis</TechnicalText> automates key data extraction and recommendations to enhance patient care.
            </p>

            <div className="flex flex-col items-center gap-8 pt-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Link
                href={siteConfig.links.signup}
                className={buttonVariants({
                  className: "rounded-full px-8 py-6 text-lg font-semibold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white transition-all duration-300 shadow-[0_0_20px_rgba(0,255,255,0.3)] hover:shadow-[0_0_30px_rgba(0,255,255,0.5)] transform hover:-translate-y-1 hover:scale-105 relative overflow-hidden group"
                })}
              >
                <span className="relative z-10">
                  Get Started
                  <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </span>
                {/* Scanning line effect */}
                <span className="absolute inset-0 overflow-hidden">
                  <span className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent animate-scan" />
                </span>
              </Link>

              <div className="space-y-4">
                <p className="text-sm text-white/80 max-w-md text-center tracking-wide">
                  <TechnicalText variant="mono">Enterprise-grade security for healthcare professionals</TechnicalText>
                </p>
                <div className="flex items-center justify-center gap-6">
                  <SecurityBadge 
                    icon={<Shield className="w-4 h-4 text-cyan-400" />}
                    label="SOC 2 Type II"
                  />
                  <SecurityBadge 
                    icon={<Shield className="w-4 h-4 text-cyan-400" />}
                    label="HIPAA Compliant"
                  />
                  <SecurityBadge 
                    icon={<CheckCircle className="w-4 h-4 text-cyan-400" />}
                    label="256-bit Encryption"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent my-12 md:my-16"></div>
        
        <Features />
      </div>
    </div>
  )
}