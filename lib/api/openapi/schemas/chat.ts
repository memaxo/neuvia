/**
 * Chat-related schemas for the OpenAPI specification
 * 
 * These schemas define the structure of chat objects used in the API,
 * closely aligning with the existing TypeScript types
 */
import type { OpenAPIV3 } from 'openapi-types'

export const chatSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  /**
   * Chat modes
   */
  ChatMode: {
    type: 'string',
    enum: [
      'default',
      'patient_summary',
      'research',
      'diagnosis',
      'verification'
    ],
    description: 'Chat interaction mode'
  },

  /**
   * Research depth options
   */
  ResearchDepth: {
    type: 'string',
    enum: ['basic', 'comprehensive', 'expert'],
    description: 'Depth of research to perform'
  },

  /**
   * Research options
   */
  ResearchOptions: {
    type: 'object',
    properties: {
      depth: {
        $ref: '#/components/schemas/ResearchDepth',
        description: 'Depth of research to perform'
      },
      sources: {
        type: 'boolean',
        description: 'Whether to include sources in the response'
      },
      latestOnly: {
        type: 'boolean',
        description: 'Whether to only include the latest research'
      }
    }
  },

  /**
   * Report format
   */
  ReportFormat: {
    type: 'object',
    required: ['format'],
    properties: {
      format: {
        type: 'string',
        enum: ['markdown', 'pdf', 'docx', 'html', 'json'],
        description: 'Format of the report'
      },
      style: {
        type: 'string',
        enum: ['clinical', 'academic', 'simplified'],
        description: 'Style of the report'
      },
      metadataInFooter: {
        type: 'boolean',
        description: 'Whether to include metadata in the footer'
      }
    }
  },

  /**
   * Report options
   */
  ReportOptions: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['markdown', 'pdf', 'docx', 'html', 'json'],
        description: 'Format of the report'
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Whether to include metadata'
      },
      detailLevel: {
        type: 'string',
        enum: ['basic', 'standard', 'comprehensive'],
        description: 'Level of detail in the report'
      }
    }
  },

  /**
   * Message (legacy)
   */
  Message: {
    type: 'object',
    required: ['content', 'role'],
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
        enum: ['system', 'user', 'assistant', 'tool'],
        description: 'Message role'
      },
      createdAt: {
        oneOf: [
          {
            type: 'string',
            format: 'date-time'
          },
          {
            type: 'object',
            description: 'Date object'
          }
        ],
        description: 'Message creation timestamp'
      },
      metadata: {
        type: 'object',
        properties: {
          documentId: {
            type: 'string',
            description: 'Document ID'
          },
          title: {
            type: 'string',
            description: 'Message title'
          },
          isReport: {
            type: 'boolean',
            description: 'Whether this message is a report'
          },
          isResearch: {
            type: 'boolean',
            description: 'Whether this message is research'
          },
          researchOptions: {
            $ref: '#/components/schemas/ResearchOptions',
            description: 'Research options'
          },
          reportFormat: {
            $ref: '#/components/schemas/ReportFormat',
            description: 'Report format'
          },
          verificationStatus: {
            type: 'string',
            enum: ['pending', 'verified', 'rejected'],
            description: 'Verification status'
          },
          sourceDocuments: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Source documents'
          }
        },
        additionalProperties: true,
        description: 'Message metadata'
      }
    }
  },

  /**
   * Chat message
   */
  ChatMessage: {
    type: 'object',
    required: ['content', 'role'],
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
        enum: ['system', 'user', 'assistant', 'tool'],
        description: 'Message role'
      },
      createdAt: {
        oneOf: [
          {
            type: 'string',
            format: 'date-time'
          },
          {
            type: 'object',
            description: 'Date object'
          }
        ],
        description: 'Message creation timestamp'
      },
      metadata: {
        $ref: '#/components/schemas/MessageMetadata',
        description: 'Message metadata'
      }
    }
  },

  /**
   * Chat session state
   */
  ChatSessionState: {
    type: 'object',
    required: ['messages', 'isLoading', 'mode', 'workflowStep'],
    properties: {
      chatId: {
        type: 'string',
        nullable: true,
        description: 'Current chat ID'
      },
      messages: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ChatMessage'
        },
        description: 'Chat messages'
      },
      mode: {
        $ref: '#/components/schemas/ChatMode',
        description: 'Current chat mode'
      },
      isLoading: {
        type: 'boolean',
        description: 'Whether a response is being generated'
      },
      workflowStep: {
        $ref: '#/components/schemas/WorkflowStep',
        description: 'Current workflow step'
      },
      verification: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/VerificationItem'
            },
            description: 'Items being verified'
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
        },
        description: 'Current verification state (if in verification mode)'
      },
      error: {
        type: 'string',
        nullable: true,
        description: 'Error message if any'
      }
    }
  },

  /**
   * Send message request
   */
  SendMessageRequest: {
    type: 'object',
    required: ['message'],
    properties: {
      message: {
        type: 'string',
        description: 'Message content'
      },
      options: {
        type: 'object',
        properties: {
          isCorrection: {
            type: 'boolean',
            description: 'Whether this message is a correction'
          },
          metadata: {
            $ref: '#/components/schemas/MessageMetadata',
            description: 'Message metadata'
          }
        },
        description: 'Message options'
      }
    }
  },

  /**
   * Send message response
   */
  SendMessageResponse: {
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
        required: ['messageId', 'chatId'],
        properties: {
          messageId: {
            type: 'string',
            description: 'ID of the sent message'
          },
          chatId: {
            type: 'string',
            description: 'ID of the chat'
          },
          message: {
            $ref: '#/components/schemas/ChatMessage',
            description: 'The sent message'
          },
          response: {
            $ref: '#/components/schemas/ChatMessage',
            description: 'The response message'
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
   * Chat history response
   */
  ChatHistoryResponse: {
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
        required: ['chatId', 'messages'],
        properties: {
          chatId: {
            type: 'string',
            description: 'Chat ID'
          },
          messages: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ChatMessage'
            },
            description: 'Chat messages'
          },
          mode: {
            $ref: '#/components/schemas/ChatMode',
            description: 'Chat mode'
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            description: 'Chat metadata'
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
   * Start chat request
   */
  StartChatRequest: {
    type: 'object',
    properties: {
      mode: {
        $ref: '#/components/schemas/ChatMode',
        description: 'Chat mode'
      },
      initialMessage: {
        type: 'string',
        description: 'Optional initial message'
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Additional metadata for the chat'
      }
    }
  },

  /**
   * Start chat response
   */
  StartChatResponse: {
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
        required: ['chatId'],
        properties: {
          chatId: {
            type: 'string',
            description: 'Chat ID'
          },
          mode: {
            $ref: '#/components/schemas/ChatMode',
            description: 'Chat mode'
          },
          initialMessage: {
            $ref: '#/components/schemas/ChatMessage',
            description: 'Initial system message (if any)'
          }
        }
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Server timestamp of the response'
      }
    }
  }
}