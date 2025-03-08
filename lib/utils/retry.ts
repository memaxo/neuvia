import { ApplicationError } from '@/lib/errors'

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay?: number;
  retryCondition?: (error: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryCondition: (error) => {
    // Default retry condition - determine if error is retryable
    if (error instanceof ApplicationError) {
      return 'retryable' in error.data ? !!error.data.retryable : false;
    }
    return false;
  }
}

/**
 * Execute an async operation with configurable retry logic
 * 
 * @param operation Function to execute with retry logic
 * @param options Retry configuration options
 * @returns Promise resolving to operation result
 * @throws The last error encountered if all retries fail
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry based on the error
      const shouldRetry = attempt < config.maxRetries && 
        (config.retryCondition ? config.retryCondition(error) : true);
      
      if (!shouldRetry) break;
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt - 1),
        config.maxDelay || Infinity
      );
      
      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}