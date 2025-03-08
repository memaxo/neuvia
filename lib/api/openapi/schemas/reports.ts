/**
 * Report-related schemas for the OpenAPI specification
 * 
 * These schemas define the structure of report objects used in the API,
 * closely aligning with the existing TypeScript types
 */
import type { OpenAPIV3 } from 'openapi-types'

export const reportSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  /**
   * Report format options
   */
  ReportFormatType: {
    type: 'string',
    enum: ['markdown', 'pdf', 'docx', 'html', 'json'],
    description: 'Available report formats'
  },

  /**
   * Report style options
   */
  ReportStyleType: {
    type: 'string',
    enum: ['clinical', 'academic', 'simplified'],
    description: 'Available report styles'
  },

  /**
   * Detail level options
   */
  DetailLevelType: {
    type: 'string',
    enum: ['basic', 'standard', 'comprehensive'],
    description: 'Level of detail in generated reports'
  },

  /**
   * Report configuration
   */
  ReportConfig: {
    type: 'object',
    required: ['format'],
    properties: {
      format: {
        $ref: '#/components/schemas/ReportFormatType',
        description: 'Format of the report'
      },
      style: {
        $ref: '#/components/schemas/ReportStyleType',
        description: 'Style of the report formatting',
        default: 'clinical'
      },
      detailLevel: {
        $ref: '#/components/schemas/DetailLevelType',
        description: 'Level of detail in the report',
        default: 'standard'
      },
      includeMetadata: {
        type: 'boolean',
        description: 'Whether to include metadata in the report',
        default: true
      },
      metadataInFooter: {
        type: 'boolean',
        description: 'Whether to include metadata in the footer (for PDF/DOCX)',
        default: false
      }
    }
  },

  /**
   * Report section
   */
  ReportSection: {
    type: 'object',
    required: ['title', 'content'],
    properties: {
      title: {
        type: 'string',
        description: 'Section title'
      },
      content: {
        type: 'string',
        description: 'Section content'
      },
      order: {
        type: 'integer',
        minimum: 0,
        description: 'Display order of the section'
      },
      level: {
        type: 'integer',
        minimum: 1,
        maximum: 5,
        description: 'Heading level (1-5)'
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Additional section metadata'
      }
    }
  },

  /**
   * Report metadata
   */
  ReportMetadata: {
    type: 'object',
    properties: {
      generatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when the report was generated'
      },
      generatedBy: {
        type: 'string',
        description: 'User who generated the report'
      },
      patientId: {
        type: 'string',
        format: 'uuid',
        description: 'Patient ID'
      },
      documentIds: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid'
        },
        description: 'IDs of documents used to generate the report'
      },
      reportVersion: {
        type: 'string',
        description: 'Version of the report'
      },
      verificationStatus: {
        type: 'string',
        enum: ['unverified', 'verified', 'rejected'],
        description: 'Verification status of the report'
      },
      verifiedBy: {
        type: 'string',
        description: 'User who verified the report'
      },
      verifiedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when the report was verified'
      }
    }
  },

  /**
   * Report
   */
  Report: {
    type: 'object',
    required: ['id', 'title', 'content', 'createdAt', 'config'],
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
      description: {
        type: 'string',
        description: 'Report description'
      },
      content: {
        type: 'string',
        description: 'Report content'
      },
      sections: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ReportSection'
        },
        description: 'Report sections'
      },
      config: {
        $ref: '#/components/schemas/ReportConfig',
        description: 'Report configuration'
      },
      metadata: {
        $ref: '#/components/schemas/ReportMetadata',
        description: 'Report metadata'
      },
      patientId: {
        type: 'string',
        format: 'uuid',
        description: 'Patient ID'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when the report was created'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when the report was last updated'
      }
    }
  },

  /**
   * Generate report request
   */
  GenerateReportRequest: {
    type: 'object',
    required: ['patientId'],
    properties: {
      patientId: {
        type: 'string',
        format: 'uuid',
        description: 'Patient ID'
      },
      config: {
        $ref: '#/components/schemas/ReportConfig',
        description: 'Report configuration'
      },
      documentIds: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid'
        },
        description: 'Optional list of document IDs to include (if not provided, all patient documents are used)'
      },
      title: {
        type: 'string',
        description: 'Custom report title'
      },
      description: {
        type: 'string',
        description: 'Custom report description'
      }
    }
  },

  /**
   * Generate report response
   */
  GenerateReportResponse: {
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
        required: ['reportId', 'status'],
        properties: {
          reportId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the generated report'
          },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'error'],
            description: 'Report generation status'
          },
          estimatedTimeSeconds: {
            type: 'integer',
            description: 'Estimated time to complete in seconds'
          },
          report: {
            $ref: '#/components/schemas/Report',
            description: 'The generated report (if completed)'
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
   * Get report response
   */
  GetReportResponse: {
    type: 'object',
    required: ['success', 'data', 'timestamp'],
    properties: {
      success: {
        type: 'boolean',
        example: true,
        description: 'Indicates successful operation'
      },
      data: {
        $ref: '#/components/schemas/Report',
        description: 'The requested report'
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description: 'Server timestamp of the response'
      }
    }
  },

  /**
   * List reports response
   */
  ListReportsResponse: {
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
        required: ['reports', 'pagination'],
        properties: {
          reports: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Report'
            },
            description: 'List of reports'
          },
          pagination: {
            $ref: '#/components/schemas/PaginationMeta',
            description: 'Pagination metadata'
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
   * Update report request
   */
  UpdateReportRequest: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Updated report title'
      },
      description: {
        type: 'string',
        description: 'Updated report description'
      },
      content: {
        type: 'string',
        description: 'Updated report content'
      },
      sections: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/ReportSection'
        },
        description: 'Updated report sections'
      },
      config: {
        $ref: '#/components/schemas/ReportConfig',
        description: 'Updated report configuration'
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
        description: 'Updated report metadata'
      }
    }
  },

  /**
   * Delete report response
   */
  DeleteReportResponse: {
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
        required: ['deleted'],
        properties: {
          deleted: {
            type: 'boolean',
            description: 'Whether the report was deleted'
          },
          reportId: {
            type: 'string',
            format: 'uuid',
            description: 'ID of the deleted report'
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