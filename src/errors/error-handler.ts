/**
 * @fileoverview
 * Centralized error handling utilities.
 */
import { ApplicationError } from './application-error';

/**
 * Centralized error handler that formats and logs application errors consistently.
 * 
 * @param error The error to handle
 * @param context Optional context information for better error reporting
 */
export function handleError(error: unknown, context?: string): void {
  const prefix = '[local-agent]';
  const contextStr = context ? ` (${context})` : '';
  
  if (error instanceof ApplicationError) {
    console.error(`${prefix} ${error.code}: ${error.message}${contextStr}`);
    if (!error.recoverable) {
      process.exit(1);
    }
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${prefix} Unexpected error: ${message}${contextStr}`);
  }
}

/**
 * Wraps a function to provide automatic error handling.
 * 
 * @param fn The function to wrap
 * @param context Context information for error reporting
 * @returns The wrapped function
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T, 
  context?: string
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error) => {
          handleError(error, context);
          throw error;
        });
      }
      return result;
    } catch (error) {
      handleError(error, context);
      throw error;
    }
  }) as T;
}