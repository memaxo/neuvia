/**
 * OpenAPI path definition for report-related endpoints
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for report generation and management APIs
 */
export const reportPaths: Record<string, OpenAPIV3.PathItemObject> = {
  '/reports/generate': {
    post: {
      tags: ['reports'],
      summary: 'Generate a report',
      description: 'Generates a report from patient data and workflow state',
      operationId: 'generateReport',
      security: [
        { bearerAuth: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['patientId'],
              properties: {
                patientId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Patient ID for whom to generate the report'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Workflow ID associated with this report generation'
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
                detailLevel: {
                  type: 'string',
                  enum: ['basic', 'standard', 'comprehensive'],
                  default: 'standard',
                  description: 'Level of detail in the report'
                },
                includeVerificationData: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether to include verification data in the report'
                },
                metadataInFooter: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether to include metadata in the report footer'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Report generated successfully',
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
                    required: ['id', 'content', 'format'],
                    properties: {
                      id: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Report ID'
                      },
                      title: {
                        type: 'string',
                        description: 'Report title'
                      },
                      content: {
                        type: 'string',
                        description: 'Report content in the specified format'
                      },
                      format: {
                        type: 'string',
                        enum: ['markdown', 'pdf', 'docx', 'html', 'json'],
                        description: 'Format of the report'
                      },
                      generatedAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Timestamp when the report was generated'
                      },
                      patientId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Patient ID'
                      },
                      size: {
                        type: 'integer',
                        description: 'Size of the report in bytes'
                      },
                      url: {
                        type: 'string',
                        format: 'url',
                        description: 'URL to download the report (if applicable)'
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
  
  '/reports/{reportId}/format': {
    post: {
      tags: ['reports'],
      summary: 'Format an existing report',
      description: 'Change the format of an existing report',
      operationId: 'formatReport',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
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
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['format'],
              properties: {
                format: {
                  type: 'string',
                  enum: ['markdown', 'pdf', 'docx', 'html', 'json'],
                  description: 'Format to convert the report to'
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
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Report formatted successfully',
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
                    required: ['id', 'content', 'format'],
                    properties: {
                      id: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Report ID (may be a new ID)'
                      },
                      content: {
                        type: 'string',
                        description: 'Formatted report content'
                      },
                      format: {
                        type: 'string',
                        enum: ['markdown', 'pdf', 'docx', 'html', 'json'],
                        description: 'Format of the report'
                      },
                      formattedAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Timestamp when the report was formatted'
                      },
                      url: {
                        type: 'string',
                        format: 'url',
                        description: 'URL to download the report (if applicable)'
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
  
  '/reports/{reportId}': {
    get: {
      tags: ['reports'],
      summary: 'Get a report',
      description: 'Retrieve a specific report by ID',
      operationId: 'getReport',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
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
  }
}