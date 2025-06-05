# AI Provider Factory Implementation

This document outlines a detailed factory pattern implementation for managing AI providers in the project. The current implementation in `interactions.ts` has several limitations:

1. Direct imports of all providers at the top of the file, increasing bundle size
2. Manual initialization of OpenRouter with error-prone conditional logic
3. String-based switching logic in the `getClientForProvider` function
4. Multiple error handling paths for provider selection
5. Repeated provider selection logic in multiple places

## Proposed Implementation

The solution uses a factory pattern with dynamic imports to lazy-load providers, standardized error handling, and clear separation of concerns.

### Directory Structure

```
src/
├── providers/
│   ├── index.ts
│   ├── types.ts
│   ├── provider-factory.ts
│   ├── openai-provider.ts
│   ├── anthropic-provider.ts
│   ├── google-provider.ts
│   ├── openrouter-provider.ts
│   └── custom-provider.ts
```

### Core Components

#### 1. Provider Interface (types.ts)

```typescript
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
```

#### 2. Provider Factory (provider-factory.ts)

```typescript
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
    'custom': () => import('./custom-provider'),
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
```

#### 3. Individual Provider Implementations

##### OpenAI Provider (openai-provider.ts)

```typescript
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
```

##### Anthropic Provider (anthropic-provider.ts)

```typescript
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
```

##### OpenRouter Provider (openrouter-provider.ts)

```typescript
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
```

#### 4. Provider Index (index.ts)

```typescript
// Export factory and types
export * from './provider-factory';
export * from './types';

// Export provider implementations (for direct use if needed)
export { default as OpenAIProvider } from './openai-provider';
export { default as AnthropicProvider } from './anthropic-provider';
export { default as GoogleProvider } from './google-provider';
export { default as OpenRouterProvider } from './openrouter-provider';
export { default as CustomProvider } from './custom-provider';
```

### Integration into Interactions.ts

The refactored `interactions.ts` would use the provider factory as follows:

```typescript
import { ProviderFactory, ProviderError } from './providers';

// Replace direct imports
// import { openai } from "@ai-sdk/openai";
// import { anthropic } from "@ai-sdk/anthropic";
// import { google } from "@ai-sdk/google";

// Remove OpenRouter initialization logic
// let openrouter: any = null;
// let openrouterModule: any = null;
// try {
//   openrouterModule = require("@openrouter/ai-sdk-provider");
// } catch (e) {
//   openrouterModule = null;
// }

// Remove function initializeOpenRouter()

// Replace parseModelString function with factory method
// function parseModelString(modelString: string): { provider: string, modelName: string } {
//   ...
// }

// Remove getClientForProvider function
// function getClientForProvider(provider: string): ((modelName: string) => any) {
//   ...
// }

// Update processUserInput to use the factory
async function processUserInput(prompt: string, isAutoContinuation = false): Promise<void> {
  // ... existing code ...

  try {
    // Combine all loaded MCP tools into a single array for createAISDKTools
    const mcpToolInstances = Object.values(loadedTools);
    const allTools = mcpToolInstances.length === 1
      ? createAISDKTools(mcpToolInstances[0])
      : createAISDKTools(...mcpToolInstances);

    // Build the full prompt with conversation context
    const contextualPrompt = prompt + buildConversationContext();

    // Dynamically select provider and model using the factory
    let model;
    try {
      // Get model from the factory (handles parsing, provider loading, and initialization)
      model = await ProviderFactory.getModelFromString(config.model, keys);
    } catch (err) {
      spinnerActive = false;
      clearInterval(spinnerInterval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      
      // Specific error handling for provider errors
      if (err instanceof ProviderError) {
        console.error(`Provider Error [${err.provider}]: ${err.message}`);
        logAgentError(sessionFile, `Provider Error [${err.provider}]: ${err.message}`);
      } else {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${errMsg}`);
        logAgentError(sessionFile, errMsg);
      }
      
      if (!isAutoContinuation) {
        rl.prompt();
      }
      return;
    }

    const result = await generateText({
      model,
      tools: allTools,
      temperature: config.temperature,
      system: enhancedSystemPrompt,
      prompt: contextualPrompt
    });
    
    // ... rest of existing code ...
  } catch (err) {
    // ... existing error handling ...
  }
}
```

### Summary Tool Handling

Similarly, update the summary tool handling:

```typescript
// Use the same dynamic model selection for summary
let summaryModel;
try {
  summaryModel = await ProviderFactory.getModelFromString(config.model, keys);
} catch (err) {
  clearInterval(toolSpinnerInterval);
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  
  if (err instanceof ProviderError) {
    console.error(`Provider Error [${err.provider}]: ${err.message}`);
    logAgentError(sessionFile, `Provider Error [${err.provider}]: ${err.message}`);
  } else {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${errMsg}`);
    logAgentError(sessionFile, errMsg);
  }
  return;
}
```

## Benefits of This Approach

1. **Separation of Concerns**: Each provider has its own implementation class, making it easier to maintain and extend.

2. **Lazy Loading**: Providers are only loaded when needed, reducing initial bundle size and startup time.

3. **Error Handling**: Standardized error handling with specific error types for providers.

4. **Testability**: Provider implementations can be individually tested.

5. **API Key Management**: Consistent handling of API keys across providers.

6. **Dynamic Loading**: Providers can be dynamically loaded at runtime based on configuration.

7. **Centralized Logic**: All provider-related logic is centralized in a single module.

## Implementation Plan

1. Create the provider module structure in `src/providers/`.
2. Implement the base interfaces and factory.
3. Implement individual provider classes.
4. Refactor `interactions.ts` to use the factory.
5. Update configuration handling for API keys.
6. Add tests for the provider factory and implementations.

This approach provides a scalable and maintainable solution for managing AI providers in the application, while reducing complexity and improving error handling.