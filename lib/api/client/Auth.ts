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

import { HttpClient, RequestParams } from './http-client';

export class Auth<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
 * @description Handles authentication callback flow for Supabase auth
 *
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
  authCallback = (
    query: {
      /** Authentication code to exchange for a session */
      code: string;
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      any,
      void | {
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
      path: `/sid/callback`,
      method: 'GET',
      query: query,
      ...params,
    });
}
