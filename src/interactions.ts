// interactions.ts
/**
 * @fileoverview
 * Provides the interactive session loop and supporting utilities for the local agent.
 * Handles user prompts, conversation context, multi-step task management, and dynamic model/tool selection.
 * Designed for extensibility and clarity for external developers.
 */
import * as readline from "readline";
import { createAISDKTools } from "@agentic/ai-sdk";
// AI model providers
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
// OpenRouter is optional, import if available in your project
let openrouter: any = null;
let openrouterModule: any = null;
try {
  // @ts-ignore
  openrouterModule = require("@openrouter/ai-sdk-provider");
} catch (e) {
  openrouterModule = null;
}

/**
 * Initializes the OpenRouter client using the current API key from environment variables.
 * Returns the client instance if successful, or null if unavailable.
 *
 * @returns {any | null} The OpenRouter client instance, or null if not configured.
 */
function initializeOpenRouter() {
  if (!openrouterModule) return null;
  try {
    return openrouterModule.createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY || "",
    });
  } catch (e) {
    return null;
  }
}
import { logToolUsed, logAgentResponse, logAgentError, logUserPrompt } from "./memory.js";
import { YELLOW, RESET } from "./initialization.js";

/**
 * Run the interactive prompt loop for the agent session.
 */
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

/**
 * Represents a single message in the conversation history.
 * Used to track user, assistant, and system messages, including tool usage.
 */
interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolUsed?: string;
}

/**
 * Represents the context for a multi-step task.
 * Tracks task description, completed and next steps, and completion status.
 */
interface TaskContext {
  isMultiStep: boolean;
  taskDescription: string;
  completedSteps: string[];
  nextSteps: string[];
  isComplete: boolean;
}

/**
 * Parses a model string to extract the provider and model name.
 * Supports formats like "openai/gpt-4" or just "gpt-4" (defaults to OpenAI).
 *
 * @param {string} modelString - The model string to parse.
 * @returns {{ provider: string, modelName: string }} The provider and model name.
 */
function parseModelString(modelString: string): { provider: string, modelName: string } {
  if (!modelString.includes("/")) {
    // Backward compatibility: treat as openai
    return { provider: "openai", modelName: modelString };
  }
  const [provider, ...rest] = modelString.split("/");
  return { provider: provider.toLowerCase(), modelName: rest.join("/") };
}

/**
 * Returns the appropriate model client function for the specified provider.
 * Supports OpenAI, Anthropic, Google, and OpenRouter.
 *
 * @param {string} provider - The AI provider name (e.g., "openai", "anthropic").
 * @returns {(modelName: string) => any} Function to get the model instance for the provider.
 * @throws {Error} If the provider is unsupported or not configured.
 */
