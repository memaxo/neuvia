/**
 * OpenAPI path definition for verification-related endpoints
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for patient verification APIs
 */
export const verificationPaths: Record<string, OpenAPIV3.PathItemObject> = {
  '/patient/{patientId}/verify-summary': {
    get: {
      tags: ['verification', 'patients'],
      summary: 'Get patient summary verification status',
      description: 'Retrieves the verification status of a patient summary',
      operationId: 'getPatientSummaryVerification',
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
      responses: {
        '200': {
          description: 'Summary verification status retrieved successfully',
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
                    required: ['verificationStatus', 'items'],
                    properties: {
                      verificationStatus: {
                        $ref: '#/components/schemas/VerificationStatusType',
                        description: 'Current verification status'
                      },
                      items: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/VerificationItem'
                        },
                        description: 'Verification items'
                      },
                      metadata: {
                        $ref: '#/components/schemas/VerificationMetadata',
                        description: 'Verification metadata'
                      },
                      originalContent: {
                        type: 'string',
                        description: 'Original content being verified'
                      },
                      currentContent: {
                        type: 'string',
                        description: 'Current content after any corrections'
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
    },
    post: {
      tags: ['verification', 'patients'],
      summary: 'Update patient summary verification status',
      description: 'Updates the verification status of a patient summary',
      operationId: 'updatePatientSummaryVerification',
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
              required: ['status'],
              properties: {
                status: {
                  type: 'string',
                  enum: ['pending', 'verified', 'rejected'],
                  default: 'verified',
                  description: 'Verification status to set'
                },
                comments: {
                  type: 'string',
                  description: 'Optional comments about the verification'
                },
                items: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/VerificationItem'
                  },
                  description: 'Updated verification items'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Verification status updated successfully',
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
                    $ref: '#/components/schemas/VerificationResult',
                    description: 'Verification result'
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
  '/document-verification': {
    get: {
      tags: ['verification', 'documents'],
      summary: 'Get document verification status',
      description: 'Retrieves the verification status of a document',
      operationId: 'getDocumentVerification',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
        {
          name: 'extractedDocumentId',
          in: 'query',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Extracted document ID'
        }
      ],
      responses: {
        '200': {
          description: 'Document verification status retrieved successfully',
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
                    $ref: '#/components/schemas/VerifiedDocument',
                    description: 'Verified document data'
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
    },
    post: {
      tags: ['verification', 'documents'],
      summary: 'Generate verification items for a document',
      description: 'Creates verification items for a document',
      operationId: 'generateDocumentVerification',
      security: [
        { bearerAuth: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['documentId', 'workflowId'],
              properties: {
                documentId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Document ID'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Workflow ID'
                },
                options: {
                  $ref: '#/components/schemas/VerificationOptions',
                  description: 'Verification options'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Verification items generated successfully',
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
                    required: ['verificationId', 'items'],
                    properties: {
                      verificationId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Verification process ID'
                      },
                      workflowId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Workflow ID'
                      },
                      items: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/VerificationItem'
                        },
                        description: 'Verification items'
                      },
                      status: {
                        $ref: '#/components/schemas/VerificationStatusType',
                        description: 'Verification status'
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
        '422': {
          $ref: '#/components/responses/ValidationError'
        },
        '500': {
          $ref: '#/components/responses/ServerError'
        }
      }
    }
  }
}