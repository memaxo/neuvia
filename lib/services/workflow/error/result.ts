/**
 * @fileoverview Provides a standardized Result pattern for error handling in the workflow system.
 * 
 * This pattern enables functions to return either success or failure results without throwing
 * exceptions, making error handling more explicit and predictable. It encourages handling
 * all possible outcomes and eliminates "undefined is not an object" runtime errors.
 * 
 * Usage:
 * ```typescript
 * // Creating a success result
 * return Result.success({ data: 'some-data' });
 * 
 * // Creating a failure result
 * return Result.failure('Operation failed', 'OPERATION_FAILED', { details: 'additional context' });
 * 
 * // Using with async/await and handling both cases
 * const result = await someOperation();
 * if (result.isSuccess()) {
 *   // Use result.value
 * } else {
 *   // Handle result.error
 * }
 * 
 * // Converting try/catch to Result
 * return Result.try(() => {
 *   // Code that might throw an exception
 *   return someValue;
 * });
 * ```
 */
import { normalizeError } from '@/lib/errors';

/**
 * Standard error interface for result failures
 */
export interface ResultError {
  message: string;
  code: string;
  stack?: string;
  cause?: unknown;
  details?: Record<string, unknown>;
  category?: string;
}

/**
 * Type predicate to check if an object matches the ResultError interface
 */
export function isResultError(obj: unknown): obj is ResultError {
  const isBaseResultError = (
    typeof obj === 'object' &&
    obj !== null &&
    'message' in obj &&
    typeof (obj as ResultError).message === 'string' &&
    'code' in obj &&
    typeof (obj as ResultError).code === 'string'
  );
  
  // Check category if it exists (optional)
  if (isBaseResultError && 'category' in obj) {
    return typeof (obj as ResultError).category === 'string' || (obj as ResultError).category === undefined;
  }
  
  return isBaseResultError;
}

/**
 * Result class for representing both success and failure outcomes without throwing exceptions
 */
export class Result<T> {
  private readonly _isSuccess: boolean;
  private readonly _value?: T;
  private readonly _error?: ResultError;

  private constructor(isSuccess: boolean, value?: T, error?: ResultError) {
    this._isSuccess = isSuccess;
    this._value = value;
    this._error = error;
  }

  /**
   * Creates a success result with the provided value
   */
  public static success<U>(value: U): Result<U> {
    return new Result<U>(true, value);
  }

  /**
   * Creates a failure result with error details
   */
  public static failure<U>(
    message: string,
    code = 'UNKNOWN_ERROR',
    details?: Record<string, unknown>,
    category?: string
  ): Result<U> {
    const error: ResultError = {
      message,
      code,
      details,
      category
    };
    return new Result<U>(false, undefined, error);
  }

  /**
   * Creates a failure result from an existing error object
   */
  public static fromError<U>(error: unknown): Result<U> {
    const normalized = normalizeError(error);
    
    // Import is not available here so we use normalized.category
    const errorCategory = normalized.category;
    
    return Result.failure<U>(
      normalized.message,
      normalized.code,
      normalized.data,
      errorCategory
    );
  }

  /**
   * Wraps a function call in a try/catch and returns a Result
   */
  public static try<U>(fn: () => U): Result<U> {
    try {
      const value = fn();
      return Result.success(value);
    } catch (error) {
      return Result.fromError<U>(error);
    }
  }

  /**
   * Wraps an async function call in a try/catch and returns a Result
   */
  public static async tryAsync<U>(fn: () => Promise<U>): Promise<Result<U>> {
    try {
      const value = await fn();
      return Result.success(value);
    } catch (error) {
      return Result.fromError<U>(error);
    }
  }

  /**
   * Converts a promise to a Result, handling both resolved and rejected states
   */
  public static async fromPromise<U>(promise: Promise<U>): Promise<Result<U>> {
    try {
      const value = await promise;
      return Result.success(value);
    } catch (error) {
      return Result.fromError<U>(error);
    }
  }
  
  /**
   * Creates a failure result from an ApplicationError
   * This provides direct integration with exception-based code
   */
  public static fromApplicationError<U>(
    error: import('@/lib/errors').ApplicationError
  ): Result<U> {
    return Result.failure<U>(
      error.message,
      error.code,
      error.data,
      error.category
    );
  }

  /**
   * Checks if this result represents a success
   */
  public isSuccess(): boolean {
    return this._isSuccess;
  }

  /**
   * Checks if this result represents a failure
   */
  public isFailure(): boolean {
    return !this._isSuccess;
  }

  /**
   * Gets the success value (throws if called on failure)
   */
  public get value(): T {
    if (!this._isSuccess) {
      throw new Error(
        `Cannot access value of failed result. Error: ${this._error?.message}`
      );
    }
    // We know value must be defined for success results
    return this._value as T;
  }

  /**
   * Safely gets the value if success, or undefined if failure
   */
  public getValueOrUndefined(): T | undefined {
    return this._isSuccess ? this._value : undefined;
  }

  /**
   * Gets the value if success, or a default value if failure
   */
  public getValueOrDefault(defaultValue: T): T {
    return this._isSuccess ? (this._value as T) : defaultValue;
  }

  /**
   * Gets the error (throws if called on success)
   */
  public get error(): ResultError {
    if (this._isSuccess) {
      throw new Error('Cannot access error of successful result');
    }
    // We know error must be defined for failure results
    return this._error as ResultError;
  }

  /**
   * Safely gets the error if failure, or undefined if success
   */
  public getErrorOrUndefined(): ResultError | undefined {
    return this._isSuccess ? undefined : this._error;
  }

