/**
 * @fileoverview
 * Application error classes for structured error handling.
 */

/**
 * Base application error class with error codes and recovery information.
 */
export class ApplicationError extends Error {
  constructor(
    message: string, 
    public readonly code: string, 
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

/**
 * Configuration-related errors (missing files, invalid format, etc.).
 */
export class ConfigurationError extends ApplicationError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', true);
  }
}

/**
 * AI provider-related errors (unavailable provider, API issues, etc.).
 */
export class ProviderError extends ApplicationError {
  constructor(message: string) {
    super(message, 'PROVIDER_ERROR', true);
  }
}

/**
 * MCP tool-related errors (tool loading, execution failures, etc.).
 */
export class ToolError extends ApplicationError {
  constructor(message: string) {
    super(message, 'TOOL_ERROR', true);
  }
}

/**
 * Session management errors (file I/O, memory issues, etc.).
 */
export class SessionError extends ApplicationError {
  constructor(message: string) {
    super(message, 'SESSION_ERROR', true);
  }
}