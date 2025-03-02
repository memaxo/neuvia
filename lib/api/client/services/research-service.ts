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

export class Research<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
 * @description Performs research including medical diagnoses from documents or queries
 *
 * @tags research
 * @name PerformResearch
 * @summary Perform research using Perplexity
 * @request POST:/perplexity
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \** Research content *\
    research: string,
  \** Original query *\
    query: string,
  \** Research sources *\
    sources?: ({
  \** Source title *\
    title: string,
  \**
   * Source URL
   * @format uri
   *\
    url: string,
  \** Source content excerpt *\
    content?: string,
  \** Publication date *\
    date?: string,
  \**
   * Relevance score (0-1)
   * @min 0
   * @max 1
   *\
    relevanceScore?: number,

})[],
    metadata?: {
  \** Processing time in milliseconds *\
    processingTimeMs?: number,
  \** Depth of research performed *\
    depth?: "basic" | "comprehensive" | "expert",
  \** Number of sources included *\
    sourceCount?: number,
  \** Whether this was a medical diagnosis *\
    isMedicalDiagnosis?: boolean,

},

},
  \** @format date-time *\
    timestamp: string,

}` Research performed successfully
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
  performResearch = (
    data: (
      | {
          /** Research query */
          query: string;
        }
      | {
          /**
           * Document ID to research
           * @format uuid
           */
          documentId: string;
        }
    ) & {
      options?: {
        /**
         * Depth of research to perform
         * @default "comprehensive"
         */
        depth?: 'basic' | 'comprehensive' | 'expert';
        /**
         * Maximum number of sources to include
         * @min 1
         * @max 20
         * @default 5
         */
        sourcesLimit?: number;
        /**
         * Whether to include source content in the response
         * @default true
         */
        includeSourceContent?: boolean;
        /**
         * Whether this is a medical diagnosis research
         * @default false
         */
        isMedicalDiagnosis?: boolean;
        /** Optional patient data for context in medical diagnosis */
        patientData?: string;
      };
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /** Research content */
          research: string;
          /** Original query */
          query: string;
          /** Research sources */
          sources?: {
            /** Source title */
            title: string;
            /**
             * Source URL
             * @format uri
             */
            url: string;
            /** Source content excerpt */
            content?: string;
            /** Publication date */
            date?: string;
            /**
             * Relevance score (0-1)
             * @min 0
             * @max 1
             */
            relevanceScore?: number;
          }[];
          metadata?: {
            /** Processing time in milliseconds */
            processingTimeMs?: number;
            /** Depth of research performed */
            depth?: 'basic' | 'comprehensive' | 'expert';
            /** Number of sources included */
            sourceCount?: number;
            /** Whether this was a medical diagnosis */
            isMedicalDiagnosis?: boolean;
          };
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
      | {
          error: {
            /** @example "External service error" */
            message: string;
            /** @example "EXTERNAL_SERVICE_ERROR" */
            code: string;
            /** @format date-time */
            timestamp: string;
            details?: {
              /** The external service that failed */
              service?: string;
            };
          };
        }
    >({
      path: `/perplexity`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
  /**
 * @description Ingests documents into vector store for later retrieval
 *
 * @tags research, documents
 * @name IngestDocument
 * @summary Ingest document into vector store
 * @request POST:/retrieval/ingest
 * @secure
 * @response `200` `{
  \** @example true *\
    success: boolean,
    data: {
  \** Embedding records created *\
    embeddings: ({
  \** Embedding ID *\
    id: string,
  \** Index of the chunk *\
    chunkIndex?: number,
  \** Embedding metadata *\
    metadata?: Record<string,any>,

})[],
  \** Number of embeddings created *\
    count?: number,
  \** Processing time in milliseconds *\
    processingTimeMs?: number,

},
  \** @format date-time *\
    timestamp: string,

}` Document ingested successfully
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
  ingestDocument = (
    data: {
      /** Document text to ingest */
      text: string;
      /** Optional metadata for the document */
      metadata?: Record<string, any>;
      /**
       * Optional patient ID to associate with the document
       * @format uuid
       */
      patientId?: string;
      /**
       * Optional document ID to associate with the embedding
       * @format uuid
       */
      documentId?: string;
      /**
       * Size of text chunks for embedding
       * @min 100
       * @max 10000
       * @default 1000
       */
      chunkSize?: number;
      /**
       * Overlap between chunks
       * @min 0
       * @max 1000
       * @default 200
       */
      chunkOverlap?: number;
    },
    params: RequestParams = {},
  ) =>
    this.http.request<
      {
        /** @example true */
        success: boolean;
        data: {
          /** Embedding records created */
          embeddings: {
            /** Embedding ID */
            id: string;
            /** Index of the chunk */
            chunkIndex?: number;
            /** Embedding metadata */
            metadata?: Record<string, any>;
          }[];
          /** Number of embeddings created */
          count?: number;
          /** Processing time in milliseconds */
          processingTimeMs?: number;
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
      path: `/retrieval/ingest`,
      method: 'POST',
      body: data,
      secure: true,
      type: ContentType.Json,
      format: 'json',
      ...params,
    });
}
