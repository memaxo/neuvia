/**
 * Profile management hooks
 * 
 * Generated from OpenAPI specification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from "../api-client"

// Initialize API client
const apiClient = new ApiClient()

/**
 * Hook for uploading avatar
 */
export const useAvatarUpload = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    async (params: {
      file: File,
      userId: string,
      onProgress?: (progress: number, status: string) => void
    }): Promise<string> => {
      return apiClient.profile.uploadAvatar(params)
    },
    {
      onSuccess: () => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['profile'])
      }
    }
  )
}

/**
 * Hook for user profile data
 */
export const useProfile = (userId: string) => {
  return useQuery(['profile', userId], () => 
    apiClient.profile.getProfile({ userId })
  )
}

/**
 * Hook for updating user profile
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (params: { userId: string, data: Record<string, any> }) => 
      apiClient.profile.updateProfile(params),
    {
      onSuccess: (_, variables) => {
        // Invalidate profile query
        queryClient.invalidateQueries(['profile', variables.userId])
      }
    }
  )
}