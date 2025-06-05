/**
 * @fileoverview
 * OpenRouter provider implementation for the AI Provider Factory.
 */
import { AIProvider, ProviderError } from './types';

/**
 * OpenRouter provider implementation.
 */
export default class OpenRouterProvider implements AIProvider {
  private apiKey: string | null = null;
  private client: any = null;
  
  /**
   * Creates and returns an OpenRouter model instance.
   * @param modelName The OpenRouter model name, which might include provider namespace
   * @returns An OpenRouter model instance
   * @throws ProviderError if OpenRouter client cannot be initialized
   */
  getModel(modelName: string): any {
    if (!this.client) {
      this.initializeClient();
    }
    
    // OpenRouter supports both chat and completion models
    // For simplicity, we'll use chat for all models
    return this.client.chat(modelName);
  }
  
  /**
   * Indicates if this provider requires an API key.
   * OpenRouter always requires an API key.
   */
  requiresApiKey(): boolean {
    return true;
  }
  
  /**
   * Initializes the provider with an API key.
   * @param keys Object containing API keys
   */
  initialize(keys: Record<string, string>): void {
    if (keys.openrouter) {
      this.apiKey = keys.openrouter;
      // Set environment variable for SDK to use
      process.env.OPENROUTER_API_KEY = this.apiKey;
    }
  }
  
  /**
   * Initialize the OpenRouter client.
   * @private
   * @throws ProviderError if the client cannot be initialized
   */
  private initializeClient(): void {
    try {
      // Check if @openrouter/ai-sdk-provider is installed
      const openrouterModule = require('@openrouter/ai-sdk-provider');
      
      if (!this.apiKey && !process.env.OPENROUTER_API_KEY) {
        throw new ProviderError(
          'OpenRouter API key not provided. Set OPENROUTER_API_KEY environment variable or provide it in keys.json.',
          'openrouter',
          true
        );
      }
      
      this.client = openrouterModule.createOpenRouter({
        apiKey: this.apiKey || process.env.OPENROUTER_API_KEY || '',
      });
      
      if (!this.client) {
        throw new ProviderError(
          'Failed to initialize OpenRouter client',
          'openrouter',
          true
        );
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }
      
      // Check if it's a module not found error
      if (error instanceof Error && error.message.includes('Cannot find module')) {
        throw new ProviderError(
          'OpenRouter provider is not available. Install @openrouter/ai-sdk-provider package.',
          'openrouter',
          true
        );
      }
      
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderError(
        `Failed to initialize OpenRouter: ${message}`,
        'openrouter',
        true
      );
    }
  }
}