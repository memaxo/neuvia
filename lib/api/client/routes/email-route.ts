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

export namespace Email {
  /**
 * @description Sends an email using the Resend service with a templated email
 * @tags email
 * @name SendEmail
 * @summary Send an email using Resend
 * @request POST:/send
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \** Resend email ID *\
    id: string,
  \** Whether the email was sent successfully *\
    sent: boolean,
  \**
   * Timestamp when the email was sent
   * @format date-time
   *\
    timestamp: string,

},
  \** @format date-time *\
    timestamp: string,

}` Email sent successfully
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
 * @response `502` `{
    error: {
  \** @example "External service error" *\
    message: string,
  \** @example "EXTERNAL_SERVICE_ERROR" *\
    code: string,
  \** @format date-time *\
    timestamp: string,
    details?: {
  \** The external service that failed *\
    service?: string,

},

},

}`
*/
  export namespace SendEmail {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = {
      /**
       * Recipients email addresses
       * @minItems 1
       */
      to: string[];
      /**
       * Email subject
       * @minLength 1
       */
      subject: string;
      /** Recipient first name for personalization */
      firstName: string;
    };
    export type RequestHeaders = {};
    export type ResponseBody = {
      /** @example true */
      success: boolean;
      data: {
        /** Resend email ID */
        id: string;
        /** Whether the email was sent successfully */
        sent: boolean;
        /**
         * Timestamp when the email was sent
         * @format date-time
         */
        timestamp: string;
      };
      /** @format date-time */
      timestamp: string;
    };
  }
}
