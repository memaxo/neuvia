/**
 * Document management hooks
 * 
 * Generated from OpenAPI specification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from "../api-client"
import type { DocumentSearchQuery, DocumentUploadRequest } from '../models'

// Initialize API client
const apiClient = new ApiClient()

/**
 * Hook for searching documents
 */
export const useDocumentSearch = () => {
  return useMutation(
    (params: DocumentSearchQuery) => apiClient.documents.searchDocuments(params)
  )
}

/**
 * Hook for uploading a document
 */
export const useDocumentUpload = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (params: DocumentUploadRequest) => apiClient.documents.uploadDocument(params),
    {
      onSuccess: () => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['documents'])
      }
    }
  )
}

/**
 * Hook for ingesting documents into vector store
 */
export const useDocumentIngest = () => {
  return useMutation(
    (params: { text: string, metadata?: Record<string, any> }) => 
      apiClient.retrieval.ingestDocument(params)
  )
}

/**
 * Hook for processing documents
 */
export const useDocumentProcess = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    (params: { 
      file: File, 
      patientId: string,
      documentType: any,
      metadata?: Record<string, any>,
      onStatusUpdate?: (status: any) => void
    }) => 
      apiClient.documents.processDocument(params),
    {
      onSuccess: () => {
        // Invalidate relevant queries
        queryClient.invalidateQueries(['documents'])
        queryClient.invalidateQueries(['patients'])
      }
    }
  )
}
