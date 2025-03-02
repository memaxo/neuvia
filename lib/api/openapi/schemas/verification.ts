/**
 * Verification-related schemas for the OpenAPI specification
 * 
 * These schemas define the structure of verification objects used in the API,
 * closely aligning with the existing TypeScript types in verification modules
 */
import { OpenAPIV3 } from 'openapi-types'

export const verificationSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  /**
   * Verification status type
   */
  VerificationStatusType: {
    type: 'string',
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    description: 'Current status of the verification process'
  },

  /**
   * Verification status
   */
  VerificationStatus: {
    type: 'object',
    required: ['isVerified', 'verifiedAt'],
    properties: {
      isVerified: {
        type: 'boolean',
        description: 'Whether the item is verified'
      },
      verifiedAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the verification occurred (ISO string format)'
      },
      corrections: {
        type: 'object',
        additionalProperties: {
          type: 'string'
        },
        description: 'Optional corrections to the original data'
      },
      verifiedBy: {
        type: 'string',
        description: 'User who performed the verification (if applicable)'
      }
    }
  },

  /**
   * Verification item change history entry
   */
  VerificationChangeHistoryEntry: {
    type: 'object',
    required: ['id', 'content', 'timestamp'],
    properties: {
      id: {
        type: 'string',
        description: 'Version ID'
      },
      content: {
        type: 'string',
        description: 'Content at this version'
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp of the change'
      },
      userId: {
        type: 'string',
        description: 'User who made the change (if applicable)'
      }
    }
  },

  /**
   * Verification item
   */
  VerificationItem: {
    type: 'object',
    required: [
      'id',
      'title',
      'originalContent',
      'currentContent',
      'isVerified',
      'isModified',
      'changeHistory'
    ],
    properties: {
      id: {
        type: 'string',
        description: 'Unique identifier for this verification item'
      },
      title: {
        type: 'string',
        description: 'Title/label for this verification item'
      },
      description: {
        type: 'string',
        description: 'Description of what needs to be verified'
      },
      originalContent: {
        type: 'string',
        description: 'The original content extracted from the document'
      },
      currentContent: {
        type: 'string',
        description: 'The current content after any corrections'
      },
      isVerified: {
        type: 'boolean',
        description: 'Whether this item has been verified by a user'
      },
      isModified: {
        type: 'boolean',
        description: 'Whether this item has been modified during verification'
      },
      changeHistory: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/VerificationChangeHistoryEntry'
        },
        description: 'History of content changes'
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Metadata for this verification item'
      }
    }
  },

  /**
   * Verification options
   */
  VerificationOptions: {
    type: 'object',
    required: ['isRequired'],
    properties: {
      isRequired: {
        type: 'boolean',
        description: 'Whether verification is required'
      },
      timeoutMs: {
        type: 'integer',
        minimum: 0,
        description: 'Timeout for verification (in milliseconds)'
      },
      autoApproveOnTimeout: {
        type: 'boolean',
        description: 'Whether to auto-approve after timeout'
      },
      userId: {
        type: 'string',
        description: 'User ID performing verification'
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Additional metadata'
      },
      items: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/VerificationItem'
        },
        description: 'Optional verification items to include'
      }
    }
  },

  /**
   * Correction entry in verification metadata
   */
  CorrectionEntry: {
    type: 'object',
    required: ['id', 'text', 'timestamp'],
    properties: {
      id: {
        type: 'string',
        description: 'Correction ID'
      },
      text: {
        type: 'string',
        description: 'Correction text'
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when correction was made'
      }
    }
  },

  /**
   * Verification metadata
   */
  VerificationMetadata: {
    type: 'object',
    required: [
      'verificationStatus',
      'originalSummaryId',
      'currentVersionId',
      'correctionCount',
      'corrections'
    ],
    properties: {
      verificationStatus: {
        $ref: '#/components/schemas/VerificationStatusType',
        description: 'Current verification status'
      },
      originalSummaryId: {
        type: 'string',
        description: 'ID of the original summary'
      },
      currentVersionId: {
        type: 'string',
        description: 'ID of the current version being verified'
      },
      correctionCount: {
        type: 'integer',
        minimum: 0,
        description: 'Number of corrections applied'
      },
      verifiedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when the summary was verified'
      },
      verifiedBy: {
        type: 'string',
        description: 'User ID who verified the summary'
      },
      corrections: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/CorrectionEntry'
        },
        description: 'History of corrections applied'
      },
      extractedData: {
        type: 'object',
        additionalProperties: true,
        description: 'Extracted document data'
      },
      startedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when verification started'
      },
      lastUpdated: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp of last update'
      }
    }
  },

  /**
   * Message metadata for verification
   */
  MessageMetadata: {
    type: 'object',
    properties: {
      isSummary: {
        type: 'boolean',
        description: 'Whether this message contains a summary'
      },
      isVerificationRequest: {
        type: 'boolean',
        description: 'Whether this message is requesting verification'
      },
      isCorrection: {
        type: 'boolean',
        description: 'Whether this message is a correction to a summary'
      },
      isProgress: {
        type: 'boolean',
        description: 'Whether this message is a progress update'
      },
      summaryVersionId: {
        type: 'string',
        description: 'ID of the summary version this message refers to'
      },
      progressValue: {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Progress value (0-100) for progress messages'
      },
      progressPhase: {
        type: 'string',
        description: 'Current phase for progress messages'
      },
      verificationMetadata: {
        $ref: '#/components/schemas/VerificationMetadata',
        description: 'Reference to verification metadata if applicable'
      }
    },
    additionalProperties: true
  },

  /**
   * Verification result
   */
  VerificationResult: {
    type: 'object',
    required: [
      'isCompleted',
      'isApproved',
      'items',
      'verificationMetadata'
    ],
    properties: {
      isCompleted: {
        type: 'boolean',
        description: 'Whether verification was completed'
      },
      isApproved: {
        type: 'boolean',
        description: 'Whether the content was approved'
      },
      items: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/VerificationItem'
        },
        description: 'List of verification items with their verification status'
      },
      completedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp of verification completion'
      },
      completedBy: {
        type: 'string',
        description: 'User who completed verification'
      },
      verificationTime: {
        type: 'integer',
        minimum: 0,
        description: 'Time taken for verification (in milliseconds)'
      },
      verificationMetadata: {
        $ref: '#/components/schemas/VerificationMetadata',
        description: 'Detailed metadata about the verification process'
      }
    }
  },

  /**
   * Verification message
   */
  VerificationMessage: {
    type: 'object',
    required: [
      'id',
      'content',
      'role',
      'metadata',
      'createdAt'
    ],
    properties: {
      id: {
        type: 'string',
        description: 'Message ID'
      },
      content: {
        type: 'string',
        description: 'Message content'
      },
      role: {
        type: 'string',
        enum: ['system', 'user', 'assistant'],
        description: 'Message role'
      },
      isVerificationRequest: {
        type: 'boolean',
        description: 'Whether this message is a verification request'
      },
      isSummary: {
        type: 'boolean',
        description: 'Whether this message contains summary content'
      },
      isCorrection: {
        type: 'boolean',
        description: 'Whether this message is a correction'
      },
      metadata: {
        $ref: '#/components/schemas/MessageMetadata',
        description: 'Metadata for this message'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Creation timestamp'
      }
    }
  },

  /**
   * Verified document
   */
  VerifiedDocument: {
    type: 'object',
    required: [
      'id',
      'extractedDocumentId',
      'createdAt',
      'documentType',
      'verificationItems',
      'verifiedData',
      'originalData',
      'verificationStatus'
    ],
    properties: {
      id: {
        type: 'string',
        description: 'Unique identifier'
      },
      extractedDocumentId: {
        type: 'string',
        description: 'The original extracted document ID'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Creation timestamp'
      },
      patientId: {
        type: 'string',
        format: 'uuid',
        description: 'Patient ID'
      },
      documentType: {
        $ref: '#/components/schemas/DocumentType',
        description: 'Document type information'
      },
      verificationItems: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/VerificationItem'
        },
        description: 'Verification items'
      },
      verifiedData: {
        type: 'object',
        additionalProperties: true,
        description: 'The verified data (after corrections)'
      },
      originalData: {
        type: 'object',
        additionalProperties: true,
        description: 'Original extraction data'
      },
      verificationStatus: {
        $ref: '#/components/schemas/VerificationStatus',
        description: 'Overall verification status'
      },
      _uiState: {
        type: 'object',
        properties: {
          isUIVerificationComplete: {
            type: 'boolean',
            description: 'Whether all verification steps are completed in the UI'
          },
          uiVerifiedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when the verification was completed in the UI'
          }
        },
        description: 'Optional UI state for verification tracking'
      }
    }
  },

  /**
   * Start verification request
   */
  StartVerificationRequest: {
    type: 'object',
    required: ['content'],
    properties: {
      content: {
        type: 'string',
        description: 'Content to be verified'
      },
      options: {
        $ref: '#/components/schemas/VerificationOptions',
        description: 'Verification options'
      }
    }
  },

  /**
   * Start verification response
   */
  StartVerificationResponse: {
    type: 'object',
    required: ['success', 'data', 'timestamp'],
    properties: {
      success: {
        type: 'boolean',
        example: true,
        description: 'Indicates successful operation'
      },
      data: {
        type: 'object',
        required: ['verificationId', 'items', 'status'],
        properties: {
          verificationId: {
            type: 'string',
            description: 'ID of the verification process'
          },
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/VerificationItem'
            },
            description: 'Items that need verification'
          },
          status: {
            $ref: '#/components/schemas/VerificationStatusType',
            description: 'Current verification status'
          },
          metadata: {
            $ref: '#/components/schemas/VerificationMetadata',
            description: 'Verification metadata'
          }
        }
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Server timestamp of the response'
      }
    }
  },

  /**
   * Submit correction request
   */
  SubmitCorrectionRequest: {
    type: 'object',
    required: ['correction', 'verificationId'],
    properties: {
      correction: {
        type: 'string',
        description: 'Correction text'
      },
      verificationId: {
        type: 'string',
        description: 'ID of the verification process'
      },
      itemId: {
        type: 'string',
        description: 'Optional ID of the specific verification item being corrected'
      }
    }
  },

  /**
   * Complete verification request
   */
  CompleteVerificationRequest: {
    type: 'object',
    required: ['verificationId', 'isApproved'],
    properties: {
      verificationId: {
        type: 'string',
        description: 'ID of the verification process'
      },
      isApproved: {
        type: 'boolean',
        description: 'Whether the content is approved'
      },
      comments: {
        type: 'string',
        description: 'Optional comments about the verification'
      }
    }
  },

  /**
   * Complete verification response
   */
  CompleteVerificationResponse: {
    type: 'object',
    required: ['success', 'data', 'timestamp'],
    properties: {
      success: {
        type: 'boolean',
        example: true,
        description: 'Indicates successful operation'
      },
      data: {
        $ref: '#/components/schemas/VerificationResult',
        description: 'Verification result'
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Server timestamp of the response'
      }
    }
  }
}