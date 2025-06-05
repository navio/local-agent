/**
 * @fileoverview
 * Core types and interfaces for AI provider management.
 * Defines the contract for AI providers and error handling.
 */

/**
 * Represents an AI model provider that can create model instances.
 */
export interface AIProvider {
  /**
   * Creates and returns a model instance for the specified model name.
   * @param modelName The specific model to instantiate
   * @returns A model instance compatible with the ai-sdk
   */
  getModel(modelName: string): any;
  
  /**
   * Returns whether this provider requires initialization with API keys.
   */
  requiresApiKey(): boolean;
  
  /**
   * Initializes the provider with the necessary API keys.
   * @param keys The keys object containing API keys
   */
  initialize(keys: Record<string, string>): void;
}

/**
 * Result of parsing a model string into provider and model components.
 */
export interface ParsedModel {
  provider: string;
  modelName: string;
}

/**
 * Error thrown when an AI provider encounters an issue.
 */
export class ProviderError extends Error {
  constructor(
    message: string, 
    public readonly provider: string,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}