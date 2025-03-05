/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ## (Manually revised to ensure type consistency)             ##
 * ---------------------------------------------------------------
 */

import type { HttpClient, RequestParams } from '../models/http-client'
import { ContentType } from '../models/http-client'
import type { UUID } from '@/lib/types/database'
import type {
  SubmitCorrectionOptions,
  ProcessCorrectionOptions,
  GenerateVerificationOptions,
  VerificationItem,
  VerificationResult,
  VerificationStatusType,
  VerificationMetadata,
} from '@/lib/types/verification'

/**
 * Standard error response shape for this service,
 * matching the error object in the swagger definitions.
 */
interface ErrorResponse {
  error: {
    message: string
    code: string
    /** @format date-time */
    timestamp: string
    details?: object
  }
}

/**
 * Response shape for correction-based endpoints
 */
interface CorrectionResponse {
  /** @example true */
  success: boolean
  data: {
    /** ID of the updated or processed summary */
    summaryId: string
    /** Updated/processed summary content */
    summary: string
    /** Optional structured data extracted from the summary */
    structuredData?: Record<string, unknown>
    /**
     * Total number of corrections applied
     * @min 0
     */
    correctionCount?: number
  }
  /** @format date-time */
  timestamp: string
}

/**
 * Response for verification generation requests
 */
interface GenerateVerificationResponse {
  /** @example true */
  success: boolean
  data: {
    /** ID of the generated summary */
    summaryId: string
    /** Summary content generated from the document */
    summary: string
    /** Structured data extracted from the document */
    structuredData?: Record<string, unknown>
  }
  /** @format date-time */
  timestamp: string
}

/**
 * Response for patient summary verification retrieval
 */
interface GetPatientSummaryVerificationResponse {
  /** @example true */
  success: boolean
  data: {
    /** Current verification status */
    verificationStatus: VerificationStatusType
    /** Verification items */
    items: VerificationItem[]
    /** Verification metadata */
    metadata?: VerificationMetadata
    /** Original content being verified */
    originalContent?: string
    /** Current content after any corrections */
    currentContent?: string
  }
  /** @format date-time */
  timestamp: string
}

/**
 * Shape for updating a patient's summary verification status
 */
interface UpdatePatientSummaryVerificationParams {
  /**
   * Verification status to set
   * @default "verified"
   */
  status: 'pending' | 'verified' | 'rejected'
  /** Optional comments about the verification */
  comments?: string
  /** Updated verification items */
  items?: VerificationItem[]
}

/**
 * Response for updating a patient's summary verification
 */
interface UpdatePatientSummaryVerificationResponse {
  /** @example true */
  success: boolean
  /** Verification result */
  data: VerificationResult
  /** @format date-time */
  timestamp: string
}

/**
 * Response shape for retrieving a document's verification status
 */
interface GetDocumentVerificationResponse {
  /** @example true */
  success: boolean
  /** Verified document data */
  data: {
    /** Unique ID or reference for the verified document */
    documentId?: UUID
    /** Additional verified content or metadata */
    [key: string]: unknown
  }
  /** @format date-time */
  timestamp: string
}

/**
 * Params for generating document verification
 */
interface GenerateDocumentVerificationParams {
  /**
   * Document ID
   * @format uuid
   */
  documentId: UUID
  /**
   * Workflow ID
   * @format uuid
   */
  workflowId: UUID
  /** Verification options */
  options?: Record<string, unknown> // Could refine with VerificationOptions, if fully supported
}

/**
 * Response for generating document verification
 */
interface GenerateDocumentVerificationResponse {
  /** @example true */
  success: boolean
  data: {
    /**
     * Verification process ID
     * @format uuid
     */
    verificationId: UUID
    /**
     * Workflow ID
     * @format uuid
     */
    workflowId?: UUID
    /** Verification items */
    items: VerificationItem[]
    /** Verification status */
    status?: VerificationStatusType
  }
  /** @format date-time */
  timestamp: string
}

/**
 * Verification class providing endpoints for
 * - corrections (submit/process)
 * - document verification
 * - patient summary verification
 */
export class Verification<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http
  }

  /**
   * @description Processes user correction on verified content like a patient summary
   *
   * @tags verification
   * @name submitCorrection
   * @summary Submit a correction to verified content
   * @request POST:/verification/submit-correction
   * @secure
   */
  submitCorrection = (
    data: SubmitCorrectionOptions,
    params: RequestParams = {}
  ) =>
    this.http.request<CorrectionResponse, ErrorResponse>({
      path: `/verification/submit-correction`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })

  /**
   * @description Processes a correction to verified content and returns updated content
   *
   * @tags verification
   * @name processCorrection
   * @summary Process a correction to verified content
   * @request POST:/verification/process-correction
   * @secure
   */
  processCorrection = (
    data: ProcessCorrectionOptions,
    params: RequestParams = {}
  ) =>
    this.http.request<CorrectionResponse, ErrorResponse>({
      path: `/verification/process-correction`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })

  /**
   * @description Generates verification items and summary for a document
   *
   * @tags verification
   * @name generateVerification
   * @summary Generate verification for a document
   * @request POST:/verification/generate
   * @secure
   */
  generateVerification = (
    data: GenerateVerificationOptions,
    params: RequestParams = {}
  ) =>
    this.http.request<GenerateVerificationResponse, ErrorResponse>({
      path: `/verification/generate`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })

  /**
   * @description Retrieves the verification status of a patient summary
   *
   * @tags verification, patients
   * @name getPatientSummaryVerification
   * @summary Get patient summary verification status
   * @request GET:/patient/{patientId}/verify-summary
   * @secure
   */
  getPatientSummaryVerification = (
    patientId: UUID,
    params: RequestParams = {}
  ) =>
    this.http.request<GetPatientSummaryVerificationResponse, ErrorResponse>({
      path: `/patient/${patientId}/verify-summary`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    })

  /**
   * @description Updates the verification status of a patient summary
   *
   * @tags verification, patients
   * @name updatePatientSummaryVerification
   * @summary Update patient summary verification status
   * @request POST:/patient/{patientId}/verify-summary
   * @secure
   */
  updatePatientSummaryVerification = (
    patientId: UUID,
    data: UpdatePatientSummaryVerificationParams,
    params: RequestParams = {}
  ) =>
    this.http.request<UpdatePatientSummaryVerificationResponse, ErrorResponse>({
      path: `/patient/${patientId}/verify-summary`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })

  /**
   * @description Retrieves the verification status of a document
   *
   * @tags verification, documents
   * @name getDocumentVerification
   * @summary Get document verification status
   * @request GET:/document-verification
   * @secure
   */
  getDocumentVerification = (
    extractedDocumentId: UUID,
    params: RequestParams = {}
  ) =>
    this.http.request<GetDocumentVerificationResponse, ErrorResponse>({
      path: `/document-verification`,
      method: 'GET',
      query: { extractedDocumentId },
      secure: true,
      format: 'json',
      ...params,
    })

  /**
   * @description Creates verification items for a document
   *
   * @tags verification, documents
   * @name generateDocumentVerification
   * @summary Generate verification items for a document
   * @request POST:/document-verification
   * @secure
   */
  generateDocumentVerification = (
    data: GenerateDocumentVerificationParams,
    params: RequestParams = {}
  ) =>
    this.http.request<GenerateDocumentVerificationResponse, ErrorResponse>({
      path: `/document-verification`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
}