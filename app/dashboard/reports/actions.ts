import { z } from 'zod'

import { createServerClient } from '@/lib/supabase/clients'
import { 
  ApplicationError, 
  ExternalServiceError, 
  SystemError, 
  ValidationError, 
  NotFoundError,
  normalizeError
} from '@/lib/errors'
import logger from '@/lib/logger'

import type { Database } from '@/lib/database.types'

// Schema for medical references
const medicalReferenceSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  journal: z.string().optional(),
  year: z.number(),
  doi: z.string().optional(),
  url: z.string().url().optional(),
  citationText: z.string(),
})

// Schema for differential diagnosis
const differentialDiagnosisSchema = z.object({
  condition: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  snomedCode: z.string().optional(),
  icdCode: z.string().optional(),
})

// Schema for model metadata
const modelMetadataSchema = z.object({
  version: z.string(),
  training_date: z.string().datetime(),
  reasoning_chain: z.array(
    z.object({
      step: z.number(),
      reasoning: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
})

// Schema for validation metadata
const validationMetadataSchema = z.object({
  checksum: z.string(),
  uncertainty_metrics: z.record(z.string(), z.number()),
  reviewer_attestation: z.object({
    reviewed: z.boolean(),
    comments: z.string().optional(),
    attestation_date: z.string().datetime().optional(),
  }),
})

// Schema for compliance metadata
const complianceMetadataSchema = z.object({
  hipaa_access_log: z.array(
    z.object({
      user_id: z.string().uuid(),
      access_time: z.string().datetime(),
      action: z.string(),
    })
  ),
  data_retention_policy: z.string(),
  regulatory_flags: z.array(z.string()),
})

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
})

export type GenerateReportInput = z.infer<typeof generateReportSchema>

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
  findings: z
    .array(
      z.object({
        description: z.string(),
        category: z.string(),
        severity: z.enum(['low', 'medium', 'high']),
        snomedCode: z.string().optional(),
      })
    )
    .nullable(),
  recommendations: z
    .array(
      z.object({
        recommendation: z.string(),
        priority: z.enum(['low', 'medium', 'high']),
        timeframe: z.string().optional(),
        rationale: z.string(),
      })
    )
    .nullable(),
  differential_diagnoses: z.array(differentialDiagnosisSchema).nullable(),
  evidence_mapping: z.record(z.string(), z.array(z.string())).nullable(),
  snomed_codes: z.array(z.string()).nullable(),
  icd_codes: z.array(z.string()).nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),
  source_documents: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        type: z.string(),
        relevance_score: z.number().min(0).max(1),
      })
    )
    .nullable(),
  medical_references: z.array(medicalReferenceSchema).nullable(),
  clinical_guidelines: z
    .array(
      z.object({
        guideline: z.string(),
        source: z.string(),
        relevance: z.string(),
        recommendation_grade: z.string().optional(),
      })
    )
    .nullable(),
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
})

export type Report = z.infer<typeof reportSchema>

// Schema for audit log entries
export const auditLogSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.string(),
  changes: z.any(),
  timestamp: z.string().datetime(),
})

export type AuditLog = z.infer<typeof auditLogSchema>

