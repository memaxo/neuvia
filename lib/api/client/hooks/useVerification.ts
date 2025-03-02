/**
 * Verification hooks
 * 
 * Generated from OpenAPI specification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from "../api-client"
import { StartVerificationRequest, SubmitCorrectionRequest, CompleteVerificationRequest } from '../models'

// Initialize API client
const apiClient = new ApiClient()

/**
 * Hook for getting document verification status
 */
export const useDocumentVerification = (documentId: string) => {
  return useQuery(
    ['verification', 'document', documentId],
    () => apiClient.verification.getDocumentVerification({ extractedDocumentId: documentId }),
    {
      enabled: !!documentId,
    }
  )
}

/**
 * Hook for generating document verification
 */
export const useGenerateVerification = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (params: { documentId: string, workflowId: string }) => 
      apiClient.verification.generateDocumentVerification(params),
    {
      onSuccess: (data, variables) => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['verification', 'document', variables.documentId])
      }
    }
  )
}

/**
 * Hook for getting patient summary verification status
 */
export const usePatientSummaryVerification = (patientId: string) => {
  return useQuery(
    ['verification', 'patient', patientId],
    () => apiClient.verification.getPatientSummaryVerification({ patientId }),
    {
      enabled: !!patientId,
    }
  )
}

/**
 * Hook for updating patient summary verification
 */
export const useUpdatePatientSummaryVerification = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (params: { patientId: string, status: string, comments?: string }) => 
      apiClient.verification.updatePatientSummaryVerification(params),
    {
      onSuccess: (data, variables) => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['verification', 'patient', variables.patientId])
      }
    }
  )
}
