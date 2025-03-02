/**
 * OpenAPI path definition for patient-related endpoints
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for patient APIs
 */
export const patientPaths: Record<string, OpenAPIV3.PathItemObject> = {
  '/patient/{patientId}/generate-report': {
    post: {
      tags: ['patients', 'reports'],
      summary: 'Generate a patient report',
      description: 'Generates a comprehensive medical report for a specific patient using Perplexity research',
      operationId: 'generatePatientReport',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
        {
          name: 'patientId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Patient ID'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                reportType: {
                  type: 'string',
                  enum: ['diagnosis', 'summary', 'treatment', 'recommendation'],
                  default: 'diagnosis',
                  description: 'Type of report to generate'
                },
                researchDepth: {
                  type: 'string',
                  enum: ['basic', 'comprehensive', 'expert'],
                  default: 'comprehensive',
                  description: 'Depth of research to perform'
                },
                includeSources: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether to include sources in the report'
                },
                format: {
                  type: 'string',
                  enum: ['markdown', 'pdf', 'docx', 'html', 'json'],
                  default: 'pdf',
                  description: 'Format of the report'
                },
                style: {
                  type: 'string',
                  enum: ['clinical', 'academic', 'simplified'],
                  default: 'clinical',
                  description: 'Report style'
                },
                metadataInFooter: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether to include metadata in the report footer'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Workflow ID associated with this report generation'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Report generation initiated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data', 'timestamp'],
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  data: {
                    type: 'object',
                    required: ['reportId', 'status'],
                    properties: {
                      reportId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Report ID'
                      },
                      status: {
                        type: 'string',
                        enum: ['processing', 'completed', 'failed'],
                        default: 'processing',
                        description: 'Status of the report generation'
                      },
                      estimatedCompletionTime: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Estimated time of completion'
                      },
                      message: {
                        type: 'string',
                        description: 'Additional information about the report generation'
                      }
                    }
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time'
                  }
                }
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/BadRequest'
        },
        '401': {
          $ref: '#/components/responses/Unauthorized'
        },
        '404': {
          $ref: '#/components/responses/NotFound'
        },
        '422': {
          $ref: '#/components/responses/ValidationError'
        },
        '500': {
          $ref: '#/components/responses/ServerError'
        }
      }
    }
  },
  
  '/patient/{patientId}/report/{reportId}': {
    get: {
      tags: ['patients', 'reports'],
      summary: 'Get a patient report',
      description: 'Retrieves a generated report for a specific patient',
      operationId: 'getPatientReport',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
        {
          name: 'patientId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Patient ID'
        },
        {
          name: 'reportId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Report ID'
        }
      ],
      responses: {
        '200': {
          description: 'Report retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data', 'timestamp'],
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  data: {
                    $ref: '#/components/schemas/Report'
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time'
                  }
                }
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/BadRequest'
        },
        '401': {
          $ref: '#/components/responses/Unauthorized'
        },
        '404': {
          $ref: '#/components/responses/NotFound'
        },
        '500': {
          $ref: '#/components/responses/ServerError'
        }
      }
    }
  },
  
  '/patient/{patientId}/reports': {
    get: {
      tags: ['patients', 'reports'],
      summary: 'Get patient reports',
      description: 'Retrieves all reports for a specific patient',
      operationId: 'getPatientReports',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
        {
          name: 'patientId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Patient ID'
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10
          },
          description: 'Maximum number of reports to return'
        },
        {
          name: 'offset',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            minimum: 0,
            default: 0
          },
          description: 'Number of reports to skip'
        },
        {
          name: 'type',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            enum: ['all', 'diagnosis', 'summary', 'treatment', 'recommendation'],
            default: 'all'
          },
          description: 'Filter reports by type'
        }
      ],
      responses: {
        '200': {
          description: 'Reports retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'data', 'timestamp'],
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
                  },
                  data: {
                    type: 'object',
                    required: ['reports', 'total'],
                    properties: {
                      reports: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/ReportSummary'
                        },
                        description: 'List of reports'
                      },
                      total: {
                        type: 'integer',
                        description: 'Total number of reports for this patient'
                      },
                      hasMore: {
                        type: 'boolean',
                        description: 'Indicates if there are more reports to fetch'
                      }
                    }
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time'
                  }
                }
              }
            }
          }
        },
        '400': {
          $ref: '#/components/responses/BadRequest'
        },
        '401': {
          $ref: '#/components/responses/Unauthorized'
        },
        '404': {
          $ref: '#/components/responses/NotFound'
        },
        '500': {
          $ref: '#/components/responses/ServerError'
        }
      }
    }
  }
}