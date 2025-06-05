# Project Simplification Proposal

Based on code analysis, I've identified several areas where the project could be simplified for better maintainability, extensibility, and clarity.

## 1. AI Provider Factory Pattern

The current implementation in `interactions.ts` handles AI providers with a combination of imports, conditional logic, and error handling spread across the file. I propose refactoring this to a proper factory pattern:

```typescript
// src/providers/types.ts
export interface AIProvider {
  getModel: (modelName: string) => any;
}

// src/providers/provider-factory.ts
import { AIProvider } from './types';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { GoogleProvider } from './google-provider';
import { OpenRouterProvider } from './openrouter-provider';

export class ProviderFactory {
  private static providers: Record<string, AIProvider> = {
    'openai': new OpenAIProvider(),
    'anthropic': new AnthropicProvider(),
    'google': new GoogleProvider(),
    'openrouter': new OpenRouterProvider(),
  };

  static getProvider(providerName: string): AIProvider {
    const provider = this.providers[providerName.toLowerCase()];
    if (!provider) {
      throw new Error(`Unsupported AI provider: ${providerName}`);
    }
    return provider;
  }

  static parseModelString(modelString: string): { provider: string, modelName: string } {
    if (!modelString.includes("/")) {
      // Backward compatibility: treat as openai
      return { provider: "openai", modelName: modelString };
    }
    const [provider, ...rest] = modelString.split("/");
    return { provider: provider.toLowerCase(), modelName: rest.join("/") };
  }
}

// Example provider implementation (src/providers/openai-provider.ts)
import { openai } from "@ai-sdk/openai";
import { AIProvider } from './types';

export class OpenAIProvider implements AIProvider {
  getModel(modelName: string): any {
    return openai(modelName);
  }
}
```

This pattern offers several advantages:
- Clear separation of concerns
- Isolated provider-specific logic
- Easy extensibility for new providers
- Simplified imports with lazy loading
- Centralized error handling

## 2. Task Management State Machine

The multi-step task logic in `interactions.ts` uses complex string matching and conditional checks. I propose implementing a state machine pattern:

```typescript
// src/tasks/task-state.ts
export enum TaskState {
  IDLE = 'idle',
  IN_PROGRESS = 'in_progress',
  WAITING_FOR_TOOL = 'waiting_for_tool',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// src/tasks/task-manager.ts
import { TaskState } from './task-state';

export class TaskManager {
  private state: TaskState = TaskState.IDLE;
  private taskDescription: string = '';
  private completedSteps: string[] = [];
  private nextSteps: string[] = [];
  
  startTask(description: string): void {
    this.taskDescription = description;
    this.completedSteps = [];
    this.nextSteps = [];
    this.state = TaskState.IN_PROGRESS;
  }
  
  completeStep(description: string): void {
    this.completedSteps.push(description);
    // Logic to determine if task is complete
  }
  
  isTaskInProgress(): boolean {
    return this.state === TaskState.IN_PROGRESS;
  }
  
  shouldContinueAutomatically(response: string, toolUsed?: string): boolean {
    // Simplified continuation detection using patterns
    return this.analyzeResponseForContinuation(response, toolUsed);
  }
  
  private analyzeResponseForContinuation(response: string, toolUsed?: string): boolean {
    // Implementation with pattern matching
  }
}
```

Benefits of this approach:
- Explicit state transitions
- Clearer task lifecycle
- Reduced cognitive complexity
- Easier testing and maintenance

## 3. Error Handling Strategy

Current error handling is inconsistent with a mix of try/catch blocks, conditional checks, and process.exit() calls. I propose a unified error handling approach:

```typescript
// src/errors/application-error.ts
export class ApplicationError extends Error {
  constructor(message: string, public readonly code: string, public readonly recoverable: boolean = true) {
    super(message);
    this.name = 'ApplicationError';
  }
}

// Specific error types
export class ConfigurationError extends ApplicationError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', true);
  }
}

export class ProviderError extends ApplicationError {
  constructor(message: string) {
    super(message, 'PROVIDER_ERROR', true);
  }
}

// src/errors/error-handler.ts
import { ApplicationError } from './application-error';

export function handleError(error: unknown): void {
  if (error instanceof ApplicationError) {
    console.error(`[local-agent] ${error.code}: ${error.message}`);
    if (!error.recoverable) {
      process.exit(1);
    }
  } else {
    console.error(`[local-agent] Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

Benefits:
- Consistent error reporting
- Better error classification
- Clear distinction between recoverable and fatal errors
- Centralized error handling logic

## 4. Configuration Service

Move configuration validation and loading to a dedicated service:

```typescript
// src/config/config-service.ts
import { readFileSync } from 'fs';
import { 
  GenerateTextParamsSchema, 
  ToolsJsonSchema, 
  KeysJsonSchema 
} from '../types';
import { ConfigurationError } from '../errors/application-error';

export class ConfigService {
  static loadConfig(filePath: string): any {
    try {
      const configData = JSON.parse(readFileSync(filePath, 'utf8'));
      return GenerateTextParamsSchema.parse(configData);
    } catch (err) {
      throw new ConfigurationError(`Invalid configuration in ${filePath}: ${err}`);
    }
  }
  
  static loadTools(filePath: string): any {
    try {
      const toolsData = JSON.parse(readFileSync(filePath, 'utf8'));
      return ToolsJsonSchema.parse(toolsData);
    } catch (err) {
      throw new ConfigurationError(`Invalid tools configuration in ${filePath}: ${err}`);
    }
  }
  
  static loadKeys(filePath: string): any {
    try {
      const keysData = JSON.parse(readFileSync(filePath, 'utf8'));
      return KeysJsonSchema.parse(keysData);
    } catch (err) {
      throw new ConfigurationError(`Invalid keys configuration in ${filePath}: ${err}`);
    }
  }
}
```

Benefits:
- Centralized configuration management
- Consistent validation logic
- Clear error messages
- Simplified main code flow

## Implementation Plan

1. **AI Provider Factory**
   - Create provider-specific classes
   - Implement factory with dynamic imports
   - Update interactions.ts to use the factory

2. **Task State Machine**
   - Implement TaskManager class
   - Replace string-based checks with state transitions
   - Simplify continuation detection logic

3. **Error Handling**
   - Create error hierarchy
   - Implement central error handler
   - Replace direct process.exit() calls with proper error throwing

4. **Configuration Service**
   - Create ConfigService class
   - Update initialization.ts to use the service
   - Improve validation and error messages

These changes would significantly reduce complexity, improve maintainability, and make the codebase more extensible for future features.