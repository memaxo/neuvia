/**
 * Chat functionality hooks
 * 
 * Generated from OpenAPI specification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from '../api-client'
import type { FileUpload } from '@/lib/types/upload'

// Initialize API client
const apiClient = new ApiClient()

/**
 * Hook for uploading chat attachments
 */
export const useChatAttachmentUpload = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    async (params: {
      file: File, 
      chatId: string, 
      messageId?: string,
      onProgress?: (progress: number, status: string) => void
    }): Promise<FileUpload> => {
      return apiClient.chat.uploadAttachment(params)
    },
    {
      onSuccess: () => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['chat'])
      }
    }
  )
}

/**
 * Hook for retrieving chat history
 */
export const useChatHistory = (chatId: string) => {
  return useQuery(['chat', chatId], () => 
    apiClient.chat.getChatHistory({ chatId })
  )
}

/**
 * Hook for sending a message
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (params: { chatId: string, content: string, attachments?: string[] }) => 
      apiClient.chat.sendMessage(params),
    {
      onSuccess: (_, variables) => {
        // Invalidate chat history query
        queryClient.invalidateQueries(['chat', variables.chatId])
      }
    }
  )
}