/**
 * Patient management hooks
 * 
 * Generated from OpenAPI specification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from "../api-client"

// Initialize API client
const apiClient = new ApiClient()

/**
 * Hook for getting patient summary verification
 */
export const usePatientSummary = (patientId: string) => {
  return useQuery(
    ['patients', patientId, 'summary'],
    () => apiClient.patients.getPatientSummary({ patientId }),
    {
      enabled: !!patientId,
    }
  )
}

/**
 * Hook for verifying patient summary
 */
export const useVerifyPatientSummary = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (params: { patientId: string, status?: string, comments?: string }) => 
      apiClient.patients.verifyPatientSummary(params),
    {
      onSuccess: (data, variables) => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['patients', variables.patientId, 'summary'])
      }
    }
  )
}
