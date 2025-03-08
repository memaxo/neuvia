/**
 * Reports service implementation
 */
import type { Report } from '../models/data-contracts';
import type { HttpClient, RequestParams } from "../models/http-client";
import { ContentType } from "../models/http-client"

export class Reports<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
 * @description Generates a report from patient data and workflow state
 *
 * @tags reports
 * @name GenerateReport
 * @summary Generate a report
 * @request POST:/reports/generate
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \**
   * Report ID
   * @format uuid
   *\
    id: string,
  \** Report title *\
    title?: string,
  \** Report content in the specified format *\
    content: string,
  \** Format of the report *\
    format: "markdown" | "pdf" | "docx" | "html" | "json",
  \**
   * Timestamp when the report was generated
   * @format date-time
   *\
    generatedAt?: string,
  \**
   * Patient ID
   * @format uuid
   *\
    patientId?: string,
  \** Size of the report in bytes *\
    size?: number,
  \**
   * URL to download the report (if applicable)
   * @format url
   *\
    url?: string,

},
  \** @format date-time *\
    timestamp: string,

}` Report generated successfully
 * @response `400` `{
    error: {
  \** @example "Invalid input parameters" *\
    message: string,
  \** @example "INVALID_INPUT" *\
    code: string,
  \** @format date-time *\
    timestamp: string,
  \** May contain field-specific validation errors *\
    details?: object,

},

}`
 * @response `401` `{
    error: {
  \** @example "Authentication failed" *\
    message: string,
  \** @example "AUTHENTICATION_FAILED" *\
    code: string,
  \** @format date-time *\
    timestamp: string,

},

}`
 * @response `404` `{
    error: {
  \** @example "Resource not found" *\
    message: string,
  \** @example "NOT_FOUND" *\
    code: string,
  \** @format date-time *\
    timestamp: string,
    details?: {
  \** The type of resource that was not found *\
    resource?: string,

},

},

}`
 * @response `422` `{
    error: {
  \** @example "Validation failed" *\
    message: string,
  \** @example "VALIDATION_FAILED" *\
    code: string,
  \** @format date-time *\
    timestamp: string,
    details?: {
  \** Field-specific validation errors *\
    fields?: Record<string,string>,

},

},

}`
 * @response `500` `{
    error: {
  \** @example "Internal server error" *\
    message: string,
  \** @example "SERVER_ERROR" *\
    code: string,
  \** @format date-time *\
    timestamp: string,

},

}`
 */
  generateReport = (
    data: {
      /**
       * Patient ID for whom to generate the report
       * @format uuid
       */
      patientId: string;
      /**
       * Workflow ID associated with this report generation
       * @format uuid
       */
      workflowId?: string;
      /**
       * Format of the report
       * @default "pdf"
       */
      format?: 'markdown' | 'pdf' | 'docx' | 'html' | 'json';
      /**
       * Report style
       * @default "clinical"
       */
      style?: 'clinical' | 'academic' | 'simplified';
      /**
       * Level of detail in the report
       * @default "standard"
       */
      detailLevel?: 'basic' | 'standard' | 'comprehensive';
      /**
       * Whether to include verification data in the report
       * @default true
       */
      includeVerificationData?: boolean;
      /**
       * Whether to include metadata in the report footer
       * @default true
       */
      metadataInFooter?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /**
           * Report ID
           * @format uuid
           */
          id: string;
          /** Report title */
          title?: string;
          /** Report content in the specified format */
          content: string;
          /** Format of the report */
          format: 'markdown' | 'pdf' | 'docx' | 'html' | 'json';
          /**
           * Timestamp when the report was generated
           * @format date-time
           */
          generatedAt?: string;
          /**
           * Patient ID
           * @format uuid
           */
          patientId?: string;
          /** Size of the report in bytes */
          size?: number;
          /**
           * URL to download the report (if applicable)
           * @format url
           */
          url?: string;
        };
        /** @format date-time */
        timestamp: string;
      },
      | {
          error: {
            /** @example "Invalid input parameters" */
            message: string;
            /** @example "INVALID_INPUT" */
            code: string;
            /** @format date-time */
            timestamp: string;
            /** May contain field-specific validation errors */
            details?: object;
          };
        }
      | {
          error: {
            /** @example "Authentication failed" */
            message: string;
            /** @example "AUTHENTICATION_FAILED" */
            code: string;
            /** @format date-time */
            timestamp: string;
          };
        }
      | {
          error: {
            /** @example "Resource not found" */
            message: string;
            /** @example "NOT_FOUND" */
            code: string;
            /** @format date-time */
            timestamp: string;
            details?: {
              /** The type of resource that was not found */
              resource?: string;
            };
          };
        }
      | {
          error: {
            /** @example "Validation failed" */
            message: string;
            /** @example "VALIDATION_FAILED" */
            code: string;
            /** @format date-time */
            timestamp: string;
            details?: {
              /** Field-specific validation errors */
              fields?: Record<string, string>;
            };
          };
        }
      | {
          error: {
            /** @example "Internal server error" */
            message: string;
            /** @example "SERVER_ERROR" */
            code: string;
            /** @format date-time */
            timestamp: string;
          };
        }
    >({
      path: `/reports/generate`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
 * @description Change the format of an existing report
 *
 * @tags reports
 * @name FormatReport
 * @summary Format an existing report
 * @request POST:/reports/{reportId}/format
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \**
   * Report ID (may be a new ID)
   * @format uuid
   *\
    id: string,
  \** Formatted report content *\
    content: string,
  \** Format of the report *\
    format: "markdown" | "pdf" | "docx" | "html" | "json",
  \**
   * Timestamp when the report was formatted
   * @format date-time
   *\
    formattedAt?: string,
  \**
   * URL to download the report (if applicable)
   * @format url
   *\
    url?: string,

},
  \** @format date-time *\
    timestamp: string,

}` Report formatted successfully
 * @response `400` `{
    error: {
  \** @example "Invalid input parameters" *\
    message: string,
  \** @example "INVALID_INPUT" *\
    code: string,
  \** @format date-time *\
    timestamp: string,
  \** May contain field-specific validation errors *\
    details?: object,

},

}`
 * @response `401` `{
    error: {
  \** @example "Authentication failed" *\
    message: string,
  \** @example "AUTHENTICATION_FAILED" *\
    code: string,
  \** @format date-time *\
    timestamp: string,

},

}`
 * @response `404` `{
    error: {
  \** @example "Resource not found" *\
    message: string,
  \** @example "NOT_FOUND" *\
    code: string,
  \** @format date-time *\
    timestamp: string,
    details?: {
  \** The type of resource that was not found *\
    resource?: string,

},

},

}`
 * @response `422` `{
    error: {
  \** @example "Validation failed" *\
    message: string,
  \** @example "VALIDATION_FAILED" *\
    code: string,
  \** @format date-time *\
    timestamp: string,
    details?: {
  \** Field-specific validation errors *\
    fields?: Record<string,string>,

},

},

}`
 * @response `500` `{
    error: {
  \** @example "Internal server error" *\
    message: string,
  \** @example "SERVER_ERROR" *\
    code: string,
  \** @format date-time *\
    timestamp: string,

},

}`
 */
  formatReport = (
    reportId: string,
    data: {
      /** Format to convert the report to */
      format: 'markdown' | 'pdf' | 'docx' | 'html' | 'json';
      /**
       * Report style
       * @default "clinical"
       */
      style?: 'clinical' | 'academic' | 'simplified';
      /**
       * Whether to include metadata in the report footer
       * @default true
       */
      metadataInFooter?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /**
           * Report ID (may be a new ID)
           * @format uuid
           */
          id: string;
          /** Formatted report content */
          content: string;
          /** Format of the report */
          format: 'markdown' | 'pdf' | 'docx' | 'html' | 'json';
          /**
           * Timestamp when the report was formatted
           * @format date-time
           */
          formattedAt?: string;
          /**
           * URL to download the report (if applicable)
           * @format url
           */
          url?: string;
        };
        /** @format date-time */
        timestamp: string;
      },
      | {
          error: {
            /** @example "Invalid input parameters" */
            message: string;
            /** @example "INVALID_INPUT" */
            code: string;
            /** @format date-time */
            timestamp: string;
            /** May contain field-specific validation errors */
            details?: object;
          };
        }
      | {
          error: {
            /** @example "Authentication failed" */
            message: string;
            /** @example "AUTHENTICATION_FAILED" */
            code: string;
            /** @format date-time */
            timestamp: string;
          };
        }
      | {
          error: {
            /** @example "Resource not found" */
            message: string;
            /** @example "NOT_FOUND" */
            code: string;
            /** @format date-time */
            timestamp: string;
            details?: {
              /** The type of resource that was not found */
              resource?: string;
            };
          };
        }
      | {
          error: {
            /** @example "Validation failed" */
            message: string;
            /** @example "VALIDATION_FAILED" */
            code: string;
            /** @format date-time */
            timestamp: string;
            details?: {
              /** Field-specific validation errors */
              fields?: Record<string, string>;
            };
          };
        }
      | {
          error: {
            /** @example "Internal server error" */
            message: string;
            /** @example "SERVER_ERROR" */
            code: string;
            /** @format date-time */
            timestamp: string;
          };
        }
    >({
      path: `/reports/${reportId}/format`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
 * @description Retrieve a specific report by ID
 *
 * @tags reports
 * @name GetReport
 * @summary Get a report
 * @request GET:/reports/{reportId}
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: Report,
  \** @format date-time *\
    timestamp: string,

}` Report retrieved successfully
 * @response `400` `{
    error: {
  \** @example "Invalid input parameters" *\
    message: string,
  \** @example "INVALID_INPUT" *\
    code: string,
  \** @format date-time *\
    timestamp: string,
  \** May contain field-specific validation errors *\
    details?: object,

},

}`
 * @response `401` `{
    error: {
  \** @example "Authentication failed" *\
    message: string,
  \** @example "AUTHENTICATION_FAILED" *\
    code: string,
  \** @format date-time *\
    timestamp: string,

},

}`
 * @response `404` `{
    error: {
  \** @example "Resource not found" *\
    message: string,
  \** @example "NOT_FOUND" *\
    code: string,
  \** @format date-time *\
    timestamp: string,
    details?: {
  \** The type of resource that was not found *\
    resource?: string,

},

},

}`
 * @response `500` `{
    error: {
  \** @example "Internal server error" *\
    message: string,
  \** @example "SERVER_ERROR" *\
    code: string,
  \** @format date-time *\
    timestamp: string,

},

}`
 */
  getReport = (reportId: string, params: RequestParams = {}) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: Report;
        /** @format date-time */
        timestamp: string;
      },
      | {
          error: {
            /** @example "Invalid input parameters" */
            message: string;
            /** @example "INVALID_INPUT" */
            code: string;
            /** @format date-time */
            timestamp: string;
            /** May contain field-specific validation errors */
            details?: object;
          };
        }
      | {
          error: {
            /** @example "Authentication failed" */
            message: string;
            /** @example "AUTHENTICATION_FAILED" */
            code: string;
            /** @format date-time */
            timestamp: string;
          };
        }
      | {
          error: {
            /** @example "Resource not found" */
            message: string;
            /** @example "NOT_FOUND" */
            code: string;
            /** @format date-time */
            timestamp: string;
            details?: {
              /** The type of resource that was not found */
              resource?: string;
            };
          };
        }
      | {
          error: {
            /** @example "Internal server error" */
            message: string;
            /** @example "SERVER_ERROR" */
            code: string;
            /** @format date-time */
            timestamp: string;
          };
        }
    >({
      path: `/reports/${reportId}`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
}
