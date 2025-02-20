import { Cpu, FileText, Shield, Zap } from "lucide-react"

const features = [
  {
    name: "Advanced LLM Analysis",
    description: "Leverage powerful AI models to analyze medical records, extract key insights, and provide evidence-based recommendations.",
    icon: Cpu,
  },
  {
    name: "Document Processing",
    description: "Process and analyze large volumes of medical documents with our high-capacity ingestion system and intelligent summarization.",
    icon: FileText,
  },
  {
    name: "HIPAA-Compliant Security",
    description: "Enterprise-grade security with full HIPAA compliance, protecting sensitive patient data with advanced encryption and access controls.",
    icon: Shield,
  },
  {
    name: "Clinical Workflow Integration",
    description: "Seamlessly integrate with your clinical workflows, providing instant access to patient insights and automated documentation.",
    icon: Zap,
  },
]

export default function Features() {
  return (
    <section className="py-12 md:py-20 relative">
      <div className="container relative">
        <div className="mx-auto max-w-4xl text-center mb-8 md:mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-teal-100">Clinical Intelligence Platform</h2>
          <p className="text-lg text-teal-100/80">
            Transform your clinical practice with our advanced medical records analysis system, powered by state-of-the-art LLM technology.
          </p>
        </div>
        <div className="mx-auto max-w-5xl grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          {features.map((feature) => (
            <div key={feature.name} className="relative overflow-hidden rounded-lg border border-teal-500/10 bg-white/5 backdrop-blur-sm p-6 md:p-8 transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/5 hover:border-teal-500/20">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-teal-500/10">
                  <feature.icon className="h-5 w-5 text-teal-300" />
                </div>
                <h3 className="font-bold text-lg text-white">{feature.name}</h3>
              </div>
              <p className="text-teal-100/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}