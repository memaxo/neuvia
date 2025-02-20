import { Cpu, FileText, Shield, Zap } from "lucide-react"

const features = [
  {
    name: "AI-Powered Clinical Review",
    description: "Process 1,200+ records per hour with 99.2% accuracy. Our FDA-cleared NLP extracts key findings from unstructured notes and provides evidence-based recommendations.",
    icon: Cpu,
  },
  {
    name: "Instant Document Analysis",
    description: "Get comprehensive patient summaries in under 30 seconds. Our high-capacity system processes and analyzes medical documents with intelligent summarization focused on clinical relevance.",
    icon: FileText,
  },
  {
    name: "Enterprise Security & Compliance",
    description: "HIPAA-compliant infrastructure with SOC 2 Type II certification. Complete audit trails for all AI suggestions, ensuring transparency and accountability in clinical decision support.",
    icon: Shield,
  },
  {
    name: "Seamless EHR Integration",
    description: "Direct integration with major EHR systems including Epic and Cerner via FHIR API. Access patient insights and automated documentation without disrupting your clinical workflow.",
    icon: Zap,
  },
]

export default function Features() {
  return (
    <section className="py-12 md:py-20 relative">
      <div className="container relative">
        <div className="mx-auto max-w-4xl text-center mb-12 md:mb-16">
          <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-6 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-transparent bg-clip-text drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
            Clinical Intelligence Platform
          </h2>
          <p className="text-xl text-white/90 font-medium max-w-3xl mx-auto backdrop-blur-sm">
            Reduce documentation time by 60% while preventing up to 40% of adverse events through automated analysis and clinical decision support.
          </p>
        </div>
        <div className="mx-auto max-w-6xl grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
          {features.map((feature) => (
            <div 
              key={feature.name} 
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl p-8 transition-all duration-300 hover:border-cyan-500/30 hover:bg-black/40 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)] hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-5 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 group-hover:border-cyan-500/20 transition-colors duration-300">
                    <feature.icon className="h-6 w-6 text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300" />
                  </div>
                  <h3 className="font-bold text-xl text-white group-hover:text-cyan-50 transition-colors duration-300">
                    {feature.name}
                  </h3>
                </div>
                <p className="text-lg text-white/75 group-hover:text-white/85 transition-colors duration-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>

              <div className="absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute top-0 -left-full w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent group-hover:animate-scan" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}