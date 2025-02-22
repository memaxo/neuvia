import { z } from "zod";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Database } from "@/lib/database.types";

// Schema for medical references
const medicalReferenceSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string().optional(),
  year: z.number(),
  doi: z.string().optional(),
  url: z.string().url().optional(),
  citationText: z.string(),
});

// Schema for differential diagnosis
const differentialDiagnosisSchema = z.object({
  condition: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  snomedCode: z.string().optional(),
  icdCode: z.string().optional(),
});

// Schema for model metadata
const modelMetadataSchema = z.object({
  version: z.string(),
  training_date: z.string().datetime(),
  reasoning_chain: z.array(z.object({
    step: z.number(),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
  })),
});

// Schema for validation metadata
const validationMetadataSchema = z.object({
  checksum: z.string(),
  uncertainty_metrics: z.record(z.string(), z.number()),
  reviewer_attestation: z.object({
    reviewed: z.boolean(),
    comments: z.string().optional(),
    attestation_date: z.string().datetime().optional(),
  }),
});

// Schema for compliance metadata
const complianceMetadataSchema = z.object({
  hipaa_access_log: z.array(z.object({
    user_id: z.string().uuid(),
    access_time: z.string().datetime(),
    action: z.string(),
  })),
  data_retention_policy: z.string(),
  regulatory_flags: z.array(z.string()),
});

// Schema for report generation input
export const generateReportSchema = z.object({
  patientId: z.string().uuid(),
  title: z.string(),
  type: z.enum(['diagnostic', 'progress', 'analytics']),
  departmentId: z.string().uuid(),
  patientInfo: z.object({
    symptoms: z.array(z.string()),
    medicalHistory: z.string(),
    currentMedications: z.array(z.string()),
    allergies: z.array(z.string()),
    vitalSigns: z.record(z.string(), z.string()),
  }),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// Schema for report output
export const reportSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  type: z.enum(['diagnostic', 'progress', 'analytics']),
  status: z.enum(['processing', 'completed', 'failed']),
  title: z.string(),
  summary: z.string().nullable(),
  content: z.any().nullable(),
  metadata: z.object({
    patientInfo: z.object({
      symptoms: z.array(z.string()),
      medicalHistory: z.string(),
      currentMedications: z.array(z.string()),
      allergies: z.array(z.string()),
      vitalSigns: z.record(z.string(), z.string()),
    }),
  }),
  findings: z.array(z.object({
    description: z.string(),
    category: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    snomedCode: z.string().optional(),
  })).nullable(),
  recommendations: z.array(z.object({
    recommendation: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    timeframe: z.string().optional(),
    rationale: z.string(),
  })).nullable(),
  differential_diagnoses: z.array(differentialDiagnosisSchema).nullable(),
  evidence_mapping: z.record(z.string(), z.array(z.string())).nullable(),
  snomed_codes: z.array(z.string()).nullable(),
  icd_codes: z.array(z.string()).nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),
  source_documents: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    relevance_score: z.number().min(0).max(1),
  })).nullable(),
  medical_references: z.array(medicalReferenceSchema).nullable(),
  clinical_guidelines: z.array(z.object({
    guideline: z.string(),
    source: z.string(),
    relevance: z.string(),
    recommendation_grade: z.string().optional(),
  })).nullable(),
  model_metadata: modelMetadataSchema,
  validation_metadata: validationMetadataSchema,
  compliance_metadata: complianceMetadataSchema,
  errorMessage: z.string().nullable(),
  departmentId: z.string().uuid(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  createdBy: z.string().uuid(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().uuid(),
  reviewedAt: z.string().datetime().nullable(),
  reviewedBy: z.string().uuid().nullable(),
});

export type Report = z.infer<typeof reportSchema>;

// Schema for audit log entries
export const auditLogSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.string(),
  changes: z.any(),
  timestamp: z.string().datetime(),
});

export type AuditLog = z.infer<typeof auditLogSchema>;

export async function generateReport(input: GenerateReportInput) {
  const supabase = createServerActionClient<Database>({ cookies });

  // 1. Start report generation
  const { data: report, error: createError } = await supabase
    .from("reports")
    .insert({
      patient_id: input.patientId,
      title: input.title,
      type: input.type,
      status: "processing",
      department_id: input.departmentId,
      metadata: {
        patientInfo: input.patientInfo,
      },
      model_metadata: {
        version: "1.0.0",
        training_date: new Date().toISOString(),
        reasoning_chain: [],
      },
      validation_metadata: {
        checksum: "",
        uncertainty_metrics: {},
        reviewer_attestation: { reviewed: false },
      },
      compliance_metadata: {
        hipaa_access_log: [],
        data_retention_policy: "standard",
        regulatory_flags: [],
      },
    })
    .select()
    .single();

  if (createError) {
    throw new Error("Failed to create report: " + createError.message);
  }

  // 2. Generate research topic from patient info
  const researchTopic = `Medical diagnosis analysis for patient with symptoms: ${input.patientInfo.symptoms.join(", ")}. 
    Medical history: ${input.patientInfo.medicalHistory}. 
    Current medications: ${input.patientInfo.currentMedications.join(", ")}. 
    Allergies: ${input.patientInfo.allergies.join(", ")}.`;

  try {
    // 3. Call deep-research API
    const response = await fetch("/api/deep-research", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: researchTopic,
      }),
    });

    if (!response.ok) {
      throw new Error("Deep research failed: " + response.statusText);
    }

    const result = await response.json();

    // 4. Update report with results
    const { error: updateError } = await supabase
      .from("reports")
      .update({
        status: "completed",
        content: result.data.content,
        summary: result.data.summary,
        findings: result.data.findings,
        recommendations: result.data.recommendations,
        differential_diagnoses: result.data.differentialDiagnoses,
        evidence_mapping: result.data.evidenceMapping,
        snomed_codes: result.data.snomedCodes,
        icd_codes: result.data.icdCodes,
        confidence_score: result.data.confidenceScore,
        source_documents: result.data.sourceDocuments,
        medical_references: result.data.medicalReferences,
        clinical_guidelines: result.data.clinicalGuidelines,
        model_metadata: {
          ...report.model_metadata,
          reasoning_chain: result.data.reasoningChain,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (updateError) {
      throw new Error("Failed to update report: " + updateError.message);
    }

    return { success: true, reportId: report.id };
  } catch (error) {
    // 5. Handle errors by updating report status
    await supabase
      .from("reports")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error occurred",
      })
      .eq("id", report.id);

    throw error;
  }
} 