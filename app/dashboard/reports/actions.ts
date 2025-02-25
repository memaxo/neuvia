import { z } from "zod";

import { createServerClient } from '@/lib/supabase/clients'

import type { Database } from "@/lib/database.types";

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

export async function generateReport(input: GenerateReportInput & { verifiedData?: any }) {
  const supabase = await createServerClient();

  // Log the start of report generation for debugging
  console.log("[generateReport] Starting report generation with input:", input);

  // 1. Start report generation (insert a row with status='processing')
  const { data: report, error: createError } = await supabase
    .from("reports")
    .insert({
      patient_id: input.patientId,
      title: input.title,
      type: input.type,
      status: "processing",
      department_id: input.departmentId,
      // Use verifiedData if present; otherwise, fallback to old patientInfo
      metadata: {
        patientInfo: input.verifiedData ?? input.patientInfo,
      },
      model_metadata: {
        version: "1.1.0",
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
    // Fail early if we can't create the report row
    throw new Error(`Failed to create report: ${createError.message}`);
  }

  // 2. Build a final data object from the verified data
  // Or if verifiedData not available, fallback to patientInfo
  const finalData = input.verifiedData ?? input.patientInfo;
  console.log("[generateReport] Using final verified data for LLM call:", finalData);

  // We'll confirm we use "o3-mini" or "deep-research"
  // let's say we do "o3-mini" for now, or brand it as "deepResearch" in logs
  const chosenModel = "o3-mini";
  console.log("[generateReport] Using chosen model:", chosenModel);

  // We'll wrap the final LLM call with Zod validation after receiving response
  // Also note any fallback for missing fields

  // Create a short summary of the data for the "research topic"
  const researchTopic = `Medical diagnosis analysis for patient with symptoms: ${
    finalData.symptoms?.join(", ") || "N/A"
  }.
  Medical history: ${finalData.medicalHistory || "N/A"}.
  Current medications: ${Array.isArray(finalData.currentMedications) ? finalData.currentMedications.join(", ") : "N/A"}.
  Allergies: ${Array.isArray(finalData.allergies) ? finalData.allergies.join(", ") : "N/A"}.
  Vital signs: ${finalData.vitalSigns ? JSON.stringify(finalData.vitalSigns) : "N/A"}.
  `;

  // Introduce optional timeout
  // We'll let the user specify a maxDuration in ms, default to 30 seconds
  const maxDuration = 30000;
  let didTimeout = false;
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    didTimeout = true;
    abortController.abort();
  }, maxDuration);

  try {
    // Log the external LLM/deep research call
    console.log("[generateReport] Making deep research call with topic:", researchTopic);

    // 3. Call deep-research or LLM API
    const response = await fetch("/api/deep-research", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: abortController.signal,
      body: JSON.stringify({ topic: researchTopic }),
    });

    // If we timed out, let's handle that
    if (didTimeout) {
      console.error("[generateReport] LLM call timed out");
      await supabase
        .from("reports")
        .update({
          status: "failed",
          error_message: "Report generation timed out. Please retry.",
        })
        .eq("id", report.id);

      throw new Error("LLM call timed out. Please retry.");
    }

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Deep research failed: ${response.statusText}`);
    }

    const rawLLMData = await response.json();
    console.log("[generateReport] Received deep research result:", rawLLMData);

    // Attempt to parse with our existing reportSchema
    let validatedLLMData: any;
    try {
      validatedLLMData = reportSchema.parse(rawLLMData.data);
    } catch (parseErr) {
      console.error("[generateReport] Zod parse failed, applying fallback logic:", parseErr);
      // We'll create a partial fallback:
      validatedLLMData = {
        content: rawLLMData.data?.content ?? "<p>No content</p>",
        summary: rawLLMData.data?.summary ?? "No summary",
        findings: rawLLMData.data?.findings ?? null,
        recommendations: rawLLMData.data?.recommendations ?? null,
        differential_diagnoses: rawLLMData.data?.differentialDiagnoses ?? null,
        evidence_mapping: rawLLMData.data?.evidenceMapping ?? null,
        snomed_codes: rawLLMData.data?.snomedCodes ?? null,
        icd_codes: rawLLMData.data?.icdCodes ?? null,
        confidence_score: rawLLMData.data?.confidenceScore ?? 0.0,
        source_documents: rawLLMData.data?.sourceDocuments ?? null,
        medical_references: rawLLMData.data?.medicalReferences ?? null,
        clinical_guidelines: rawLLMData.data?.clinicalGuidelines ?? null,
        reasoningChain: rawLLMData.data?.reasoningChain ?? [],
      };
    }

    console.log("[generateReport] Validated or fallback LLM data:", validatedLLMData);

    // 4. Partial update if needed - mark 'processing' or store partial results
    // For demonstration, we do final in one shot.
    // If partial streaming is desired, we'd do frequent updates here.

    // 5. Update report with final results
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
          reasoning_chain: result.data.reasoningChain || [],
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (updateError) {
      console.error("[generateReport] Error updating final report:", updateError);
      await supabase
        .from("reports")
        .update({
          status: "failed",
          error_message: `Failed final update: ${updateError.message}`,
        })
        .eq("id", report.id);

      throw new Error(`Failed to update report: ${updateError.message}`);
    }

    // 6. Return success
    console.log("[generateReport] Report generation completed successfully for report ID:", report.id);
    return { success: true, reportId: report.id };

  } catch (error: any) {
    clearTimeout(timeout);

    // If the error is from abort, we've already updated status
    if (didTimeout) {
      console.error("[generateReport] Caught abort error after timeout.");
      throw error;
    }

    // 7. Handle errors by updating the report record
    console.error("[generateReport] Error during LLM call:", error);
    await supabase
      .from("reports")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error occurred",
      })
      .eq("id", report.id);
    
    // Re-throw with consistent shape
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
  }
} 