  /**
   * Applies a function to transform the value if this is a success result
   */
  public map<U>(fn: (value: T) => U): Result<U> {
    if (this._isSuccess) {
      try {
        return Result.success(fn(this._value as T));
      } catch (error) {
        return Result.fromError<U>(error);
      }
    }
    return Result.failure<U>(
      this._error!.message,
      this._error!.code,
      this._error!.details
    );
  }

  /**
   * Applies an async function to transform the value if this is a success result
   */
  public async mapAsync<U>(fn: (value: T) => Promise<U>): Promise<Result<U>> {
    if (this._isSuccess) {
      try {
        const newValue = await fn(this._value as T);
        return Result.success(newValue);
      } catch (error) {
        return Result.fromError<U>(error);
      }
    }
    return Result.failure<U>(
      this._error!.message,
      this._error!.code,
      this._error!.details
    );
  }

  /**
   * Chains a function that returns another Result
   */
  public flatMap<U>(fn: (value: T) => Result<U>): Result<U> {
    if (this._isSuccess) {
      try {
        return fn(this._value as T);
      } catch (error) {
        return Result.fromError<U>(error);
      }
    }
    return Result.failure<U>(
      this._error!.message,
      this._error!.code,
      this._error!.details
    );
  }

  /**
   * Chains an async function that returns another Result
   */
  public async flatMapAsync<U>(
    fn: (value: T) => Promise<Result<U>>
  ): Promise<Result<U>> {
    if (this._isSuccess) {
      try {
        return await fn(this._value as T);
      } catch (error) {
        return Result.fromError<U>(error);
      }
    }
    return Result.failure<U>(
      this._error!.message,
      this._error!.code,
      this._error!.details
    );
  }

  /**
   * Handle both success and failure cases in one call
   */
  public match<U>(
    onSuccess: (value: T) => U,
    onFailure: (error: ResultError) => U
  ): U {
    if (this._isSuccess) {
      return onSuccess(this._value as T);
    } else {
      return onFailure(this._error as ResultError);
    }
  }

  /**
   * Apply side effects for success case only
   */
  public onSuccess(fn: (value: T) => void): Result<T> {
    if (this._isSuccess) {
      fn(this._value as T);
    }
    return this;
  }

  /**
   * Apply side effects for failure case only
   */
  public onFailure(fn: (error: ResultError) => void): Result<T> {
    if (!this._isSuccess) {
      fn(this._error as ResultError);
    }
    return this;
  }

  /**
   * Convert the result to a simple object representation
   */
  public toObject(): {
    success: boolean;
    value?: T;
    error?: ResultError;
  } {
    if (this._isSuccess) {
      return {
        success: true,
        value: this._value,
      };
    } else {
      return {
        success: false,
        error: this._error,
      };
    }
  }
  
  /**
   * Handle this result with the provided handler function if it's a failure
   * This allows for integration with the unified error handler
   *
   * @param handler Function that handles the error
   * @returns This result (for chaining)
   */
  public async handleErrorWith(
    handler: (error: ResultError) => Promise<void>
  ): Promise<Result<T>> {
    if (this.isFailure() && this._error) {
      await handler(this._error);
    }
    return this;
  }
  
  /**
   * Convert to ApplicationError
   * This provides direct integration with exception-based code
   */
  public toApplicationError(statusCode = 500): import('@/lib/errors').ApplicationError {
    if (this._isSuccess) {
      throw new Error('Cannot convert successful result to error');
    }
    
    const resultError = this._error as ResultError;
    
    // Use dynamic import to avoid circular dependencies
    const { ApplicationError } = require('@/lib/errors');
    
    return new ApplicationError({
      message: resultError.message,
      code: resultError.code,
      statusCode,
      data: resultError.details || {},
      cause: resultError.cause,
      category: resultError.category
    });
  }
  
  /**
   * Throw the error if this is a failure result
   * Useful for transitioning from Result pattern to exception handling
   */
  public throwIfFailure(): T {
    if (this.isFailure()) {
      throw this.toApplicationError();
    }
    return this.value;
  }
}

/**
 * Helper functions for working with arrays of Results
 */
export const ResultHelpers = {
  /**
   * Takes an array of Results and returns a Result containing an array of values if all succeed,
   * or the first failure
   */
  all<T>(results: Result<T>[]): Result<T[]> {
    // Find the first failure
    const firstFailure = results.find((result) => result.isFailure());
    if (firstFailure) {
      // Return the first failure
      return Result.failure<T[]>(
        firstFailure.error.message,
        firstFailure.error.code,
        firstFailure.error.details
      );
    }
    
    // All succeeded, collect the values
    const values = results.map((result) => result.value);
    return Result.success(values);
  },

  /**
   * Takes an array of Results and returns a Result containing an array of all successful values,
   * along with any errors that occurred (does not short-circuit on first failure)
   */
  allSettled<T>(
    results: Result<T>[]
  ): Result<{ values: T[]; errors: ResultError[] }> {
    const values: T[] = [];
    const errors: ResultError[] = [];
    
    results.forEach((result) => {
      if (result.isSuccess()) {
        values.push(result.value);
      } else {
        errors.push(result.error);
      }
    });
    
    return Result.success({ values, errors });
  },

  /**
   * Takes an array of async operations that return Results and waits for all to complete
   */
  async allAsync<T>(promises: Promise<Result<T>>[]): Promise<Result<T[]>> {
    const results = await Promise.all(promises);
    return ResultHelpers.all(results);
  },

  /**
   * Takes an array of async operations that return Results and waits for all to complete,
   * collecting successes and failures
   */
  async allSettledAsync<T>(
    promises: Promise<Result<T>>[]
  ): Promise<Result<{ values: T[]; errors: ResultError[] }>> {
    const results = await Promise.all(promises);
    return ResultHelpers.allSettled(results);
  },
};