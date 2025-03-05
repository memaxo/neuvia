/**
 * @fileoverview React Query hooks for verification-related API calls
 * 
 * Hooks in this file:
 * 1. useGetDocumentVerification        - GET /document-verification
 * 2. useGenerateDocumentVerification   - POST /document-verification
 * 3. useGetPatientSummaryVerification  - GET /patient/{patientId}/verify-summary
 * 4. useUpdatePatientSummaryVerification - POST /patient/{patientId}/verify-summary
 *
 * These hooks align with the standardized approach of using React Query for data fetching.
 * We rely on the auto-generated client methods from the OpenAPI-based ApiClient.
 *
 * Notable changes:
 *  - Hook names now match server-side API operation IDs for clarity.
 *  - Parameter types updated to reflect canonical types from verification endpoints.
 *  - Comprehensive JSDoc comments included for better clarity.
 *  - Error handling aligns with react-query's onError approach.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from '../api-client'
import type { VerificationOptions } from '@/lib/types/verification'
import type { UUID } from '@/lib/types/database'
import type { VerificationItem } from '@/lib/types/workflow'

/**
 * Initialize an API client instance for verification endpoints.
 */
const apiClient = new ApiClient()

/**
 * Hook: useGetDocumentVerification
 *
 * Fetches the verification status of a document by ID.
 * Wrapper around GET /document-verification?extractedDocumentId=...
 *
 * @param extractedDocumentId - The UUID of the extracted document
 * @returns React Query's UseQueryResult object
 *
 * Usage:
 * const { data, error, isLoading } = useGetDocumentVerification(documentId)
 */
export function useGetDocumentVerification(extractedDocumentId: UUID) {
  return useQuery(
    ['verification', 'document', extractedDocumentId],
    async () => {
      // Call the auto-generated client method
      return await apiClient.verification.getDocumentVerification({ extractedDocumentId })
    },
    {
      enabled: Boolean(extractedDocumentId),
      onError: (err) => {
        // Custom error handling if needed
        // e.g., log or show toast
        // console.error('Error fetching document verification:', err)
      },
    }
  )
}

/**
 * Parameter type for generating document verification
 */
export interface GenerateDocumentVerificationParams {
  /** Document UUID */
  documentId: UUID
  /** Workflow UUID for tracking this verification process */
  workflowId: UUID
  /** Optional verification options */
  options?: VerificationOptions
}

/**
 * Hook: useGenerateDocumentVerification
 *
 * Generates verification items and status for a specified document.
 * Wrapper around POST /document-verification
 *
 * @returns A mutation object from React Query
 *
 * Usage:
 * const { mutate: generateVerification } = useGenerateDocumentVerification()
 * generateVerification({ documentId, workflowId, options })
 */
export function useGenerateDocumentVerification() {
  const queryClient = useQueryClient()

  return useMutation(
    async (params: GenerateDocumentVerificationParams) => {
      return await apiClient.verification.generateDocumentVerification(params)
    },
    {
      onSuccess: (data, variables) => {
        // After successful generation, we can invalidate the relevant queries
        queryClient.invalidateQueries(['verification', 'document', variables.documentId])
      },
      onError: (err) => {
        // handle error - optionally show toast or track
        // console.error('Error generating document verification:', err)
      },
    }
  )
}

/**
 * Hook: useGetPatientSummaryVerification
 *
 * Retrieves the verification status of a patient summary by patient ID.
 * Wrapper around GET /patient/{patientId}/verify-summary
 *
 * @param patientId - The UUID of the patient
 * @returns React Query's UseQueryResult object
 *
 * Usage:
 * const { data, error, isLoading } = useGetPatientSummaryVerification(patientId)
 */
export function useGetPatientSummaryVerification(patientId: UUID) {
  return useQuery(
    ['verification', 'patient', patientId],
    async () => {
      return await apiClient.verification.getPatientSummaryVerification(patientId)
    },
    {
      enabled: Boolean(patientId),
      onError: (err) => {
        // handle error if needed
        // console.error('Error fetching patient summary verification:', err)
      },
    }
  )
}

/**
 * Parameter type for updating a patient summary verification
 */
export interface UpdatePatientSummaryVerificationParams {
  /** Patient UUID */
  patientId: UUID
  /** Verification status to set: 'pending' | 'verified' | 'rejected' */
  status: 'pending' | 'verified' | 'rejected'
  /** Optional comments about the verification */
  comments?: string
  /** Optional updated verification items */
  items?: VerificationItem[]
}

/**
 * Hook: useUpdatePatientSummaryVerification
 *
 * Updates the verification status of a patient summary.
 * Wrapper around POST /patient/{patientId}/verify-summary
 *
 * @returns A mutation object from React Query
 *
 * Usage:
 * const { mutate: updateVerification } = useUpdatePatientSummaryVerification()
 * updateVerification({ patientId, status: 'verified', comments: 'All good', items: [...] })
 */
export function useUpdatePatientSummaryVerification() {
  const queryClient = useQueryClient()

  return useMutation(
    async (params: UpdatePatientSummaryVerificationParams) => {
      const { patientId, ...updateData } = params
      return await apiClient.verification.updatePatientSummaryVerification(patientId, updateData)
    },
    {
      onSuccess: (data, variables) => {
        // Invalidate relevant queries on success
        queryClient.invalidateQueries(['verification', 'patient', variables.patientId])
      },
      onError: (err) => {
        // console.error('Error updating patient summary verification:', err)
      },
    }
  )
}