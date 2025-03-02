/**
 * Patients service implementation
 */
import type { HttpClient, RequestParams } from "../models/http-client";
import { ContentType } from "../models/http-client"

export class Patients<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http
  }

  /**
   * Get patient summary
   */
  getPatientSummary = (
    patientId: string,
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/patient/${patientId}/summary`,
      method: 'GET',
      format: 'json',
      ...params,
    })
  }

  /**
   * Verify patient summary
   */
  verifyPatientSummary = (
    patientId: string,
    data: {
      summaryId: string
      isApproved: boolean
      comments?: string
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/patient/${patientId}/verify-summary`,
      method: 'POST',
      body: data,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
  }

  /**
   * Get patient by ID
   */
  getPatient = (
    patientId: string,
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/patients/${patientId}`,
      method: 'GET',
      format: 'json',
      ...params,
    })
  }

  /**
   * List patients
   */
  listPatients = (
    query?: {
      page?: number
      limit?: number
      search?: string
      filters?: Record<string, any>
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/patients`,
      method: 'GET',
      query,
      format: 'json',
      ...params,
    })
  }

  /**
   * Create a new patient
   */
  createPatient = (
    data: {
      name: string
      dateOfBirth?: string
      gender?: string
      contactInfo?: any
      medicalHistory?: any
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/patients`,
      method: 'POST',
      body: data,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
  }

  /**
   * Update patient
   */
  updatePatient = (
    patientId: string,
    data: {
      name?: string
      dateOfBirth?: string
      gender?: string
      contactInfo?: any
      medicalHistory?: any
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/patients/${patientId}`,
      method: 'PUT',
      body: data,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
  }

  /**
   * Delete patient
   */
  deletePatient = (
    patientId: string,
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/patients/${patientId}`,
      method: 'DELETE',
      format: 'json',
      ...params,
    })
  }
}