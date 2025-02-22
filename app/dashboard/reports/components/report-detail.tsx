'use client'

import { cn } from '@/lib/utils'
import type { Report } from '@/lib/reports.types'

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

interface ReportDetailProps {
  report: Report
}

export function ReportDetail({ report }: ReportDetailProps) {
  // Safely cast differential_diagnoses if it's an array
  const differentialDiagnoses: DifferentialDiagnosis[] = Array.isArray(report.differential_diagnoses)
    ? (report.differential_diagnoses as unknown as DifferentialDiagnosis[])
    : [];

  // Safely cast model_metadata if it's an object
  const modelMetadata: ModelMetadata = (typeof report.model_metadata === 'object' && report.model_metadata !== null)
    ? (report.model_metadata as unknown as ModelMetadata)
    : { version: '', training_date: '', reasoning_chain: [] };

  // Safely cast validation_metadata if it's an object
  const validationMetadata: ValidationMetadata = (typeof report.validation_metadata === 'object' && report.validation_metadata !== null)
    ? (report.validation_metadata as unknown as ValidationMetadata)
    : { checksum: '', uncertainty_metrics: {}, reviewer_attestation: { reviewed: false } };

  // Safely cast compliance_metadata if it's an object
  const complianceMetadata: ComplianceMetadata = (typeof report.compliance_metadata === 'object' && report.compliance_metadata !== null)
    ? (report.compliance_metadata as unknown as ComplianceMetadata)
    : { data_retention_policy: '', regulatory_flags: [] };

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg">
      <h2 className="text-xl font-bold text-foreground">Report Detail</h2>
      <div className="space-y-4">
        {/* Clinical Content */}
        <div>
          <h3 className="text-lg font-medium text-foreground">Clinical Content</h3>
          <div className="prose prose-invert" dangerouslySetInnerHTML={{ __html: report.content || '' }} />
        </div>
        {/* Differential Diagnoses */}
        <div>
          <h3 className="text-lg font-medium text-foreground">Differential Diagnoses</h3>
          {differentialDiagnoses.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1">
              {differentialDiagnoses.map((diagnosis: DifferentialDiagnosis, idx: number) => (
                <li key={idx} className="text-sm text-foreground">
                  {diagnosis.condition} - {Math.round(diagnosis.confidence * 100)}% confidence
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No differential diagnoses available.</p>
          )}
        </div>
        {/* Model Metadata */}
        <div>
          <h3 className="text-lg font-medium text-foreground">Model Metadata</h3>
          <p className="text-sm text-muted-foreground">Version: {modelMetadata.version}</p>
          <p className="text-sm text-muted-foreground">Training Date: {modelMetadata.training_date}</p>
          {modelMetadata.reasoning_chain.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-foreground">Reasoning Steps:</p>
              <ol className="list-decimal pl-5 text-sm text-muted-foreground">
                {modelMetadata.reasoning_chain.map((step, idx: number) => (
                  <li key={idx}>Step {step.step}: {step.reasoning} ({Math.round(step.confidence * 100)}% confidence)</li>
                ))}
              </ol>
            </div>
          )}
        </div>
        {/* Validation Metadata */}
        <div>
          <h3 className="text-lg font-medium text-foreground">Validation Metadata</h3>
          <p className="text-sm text-muted-foreground">Checksum: {validationMetadata.checksum}</p>
          {Object.keys(validationMetadata.uncertainty_metrics).length > 0 && (
            <div className="mt-2 text-sm text-muted-foreground">
              <p>Uncertainty Metrics:</p>
              <ul className="list-disc pl-5">
                {Object.entries(validationMetadata.uncertainty_metrics).map(([key, value]) => (
                  <li key={key}>{key}: {value}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Reviewed: {validationMetadata.reviewer_attestation.reviewed ? 'Yes' : 'No'}
          </p>
        </div>
        {/* Compliance Metadata */}
        <div>
          <h3 className="text-lg font-medium text-foreground">Compliance Metadata</h3>
          <p className="text-sm text-muted-foreground">Data Retention Policy: {complianceMetadata.data_retention_policy}</p>
          {complianceMetadata.regulatory_flags.length > 0 && (
            <div className="mt-2 text-sm text-muted-foreground">
              <p>Regulatory Flags:</p>
              <ul className="list-disc pl-5">
                {complianceMetadata.regulatory_flags.map((flag: string, idx: number) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 