/**
 * Documents service implementation
 */
import type { HttpClient, RequestParams } from "../models/http-client";
import { ContentType } from "../models/http-client"
import { DocumentType, DocumentMetadata } from '../models/data-contracts'

export class Documents<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http
  }

  /**
   * Upload document to storage
   */
  uploadDocument = (
    data: {
      file: File
      patientId: string
      documentType?: string
      documentCategory?: string
      metadata?: Record<string, any>
      onStatusUpdate?: (status: any) => void
    },
    params: RequestParams = {},
  ) => {
    const formData = new FormData()
    formData.append('file', data.file)
    formData.append('patientId', data.patientId)
    
    if (data.documentType) {
      formData.append('documentType', data.documentType)
    }
    
    if (data.documentCategory) {
      formData.append('documentCategory', data.documentCategory)
    }
    
    if (data.metadata) {
      formData.append('metadata', JSON.stringify(data.metadata))
    }

    return this.http.request({
      path: `/documents/upload`,
      method: 'POST',
      body: formData,
      type: ContentType.FormData,
      format: 'json',
      ...params,
    })
  }

  /**
   * Process document for extraction
   */
  processDocument = (
    data: {
      file: File
      patientId: string
      documentType?: string
      documentCategory?: string
      onStatusUpdate?: (status: any) => void
    },
    params: RequestParams = {},
  ) => {
    const formData = new FormData()
    formData.append('file', data.file)
    formData.append('patientId', data.patientId)
    
    if (data.documentType) {
      formData.append('documentType', data.documentType)
    }
    
    if (data.documentCategory) {
      formData.append('documentCategory', data.documentCategory)
    }

    return this.http.request({
      path: `/documents/process`,
      method: 'POST',
      body: formData,
      type: ContentType.FormData,
      format: 'json',
      ...params,
    })
  }

  /**
   * Get document by ID
   */
  getDocument = (
    documentId: string,
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/documents/${documentId}`,
      method: 'GET',
      format: 'json',
      ...params,
    })
  }

  /**
   * List documents, optionally filtered by patient ID
   */
  listDocuments = (
    query?: {
      patientId?: string
      page?: number
      limit?: number
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/documents`,
      method: 'GET',
      query,
      format: 'json',
      ...params,
    })
  }

  /**
   * Delete a document
   */
  deleteDocument = (
    documentId: string,
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/documents/${documentId}`,
      method: 'DELETE',
      format: 'json',
      ...params,
    })
  }
}