function getClientForProvider(provider: string): ((modelName: string) => any) {
  switch (provider) {
    case "openai":
      return openai;
    case "anthropic":
      return anthropic;
    case "google":
      return google;
    // "custom" provider is not supported due to missing SDK export
    case "custom":
      throw new Error("The 'custom' provider is not supported: no implementation available in the current SDK.");
    case "openrouter":
      // Initialize OpenRouter client with current API key
      openrouter = initializeOpenRouter();
      if (!openrouter) throw new Error("OpenRouter client not available or not configured. Make sure you have the @openrouter/ai-sdk-provider package installed and OPENROUTER_API_KEY set.");
      // OpenRouter supports both chat and completion models, but for simplicity, use .chat for now
      return (modelName: string) => openrouter.chat(modelName);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

/**
 * Starts and manages the interactive agent session in the terminal.
 * Handles user prompts, conversation history, multi-step task logic, and tool/model selection.
 * Provides a rich, markdown-enabled interface for agent interaction.
 *
 * @param {any} config - The agent configuration object.
 * @param {Record<string, any>} loadedTools - Loaded MCP tool instances.
 * @param {string} sessionFile - Path to the session memory log file.
 * @param {string} agentName - The display name of the agent.
 */
export function runInteractiveSession(config: any, loadedTools: Record<string, any>, sessionFile: string, agentName: string) {
  const BLUE = "\x1b[34m";
  const RESET = "\x1b[0m";
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${BLUE}$> ${RESET}`
  });

  // Configure marked to use TerminalRenderer for markdown output
  marked.setOptions({
    renderer: new TerminalRenderer()
  });

  // Conversation history and task context
  const conversationHistory: ConversationMessage[] = [];
  let currentTaskContext: TaskContext | null = null;

  // Enhanced system prompt for multi-step task handling
  const enhancedSystemPrompt = `${config.system}

IMPORTANT INSTRUCTIONS FOR MULTI-STEP TASKS:
- You are capable of handling complex, multi-step tasks that require multiple tool invocations
- When a user requests a complex task (like setting up a project, etc.), break it down into logical steps
- After completing each step, analyze if the overall task is complete or if more steps are needed
- If more steps are needed, continue working on the task without waiting for user input
- Only stop and wait for user input when the entire task is genuinely complete or you need clarification
- Maintain context of what you've accomplished and what still needs to be done
- For development tasks, ensure you create all necessary files, folders, and configurations
- When creating projects, include package.json, proper file structure, and basic functionality

TASK CONTINUATION LOGIC:
- If you just created a folder for a project, continue by creating the necessary files
- If you created some files but the project is incomplete, continue creating remaining files
- If you set up basic structure, continue with configuration and dependencies
- Only consider a task complete when it's fully functional and ready to use

CONTEXT AWARENESS:
- Remember what you've done in previous steps of the current task
- Build upon previous actions rather than starting over
- Reference earlier work when explaining current actions`;

  console.log(`Type your prompt for ${agentName} (Ctrl+C to exit):`);
  rl.prompt();
  // Set the prompt color for user input (using type assertion for private property)
  (rl as any)._writeToOutput = function (stringToWrite: string) {
    // Always write user input in blue
    ((rl as any).output as NodeJS.WriteStream).write(BLUE + stringToWrite + RESET);
  };

  /**
   * Determines if a user prompt describes a multi-step task (e.g., project creation).
   *
   * @param {string} prompt - The user prompt to analyze.
   * @returns {boolean} True if the prompt is likely a multi-step task, false otherwise.
   */
  function isMultiStepTask(prompt: string): boolean {
    const multiStepKeywords = [
      'create', 'build', 'setup', 'make', 'develop', 'implement', 'generate',
      'react app', 'project', 'application', 'website', 'api', 'server',
      'all files', 'complete', 'full', 'entire', 'whole'
    ];
    const lowerPrompt = prompt.toLowerCase();
    return multiStepKeywords.some(keyword => lowerPrompt.includes(keyword));
  }

  /**
   * Builds a string representation of recent conversation history and current task context.
   * Used to provide context to the language model for more coherent responses.
   *
   * @returns {string} The formatted conversation and task context.
   */
  function buildConversationContext(): string {
    if (conversationHistory.length === 0) return '';
    
    const recentHistory = conversationHistory.slice(-10); // Keep last 10 messages
    let context = '\n\nCONVERSATION HISTORY:\n';
    
    recentHistory.forEach((msg, index) => {
      const timeStr = msg.timestamp.toLocaleTimeString();
      context += `[${timeStr}] ${msg.role.toUpperCase()}: ${msg.content}\n`;
      if (msg.toolUsed) {
        context += `[${timeStr}] TOOL_USED: ${msg.toolUsed}\n`;
      }
    });
    
    if (currentTaskContext && !currentTaskContext.isComplete) {
      context += `\nCURRENT TASK CONTEXT:\n`;
      context += `Task: ${currentTaskContext.taskDescription}\n`;
      context += `Completed Steps: ${currentTaskContext.completedSteps.join(', ')}\n`;
      context += `Next Steps: ${currentTaskContext.nextSteps.join(', ')}\n`;
    }
    
    return context;
  }

  /**
   * Determines if the agent should automatically continue a multi-step task based on the last response or tool used.
   *
   * @param {string} response - The assistant's last response.
   * @param {string} [toolUsed] - The name of the tool used, if any.
   * @returns {boolean} True if the task should continue automatically, false if complete.
   */
  function shouldContinueTask(response: string, toolUsed?: string): boolean {
    if (!currentTaskContext || currentTaskContext.isComplete) return false;
    
    const continuationIndicators = [
      'created folder', 'created directory', 'made folder',
      'next step', 'continue', 'now i will', 'now i need to',
      'partially complete', 'still need', 'remaining',
      'created basic', 'initial setup', 'first step',
      'proceeding', 'moving on', 'next logical step',
      'will now', 'let me', 'i will create', 'i will add',
      'setting up', 'configuring', 'installing'
    ];
    
    const completionIndicators = [
      'task complete', 'finished', 'done', 'ready to use',
      'fully functional', 'all files created', 'project is complete',
      'successfully created', 'everything is set up',
      'application is now ready', 'setup is complete',
      'all necessary files', 'ready to run'
    ];
    
    const lowerResponse = response.toLowerCase();
    
    // Check for completion indicators first
    if (completionIndicators.some(indicator => lowerResponse.includes(indicator))) {
      currentTaskContext.isComplete = true;
      return false;
    }
    
    // Special logic for specific tools that typically indicate continuation
    if (toolUsed) {
      const continuationTools = ['create_directory', 'write_file'];
      if (continuationTools.some(tool => toolUsed.includes(tool))) {
        // If we just created a directory or wrote a file, likely need to continue
        return true;
      }
    }
    
    // Check for continuation indicators
    return continuationIndicators.some(indicator => lowerResponse.includes(indicator));
  }

  /**
   * Processes a user prompt, manages conversation flow, invokes tools/models, and handles multi-step logic.
   * Updates conversation history and task context as needed.
   *
   * @param {string} prompt - The user's input prompt.
   * @param {boolean} [isAutoContinuation=false] - Whether this is an automatic continuation of a multi-step task.
   * @returns {Promise<void>}
   */
  async function processUserInput(prompt: string, isAutoContinuation = false): Promise<void> {
    const userTime = new Date();
    
    // Log user prompt
    if (!isAutoContinuation) {
      logUserPrompt(sessionFile, prompt);
      conversationHistory.push({
        role: 'user',
        content: prompt,
        timestamp: userTime
      });

      // Detect if this is a new multi-step task
      if (isMultiStepTask(prompt)) {
        currentTaskContext = {
          isMultiStep: true,
          taskDescription: prompt,
          completedSteps: [],
          nextSteps: [],
          isComplete: false
        };
      }
    }

    // Add a space before the thinking/loading spinner
    console.log("");

    // Spinner animation for "Thinking..."
    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinnerIndex = 0;
    let spinnerActive = true;
    const spinnerInterval = setInterval(() => {
      process.stdout.write(
        `\r${spinnerFrames[spinnerIndex]} Thinking...`
      );
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
    }, 100);

    try {
      // Combine all loaded MCP tools into a single array for createAISDKTools
      const mcpToolInstances = Object.values(loadedTools);
      const allTools = mcpToolInstances.length === 1
        ? createAISDKTools(mcpToolInstances[0])
        : createAISDKTools(...mcpToolInstances);

      // Build the full prompt with conversation context
      const contextualPrompt = prompt + buildConversationContext();

      // Dynamically select provider and model
      let model;
      try {
        const { provider, modelName } = parseModelString(config.model);
        const client = getClientForProvider(provider);
        model = client(modelName);
      } catch (err) {
        spinnerActive = false;
        clearInterval(spinnerInterval);
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${errMsg}`);
        logAgentError(sessionFile, errMsg);
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
      
      spinnerActive = false;
      clearInterval(spinnerInterval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      let toolResultObj: any = null;
      let toolName: string | undefined = undefined;
      let assistantResponse = "";

      if (typeof result.text === "string" && result.text.trim() !== "") {
        assistantResponse = result.text;
        // Normal LLM response
        if (result.text.trim() !== "") {
          // Render markdown response with agent name in yellow
          const agentPrefix = `${YELLOW}${agentName}>${RESET} `;
          console.log(marked(`${agentPrefix}${result.text}\n`));
          logAgentResponse(sessionFile, result.text);
        }
      } else if (result.toolResults && Array.isArray(result.toolResults) && result.toolResults.length > 0) {
        toolResultObj = result.toolResults.find(
          (tr) => typeof tr === "object" && tr !== null && tr.type === "tool-result"
        );
        if (toolResultObj) {
          toolName = toolResultObj.toolName || "unknown-tool";
        }
      } else if (
        typeof result === "object" &&
        result !== null &&
        (result as any).type === "tool-result"
      ) {
        toolResultObj = result;
        toolName = (result as any).toolName || "unknown-tool";
      }

      if (toolResultObj && toolName) {
        // Show yellow spinner with tool name until next LLM response
        const toolSpinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        let toolSpinnerIndex = 0;
        const toolSpinnerInterval = setInterval(() => {
          process.stdout.write(
            `\r${YELLOW}Tool [${toolName}] is working... ${toolSpinnerFrames[toolSpinnerIndex]}${RESET}`
          );
          toolSpinnerIndex = (toolSpinnerIndex + 1) % toolSpinnerFrames.length;
        }, 100);

        logToolUsed(sessionFile, toolName);

        try {
          const continuePrompt = `Here is the result of my last action:\n\n${JSON.stringify(toolResultObj, null, 2)}\n\nPlease describe what happened to the user as if you performed the action yourself, in natural language. If this is part of a multi-step task and more work is needed to complete the overall goal, continue with the next logical step without waiting for user input.`;
          // Use the same dynamic model selection for summary
          let summaryModel;
          try {
            const { provider, modelName } = parseModelString(config.model);
            const client = getClientForProvider(provider);
            summaryModel = client(modelName);
          } catch (err) {
            clearInterval(toolSpinnerInterval);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`Error: ${errMsg}`);
            logAgentError(sessionFile, errMsg);
            return;
          }
          const summaryResult = await generateText({
            model: summaryModel,
            temperature: config.temperature,
            system: enhancedSystemPrompt,
            prompt: continuePrompt + buildConversationContext()
          });
          clearInterval(toolSpinnerInterval);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);

          let summaryResponse = "";
          if (typeof summaryResult.text === "string" && summaryResult.text.trim() !== "") {
            summaryResponse = summaryResult.text;
          } else {
            summaryResponse = JSON.stringify(summaryResult, null, 2);
          }
          console.log("");
          // Render markdown summary response with agent name in yellow
          const agentPrefix = `${YELLOW}${agentName}>${RESET} `;
          console.log(marked(`${agentPrefix}${summaryResponse}\n`));
          logAgentResponse(sessionFile, summaryResponse);
          
          assistantResponse = summaryResponse;
          
          // Add to conversation history
          conversationHistory.push({
            role: 'assistant',
            content: assistantResponse,
            timestamp: new Date(),
            toolUsed: toolName
          });

          // Update task context
          if (currentTaskContext && !currentTaskContext.isComplete) {
            currentTaskContext.completedSteps.push(`Used ${toolName}: ${assistantResponse.substring(0, 100)}...`);
          }

          // Check if we should continue the task automatically
          if (shouldContinueTask(assistantResponse, toolName)) {
            console.log(`\n${YELLOW}Task continuation detected. Press Enter to continue or modify the prompt:${RESET}`);
            // Pre-populate the readline with continuation prompt
            rl.write("continue");
            rl.prompt();
            return;
          }
          
        } catch (err) {
          clearInterval(toolSpinnerInterval);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Error: ${errMsg}`);
          logAgentError(sessionFile, errMsg);
        }
      } else if (assistantResponse) {
        // Add to conversation history for non-tool responses
        conversationHistory.push({
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date()
        });

        // Check if we should continue the task automatically
        if (shouldContinueTask(assistantResponse)) {
          console.log(`\n${YELLOW}Task continuation detected. Press Enter to continue or modify the prompt:${RESET}`);
          // Pre-populate the readline with continuation prompt
          rl.write("continue");
          rl.prompt();
          return;
        }
      }
    } catch (err) {
      spinnerActive = false;
      clearInterval(spinnerInterval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${errMsg}`);
      logAgentError(sessionFile, errMsg);
    }

    // Only prompt for next input if we're not auto-continuing
    if (!isAutoContinuation) {
      rl.prompt();
    }
  }

  rl.on("line", async (line) => {
    const prompt = line.trim();
    if (!prompt) {
      rl.prompt();
      return;
    }

    await processUserInput(prompt);
  });

  rl.on("close", () => {
    console.log(`\nSession saved to ${sessionFile}`);
    process.exit(0);
  });
}