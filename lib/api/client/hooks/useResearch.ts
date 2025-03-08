/**
 * Research hooks
 * 
 * Generated from OpenAPI specification
 */
import { useMutation } from '@tanstack/react-query'
import { ApiClient } from "../api-client"
import type { PerformResearchRequest } from '../models'

// Initialize API client
const apiClient = new ApiClient()

/**
 * Hook for performing research
 */
export const useResearch = () => {
  return useMutation(
    (params: PerformResearchRequest) => apiClient.research.performResearch(params)
  )
}
