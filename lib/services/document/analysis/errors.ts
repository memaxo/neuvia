/**
 * Document Analysis Error Classes
 * 
 * This file contains custom error classes for the document analysis services.
 */

import { ApplicationError } from '@/lib/errors'

/**
 * Base error for document analysis services
 */
export class DocumentAnalysisError extends ApplicationError {
  constructor(
    message: string,
    code: string,
    isRetryable: boolean = false,
    data?: Record<string, unknown>
  ) {
    super({
      message,
      code,
      data: {
        ...data,
        isRetryable,
      },
    })
  }
}

/**
 * Error for document type detection failures
 */
export class DocumentTypeDetectionError extends DocumentAnalysisError {
  constructor(
    message: string,
    code: string = 'document_type_detection_error',
    isRetryable: boolean = true,
    data?: Record<string, unknown>
  ) {
    super(message, code, isRetryable, data)
  }
}

/**
 * Error for section detection failures
 */
export class SectionDetectionError extends DocumentAnalysisError {
  constructor(
    message: string,
    code: string = 'section_detection_error',
    isRetryable: boolean = true,
    data?: Record<string, unknown>
  ) {
    super(message, code, isRetryable, data)
  }
}

/**
 * Error for key point extraction failures
 */
export class KeyPointExtractionError extends DocumentAnalysisError {
  constructor(
    message: string,
    code: string = 'key_point_extraction_error',
    isRetryable: boolean = true,
    data?: Record<string, unknown>
  ) {
    super(message, code, isRetryable, data)
  }
}