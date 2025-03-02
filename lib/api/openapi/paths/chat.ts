/**
 * OpenAPI path definition for chat-related endpoints
 */
import { OpenAPIV3 } from 'openapi-types'

/**
 * OpenAPI path definition for chat APIs
 */
export const chatPaths: Record<string, OpenAPIV3.PathItemObject> = {
  '/chat': {
    post: {
      tags: ['chat'],
      summary: 'Create a new chat',
      description: 'Creates a new chat session',
      operationId: 'createChat',
      security: [
        { bearerAuth: [] }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Optional chat title'
                },
                workflowId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Optional workflow ID to associate with this chat'
                },
                metadata: {
                  type: 'object',
                  additionalProperties: true,
                  description: 'Additional metadata for the chat'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Chat created successfully',
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
                    required: ['chatId'],
                    properties: {
                      chatId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'ID of the created chat'
                      },
                      title: {
                        type: 'string',
                        description: 'Chat title'
                      },
                      workflowId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Associated workflow ID'
                      },
                      createdAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Chat creation timestamp'
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
  
  '/chat/{chatId}': {
    get: {
      tags: ['chat'],
      summary: 'Get chat details',
      description: 'Retrieves details of a specific chat',
      operationId: 'getChat',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
        {
          name: 'chatId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Chat ID'
        }
      ],
      responses: {
        '200': {
          description: 'Chat details retrieved successfully',
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
                    required: ['chatId', 'title', 'createdAt'],
                    properties: {
                      chatId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Chat ID'
                      },
                      title: {
                        type: 'string',
                        description: 'Chat title'
                      },
                      workflowId: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Associated workflow ID'
                      },
                      createdAt: {
                        type: 'string',
                        format: 'date-time',
                        description: 'Chat creation timestamp'
                      },
                      metadata: {
                        type: 'object',
                        additionalProperties: true,
                        description: 'Additional metadata for the chat'
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
    delete: {
      tags: ['chat'],
      summary: 'Delete a chat',
      description: 'Deletes a specific chat',
      operationId: 'deleteChat',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
        {
          name: 'chatId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Chat ID'
        }
      ],
      responses: {
        '200': {
          description: 'Chat deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success', 'timestamp'],
                properties: {
                  success: {
                    type: 'boolean',
                    example: true
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
  
  '/chat/{chatId}/messages': {
    get: {
      tags: ['chat'],
      summary: 'Get chat messages',
      description: 'Retrieves all messages for a specific chat',
      operationId: 'getChatMessages',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
        {
          name: 'chatId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Chat ID'
        },
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50
          },
          description: 'Maximum number of messages to return'
        },
        {
          name: 'before',
          in: 'query',
          required: false,
          schema: {
            type: 'string',
            format: 'date-time'
          },
          description: 'Return messages created before this timestamp'
        }
      ],
      responses: {
        '200': {
          description: 'Chat messages retrieved successfully',
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
                    required: ['messages'],
                    properties: {
                      messages: {
                        type: 'array',
                        items: {
                          $ref: '#/components/schemas/ChatMessage'
                        },
                        description: 'List of chat messages'
                      },
                      hasMore: {
                        type: 'boolean',
                        description: 'Indicator if more messages are available'
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
      tags: ['chat'],
      summary: 'Send a message',
      description: 'Sends a new message in the chat',
      operationId: 'sendMessage',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
        {
          name: 'chatId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Chat ID'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['content'],
              properties: {
                content: {
                  type: 'string',
                  description: 'Message content'
                },
                attachments: {
                  type: 'array',
                  items: {
                    type: 'string',
                    format: 'uuid'
                  },
                  description: 'Optional attachment IDs to include with this message'
                },
                metadata: {
                  type: 'object',
                  additionalProperties: true,
                  description: 'Additional metadata for the message'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Message sent successfully',
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
                    $ref: '#/components/schemas/ChatMessage',
                    description: 'The sent message'
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
  
  '/chat/{chatId}/attachment': {
    post: {
      tags: ['chat'],
      summary: 'Upload a chat attachment',
      description: 'Uploads a file attachment for use in chat messages',
      operationId: 'uploadAttachment',
      security: [
        { bearerAuth: [] }
      ],
      parameters: [
        {
          name: 'chatId',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
            format: 'uuid'
          },
          description: 'Chat ID'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description: 'The file to upload'
                },
                messageId: {
                  type: 'string',
                  description: 'Optional message ID to associate this attachment with'
                }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Attachment uploaded successfully',
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
                    required: ['id', 'fileName', 'contentType', 'size'],
                    properties: {
                      id: {
                        type: 'string',
                        format: 'uuid',
                        description: 'Attachment ID'
                      },
                      fileName: {
                        type: 'string',
                        description: 'Original file name'
                      },
                      contentType: {
                        type: 'string',
                        description: 'MIME type of the file'
                      },
                      size: {
                        type: 'integer',
                        format: 'int64',
                        description: 'File size in bytes'
                      },
                      url: {
                        type: 'string',
                        format: 'uri',
                        description: 'URL to access the file'
                      },
                      metadata: {
                        type: 'object',
                        additionalProperties: true,
                        description: 'Additional metadata about the file'
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
        '413': {
          description: 'File too large',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              }
            }
          }
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