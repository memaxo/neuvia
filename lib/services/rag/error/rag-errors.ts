import { ApplicationError } from '@/lib/errors'

/**
 * Error thrown during RAG indexing operations
 */
export class RAGIndexingError extends ApplicationError {
  constructor(message: string, cause?: Error) {
    super('RAG_INDEXING_ERROR', message, cause)
  }
}

/**
 * Error thrown during RAG retrieval operations
 */
export class RAGRetrievalError extends ApplicationError {
  constructor(message: string, cause?: Error) {
    super('RAG_RETRIEVAL_ERROR', message, cause)
  }
}

/**
 * Error thrown during RAG memory operations
 */
export class RAGMemoryError extends ApplicationError {
  constructor(message: string, cause?: Error) {
    super('RAG_MEMORY_ERROR', message, cause)
  }
}

/**
 * Error thrown during general RAG operations
 */
export class RAGError extends ApplicationError {
  constructor(message: string, cause?: Error) {
    super('RAG_ERROR', message, cause)
  }
}