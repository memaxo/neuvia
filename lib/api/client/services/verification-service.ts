/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import {
  VerificationItem,
  VerificationMetadata,
  VerificationOptions,
  VerificationResult,
  VerificationStatusType,
  VerifiedDocument,
} from './data-contracts';
import { ContentType, HttpClient, RequestParams } from "../models/http-client"

export class Verification<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
 * @description Processes user correction on verified content like a patient summary
 *
 * @tags verification
 * @name SubmitCorrection
 * @summary Submit a correction to verified content
 * @request POST:/verification/submit-correction
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \** ID of the updated summary *\
    summaryId: string,
  \** Updated summary with correction applied *\
    summary: string,
  \** Structured data extracted from the summary *\
    structuredData?: Record<string,any>,
  \**
   * Total number of corrections applied
   * @min 0
   *\
    correctionCount?: number,

},
  \** @format date-time *\
    timestamp: string,

}` Correction processed successfully
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
  submitCorrection = (
    data: {
      /** The correction text provided by the user */
      correction: string;
      /** The current summary content being corrected */
      currentSummary: string;
      /**
       * The workflow ID associated with this correction
       * @format uuid
       */
      workflowId?: string;
      /** Optional ID of the message associated with this correction */
      messageId?: string;
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /** ID of the updated summary */
          summaryId: string;
          /** Updated summary with correction applied */
          summary: string;
          /** Structured data extracted from the summary */
          structuredData?: Record<string, any>;
          /**
           * Total number of corrections applied
           * @min 0
           */
          correctionCount?: number;
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
      path: `/verification/submit-correction`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
 * @description Processes a correction to verified content and returns updated content
 *
 * @tags verification
 * @name ProcessCorrection
 * @summary Process a correction to verified content
 * @request POST:/verification/process-correction
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \** ID of the updated summary *\
    summaryId: string,
  \** Updated summary with correction applied *\
    summary: string,
  \** Structured data extracted from the summary *\
    structuredData?: Record<string,any>,
  \**
   * Total number of corrections applied
   * @min 0
   *\
    correctionCount?: number,

},
  \** @format date-time *\
    timestamp: string,

}` Correction processed successfully
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
  processCorrection = (
    data: {
      /** The correction text */
      correction: string;
      /** The current summary content */
      currentSummary: string;
      /**
       * The workflow ID associated with this correction
       * @format uuid
       */
      workflowId?: string;
      /** Optional ID of message associated with this correction */
      messageId?: string;
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /** ID of the updated summary */
          summaryId: string;
          /** Updated summary with correction applied */
          summary: string;
          /** Structured data extracted from the summary */
          structuredData?: Record<string, any>;
          /**
           * Total number of corrections applied
           * @min 0
           */
          correctionCount?: number;
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
      path: `/verification/process-correction`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
 * @description Generates verification items and summary for a document
 *
 * @tags verification
 * @name GenerateVerification
 * @summary Generate verification for a document
 * @request POST:/verification/generate
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \** ID of the generated summary *\
    summaryId: string,
  \** Summary content generated from the document *\
    summary: string,
  \** Structured data extracted from the document *\
    structuredData?: Record<string,any>,

},
  \** @format date-time *\
    timestamp: string,

}` Verification generated successfully
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
  generateVerification = (
    data: {
      /** The document to be verified */
      document: Record<string, any>;
      /**
       * The workflow ID for this verification
       * @format uuid
       */
      workflowId?: string;
      /** Optional ID of message associated with this verification */
      messageId?: string;
      /** Optional ID for the generated summary */
      summaryId?: string;
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /** ID of the generated summary */
          summaryId: string;
          /** Summary content generated from the document */
          summary: string;
          /** Structured data extracted from the document */
          structuredData?: Record<string, any>;
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
      path: `/verification/generate`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
 * @description Retrieves the verification status of a patient summary
 *
 * @tags verification, patients
 * @name GetPatientSummaryVerification
 * @summary Get patient summary verification status
 * @request GET:/patient/{patientId}/verify-summary
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \** Current verification status *\
    verificationStatus: VerificationStatusType,
  \** Verification items *\
    items: (VerificationItem)[],
  \** Verification metadata *\
    metadata?: VerificationMetadata,
  \** Original content being verified *\
    originalContent?: string,
  \** Current content after any corrections *\
    currentContent?: string,

},
  \** @format date-time *\
    timestamp: string,

}` Summary verification status retrieved successfully
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
  getPatientSummaryVerification = (patientId: string, params: RequestParams = {}) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /** Current verification status */
          verificationStatus: VerificationStatusType;
          /** Verification items */
          items: VerificationItem[];
          /** Verification metadata */
          metadata?: VerificationMetadata;
          /** Original content being verified */
          originalContent?: string;
          /** Current content after any corrections */
          currentContent?: string;
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
            /** @example "Internal server error" */
            message: string;
            /** @example "SERVER_ERROR" */
            code: string;
            /** @format date-time */
            timestamp: string;
          };
        }
    >({
      path: `/patient/${patientId}/verify-summary`,
      method: 'GET',
      secure: true,
      format: 'json',
      ...params,
    });
  /**
 * @description Updates the verification status of a patient summary
 *
 * @tags verification, patients
 * @name UpdatePatientSummaryVerification
 * @summary Update patient summary verification status
 * @request POST:/patient/{patientId}/verify-summary
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
  \** Verification result *\
    data: VerificationResult,
  \** @format date-time *\
    timestamp: string,

}` Verification status updated successfully
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
  updatePatientSummaryVerification = (
    patientId: string,
    data: {
      /**
       * Verification status to set
       * @default "verified"
       */
      status: 'pending' | 'verified' | 'rejected';
      /** Optional comments about the verification */
      comments?: string;
      /** Updated verification items */
      items?: VerificationItem[];
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        /** Verification result */
        data: VerificationResult;
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
      path: `/patient/${patientId}/verify-summary`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
 * @description Retrieves the verification status of a document
 *
 * @tags verification, documents
 * @name GetDocumentVerification
 * @summary Get document verification status
 * @request GET:/document-verification
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
  \** Verified document data *\
    data: VerifiedDocument,
  \** @format date-time *\
    timestamp: string,

}` Document verification status retrieved successfully
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
  getDocumentVerification = (
    query: {
      /**
       * Extracted document ID
       * @format uuid
       */
      extractedDocumentId: string;
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        /** Verified document data */
        data: VerifiedDocument;
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
      path: `/document-verification`,
      method: 'GET',
      query: query,
      secure: true,
      format: 'json',
      ...params,
    });
  /**
 * @description Creates verification items for a document
 *
 * @tags verification, documents
 * @name GenerateDocumentVerification
 * @summary Generate verification items for a document
 * @request POST:/document-verification
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \**
   * Verification process ID
   * @format uuid
   *\
    verificationId: string,
  \**
   * Workflow ID
   * @format uuid
   *\
    workflowId?: string,
  \** Verification items *\
    items: (VerificationItem)[],
  \** Verification status *\
    status?: VerificationStatusType,

},
  \** @format date-time *\
    timestamp: string,

}` Verification items generated successfully
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
  generateDocumentVerification = (
    data: {
      /**
       * Document ID
       * @format uuid
       */
      documentId: string;
      /**
       * Workflow ID
       * @format uuid
       */
      workflowId: string;
      /** Verification options */
      options?: VerificationOptions;
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /**
           * Verification process ID
           * @format uuid
           */
          verificationId: string;
          /**
           * Workflow ID
           * @format uuid
           */
          workflowId?: string;
          /** Verification items */
          items: VerificationItem[];
          /** Verification status */
          status?: VerificationStatusType;
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
      path: `/document-verification`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
}
