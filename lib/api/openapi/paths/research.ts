/**
 * OpenAPI path definition for research-related endpoints
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for research APIs
 */
export const researchPaths: Record<string, OpenAPIV3.PathItemObject> = {
  '/perplexity': {
    post: {
      tags: ['research'],
      summary: 'Perform research using Perplexity',
      description: 'Performs research including medical diagnoses from documents or queries',
      operationId: 'performResearch',
      security: [
        { bearerAuth: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              oneOf: [
                {
                  required: ['query'],
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Research query'
                    }
                  }
                },
                {
                  required: ['documentId'],
                  properties: {
                    documentId: {
                      type: 'string',
                      format: 'uuid',
                      description: 'Document ID to research'
                    }
                  }
                }
              ],
              properties: {
                options: {
                  type: 'object',
                  properties: {
                    depth: {
                      type: 'string',
                      enum: ['basic', 'comprehensive', 'expert'],
                      default: 'comprehensive',
                      description: 'Depth of research to perform'
                    },
                    sourcesLimit: {
                      type: 'integer',
                      minimum: 1,
                      maximum: 20,
                      default: 5,
                      description: 'Maximum number of sources to include'
                    },
                    includeSourceContent: {
                      type: 'boolean',
                      default: true,
                      description: 'Whether to include source content in the response'
                    },
                    isMedicalDiagnosis: {
                      type: 'boolean',
                      default: false,
                      description: 'Whether this is a medical diagnosis research'
                    },
                    patientData: {
                      type: 'string',
                      description: 'Optional patient data for context in medical diagnosis'
                    }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Research performed successfully',
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
                    required: ['research', 'query'],
                    properties: {
                      research: {
                        type: 'string',
                        description: 'Research content'
                      },
                      query: {
                        type: 'string',
                        description: 'Original query'
                      },
                      sources: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['title', 'url'],
                          properties: {
                            title: {
                              type: 'string',
                              description: 'Source title'
                            },
                            url: {
                              type: 'string',
                              format: 'uri',
                              description: 'Source URL'
                            },
                            content: {
                              type: 'string',
                              description: 'Source content excerpt'
                            },
                            date: {
                              type: 'string',
                              description: 'Publication date'
                            },
                            relevanceScore: {
                              type: 'number',
                              minimum: 0,
                              maximum: 1,
                              description: 'Relevance score (0-1)'
                            }
                          }
                        },
                        description: 'Research sources'
                      },
                      metadata: {
                        type: 'object',
                        properties: {
                          processingTimeMs: {
                            type: 'integer',
                            description: 'Processing time in milliseconds'
                          },
                          depth: {
                            type: 'string',
                            enum: ['basic', 'comprehensive', 'expert'],
                            description: 'Depth of research performed'
                          },
                          sourceCount: {
                            type: 'integer',
                            description: 'Number of sources included'
                          },
                          isMedicalDiagnosis: {
                            type: 'boolean',
                            description: 'Whether this was a medical diagnosis'
                          }
                        }
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
        },
        '502': {
          $ref: '#/components/responses/ExternalServiceError'
        }
      }
    }
  },
  '/retrieval/ingest': {
    post: {
      tags: ['research', 'documents'],
      summary: 'Ingest document into vector store',
      description: 'Ingests documents into vector store for later retrieval',
      operationId: 'ingestDocument',
      security: [
        { bearerAuth: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['text'],
              properties: {
                text: {
                  type: 'string',
                  description: 'Document text to ingest'
                },
                metadata: {
                  type: 'object',
                  additionalProperties: true,
                  description: 'Optional metadata for the document'
                },
                patientId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Optional patient ID to associate with the document'
                },
                documentId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Optional document ID to associate with the embedding'
                },
                chunkSize: {
                  type: 'integer',
                  minimum: 100,
                  maximum: 10000,
                  default: 1000,
                  description: 'Size of text chunks for embedding'
                },
                chunkOverlap: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 1000,
                  default: 200,
                  description: 'Overlap between chunks'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Document ingested successfully',
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
                    required: ['embeddings'],
                    properties: {
                      embeddings: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['id'],
                          properties: {
                            id: {
                              type: 'string',
                              description: 'Embedding ID'
                            },
                            chunkIndex: {
                              type: 'integer',
                              description: 'Index of the chunk'
                            },
                            metadata: {
                              type: 'object',
                              additionalProperties: true,
                              description: 'Embedding metadata'
                            }
                          }
                        },
                        description: 'Embedding records created'
                      },
                      count: {
                        type: 'integer',
                        description: 'Number of embeddings created'
                      },
                      processingTimeMs: {
                        type: 'integer',
                        description: 'Processing time in milliseconds'
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