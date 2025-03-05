/**
 * OpenAPI path definition for verification-related endpoints
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for patient and document verification APIs
 * Aligned with canonical verification types from lib/types/verification.ts
 */
export const verificationPaths: Record<string, OpenAPIV3.PathItemObject> = {
  /**
   * Submits a correction for verified content (such as a patient summary).
   * Corresponds to the "SubmitCorrection" operation in our code.
   */
  '/verification/submit-correction': {
    post: {
      tags: ['verification'],
      summary: 'Submit a correction to verified content',
      description:
        'Processes user corrections on verified content (e.g., a patient summary) and returns updated summary information.',
      operationId: 'submitCorrection',
      security: [{ bearerAuth: [] }],
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
                  description: 'The text of the user-provided correction',
                  example: 'Update patient name from "Jon" to "John"'
                },
                currentSummary: {
                  type: 'string',
                  description: 'The current summary content before correction',
                  example: 'Patient name is Jon Smith'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description:
                    'The workflow ID associated with this correction. Ties the correction to a specific verification workflow.'
                },
                messageId: {
                  type: 'string',
                  description: 'Optional ID of the message associated with this correction'
                }
              },
              example: {
                correction: 'Change medication dosage from 5mg to 10mg',
                currentSummary: 'Patient is taking 5mg daily of Medication X.',
                workflowId: 'd2a2b1cf-7bfb-42f4-b04c-856dddb66a24',
                messageId: 'message-123'
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
                        description: 'Unique identifier of the updated summary'
                      },
                      summary: {
                        type: 'string', 
                        description: 'Updated summary content with corrections applied'
                      },
                      structuredData: {
                        type: 'object',
                        additionalProperties: true,
                        description: 'Optional structured data extracted or updated from the summary'
                      },
                      correctionCount: {
                        type: 'integer',
                        description: 'Total number of corrections applied in this workflow',
                        minimum: 0
                      }
                    },
                    example: {
                      summaryId: 'sum-789',
                      summary: 'Patient is taking 10mg daily of Medication X.',
                      structuredData: { dosage: '10mg' },
                      correctionCount: 3
                    }
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Time of response generation in ISO8601 format',
                    example: '2025-03-04T12:34:56.000Z'
                  }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '422': { $ref: '#/components/responses/ValidationError' },
        '500': { $ref: '#/components/responses/ServerError' }
      }
    }
  },

  /**
   * Processes a correction to verified content.
   * Corresponds to the "ProcessCorrection" operation in our code.
   */
  '/verification/process-correction': {
    post: {
      tags: ['verification'],
      summary: 'Process a correction to verified content',
      description:
        'Processes a user-provided correction for verified content and returns the updated summary, including any structured data changes.',
      operationId: 'processCorrection',
      security: [{ bearerAuth: [] }],
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
                  description: 'The text of the correction'
                },
                currentSummary: {
                  type: 'string',
                  description: 'The current summary content to be corrected'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description:
                    'The workflow ID associated with this correction. Ties the correction to a specific verification workflow.'
                },
                messageId: {
                  type: 'string',
                  description: 'Optional ID of the message associated with this correction'
                }
              },
              example: {
                correction: 'Change blood pressure measurement to 120/80',
                currentSummary: 'Previous record shows 130/85',
                workflowId: '95c720c2-7f8c-46d4-a3a6-6f7e204dc0ba',
                messageId: 'message-456'
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
                        description: 'Updated summary content after applying the correction'
                      },
                      structuredData: {
                        type: 'object',
                        additionalProperties: true,
                        description: 'Structured data that might have changed due to the correction'
                      },
                      correctionCount: {
                        type: 'integer',
                        minimum: 0,
                        description: 'Total number of corrections applied so far'
                      }
                    },
                    example: {
                      summaryId: 'sum-999',
                      summary: 'Blood pressure measurement updated to 120/80',
                      structuredData: { bloodPressure: '120/80' },
                      correctionCount: 1
                    }
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Time of response generation',
                    example: '2025-03-04T14:20:00.000Z'
                  }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '422': { $ref: '#/components/responses/ValidationError' },
        '500': { $ref: '#/components/responses/ServerError' }
      }
    }
  },

  /**
   * Generates verification items and summary for a document.
   * Corresponds to the "GenerateVerification" operation in our code.
   */
  '/verification/generate': {
    post: {
      tags: ['verification'],
      summary: 'Generate verification for a document',
      description:
        'Generates verification items and a new summary from the provided document content, applying any relevant extraction or analysis logic.',
      operationId: 'generateVerification',
      security: [{ bearerAuth: [] }],
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
                  description: 'Raw or structured data representing the document content'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Workflow ID tracking this verification process'
                },
                messageId: {
                  type: 'string',
                  description: 'Optional ID of a message associated with this verification'
                },
                summaryId: {
                  type: 'string',
                  description: 'Optional ID for the generated summary content'
                }
              },
              example: {
                document: {
                  text: 'Patient has a history of hypertension and is on medication A.'
                },
                workflowId: '2937ccbe-fec7-4f56-866b-eb545a921f68',
                messageId: 'message-789',
                summaryId: 'sum-101'
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
                        description: 'Summary content derived from the document'
                      },
                      structuredData: {
                        type: 'object',
                        additionalProperties: true,
                        description: 'Any structured data extracted from the document'
                      }
                    },
                    example: {
                      summaryId: 'sum-111',
                      summary: 'Patient has a history of hypertension, currently on medication A.',
                      structuredData: { conditions: ['hypertension'], meds: ['Medication A'] }
                    }
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2025-03-04T15:45:00.000Z'
                  }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '422': { $ref: '#/components/responses/ValidationError' },
        '500': { $ref: '#/components/responses/ServerError' }
      }
    }
  },

  /**
   * Retrieves or updates the verification status of a patient summary.
   * GET => "getPatientSummaryVerification"
   * POST => "updatePatientSummaryVerification"
   */
  '/patient/{patientId}/verify-summary': {
    get: {
      tags: ['verification', 'patients'],
      summary: 'Get patient summary verification status',
      description: 'Retrieves the current verification status and items for a given patient summary.',
      operationId: 'getPatientSummaryVerification',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'patientId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Unique Patient ID'
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
                        type: 'string',
                        enum: ['pending', 'inProgress', 'completed', 'failed'],
                        description: 'Overall verification status for the patient summary',
                        example: 'inProgress'
                      },
                      items: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/VerificationItem' },
                        description: 'List of verification items requiring review'
                      },
                      metadata: {
                        $ref: '#/components/schemas/VerificationMetadata',
                        description: 'Additional verification metadata tracking corrections, timestamps, etc.'
                      },
                      originalContent: {
                        type: 'string',
                        description: 'Original content being verified'
                      },
                      currentContent: {
                        type: 'string',
                        description: 'Current content after any user-provided corrections'
                      }
                    },
                    example: {
                      verificationStatus: 'inProgress',
                      items: [
                        {
                          id: 'item-001',
                          title: 'Patient Name',
                          originalContent: 'Jon Smythe',
                          currentContent: 'John Smith',
                          isVerified: false,
                          isModified: true,
                          changeHistory: [],
                          metadata: {}
                        }
                      ],
                      metadata: {
                        verificationStatus: 'inProgress',
                        originalSummaryId: 'sum-123',
                        currentVersionId: 'sum-456',
                        correctionCount: 1,
                        corrections: []
                      },
                      originalContent: 'Patient: Jon Smythe',
                      currentContent: 'Patient: John Smith'
                    }
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2025-03-04T16:00:00.000Z'
                  }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '500': { $ref: '#/components/responses/ServerError' }
      }
    },
    post: {
      tags: ['verification', 'patients'],
      summary: 'Update patient summary verification status',
      description: 'Updates the status of a patient summary verification, e.g. marking it verified or rejected.',
      operationId: 'updatePatientSummaryVerification',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'patientId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Unique Patient ID'
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
                  enum: ['pending', 'inProgress', 'completed', 'failed'],
                  default: 'inProgress',
                  description: 'Verification status to set'
                },
                comments: {
                  type: 'string',
                  description: 'Optional comments explaining the verification update'
                },
                items: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/VerificationItem' },
                  description: 'Updated verification items if changes occurred'
                }
              },
              example: {
                status: 'completed',
                comments: 'All items verified. No further corrections needed.',
                items: [
                  {
                    id: 'item-001',
                    title: 'Diagnosis',
                    originalContent: 'Hypertension Stage 1',
                    currentContent: 'Hypertension Stage 1 (confirmed)',
                    isVerified: true,
                    isModified: false,
                    changeHistory: [],
                    metadata: {}
                  }
                ]
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
                    description: 'Finalized verification result including any changes'
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2025-03-04T17:20:00.000Z'
                  }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '500': { $ref: '#/components/responses/ServerError' }
      }
    }
  },

  /**
   * Retrieves or creates verification items for a specific document.
   * GET => "getDocumentVerification"
   * POST => "generateDocumentVerification"
   */
  '/document-verification': {
    get: {
      tags: ['verification', 'documents'],
      summary: 'Get document verification status',
      description: 'Retrieves the current verification status of a document by its unique ID.',
      operationId: 'getDocumentVerification',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'documentId',
          in: 'query',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Unique document ID for which verification status is requested'
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
                    type: 'object',
                    description: 'Verified document data or verification status details',
                    additionalProperties: true
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2025-03-04T18:00:00.000Z'
                  }
                },
                example: {
                  success: true,
                  data: {
                    documentId: 'df9b12a0-ff8a-4620-912e-0bcf65167d8b',
                    verificationStatus: 'inProgress',
                    items: [
                      {
                        id: 'item-doc-001',
                        originalContent: 'Imaging result: No abnormalities found',
                        currentContent: 'Imaging result: Clear scan',
                        isVerified: false,
                        isModified: true
                      }
                    ]
                  },
                  timestamp: '2025-03-04T18:00:00.000Z'
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '500': { $ref: '#/components/responses/ServerError' }
      }
    },
    post: {
      tags: ['verification', 'documents'],
      summary: 'Generate verification items for a document',
      description: 'Creates verification items for a given document ID, returning the new or updated verification state.',
      operationId: 'generateDocumentVerification',
      security: [{ bearerAuth: [] }],
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
                  description: 'Unique document ID to generate verification items for'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Unique workflow ID to track this verification process'
                },
                options: {
                  type: 'object',
                  additionalProperties: true,
                  description:
                    'Optional verification settings such as confidence thresholds or auto-approval on timeout'
                }
              },
              example: {
                documentId: 'df9b12a0-ff8a-4620-912e-0bcf65167d8b',
                workflowId: '2937ccbe-fec7-4f56-866b-eb545a921f68',
                options: {
                  isRequired: true,
                  autoApproveOnTimeout: false,
                  confidenceThreshold: 0.8
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
                        description: 'Unique ID referencing the created verification process'
                      },
                      workflowId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Workflow ID provided in the request, returned for convenience'
                      },
                      items: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/VerificationItem' },
                        description: 'Verification items generated for this document'
                      },
                      status: {
                        type: 'string',
                        enum: ['pending', 'inProgress', 'completed', 'failed'],
                        description: 'Current verification status'
                      }
                    },
                    example: {
                      verificationId: '887c9a91-4abd-4865-a7f9-9e695fdb9951',
                      workflowId: '2937ccbe-fec7-4f56-866b-eb545a921f68',
                      items: [
                        {
                          id: 'item-doc-001',
                          originalContent: 'Lab test shows elevated cholesterol',
                          currentContent: 'Lab test shows elevated cholesterol',
                          isVerified: false,
                          isModified: false,
                          changeHistory: []
                        }
                      ],
                      status: 'pending'
                    }
                  },
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2025-03-04T19:30:00.000Z'
                  }
                }
              }
            }
          }
        },
        '400': { $ref: '#/components/responses/BadRequest' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '422': { $ref: '#/components/responses/ValidationError' },
        '500': { $ref: '#/components/responses/ServerError' }
      }
    }
  }
}