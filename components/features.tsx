import { Cpu, FileText, Shield, Zap } from 'lucide-react'

const features = [
  {
    name: 'AI-Powered Clinical Review',
    description:
      'Process 1,200+ records per hour with 99.2% accuracy. Our FDA-cleared NLP extracts key findings from unstructured notes and provides evidence-based recommendations.',
    icon: Cpu,
  },
  {
    name: 'Instant Document Analysis',
    description:
      'Get comprehensive patient summaries in under 30 seconds. Our high-capacity system processes and analyzes medical documents with intelligent summarization focused on clinical relevance.',
    icon: FileText,
  },
  {
    name: 'Enterprise Security & Compliance',
    description:
      'HIPAA-compliant infrastructure with SOC 2 Type II certification. Complete audit trails for all AI suggestions, ensuring transparency and accountability in clinical decision support.',
    icon: Shield,
  },
  {
    name: 'Seamless EHR Integration',
    description:
      'Direct integration with major EHR systems including Epic and Cerner via FHIR API. Access patient insights and automated documentation without disrupting your clinical workflow.',
    icon: Zap,
  },
]

export default function Features() {
  return (
    <section className="relative py-12 md:py-20">
      <div className="container relative">
        <div className="mx-auto mb-12 max-w-4xl text-center md:mb-16">
          <h2 className="mb-6 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-4xl font-extrabold leading-tight text-transparent drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)] sm:text-5xl">
            Clinical Intelligence Platform
          </h2>
          <p className="mx-auto max-w-3xl text-xl font-medium text-white/90 backdrop-blur-sm">
            Reduce documentation time by 60% while preventing up to 40% of
            adverse events through automated analysis and clinical decision
            support.
          </p>
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:bg-black/40 hover:shadow-[0_0_30px_rgba(0,255,255,0.1)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-5">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 transition-colors duration-300 group-hover:border-cyan-500/20">
                    <feature.icon className="h-6 w-6 text-cyan-400 transition-colors duration-300 group-hover:text-cyan-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white transition-colors duration-300 group-hover:text-cyan-50">
                    {feature.name}
                  </h3>
                </div>
                <p className="text-lg leading-relaxed text-white/75 transition-colors duration-300 group-hover:text-white/85">
                  {feature.description}
                </p>
              </div>

              <div className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="group-hover:animate-scan absolute -left-full top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
