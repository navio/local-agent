/**
 * @fileoverview
 * Google provider implementation for the AI Provider Factory.
 */
import { AIProvider } from './types';

/**
 * Google provider implementation.
 */
export default class GoogleProvider implements AIProvider {
  private apiKey: string | null = null;
  
  /**
   * Creates and returns a Google model instance.
   * @param modelName The Google model name (e.g., "gemini-pro")
   * @returns A Google model instance
   */
  getModel(modelName: string): any {
    // Dynamic import to avoid loading the module until needed
    const { google } = require('@ai-sdk/google');
    return google(modelName);
  }
  
  /**
   * Indicates if this provider requires an API key.
   * For Google, an API key is required but can come from environment variables.
   */
  requiresApiKey(): boolean {
    return false; // Google can read from GOOGLE_GENERATIVE_AI_API_KEY env var
  }
  
  /**
   * Initializes the provider with an API key.
   * @param keys Object containing API keys
   */
  initialize(keys: Record<string, string>): void {
    if (keys.google) {
      this.apiKey = keys.google;
      // Set environment variable if not already set
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = this.apiKey;
      }
    }
  }
}