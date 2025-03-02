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

import { ContentType, HttpClient, RequestParams } from "../models/http-client"

export class Security<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
 * @description Endpoint for receiving Content Security Policy violation reports from browsers
 *
 * @tags security
 * @name ReportCspViolation
 * @summary Report CSP violations
 * @request POST:/csp-report
 * @response `202` `{
  \** @example true *\
    success: boolean,
    data: {
  \** Whether the report was successfully processed *\
    reported: boolean,
  \**
   * Timestamp when the report was processed
   * @format date-time
   *\
    timestamp: string,

},
  \** @format date-time *\
    timestamp: string,

}` CSP report accepted
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
  reportCspViolation = (
    data: {
      'csp-report': {
        /** URI that was blocked by the CSP */
        'blocked-uri'?: string;
        /** CSP directive that was violated */
        'violated-directive'?: string;
        /** URI of the document where the violation occurred */
        'document-uri'?: string;
        /** Source file where the violation occurred */
        'source-file'?: string;
        /** Line number in the source file where the violation occurred */
        'line-number'?: number | string;
        /** Column number in the source file where the violation occurred */
        'column-number'?: number | string;
        /** Effective directive that was violated */
        'effective-directive'?: string;
        /** Original policy that was violated */
        'original-policy'?: string;
        /** Disposition of the violation (enforce or report) */
        disposition?: string;
        /** Referrer of the document where the violation occurred */
        referrer?: string;
        /** HTTP status code of the response */
        'status-code'?: number | string;
      };
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /** Whether the report was successfully processed */
          reported: boolean;
          /**
           * Timestamp when the report was processed
           * @format date-time
           */
          timestamp: string;
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
      path: `/csp-report`,
      method: 'POST',
      body: data,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
}
