/**
 * Document-related schemas for the OpenAPI specification
 * 
 * These schemas define the structure of document objects used throughout
 * the API, closely aligning with the existing TypeScript types
 */
import type { OpenAPIV3 } from 'openapi-types'

export const documentSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  /**
   * Document category enum
   */
  DocumentCategory: {
    type: 'string',
    enum: ['clinical', 'lab', 'imaging', 'prescription', 'administrative'],
    description: 'Category of medical document'
  },

  /**
   * Document type information
   */
  DocumentType: {
    type: 'object',
    required: ['category', 'type'],
    properties: {
      category: {
        $ref: '#/components/schemas/DocumentCategory',
        description: 'Document category'
      },
      type: {
        type: 'string',
        description: 'Specific document type within the category'
      }
    }
  },

  /**
   * Document metadata
   */
  DocumentMetadata: {
    type: 'object',
    properties: {
      uploaded_by: {
        type: 'string',
        format: 'uuid',
        description: 'User ID who uploaded the document'
      },
      patient_id: {
        type: 'string',
        format: 'uuid',
        description: 'Patient ID if this is a patient document'
      },
      document_type: {
        $ref: '#/components/schemas/DocumentType',
        description: 'Document type information'
      },
      title: {
        type: 'string',
        description: 'Original filename'
      },
      file_type: {
        type: 'string',
        description: 'File format (MIME type)'
      },
      file_size: {
        type: 'integer',
        minimum: 0,
        description: 'File size in bytes'
      },
      checksum: {
        type: 'string',
        description: 'Document hash for deduplication'
      },
      created_at: {
        type: 'string',
        format: 'date-time',
        description: 'Extraction timestamp'
      },
      processing_status: {
        type: 'string',
        enum: ['pending', 'processing', 'completed', 'error'],
        description: 'Processing status'
      },
      page_number: {
        type: 'integer',
        minimum: 1,
        description: 'Page number (for multi-page documents)'
      },
      chunk_index: {
        type: 'integer',
        minimum: 0,
        description: 'Chunk index (for chunked documents)'
      },
      custom: {
        type: 'object',
        additionalProperties: true,
        description: 'Additional custom metadata'
      },
      content_hash: {
        type: 'string',
        description: 'Content hash for deduplication within langchain'
      }
    }
  },

  /**
   * Document chunk
   */
  DocumentChunk: {
    type: 'object',
    required: ['id', 'content', 'chunk_index', 'token_count'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Chunk ID'
      },
      document_id: {
        type: 'string',
        format: 'uuid',
        description: 'Document ID this chunk belongs to'
      },
      content: {
        type: 'string',
        description: 'Chunk text content'
      },
      chunk_index: {
        type: 'integer',
        minimum: 0,
        description: 'Chunk index in the document'
      },
      page_number: {
        type: 'integer',
        minimum: 1,
        description: 'Page number'
      },
      token_count: {
        type: 'integer',
        minimum: 0,
        description: 'Token count'
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Metadata for the chunk'
      },
      heading: {
        type: 'string',
        description: 'Heading or section title'
      },
      importance_score: {
        type: 'number',
        description: 'Importance score'
      }
    }
  },

  /**
   * Workflow step enum
   */
  WorkflowStep: {
    type: 'string',
    enum: [
      'idle',
      'uploading',
      'extracting',
      'verification',
      'report_generation',
      'complete',
      'chat_started',
      'chat_in_progress',
      'chat_completed',
      'chat_error',
      'research',
      'report_presentation',
      'verification_pending',
      'verification_in_progress',
      'verification_completed',
      'verification_failed',
      'error'
    ],
    description: 'Current step in the workflow process'
  },

  /**
   * Processing phase enum
   */
  ProcessingPhase: {
    type: 'string',
    enum: [
      'initialization',
      'uploading',
      'extraction',
      'analysis',
      'verification',
      'correction',
      'research',
      'report_generation',
      'completion',
      'extraction_completed',
      'error'
    ],
    description: 'Current phase of processing'
  },

  /**
   * Extracted document
   */
  ExtractedDocument: {
    type: 'object',
    required: ['id', 'created_at', 'document_type', 'extractedData', 'is_processed', 'processing_status'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Document ID'
      },
      created_at: {
        type: 'string',
        format: 'date-time',
        description: 'Creation timestamp'
      },
      document_type: {
        $ref: '#/components/schemas/DocumentType',
        description: 'Document type'
      },
      patient_id: {
        type: 'string',
        format: 'uuid',
        description: 'Patient ID'
      },
      extractedData: {
        type: 'object',
        required: ['content_text', 'metadata'],
        properties: {
          content_text: {
            type: 'string',
            description: 'Raw document text'
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            description: 'Document metadata'
          },
          chunks: {
            type: 'array',
            items: {
              type: 'object',
              required: ['content'],
              properties: {
                content: {
                  type: 'string',
                  description: 'Chunk content'
                },
                page_number: {
                  type: 'integer',
                  description: 'Page number'
                }
              }
            },
            description: 'Document chunks'
          }
        }
      },
      is_processed: {
        type: 'boolean',
        description: 'Whether extraction was successful'
      },
      processing_error: {
        type: 'string',
        description: 'Error message if extraction failed'
      },
      processing_status: {
        type: 'string',
        description: 'Processing status'
      }
    }
  },

  /**
   * Document embedding
   */
  DocumentEmbedding: {
    type: 'object',
    required: ['id', 'content', 'embedding', 'created_at'],
    properties: {
      id: {
        type: 'integer',
        description: 'Document ID (numerical in the actual DB)'
      },
      content: {
        type: 'string',
        description: 'Document content'
      },
      embedding: {
        type: 'string',
        description: 'Embedding vector (stored as string in Postgres)'
      },
      metadata: {
        $ref: '#/components/schemas/DocumentMetadata',
        description: 'Document metadata'
      },
      created_at: {
        type: 'string',
        format: 'date-time',
        description: 'Creation timestamp'
      },
      document_id: {
        type: 'integer',
        description: 'Reference to document'
      }
    }
  },

  /**
   * Document search query
   */
  DocumentSearchQuery: {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      filter: {
        type: 'object',
        additionalProperties: true,
        description: 'Filter metadata (optional)'
      },
      match_count: {
        type: 'integer',
        minimum: 1,
        default: 5,
        description: 'Number of results to return (match_count in RPC)'
      },
      match_threshold: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        default: 0.5,
        description: 'Minimum similarity threshold (0-1) (match_threshold in RPC)'
      },
      patient_id: {
        type: 'string',
        format: 'uuid',
        description: 'Patient ID filter'
      }
    }
  },

  /**
   * Document search result
   */
  DocumentSearchResult: {
    type: 'object',
    required: ['content', 'similarity'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Document ID'
      },
      document_id: {
        type: 'string',
        format: 'uuid',
        description: 'Document ID this chunk belongs to'
      },
      content: {
        type: 'string',
        description: 'Document content'
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Metadata'
      },
      similarity: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Similarity score (0-1)'
      }
    }
  },

  /**
   * Document search response
   */
  DocumentSearchResponse: {
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
        required: ['results', 'query'],
        properties: {
          results: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/DocumentSearchResult'
            },
            description: 'Search results'
          },
          query: {
            type: 'string',
            description: 'Original search query'
          },
          metadata: {
            type: 'object',
            properties: {
              total_matches: {
                type: 'integer',
                description: 'Total number of matches found'
              },
              processing_time_ms: {
                type: 'integer',
                description: 'Processing time in milliseconds'
              }
            }
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
   * Document upload request
   */
  DocumentUploadRequest: {
    type: 'object',
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: 'Document file to upload'
      },
      patient_id: {
        type: 'string',
        format: 'uuid',
        description: 'Patient ID'
      },
      document_type: {
        $ref: '#/components/schemas/DocumentType',
        description: 'Document type information'
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Additional metadata'
      }
    }
  },

  /**
   * Document upload response
   */
  DocumentUploadResponse: {
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
        required: ['document_id', 'url'],
        properties: {
          document_id: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the uploaded document'
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'URL to access the document'
          },
          processing_status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'error'],
            description: 'Processing status'
          },
          metadata: {
            $ref: '#/components/schemas/DocumentMetadata',
            description: 'Document metadata'
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