export async function generateReport(
  input: GenerateReportInput & { verifiedData?: any }
) {
  // Create a structured logger with report generation context
  const moduleLogger = logger.withMetadata({
    module: 'ReportsAction',
    method: 'generateReport',
    patientId: input.patientId,
    reportType: input.type
  })

  try {
    // Validate input
    if (!input.patientId) {
      moduleLogger.error('Missing patient ID')
      throw new ValidationError({
        message: 'Patient ID is required',
        code: 'MISSING_PATIENT_ID'
      })
    }

    moduleLogger.info('Starting report generation', { 
      reportTitle: input.title,
      hasVerifiedData: !!input.verifiedData
    })

    const supabase = await createServerClient()

    // 1. Start report generation (insert a row with status='processing')
    const { data: report, error: createError } = await supabase
      .from('reports')
      .insert({
        patient_id: input.patientId,
        title: input.title,
        type: input.type,
        status: 'processing',
        department_id: input.departmentId,
        // Use verifiedData if present; otherwise, fallback to old patientInfo
        metadata: {
          patientInfo: input.verifiedData ?? input.patientInfo,
        },
        model_metadata: {
          version: '1.1.0',
          training_date: new Date().toISOString(),
          reasoning_chain: [],
        },
        validation_metadata: {
          checksum: '',
          uncertainty_metrics: {},
          reviewer_attestation: { reviewed: false },
        },
        compliance_metadata: {
          hipaa_access_log: [],
          data_retention_policy: 'standard',
          regulatory_flags: [],
        },
      })
      .select()
      .single()

    if (createError) {
      moduleLogger.error('Failed to create initial report record', { 
        error: createError.message 
      })
      throw new ExternalServiceError({
        message: 'Failed to create report record in database',
        service: 'Database',
        code: 'DB_INSERT_FAILED',
        data: { error: createError },
        cause: createError
      })
    }

    moduleLogger.info('Created initial report record', { reportId: report.id })

  // 2. Build a final data object from the verified data
  // Or if verifiedData not available, fallback to patientInfo
  const finalData = input.verifiedData ?? input.patientInfo
  moduleLogger.info('Preparing data for LLM call', {
    hasSymptoms: !!finalData.symptoms?.length,
    hasMedicalHistory: !!finalData.medicalHistory,
    hasMedications: !!finalData.currentMedications?.length,
    hasAllergies: !!finalData.allergies?.length,
    hasVitalSigns: !!finalData.vitalSigns
  })

  // We'll confirm we use "o3-mini" or "deep-research"
  // let's say we do "o3-mini" for now, or brand it as "deepResearch" in logs
  const chosenModel = 'o3-mini'
  moduleLogger.info('Using model for report generation', { model: chosenModel })

  try {
    // Validate that we have sufficient data to generate a report
    if (!finalData.symptoms?.length && !finalData.medicalHistory) {
      moduleLogger.warn('Insufficient patient data for report generation')
      throw new ValidationError({
        message: 'Insufficient patient data for report generation',
        code: 'INSUFFICIENT_PATIENT_DATA',
        data: { 
          patientId: input.patientId,
          reportId: report.id
        }
      })
    }

    // Create a short summary of the data for the "research topic"
    const researchTopic = `Medical diagnosis analysis for patient with symptoms: ${
      finalData.symptoms?.join(', ') || 'N/A'
    }.
    Medical history: ${finalData.medicalHistory || 'N/A'}.
    Current medications: ${Array.isArray(finalData.currentMedications) ? finalData.currentMedications.join(', ') : 'N/A'}.
    Allergies: ${Array.isArray(finalData.allergies) ? finalData.allergies.join(', ') : 'N/A'}.
    Vital signs: ${finalData.vitalSigns ? JSON.stringify(finalData.vitalSigns) : 'N/A'}.
    `

    moduleLogger.info('Generated research topic for LLM', { 
      topicLength: researchTopic.length 
    })

    // Introduce timeout for API call
    const maxDuration = 30000
    let didTimeout = false
    const abortController = new AbortController()
    const timeout = setTimeout(() => {
      didTimeout = true
      abortController.abort()
      moduleLogger.error('Report generation timed out', { 
        maxDuration,
        reportId: report.id
      })
    }, maxDuration)

    // 3. Call deep-research or LLM API
    moduleLogger.info('Making deep research API call', { 
      endpoint: '/api/deep-research',
      topicPreview: `${researchTopic.substring(0, 100)  }...` 
    })

    const response = await fetch('/api/deep-research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
      body: JSON.stringify({ topic: researchTopic }),
    })

    // If we timed out, let's handle that
    if (didTimeout) {
      moduleLogger.error('LLM call timed out', { reportId: report.id })
      
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          status: 'failed',
          error_message: 'Report generation timed out. Please retry.',
        })
        .eq('id', report.id)
        
      if (updateError) {
        moduleLogger.error('Failed to update report status after timeout', { 
          error: updateError.message 
        })
      }

      throw new ExternalServiceError({
        message: 'Report generation timed out',
        service: 'LLM-Service',
        code: 'TIMEOUT',
        statusCode: 504,
        data: { 
          reportId: report.id,
          maxDuration,
          patientId: input.patientId
        }
      })
    }

    clearTimeout(timeout)
    
    // Check for API errors
    if (!response.ok) {
      moduleLogger.error('Deep research API call failed', { 
        statusCode: response.status,
        statusText: response.statusText
      })
      
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          status: 'failed',
          error_message: `API error: ${response.statusText}`,
        })
        .eq('id', report.id)
        
      throw new ExternalServiceError({
        message: `Deep research API call failed: ${response.statusText}`,
        service: 'DeepResearch',
        code: 'API_ERROR',
        statusCode: response.status,
        data: { 
          reportId: report.id,
          patientId: input.patientId
        }
      })
    }

    moduleLogger.info('Deep research API call successful')
    
    // Parse API response
    let rawLLMData: any
    try {
      rawLLMData = await response.json()
      moduleLogger.info('Received deep research result', { 
        hasContent: !!rawLLMData?.data?.content,
        hasSummary: !!rawLLMData?.data?.summary
      })
    } catch (parseError) {
      moduleLogger.error('Failed to parse API response as JSON', {}, parseError)
      
      await supabase
        .from('reports')
        .update({
          status: 'failed',
          error_message: 'Invalid response format from research API',
        })
        .eq('id', report.id)
        
      throw new ExternalServiceError({
        message: 'Failed to parse deep research API response',
        service: 'DeepResearch',
        code: 'INVALID_RESPONSE_FORMAT',
        data: { reportId: report.id },
        cause: parseError
      })
    }
    
    if (!rawLLMData?.data) {
      moduleLogger.error('Missing data in API response', {
        responseKeys: Object.keys(rawLLMData || {})
      })
      
      await supabase
        .from('reports')
        .update({
          status: 'failed',
          error_message: 'Missing data in research API response',
        })
        .eq('id', report.id)
        
      throw new ExternalServiceError({
        message: 'Missing data in deep research API response',
        service: 'DeepResearch',
        code: 'MISSING_RESPONSE_DATA',
        data: { reportId: report.id }
      })
    }

    // Attempt to validate the response data
    let validatedLLMData: any
    try {
      validatedLLMData = reportSchema.parse(rawLLMData.data)
      moduleLogger.info('Response data validated successfully')
    } catch (parseErr) {
      moduleLogger.warn('Schema validation failed, applying fallback logic', {
        validationError: parseErr instanceof Error ? parseErr.message : String(parseErr)
      })
      
      // Create a partial fallback with default values for missing fields
      validatedLLMData = {
        content: rawLLMData.data?.content ?? '<p>No content</p>',
        summary: rawLLMData.data?.summary ?? 'No summary',
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
      }
      
      moduleLogger.info('Created fallback data structure')
    }

    // 5. Update report with final results
    moduleLogger.info('Updating report with generated content', { reportId: report.id })
    
    const updatePayload = {
      status: 'completed',
      content: validatedLLMData.content,
      summary: validatedLLMData.summary,
      findings: validatedLLMData.findings,
      recommendations: validatedLLMData.recommendations,
      differential_diagnoses: validatedLLMData.differential_diagnoses,
      evidence_mapping: validatedLLMData.evidence_mapping,
      snomed_codes: validatedLLMData.snomed_codes,
      icd_codes: validatedLLMData.icd_codes,
      confidence_score: validatedLLMData.confidence_score,
      source_documents: validatedLLMData.source_documents,
      medical_references: validatedLLMData.medical_references,
      clinical_guidelines: validatedLLMData.clinical_guidelines,
      model_metadata: {
        ...report.model_metadata,
        reasoning_chain: validatedLLMData.reasoningChain || [],
      },
      completed_at: new Date().toISOString(),
    }
    
    const { error: updateError } = await supabase
      .from('reports')
      .update(updatePayload)
      .eq('id', report.id)

    if (updateError) {
      moduleLogger.error('Failed to update report with results', {
        error: updateError.message,
        reportId: report.id
      })
      
      // Try to mark the report as failed if we couldn't update it successfully
      try {
        await supabase
          .from('reports')
          .update({
            status: 'failed',
            error_message: `Failed to save report results: ${updateError.message}`,
          })
          .eq('id', report.id)
      } catch (markFailedError) {
        moduleLogger.error('Could not mark report as failed', {}, markFailedError)
      }

      throw new ExternalServiceError({
        message: 'Failed to update report with generated content',
        service: 'Database',
        code: 'DB_UPDATE_FAILED',
        data: { 
          reportId: report.id,
          error: updateError.message
        },
        cause: updateError
      })
    }

    // Log success and return result
    moduleLogger.info('Report generation completed successfully', { 
      reportId: report.id,
      executionTime: Date.now() - new Date(report.created_at).getTime()
    })
    
    return { 
      success: true, 
      reportId: report.id 
    }
    // End of tryBlock from "// 3. Call deep-research or LLM API"
    } catch (innerError) {
      clearTimeout(timeout)

      // If the error is from abort, we've already updated status
      if (didTimeout) {
        moduleLogger.error('Caught abort error after timeout')
        throw innerError
      }

      // Handle inner errors from the LLM call
      const normalizedError = normalizeError(innerError)
      
      moduleLogger.error('Error during report generation process', { 
        errorCode: normalizedError.code,
        errorType: normalizedError.name
      }, normalizedError)
      
      // Update report status
      try {
        await supabase
          .from('reports')
          .update({
            status: 'failed',
            error_message: normalizedError.message,
          })
          .eq('id', report.id)
          
        moduleLogger.info('Updated report status to failed')
      } catch (updateError) {
        moduleLogger.error('Failed to update report status after error', {}, updateError)
      }
      
      // Rethrow the normalized error
      throw normalizedError
    }
  // End of outer tryBlock from "// Create a structured logger with report generation context"
  } catch (error) {
    // Handle any errors that occur during the report generation process
    const normalizedError = normalizeError(error)
    
    moduleLogger.error('Report generation failed', { 
      errorCode: normalizedError.code,
      statusCode: normalizedError.statusCode,
      isApplicationError: error instanceof ApplicationError
    }, normalizedError)

    // If we have report ID, try to update the status
    if (report?.id) {
      try {
        await supabase
          .from('reports')
          .update({
            status: 'failed',
            error_message: normalizedError.message,
          })
          .eq('id', report.id)
      } catch (updateError) {
        moduleLogger.error('Failed to update report status', {}, updateError)
      }
    }
    
    // Return the normalized error for proper client handling
    throw normalizedError
  }
}
