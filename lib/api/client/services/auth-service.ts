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

import type { HttpClient, RequestParams } from "../models/http-client";
import { ContentType } from "../models/http-client";
import { authService as localAuthService } from '@/lib/services/auth/auth-service';

export class Auth<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * Get the current authenticated user
   */
  getCurrentUser = async (
    params: RequestParams = {},
  ) => {
    // Use local auth service for this operation
    return await localAuthService.getCurrentUser();
  }

  /**
   * Sign in with email and password
   */
  signInWithPassword = async (
    data: {
      email: string;
      password: string;
    },
    params: RequestParams = {},
  ) => {
    // Use local auth service for this operation
    return await localAuthService.signInWithPassword(data.email, data.password);
  }

  /**
   * Sign up with email and password
   */
  signUp = async (
    data: {
      email: string;
      password: string;
    },
    params: RequestParams = {},
  ) => {
    // Use local auth service for this operation
    return await localAuthService.signUp(data.email, data.password);
  }

  /**
   * Sign out
   */
  signOut = async (
    params: RequestParams = {},
  ) => {
    // Use local auth service for this operation
    return await localAuthService.signOut();
  }

  /**
   * Get session
   */
  getSession = async (
    params: RequestParams = {},
  ) => {
    // Use local auth service for this operation
    return await localAuthService.getSession();
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
