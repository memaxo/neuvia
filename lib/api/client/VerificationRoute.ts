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

export namespace Verification {
  /**
 * @description Processes user correction on verified content like a patient summary
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
  export namespace SubmitCorrection {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
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
    };
    export type RequestHeaders = {};
    export type ResponseBody = {
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
    };
  }

  /**
 * @description Processes a correction to verified content and returns updated content
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
  export namespace ProcessCorrection {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
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
    };
    export type RequestHeaders = {};
    export type ResponseBody = {
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
    };
  }

  /**
 * @description Generates verification items and summary for a document
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
  export namespace GenerateVerification {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
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
    };
    export type RequestHeaders = {};
    export type ResponseBody = {
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
    };
  }

  /**
 * @description Retrieves the verification status of a patient summary
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
  export namespace GetPatientSummaryVerification {
    export type RequestParams = {
      /**
       * Patient ID
       * @format uuid
       */
      patientId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
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
    };
  }

  /**
 * @description Updates the verification status of a patient summary
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
  export namespace UpdatePatientSummaryVerification {
    export type RequestParams = {
      /**
       * Patient ID
       * @format uuid
       */
      patientId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = {
      /**
       * Verification status to set
       * @default "verified"
       */
      status: 'pending' | 'verified' | 'rejected';
      /** Optional comments about the verification */
      comments?: string;
      /** Updated verification items */
      items?: VerificationItem[];
    };
    export type RequestHeaders = {};
    export type ResponseBody = {
      /** @example true */
      success: boolean;
      /** Verification result */
      data: VerificationResult;
      /** @format date-time */
      timestamp: string;
    };
  }

  /**
 * @description Retrieves the verification status of a document
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
  export namespace GetDocumentVerification {
    export type RequestParams = {};
    export type RequestQuery = {
      /**
       * Extracted document ID
       * @format uuid
       */
      extractedDocumentId: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      /** @example true */
      success: boolean;
      /** Verified document data */
      data: VerifiedDocument;
      /** @format date-time */
      timestamp: string;
    };
  }

  /**
 * @description Creates verification items for a document
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
  export namespace GenerateDocumentVerification {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
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
    };
    export type RequestHeaders = {};
    export type ResponseBody = {
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
    };
  }
}
