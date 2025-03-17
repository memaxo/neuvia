/**
 * Standard result pattern for handling success/failure in the workflow
 */
export interface Result<T, E = Error> {
  /**
   * Returns whether the result is a success or failure
   */
  isSuccess(): boolean;
  
  /**
   * Returns whether the result is a failure
   */
  isFailure(): boolean;
  
  /**
   * Returns the success value. Will throw if the result is a failure.
   */
  getValue(): T;
  
  /**
   * Returns the error value. Will throw if the result is a success.
   */
  getError(): E;
  
  /**
   * Maps the success value using the provided function.
   * Does nothing if the result is a failure.
   */
  map<U>(fn: (value: T) => U): Result<U, E>;
  
  /**
   * Maps the error value using the provided function.
   * Does nothing if the result is a success.
   */
  mapError<F>(fn: (error: E) => F): Result<T, F>;
  
  /**
   * Maps the success value using the provided function that returns a new Result.
   * Does nothing if the result is a failure.
   */
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E>;
  
  /**
   * Constructs a success Result with the provided value
   */
  static success<T, E = Error>(value: T): Result<T, E>;
  
  /**
   * Constructs a failure Result with the provided error
   */
  static failure<T, E = Error>(error: E): Result<T, E>;
}

/**
 * Implementation of a success result
 */
class Success<T, E = Error> implements Result<T, E> {
  constructor(private readonly value: T) {}
  
  isSuccess(): boolean {
    return true;
  }
  
  isFailure(): boolean {
    return false;
  }
  
  getValue(): T {
    return this.value;
  }
  
  getError(): E {
    throw new Error('Cannot get error from a success result');
  }
  
  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Success<U, E>(fn(this.value));
  }
  
  mapError<F>(_fn: (error: E) => F): Result<T, F> {
    return new Success<T, F>(this.value);
  }
  
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }
  
  static success<T, E = Error>(value: T): Result<T, E> {
    return new Success<T, E>(value);
  }
  
  static failure<T, E = Error>(error: E): Result<T, E> {
    return new Failure<T, E>(error);
  }
}

/**
 * Implementation of a failure result
 */
class Failure<T, E = Error> implements Result<T, E> {
  constructor(private readonly error: E) {}
  
  isSuccess(): boolean {
    return false;
  }
  
  isFailure(): boolean {
    return true;
  }
  
  getValue(): T {
    throw new Error('Cannot get value from a failure result');
  }
  
  getError(): E {
    return this.error;
  }
  
  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Failure<U, E>(this.error);
  }
  
  mapError<F>(fn: (error: E) => F): Result<T, F> {
    return new Failure<T, F>(fn(this.error));
  }
  
  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return new Failure<U, E>(this.error);
  }
  
  static success<T, E = Error>(value: T): Result<T, E> {
    return new Success<T, E>(value);
  }
  
  static failure<T, E = Error>(error: E): Result<T, E> {
    return new Failure<T, E>(error);
  }
}

/**
 * Creates a success result
 */
export function makeSuccess<T, E = Error>(value: T): Result<T, E> {
  return Success.success<T, E>(value);
}

/**
 * Creates a failure result
 */
export function makeFailure<T, E = Error>(error: E): Result<T, E> {
  return Failure.failure<T, E>(error);
}