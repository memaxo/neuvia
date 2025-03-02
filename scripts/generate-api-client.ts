/**
 * Script to generate TypeScript API client from OpenAPI specification
 * 
 * This script generates a strongly-typed API client for the Neuvia API
 * using the OpenAPI specification. It creates:
 * 
 * 1. API client classes for each tag
 * 2. TypeScript interfaces for request/response types
 * 3. React hooks for use in the frontend
 */
import fs from 'fs'
import path from 'path'
import { generateApi } from 'swagger-typescript-api'
import { openAPISpec, getOpenAPISpecAsJSON } from '../lib/api/openapi'

// Make sure API paths are registered
import '../lib/api/openapi/paths'

/**
 * Configuration
 */
const OUTPUT_DIR = path.resolve(__dirname, '../lib/api/client')
const API_CLIENT_PATH = path.join(OUTPUT_DIR, 'api-client.ts')
const HOOKS_PATH = path.join(OUTPUT_DIR, 'hooks')
const MODELS_PATH = path.join(OUTPUT_DIR, 'models')
const TEMP_SPEC_PATH = path.join(__dirname, 'temp-openapi.json')

/**
 * Generate API client
 */
async function generateApiClient() {
  console.log('Generating API client from OpenAPI spec...')
  
  // Create output directories if they don't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  if (!fs.existsSync(HOOKS_PATH)) {
    fs.mkdirSync(HOOKS_PATH, { recursive: true })
  }
  if (!fs.existsSync(MODELS_PATH)) {
    fs.mkdirSync(MODELS_PATH, { recursive: true })
  }
  
  try {
    // Write spec to temporary file
    fs.writeFileSync(TEMP_SPEC_PATH, getOpenAPISpecAsJSON())
    
    // Generate API client
    const result = await generateApi({
      name: 'ApiClient',
      output: OUTPUT_DIR,
      input: TEMP_SPEC_PATH,
      generateClient: true,
      generateRouteTypes: true,
      generateResponses: true,
      enumNamesAsValues: true,
      moduleNameFirstTag: true,
      singleHttpClient: true,
      prettier: {
        printWidth: 100,
        tabWidth: 2,
        trailingComma: 'all',
        singleQuote: true,
      },
      defaultResponseAsSuccess: false,
      extractRequestParams: true,
      unwrapResponseData: true,
      modular: true,
      hooks: {
        onCreateComponent: (component) => {
          // Customize component generation if needed
          return component
        },
        onCreateRequestParams: (rawType) => {
          // Process request params if needed
          return rawType
        },
        onCreateRoute: (routeData) => {
          // Customize route generation if needed
          return routeData
        },
        onFormatTypeName: (typeName, rawTypeName) => {
          // Format type names if needed
          return typeName
        },
      },
    })
    
    // Generate React hooks for API endpoints
    console.log('Generating React hooks...')
    generateReactHooks()
    
    // Cleanup temp file
    if (fs.existsSync(TEMP_SPEC_PATH)) {
      fs.unlinkSync(TEMP_SPEC_PATH)
    }
    
    console.log('API client generated successfully at:', OUTPUT_DIR)
  } catch (error) {
    console.error('Error generating API client:', error)
    // Cleanup temp file
    if (fs.existsSync(TEMP_SPEC_PATH)) {
      fs.unlinkSync(TEMP_SPEC_PATH)
    }
    process.exit(1)
  }
}

/**
 * Generate React hooks for API endpoints
 */
function generateReactHooks() {
  const indexContent = `/**
 * React Hooks for Neuvia API
 * 
 * Generated from OpenAPI specification
 */
export * from './useAuthentication'
export * from './useDocuments'
export * from './useVerification'
export * from './usePatients'
export * from './useReports'
export * from './useResearch'
`
  fs.writeFileSync(path.join(HOOKS_PATH, 'index.ts'), indexContent)
  
  // Generate authentication hooks
  generateAuthHooks()
  
  // Generate document hooks
  generateDocumentHooks()
  
  // Generate verification hooks
  generateVerificationHooks()
  
  // Generate patient hooks
  generatePatientHooks()
  
  // Generate research hooks
  generateResearchHooks()
}

/**
 * Generate authentication hooks
 */
function generateAuthHooks() {
  const content = `/**
 * Authentication hooks
 * 
 * Generated from OpenAPI specification
 */
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ApiClient } from '../api-client'

// Initialize API client
const apiClient = new ApiClient()

/**
 * Hook for handling authentication state
 */
export const useAuthentication = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  // Check if user is authenticated
  const { data, isLoading, refetch } = useQuery(
    ['auth', 'status'],
    async () => {
      // Implementation depends on your auth approach
      try {
        // This would be replaced with actual auth check logic
        const user = await apiClient.user.getCurrentUser()
        setIsAuthenticated(!!user)
        return user
      } catch (error) {
        setIsAuthenticated(false)
        return null
      }
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  )
  
  return {
    isAuthenticated,
    user: data,
    isLoading,
    refetch,
  }
}
`
  fs.writeFileSync(path.join(HOOKS_PATH, 'useAuthentication.ts'), content)
}

/**
 * Generate document hooks
 */
function generateDocumentHooks() {
  const content = `/**
 * Document management hooks
 * 
 * Generated from OpenAPI specification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from '../api-client'
import { DocumentSearchQuery, DocumentUploadRequest } from '../models'

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
`
  fs.writeFileSync(path.join(HOOKS_PATH, 'useDocuments.ts'), content)
}

/**
 * Generate verification hooks
 */
function generateVerificationHooks() {
  const content = `/**
 * Verification hooks
 * 
 * Generated from OpenAPI specification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from '../api-client'
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
`
  fs.writeFileSync(path.join(HOOKS_PATH, 'useVerification.ts'), content)
}

/**
 * Generate patient hooks
 */
function generatePatientHooks() {
  const content = `/**
 * Patient management hooks
 * 
 * Generated from OpenAPI specification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from '../api-client'

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
`
  fs.writeFileSync(path.join(HOOKS_PATH, 'usePatients.ts'), content)
}

/**
 * Generate research hooks
 */
function generateResearchHooks() {
  const content = `/**
 * Research hooks
 * 
 * Generated from OpenAPI specification
 */
import { useMutation } from '@tanstack/react-query'
import { ApiClient } from '../api-client'
import { PerformResearchRequest } from '../models'

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
`
  fs.writeFileSync(path.join(HOOKS_PATH, 'useResearch.ts'), content)
}

/**
 * Generate report hooks
 */
function generateReportHooks() {
  const content = `/**
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
`
  fs.writeFileSync(path.join(HOOKS_PATH, 'useReports.ts'), content)
}

// Run the script
generateApiClient()