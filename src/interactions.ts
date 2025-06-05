/**
 * @fileoverview
 * Provides the interactive session loop and supporting utilities for the local agent.
 * Handles user prompts, conversation context, multi-step task management, and dynamic model/tool selection.
 * Designed for extensibility and clarity for external developers.
 */
import * as readline from "readline";
import { createAISDKTools } from "@agentic/ai-sdk";
import { generateText } from "ai";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

// Import new simplified systems
import { ProviderFactory, ProviderError } from "./providers";
import { TaskManager } from "./tasks";
import { handleError } from "./errors";
import { ConversationMessage } from "./types";
import { logToolUsed, logAgentResponse, logAgentError, logUserPrompt } from "./memory";
import { YELLOW, RESET } from "./initialization";

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
export function runInteractiveSession(config: any, loadedTools: Record<string, any>, sessionFile: string, agentName: string, keys: Record<string, string> = {}) {
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

  // Conversation history and task management
  const conversationHistory: ConversationMessage[] = [];
  const taskManager = new TaskManager();

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
    
    // Get current task context from the task manager
    if (taskManager.isTaskActive()) {
      const taskContext = taskManager.getTaskContext();
      context += `\nCURRENT TASK CONTEXT:\n`;
      context += `Task: ${taskContext.taskDescription}\n`;
      context += `Completed Steps: ${taskContext.completedSteps.join(', ')}\n`;
      context += `Next Steps: ${taskContext.nextSteps.join(', ')}\n`;
    }
    
    return context;
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
      if (taskManager.isMultiStepTask(prompt)) {
        taskManager.startTask(prompt);
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
          handleError(err, 'model selection');
        } else {
          handleError(err, 'model initialization');
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

        // Record tool usage in task manager
        taskManager.recordToolUse(toolName, toolResultObj);
        logToolUsed(sessionFile, toolName);

        try {
          const continuePrompt = `Here is the result of my last action:\n\n${JSON.stringify(toolResultObj, null, 2)}\n\nPlease describe what happened to the user as if you performed the action yourself, in natural language. If this is part of a multi-step task and more work is needed to complete the overall goal, continue with the next logical step without waiting for user input.`;
          // Use the same dynamic model selection for summary
          let summaryModel;
          try {
            summaryModel = await ProviderFactory.getModelFromString(config.model, keys);
          } catch (err) {
            clearInterval(toolSpinnerInterval);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            handleError(err, 'summary model selection');
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

          // Process response through task manager
          taskManager.processResponse(assistantResponse, toolName);

          // Check if we should continue the task automatically
          if (taskManager.shouldContinueAutomatically(assistantResponse, toolName)) {
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
          handleError(err, 'tool summary generation');
        }
      } else if (assistantResponse) {
        // Add to conversation history for non-tool responses
        conversationHistory.push({
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date()
        });

        // Process response through task manager
        taskManager.processResponse(assistantResponse);

        // Check if we should continue the task automatically
        if (taskManager.shouldContinueAutomatically(assistantResponse)) {
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
      handleError(err, 'text generation');
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