/**
 * @fileoverview
 * OpenAI provider implementation for the AI Provider Factory.
 */
import { AIProvider } from './types';

/**
 * OpenAI provider implementation.
 */
export default class OpenAIProvider implements AIProvider {
  private apiKey: string | null = null;
  
  /**
   * Creates and returns an OpenAI model instance.
   * @param modelName The OpenAI model name (e.g., "gpt-4o")
   * @returns An OpenAI model instance
   */
  getModel(modelName: string): any {
    // Dynamic import to avoid loading the module until needed
    const { openai } = require('@ai-sdk/openai');
    return openai(modelName);
  }
  
  /**
   * Indicates if this provider requires an API key.
   * For OpenAI, an API key is required but can come from environment variables.
   */
  requiresApiKey(): boolean {
    return false; // OpenAI can read from OPENAI_API_KEY env var
  }
  
  /**
   * Initializes the provider with an API key.
   * @param keys Object containing API keys
   */
  initialize(keys: Record<string, string>): void {
    if (keys.openai) {
      this.apiKey = keys.openai;
      // Set environment variable if not already set
      if (!process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = this.apiKey;
      }
    }
  }
}