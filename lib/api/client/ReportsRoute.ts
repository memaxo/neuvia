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

import { Report } from './data-contracts';

export namespace Reports {
  /**
 * @description Generates a report from patient data and workflow state
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
  export namespace GenerateReport {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
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
    };
    export type RequestHeaders = {};
    export type ResponseBody = {
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
    };
  }

  /**
 * @description Change the format of an existing report
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
  export namespace FormatReport {
    export type RequestParams = {
      /**
       * Report ID
       * @format uuid
       */
      reportId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = {
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
    };
    export type RequestHeaders = {};
    export type ResponseBody = {
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
    };
  }

  /**
 * @description Retrieve a specific report by ID
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
  export namespace GetReport {
    export type RequestParams = {
      /**
       * Report ID
       * @format uuid
       */
      reportId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = {
      /** @example true */
      success: boolean;
      data: Report;
      /** @format date-time */
      timestamp: string;
    };
  }
}
