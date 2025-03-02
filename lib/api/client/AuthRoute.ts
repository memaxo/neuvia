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

export namespace Auth {
  /**
 * @description Handles authentication callback flow for Supabase auth
 * @tags auth
 * @name AuthCallback
 * @summary Auth callback endpoint
 * @request GET:/sid/callback
 * @response `302` `void` Redirect to application page
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
  export namespace AuthCallback {
    export type RequestParams = {};
    export type RequestQuery = {
      /** Authentication code to exchange for a session */
      code: string;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = any;
  }
}
