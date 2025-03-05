/* eslint-disable */
/* tslint:disable */
/**
 * @fileoverview Verification route definitions for the application.
 *
 * This file contains route namespaces that map directly to each
 * OpenAPI operation for verification-related endpoints.
 * It has been updated to match the canonical verification types
 * from "lib/types/verification.ts" and to unify parameter naming
 * and statuses (pending | inProgress | completed | failed).
 */

import {
  VerificationItem,
  VerificationMetadata,
  VerificationOptions,
  VerificationResult,
  VerifiedDocument,
} from './data-contracts'

/**
 * Namespace grouping all verification-related API operations.
 */
export namespace Verification {
  /**
   * @namespace SubmitCorrection
   * @description
   * Submits a correction for verified content (such as a patient summary).
   */
  export namespace SubmitCorrection {
    /**
     * Request parameters are empty, no URL segments needed
     */
    export type RequestParams = {}

    /**
     * Query parameters are empty
     */
    export type RequestQuery = {}

    /**
     * Body for submitting corrections
     */
    export type RequestBody = {
      /** The correction text provided by the user */
      correction: string
      /** The current summary content being corrected */
      currentSummary: string
      /**
       * The workflow ID associated with this correction
       * @format uuid
       */
      workflowId?: string
      /** Optional ID of the message associated with this correction */
      messageId?: string
    }

    /**
     * No special request headers
     */
    export type RequestHeaders = {}

    /**
     * Successful response includes updated summary information.
     */
    export type ResponseBody = {
      success: boolean
      data: {
        /** ID of the updated summary */
        summaryId: string
        /** Updated summary with corrections applied */
        summary: string
        /** Structured data extracted from the summary */
        structuredData?: Record<string, any>
        /**
         * Total number of corrections applied
         * @min 0
         */
        correctionCount?: number
      }
      /** @format date-time */
      timestamp: string
    }
  }

  /**
   * @namespace ProcessCorrection
   * @description
   * Processes user corrections on verified content and returns updated content.
   */
  export namespace ProcessCorrection {
    export type RequestParams = {}
    export type RequestQuery = {}

    /**
     * Body for processing a correction
     */
    export type RequestBody = {
      /** The correction text */
      correction: string
      /** The current summary content */
      currentSummary: string
      /**
       * The workflow ID associated with this correction
       * @format uuid
       */
      workflowId?: string
      /** Optional ID of the message associated with this correction */
      messageId?: string
    }

    export type RequestHeaders = {}

    /**
     * Successful response with updated summary information
     */
    export type ResponseBody = {
      success: boolean
      data: {
        summaryId: string
        summary: string
        structuredData?: Record<string, any>
        /**
         * Total number of corrections applied
         * @min 0
         */
        correctionCount?: number
      }
      timestamp: string
    }
  }

  /**
   * @namespace GenerateVerification
   * @description
   * Generates verification items and summary for a given document.
   */
  export namespace GenerateVerification {
    export type RequestParams = {}
    export type RequestQuery = {}

    /**
     * Body for generating verification from a document
     */
    export type RequestBody = {
      /** The document to be verified */
      document: Record<string, any>
      /**
       * The workflow ID for this verification
       * @format uuid
       */
      workflowId?: string
      /** Optional ID of message associated with this verification */
      messageId?: string
      /** Optional ID for the generated summary */
      summaryId?: string
    }

    export type RequestHeaders = {}

    /**
     * Successful response with a new summary
     */
    export type ResponseBody = {
      success: boolean
      data: {
        /** ID of the generated summary */
        summaryId: string
        /** Summary content generated from the document */
        summary: string
        /** Structured data extracted from the document */
        structuredData?: Record<string, any>
      }
      timestamp: string
    }
  }

  /**
   * @namespace GetPatientSummaryVerification
   * @description
   * Retrieves the verification status and items for a given patient summary.
   */
  export namespace GetPatientSummaryVerification {
    /**
     * Path parameters: patientId
     */
    export type RequestParams = {
      /**
       * Patient ID
       * @format uuid
       */
      patientId: string
    }

    export type RequestQuery = {}
    export type RequestBody = never
    export type RequestHeaders = {}

    /**
     * Successful response with summary verification details
     */
    export type ResponseBody = {
      success: boolean
      data: {
        /** Current verification status */
        verificationStatus: 'pending' | 'inProgress' | 'completed' | 'failed'
        /** Verification items */
        items: VerificationItem[]
        /** Verification metadata */
        metadata?: VerificationMetadata
        /** Original content being verified */
        originalContent?: string
        /** Current content after any corrections */
        currentContent?: string
      }
      timestamp: string
    }
  }

  /**
   * @namespace UpdatePatientSummaryVerification
   * @description
   * Updates the verification status of a patient summary (e.g., completing or failing verification).
   */
  export namespace UpdatePatientSummaryVerification {
    export type RequestParams = {
      /**
       * Patient ID
       * @format uuid
       */
      patientId: string
    }
    export type RequestQuery = {}

    /**
     * Body for updating verification status
     */
    export type RequestBody = {
      /**
       * Verification status to set, matching canonical statuses
       * @default "pending"
       */
      status: 'pending' | 'inProgress' | 'completed' | 'failed'
      /** Optional comments about the verification */
      comments?: string
      /** Updated verification items */
      items?: VerificationItem[]
    }

    export type RequestHeaders = {}

    /**
     * Successful response with a VerificationResult
     */
    export type ResponseBody = {
      success: boolean
      data: VerificationResult
      timestamp: string
    }
  }

  /**
   * @namespace GetDocumentVerification
   * @description
   * Retrieves the verification status of a document by its ID.
   */
  export namespace GetDocumentVerification {
    export type RequestParams = {}
    /**
     * Updated to use "documentId" instead of "extractedDocumentId"
     */
    export type RequestQuery = {
      /**
       * Document ID
       * @format uuid
       */
      documentId: string
    }
    export type RequestBody = never
    export type RequestHeaders = {}

    /**
     * Successful response includes the verified document data.
     */
    export type ResponseBody = {
      success: boolean
      data: VerifiedDocument
      timestamp: string
    }
  }

  /**
   * @namespace GenerateDocumentVerification
   * @description
   * Creates verification items for a document by ID and returns verification process details.
   */
  export namespace GenerateDocumentVerification {
    export type RequestParams = {}
    export type RequestQuery = {}

    /**
     * Body for generating verification items for a document
     */
    export type RequestBody = {
      /**
       * Document ID
       * @format uuid
       */
      documentId: string
      /**
       * Workflow ID
       * @format uuid
       */
      workflowId: string
      /** Verification options */
      options?: VerificationOptions
    }

    export type RequestHeaders = {}

    /**
     * Successful response with verification items and status
     */
    export type ResponseBody = {
      success: boolean
      data: {
        /**
         * Verification process ID
         * @format uuid
         */
        verificationId: string
        /**
         * Workflow ID
         * @format uuid
         */
        workflowId?: string
        /** Verification items */
        items: VerificationItem[]
        /** Verification status (pending, inProgress, completed, failed) */
        status?: 'pending' | 'inProgress' | 'completed' | 'failed'
      }
      timestamp: string
    }
  }
}