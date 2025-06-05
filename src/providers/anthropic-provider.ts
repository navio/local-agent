/**
 * @fileoverview
 * Anthropic provider implementation for the AI Provider Factory.
 */
import { AIProvider } from './types';

/**
 * Anthropic provider implementation.
 */
export default class AnthropicProvider implements AIProvider {
  private apiKey: string | null = null;
  
  /**
   * Creates and returns an Anthropic model instance.
   * @param modelName The Anthropic model name (e.g., "claude-3-5-sonnet")
   * @returns An Anthropic model instance
   */
  getModel(modelName: string): any {
    // Dynamic import to avoid loading the module until needed
    const { anthropic } = require('@ai-sdk/anthropic');
    return anthropic(modelName);
  }
  
  /**
   * Indicates if this provider requires an API key.
   * For Anthropic, an API key is required but can come from environment variables.
   */
  requiresApiKey(): boolean {
    return false; // Anthropic can read from ANTHROPIC_API_KEY env var
  }
  
  /**
   * Initializes the provider with an API key.
   * @param keys Object containing API keys
   */
  initialize(keys: Record<string, string>): void {
    if (keys.anthropic) {
      this.apiKey = keys.anthropic;
      // Set environment variable if not already set
      if (!process.env.ANTHROPIC_API_KEY) {
        process.env.ANTHROPIC_API_KEY = this.apiKey;
      }
    }
  }
}