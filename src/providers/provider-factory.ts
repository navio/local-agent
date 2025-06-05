/**
 * @fileoverview
 * Factory for creating and managing AI providers.
 * Uses lazy loading to only import providers when needed.
 */
import { AIProvider, ParsedModel, ProviderError } from './types';

/**
 * Factory for creating and managing AI providers.
 * Uses lazy loading to only import providers when needed.
 */
export class ProviderFactory {
  private static providers: Record<string, AIProvider | null> = {};
  private static providerModules: Record<string, () => Promise<{ default: new () => AIProvider }>> = {
    'openai': () => import('./openai-provider'),
    'anthropic': () => import('./anthropic-provider'),
    'google': () => import('./google-provider'),
    'openrouter': () => import('./openrouter-provider'),
  };

  /**
   * Parses a model string into provider and model name components.
   * Handles backward compatibility for model strings without a provider prefix.
   * 
   * @param modelString The model string to parse (e.g., "openai/gpt-4o" or "gpt-4o")
   * @returns The parsed provider and model name
   */
  static parseModelString(modelString: string): ParsedModel {
    if (!modelString.includes('/')) {
      // Backward compatibility: treat as openai
      return { provider: 'openai', modelName: modelString };
    }
    
    const [provider, ...rest] = modelString.split('/');
    return { 
      provider: provider.toLowerCase(), 
      modelName: rest.join('/') 
    };
  }

  /**
   * Gets or lazily initializes a provider instance for the specified provider name.
   * 
   * @param providerName The name of the provider to get
   * @returns The provider instance
   * @throws ProviderError if the provider is not supported or cannot be loaded
   */
  static async getProvider(providerName: string): Promise<AIProvider> {
    const normalizedName = providerName.toLowerCase();
    
    // Return cached provider if available
    if (this.providers[normalizedName]) {
      return this.providers[normalizedName]!;
    }
    
    // Check if provider is supported
    if (!this.providerModules[normalizedName]) {
      throw new ProviderError(
        `Unsupported AI provider: ${providerName}`, 
        providerName,
        false
      );
    }
    
    try {
      // Dynamically import the provider module
      const module = await this.providerModules[normalizedName]();
      const provider = new module.default();
      
      // Cache the provider instance
      this.providers[normalizedName] = provider;
      return provider;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderError(
        `Failed to load provider ${providerName}: ${message}`,
        providerName,
        true
      );
    }
  }

  /**
   * Convenience method to get a model instance for a given model string.
   * Parses the model string, gets the provider, and returns the model instance.
   * 
   * @param modelString The model string (e.g., "openai/gpt-4o" or "gpt-4o")
   * @param keys API keys for provider initialization
   * @returns A Promise resolving to the model instance
   */
  static async getModelFromString(
    modelString: string, 
    keys: Record<string, string> = {}
  ): Promise<any> {
    const { provider: providerName, modelName } = this.parseModelString(modelString);
    
    try {
      const provider = await this.getProvider(providerName);
      
      // Initialize the provider with API keys if required
      if (provider.requiresApiKey()) {
        provider.initialize(keys);
      }
      
      return provider.getModel(modelName);
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      } else {
        const message = error instanceof Error ? error.message : String(error);
        throw new ProviderError(
          `Error getting model for ${modelString}: ${message}`,
          providerName,
          true
        );
      }
    }
  }
}