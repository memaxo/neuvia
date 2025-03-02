/**
 * API Client index file 
 * Provides centralized exports for all API Client components
 */

// Export main API client
export { ApiClient } from './api-client'

// Export models
export * from './models/data-contracts'
export { HttpClient, ContentType, RequestParams } from './models/http-client'

// Export services
export { Auth } from './services/auth-service'
export { Chat } from './services/chat-service'
export { Documents } from './services/documents-service'
export { Email } from './services/email-service'
export { Patients } from './services/patients-service'
export { Reports } from './services/reports-service'
export { Research } from './services/research-service'
export { Security } from './services/security-service'
export { Verification } from './services/verification-service'

// Export hooks
export * from './hooks/useAuthentication'
export * from './hooks/useChat'
export * from './hooks/useDocuments'
export * from './hooks/usePatients'
export * from './hooks/useProfile'
export * from './hooks/useReports'
export * from './hooks/useResearch'
export * from './hooks/useVerification'
