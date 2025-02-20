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
      
      {/* Semi-transparent overlay for better text contrast */}
      <div className="absolute inset-0 z-[1] bg-black/40 backdrop-blur-sm"></div>
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6 flex flex-col flex-grow">
        <div className="flex flex-col items-center justify-center min-h-[80vh] py-4">
          <div className="max-w-4xl mx-auto text-center space-y-10">
            {/* Enhanced heading with better contrast and stronger weight */}
            <h1 className="text-6xl sm:text-7xl md:text-8xl font-extrabold tracking-tight leading-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)] animate-fade-in font-sans">
              Augment Your Clinical Judgment with{' '}
              <TechnicalText variant="highlight" animate className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text font-black">
                AI-Powered Intelligence
              </TechnicalText>
            </h1>
            
            {/* Improved subheading readability */}
            <p className="text-lg sm:text-xl md:text-2xl text-white leading-relaxed max-w-3xl mx-auto font-medium tracking-wide animate-slide-up backdrop-blur-sm py-2">
              Reduce chart review time by{' '}
              <TechnicalText variant="technical" className="text-cyan-300 font-bold">
                60%
              </TechnicalText>{' '}
              while improving clinical accuracy. Our advanced LLM technology delivers evidence-based insights in seconds.
            </p>

            {/* Enhanced CTA section */}
            <div className="flex flex-col items-center gap-10 pt-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Link
                href={siteConfig.links.signup}
                className={buttonVariants({
                  className: "rounded-full px-10 py-7 text-xl font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white transition-all duration-300 shadow-[0_0_30px_rgba(0,255,255,0.3)] hover:shadow-[0_0_40px_rgba(0,255,255,0.5)] transform hover:-translate-y-1 hover:scale-105 relative overflow-hidden group"
                })}
              >
                <span className="relative z-10 flex items-center">
                  Watch Clinical Demo
                  <span className="ml-2 transform group-hover:translate-x-1 transition-transform">→</span>
                </span>
                {/* Enhanced scanning line effect */}
                <span className="absolute inset-0 overflow-hidden">
                  <span className="absolute top-0 -left-full w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent group-hover:animate-scan" />
                </span>
              </Link>

              {/* Enhanced security badges section */}
              <div className="space-y-6 backdrop-blur-sm py-4 px-6 rounded-2xl bg-black/20">
                <p className="text-base text-white/90 max-w-md text-center tracking-wide font-medium">
                  <TechnicalText variant="mono">Trusted by 150+ Academic Medical Centers</TechnicalText>
                </p>
                <div className="flex items-center justify-center gap-8">
                  <SecurityBadge 
                    icon={<Shield className="w-5 h-5 text-cyan-400" />}
                    label="SOC 2 Type II"
                  />
                  <SecurityBadge 
                    icon={<Shield className="w-5 h-5 text-cyan-400" />}
                    label="HIPAA Compliant"
                  />
                  <SecurityBadge 
                    icon={<CheckCircle className="w-5 h-5 text-cyan-400" />}
                    label="FDA-Cleared"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced separator */}
        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent my-16 md:my-20"></div>
        
        {/* Features section with improved spacing */}
        <div className="pb-16">
          <Features />
        </div>
      </div>
    </div>
  )
}