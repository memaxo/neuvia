/**
 * OpenAPI path definition for verification-related endpoints
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for patient verification APIs
 */
export const verificationPaths: Record<string, OpenAPIV3.PathItemObject> = {
  '/verification/submit-correction': {
    post: {
      tags: ['verification'],
      summary: 'Submit a correction to verified content',
      description: 'Processes user correction on verified content like a patient summary',
      operationId: 'submitCorrection',
      security: [
        { bearerAuth: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['correction', 'currentSummary'],
              properties: {
                correction: {
                  type: 'string',
                  description: 'The correction text provided by the user'
                },
                currentSummary: {
                  type: 'string',
                  description: 'The current summary content being corrected'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'The workflow ID associated with this correction'
                },
                messageId: {
                  type: 'string',
                  description: 'Optional ID of the message associated with this correction'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Correction processed successfully',
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
                    required: ['summaryId', 'summary'],
                    properties: {
                      summaryId: {
                        type: 'string',
                        description: 'ID of the updated summary'
                      },
                      summary: {
                        type: 'string', 
                        description: 'Updated summary with correction applied'
                      },
                      structuredData: {
                        type: 'object',
                        additionalProperties: true,
                        description: 'Structured data extracted from the summary'
                      },
                      correctionCount: {
                        type: 'integer',
                        minimum: 0,
                        description: 'Total number of corrections applied'
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
  },
  
  '/verification/process-correction': {
    post: {
      tags: ['verification'],
      summary: 'Process a correction to verified content',
      description: 'Processes a correction to verified content and returns updated content',
      operationId: 'processCorrection',
      security: [
        { bearerAuth: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['correction', 'currentSummary'],
              properties: {
                correction: {
                  type: 'string',
                  description: 'The correction text'
                },
                currentSummary: {
                  type: 'string',
                  description: 'The current summary content'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'The workflow ID associated with this correction'
                },
                messageId: {
                  type: 'string',
                  description: 'Optional ID of message associated with this correction'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Correction processed successfully',
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
                    required: ['summaryId', 'summary'],
                    properties: {
                      summaryId: {
                        type: 'string',
                        description: 'ID of the updated summary'
                      },
                      summary: {
                        type: 'string', 
                        description: 'Updated summary with correction applied'
                      },
                      structuredData: {
                        type: 'object',
                        additionalProperties: true,
                        description: 'Structured data extracted from the summary'
                      },
                      correctionCount: {
                        type: 'integer',
                        minimum: 0,
                        description: 'Total number of corrections applied'
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
  },
  
  '/verification/generate': {
    post: {
      tags: ['verification'],
      summary: 'Generate verification for a document',
      description: 'Generates verification items and summary for a document',
      operationId: 'generateVerification',
      security: [
        { bearerAuth: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['document'],
              properties: {
                document: {
                  type: 'object',
                  additionalProperties: true,
                  description: 'The document to be verified'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'The workflow ID for this verification'
                },
                messageId: {
                  type: 'string',
                  description: 'Optional ID of message associated with this verification'
                },
                summaryId: {
                  type: 'string',
                  description: 'Optional ID for the generated summary'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Verification generated successfully',
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
                    required: ['summaryId', 'summary'],
                    properties: {
                      summaryId: {
                        type: 'string',
                        description: 'ID of the generated summary'
                      },
                      summary: {
                        type: 'string',
                        description: 'Summary content generated from the document'
                      },
                      structuredData: {
                        type: 'object',
                        additionalProperties: true,
                        description: 'Structured data extracted from the document'
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
  },
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