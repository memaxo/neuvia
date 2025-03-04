/**
 * Workflows service implementation
 * Provides methods for interacting with workflow states and transitions
 */
import type { HttpClient, RequestParams } from "../models/http-client";
import { ContentType } from "../models/http-client"
import type { WorkflowStep, ProcessingPhase } from "@/lib/types/workflow";

export class Workflows<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http
  }

  /**
   * Create a new workflow state
   */
  createWorkflow = (
    data: {
      workflowType: string
      userId: string
      patientId?: string
      initialStep?: WorkflowStep
      metadata?: Record<string, any>
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/workflows`,
      method: 'POST',
      body: data,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
  }

  /**
   * Update workflow state
   */
  updateWorkflowState = (
    workflowId: string,
    data: {
      step: WorkflowStep
      progress?: number
      phase?: ProcessingPhase
      metadata?: Record<string, any>
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/workflows/${workflowId}`,
      method: 'PATCH',
      body: data,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
  }

  /**
   * Get workflow by ID
   */
  getWorkflow = (
    workflowId: string,
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/workflows/${workflowId}`,
      method: 'GET',
      format: 'json',
      ...params,
    })
  }

  /**
   * List workflows with optional filtering
   */
  listWorkflows = (
    query?: {
      userId?: string
      patientId?: string
      workflowType?: string
      page?: number
      limit?: number
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/workflows`,
      method: 'GET',
      query,
      format: 'json',
      ...params,
    })
  }

  /**
   * Mark workflow as error
   */
  markWorkflowError = (
    workflowId: string,
    data: {
      error: string
      errorDetails?: Record<string, any>
      previousStep?: WorkflowStep
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/workflows/${workflowId}/error`,
      method: 'POST',
      body: data,
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
  }

  /**
   * Complete a workflow
   */
  completeWorkflow = (
    workflowId: string,
    data?: {
      metadata?: Record<string, any>
    },
    params: RequestParams = {},
  ) => {
    return this.http.request({
      path: `/workflows/${workflowId}/complete`,
      method: 'POST',
      body: data || {},
      type: ContentType.Json,
      format: 'json',
      ...params,
    })
  }
}