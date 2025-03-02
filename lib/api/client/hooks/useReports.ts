/**
 * Report generation hooks
 * 
 * Generated from OpenAPI specification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from '../api-client'
import { GenerateReportRequest, UpdateReportRequest } from '../models'

// Initialize API client
const apiClient = new ApiClient()

/**
 * Hook for generating a report
 */
export const useGenerateReport = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (params: GenerateReportRequest) => apiClient.reports.generateReport(params),
    {
      onSuccess: () => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['reports'])
      }
    }
  )
}

/**
 * Hook for getting a report
 */
export const useReport = (reportId: string) => {
  return useQuery(
    ['reports', reportId],
    () => apiClient.reports.getReport({ reportId }),
    {
      enabled: !!reportId,
    }
  )
}

/**
 * Hook for listing reports
 */
export const useReports = (patientId?: string, page = 1, limit = 10) => {
  return useQuery(
    ['reports', 'list', patientId, page, limit],
    () => apiClient.reports.listReports({ patientId, page, limit })
  )
}

/**
 * Hook for updating a report
 */
export const useUpdateReport = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (params: { reportId: string, updateData: UpdateReportRequest }) => 
      apiClient.reports.updateReport(params),
    {
      onSuccess: (data, variables) => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['reports', variables.reportId])
      }
    }
  )
}

/**
 * Hook for deleting a report
 */
export const useDeleteReport = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (reportId: string) => apiClient.reports.deleteReport({ reportId }),
    {
      onSuccess: () => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['reports'])
      }
    }
  )
}
