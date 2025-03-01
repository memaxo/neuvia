'use client'

import { Markdown } from '@/components/ui/markdown'
import type { Report } from '@/lib/reports.types'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface DifferentialDiagnosis {
  condition: string
  confidence: number
  evidence?: string[]
  snomedCode?: string
  icdCode?: string
}

interface ModelMetadata {
  version: string
  training_date: string
  reasoning_chain: { step: number; reasoning: string; confidence: number }[]
}

interface ValidationMetadata {
  checksum: string
  uncertainty_metrics: Record<string, number>
  reviewer_attestation: { reviewed: boolean }
}

interface ComplianceMetadata {
  data_retention_policy: string
  regulatory_flags: string[]
}

interface DocumentReference {
  id: string
  type: string
  title: string
  processedAt: string
  page?: number
  citationId?: string
}

interface ReportDetailProps {
  report: Report
}

export function ReportDetail({ report }: ReportDetailProps) {
  const router = useRouter()

  // Safely cast differential_diagnoses if it's an array
  const differentialDiagnoses: DifferentialDiagnosis[] = Array.isArray(
    report.differential_diagnoses
  )
    ? (report.differential_diagnoses as unknown as DifferentialDiagnosis[])
    : []

  // Safely cast model_metadata if it's an object
  const modelMetadata: ModelMetadata =
    typeof report.model_metadata === 'object' && report.model_metadata !== null
      ? (report.model_metadata as unknown as ModelMetadata)
      : { version: '', training_date: '', reasoning_chain: [] }

  // Safely cast validation_metadata if it's an object
  const validationMetadata: ValidationMetadata =
    typeof report.validation_metadata === 'object' &&
    report.validation_metadata !== null
      ? (report.validation_metadata as unknown as ValidationMetadata)
      : {
          checksum: '',
          uncertainty_metrics: {},
          reviewer_attestation: { reviewed: false },
        }

  // Safely cast compliance_metadata if it's an object
  const complianceMetadata: ComplianceMetadata =
    typeof report.compliance_metadata === 'object' &&
    report.compliance_metadata !== null
      ? (report.compliance_metadata as unknown as ComplianceMetadata)
      : { data_retention_policy: '', regulatory_flags: [] }

  // Safely cast document_references if it's an array
  const documentReferences: DocumentReference[] =
    typeof report.source_documents === 'object' &&
    report.source_documents !== null
      ? (report.source_documents as unknown as DocumentReference[])
      : []

  return (
    <>
      <div className="bg-card space-y-6 rounded-lg p-6">
        <h2 className="text-foreground text-xl font-bold">Report Detail</h2>
        <div className="space-y-4">
          {/* Clinical Content */}
          <div>
            <h3 className="text-foreground text-lg font-medium">
              Clinical Content
            </h3>
            <div className="prose prose-invert">
              <Markdown>{report.content || ''}</Markdown>
            </div>
          </div>

          {/* Document References */}
          <div>
            <h3 className="text-foreground text-lg font-medium">
              Document References
            </h3>
            {documentReferences && documentReferences.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {documentReferences.map(
                  (reference: DocumentReference, idx: number) => (
                    <li className="text-foreground text-sm" key={idx}>
                      <span className="font-semibold">
                        {reference.citationId || `Doc-${idx + 1}`}:{' '}
                      </span>
                      {reference.title}
                      {reference.page && <span> - Page {reference.page}</span>}
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({reference.type})
                      </span>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                No document references available.
              </p>
            )}
          </div>

          {/* Differential Diagnoses */}
          <div>
            <h3 className="text-foreground text-lg font-medium">
              Differential Diagnoses
            </h3>
            {differentialDiagnoses.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {differentialDiagnoses.map(
                  (diagnosis: DifferentialDiagnosis, idx: number) => (
                    <li className="text-foreground text-sm" key={idx}>
                      {diagnosis.condition} -{' '}
                      {Math.round(diagnosis.confidence * 100)}% confidence
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                No differential diagnoses available.
              </p>
            )}
          </div>
          {/* Model Metadata */}
          <div>
            <h3 className="text-foreground text-lg font-medium">
              Model Metadata
            </h3>
            <p className="text-muted-foreground text-sm">
              Version: {modelMetadata.version}
            </p>
            <p className="text-muted-foreground text-sm">
              Training Date: {modelMetadata.training_date}
            </p>
            {modelMetadata.reasoning_chain &&
              modelMetadata.reasoning_chain.length > 0 && (
                <div className="mt-2">
                  <p className="text-foreground text-sm">Reasoning Steps:</p>
                  <ol className="text-muted-foreground list-decimal pl-5 text-sm">
                    {modelMetadata.reasoning_chain.map((step, idx: number) => (
                      <li key={idx}>
                        Step {step.step}: {step.reasoning} (
                        {Math.round(step.confidence * 100)}% confidence)
                      </li>
                    ))}
                  </ol>
                </div>
              )}
          </div>
          {/* Validation Metadata */}
          <div>
            <h3 className="text-foreground text-lg font-medium">
              Validation Metadata
            </h3>
            <p className="text-muted-foreground text-sm">
              Checksum: {validationMetadata.checksum}
            </p>
            {Object.keys(validationMetadata.uncertainty_metrics).length > 0 && (
              <div className="text-muted-foreground mt-2 text-sm">
                <p>Uncertainty Metrics:</p>
                <ul className="list-disc pl-5">
                  {Object.entries(validationMetadata.uncertainty_metrics).map(
                    ([key, value]) => (
                      <li key={key}>
                        {key}: {value}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
            <p className="text-muted-foreground mt-2 text-sm">
              Reviewed:{' '}
              {validationMetadata.reviewer_attestation.reviewed ? 'Yes' : 'No'}
            </p>
          </div>
          {/* Compliance Metadata */}
          <div>
            <h3 className="text-foreground text-lg font-medium">
              Compliance Metadata
            </h3>
            <p className="text-muted-foreground text-sm">
              Data Retention Policy: {complianceMetadata.data_retention_policy}
            </p>
            {complianceMetadata.regulatory_flags &&
              complianceMetadata.regulatory_flags.length > 0 && (
                <div className="text-muted-foreground mt-2 text-sm">
                  <p>Regulatory Flags:</p>
                  <ul className="list-disc pl-5">
                    {complianceMetadata.regulatory_flags.map(
                      (flag: string, idx: number) => (
                        <li key={idx}>{flag}</li>
                      )
                    )}
                  </ul>
                </div>
              )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-4 py-2"
          onClick={() => {
            router.push(`/dashboard/chat?reportId=${report.id}`)
          }}
        >
          Open in Chat
        </button>
      </div>
    </>
  )
}
