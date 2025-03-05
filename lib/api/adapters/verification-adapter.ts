import { apiClient } from '@/lib/api/client/api-client'

/**
 * @fileoverview Adapter layer for verification-related HTTP calls.
 * Separates raw external API calls from domain logic in the service layer.
 */
export const verificationAdapter = {
  /**
   * Calls the external server to generate verification for a document.
   */
  async generateVerificationRequest(params: {
    document: Record<string, any>
    workflowId?: string
    messageId?: string
    summaryId?: string
  }) {
    return apiClient.verification.generateVerification(params)
  },

  /**
   * Calls the external server to fetch document verification status.
   */
  async getDocumentVerification(extractedDocumentId: string) {
    return apiClient.verification.getDocumentVerification({
      extractedDocumentId,
    })
  },

  /**
   * Calls the external server to update a patient summary verification.
   */
  async updatePatientSummaryVerification(
    id: string,
    data: {
      status: string
      items?: any[]
      comments?: string
    }
  ) {
    return apiClient.verification.updatePatientSummaryVerification(id, data)
  },

  /**
   * Calls the external server to get patient summary verification status.
   */
  async getPatientSummaryVerification(patientId: string) {
    return apiClient.verification.getPatientSummaryVerification(patientId)
  },
}