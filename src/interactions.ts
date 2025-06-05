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

// Debug logging utility
const isDebug = process.argv.includes('--debug');
function debugLog(...args: any[]) {
  if (isDebug) console.log(...args);
}
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
- If more steps are needed, continue working on the task WITHOUT waiting for user input
- DO NOT STOP after creating just one file or folder - continue until the task is truly complete
- For development tasks, ensure you create ALL necessary files, folders, and configurations
- When creating projects, include package.json, proper file structure, source files, and basic functionality

TASK CONTINUATION LOGIC - BE AGGRESSIVE:
- If you just created a folder for a project, IMMEDIATELY continue by creating the necessary files
- If you created some files but the project is incomplete, CONTINUE creating remaining files
- If you set up basic structure, CONTINUE with configuration and dependencies
- Create multiple files in sequence without stopping
- Only consider a task complete when it's fully functional, all files exist, and ready to use
- Use phrases like "Now I will", "Next I need to", "Let me now" to indicate continuation

COMPLETION CRITERIA:
- For projects: All source files, configuration files, and documentation must be created
- The project should be immediately runnable/usable after completion
- Include instructions on how to run/test the created project
- Only stop when you would tell the user "you can now run this" or "everything is ready"

TOOL USAGE GUIDELINES:
- Use filesystem tools to create directories and write files manually
- DO NOT try to run shell commands like 'npx create-react-app' - you don't have shell access
- Instead, manually create all necessary files for projects (package.json, source files, etc.)
- When creating React apps, manually create: package.json, src/App.js, src/index.js, public/index.html
- When creating Node.js projects, manually create: package.json, server.js, routes/, etc.
- If a tool fails with an error, acknowledge the error and try a different approach
- Never repeat the same tool call that just failed

CONTEXT AWARENESS:
- Remember what you've done in previous steps of the current task
- Build upon previous actions rather than starting over
- Reference earlier work when explaining current actions
- If you get tool errors, explain them clearly and adapt your approach`;

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

      // Add timeout for tool operations to prevent hanging
      const generateTextWithTimeout = (timeoutMs: number = 120000) => {
        return Promise.race([
          generateText({
            model,
            tools: allTools,
            temperature: config.temperature,
            system: enhancedSystemPrompt,
            prompt: contextualPrompt
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tool operation timeout after 2 minutes')), timeoutMs)
          )
        ]);
      };

      const result = await generateTextWithTimeout() as any; // Type assertion for now
      
      spinnerActive = false;
      clearInterval(spinnerInterval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      let toolResultObj: any = null;
      let toolName: string | undefined = undefined;
      let assistantResponse = "";
      let hasToolCalls = false;

      // Debug: Log the full result structure to understand what we're getting
      debugLog(`\n[DEBUG] Result structure:`, JSON.stringify({
        text: result.text ? `"${result.text.substring(0, 100)}..."` : result.text,
        toolCalls: result.toolCalls ? result.toolCalls.length : 0,
        toolResults: result.toolResults ? result.toolResults.length : 0,
        usage: result.usage
      }, null, 2));

      // Check for tool calls first (before results)
      if (result.toolCalls && Array.isArray(result.toolCalls) && result.toolCalls.length > 0) {
        hasToolCalls = true;
        const toolCall = result.toolCalls[0]; // Get first tool call
        toolName = toolCall.toolName;
        debugLog(`\n[DEBUG] Tool call detected: ${toolName} with args:`, JSON.stringify(toolCall.args, null, 2));
      }

      // Check for tool results
      if (result.toolResults && Array.isArray(result.toolResults) && result.toolResults.length > 0) {
        toolResultObj = result.toolResults[0]; // Get first tool result
        if (toolResultObj) {
          toolName = toolResultObj.toolName || toolName || "unknown-tool";
          debugLog(`\n[DEBUG] Tool result received for ${toolName}:`, JSON.stringify({
            type: toolResultObj.type,
            isError: toolResultObj.isError,
            result: typeof toolResultObj.result === 'string' ?
              toolResultObj.result.substring(0, 200) + '...' :
              toolResultObj.result
          }, null, 2));
        }
      }

      // Process normal text response (when no tools are involved)
      if (typeof result.text === "string" && result.text.trim() !== "" && !hasToolCalls) {
        assistantResponse = result.text;
        // Render markdown response with agent name in yellow
        const agentPrefix = `${YELLOW}${agentName}>${RESET} `;
        console.log(marked(`${agentPrefix}${result.text}\n`));
        logAgentResponse(sessionFile, result.text);
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
        logToolUsed(sessionFile, toolName, toolResultObj);

        try {
          // Build detailed tool result context
          let toolResultContext = "";
          
          if (toolResultObj.isError) {
            // Handle tool errors explicitly
            toolResultContext = `TOOL ERROR - ${toolName} failed with error:\n${JSON.stringify(toolResultObj.result, null, 2)}\n\nPlease acknowledge this error to the user, explain what went wrong, and if possible, try an alternative approach or fix the issue. Do not repeat the same action that failed.`;
            console.log(`\n❌ [TOOL ERROR] ${toolName}:`, toolResultObj.result);
          } else {
            // Handle successful tool results
            let resultData = toolResultObj.result;
            
            // Make result more readable for the LLM
            if (typeof resultData === 'object') {
              resultData = JSON.stringify(resultData, null, 2);
            } else if (typeof resultData === 'string' && resultData.length > 1000) {
              // Truncate very long results
              resultData = resultData.substring(0, 1000) + '\n... (truncated)';
            }
            
            toolResultContext = `TOOL SUCCESS - ${toolName} completed successfully with result:\n${resultData}\n\nPlease describe what happened to the user as if you performed the action yourself, in natural language. If this is part of a multi-step task and more work is needed to complete the overall goal, continue with the next logical step without waiting for user input.`;
            
            console.log(`\n✅ [TOOL SUCCESS] ${toolName}`);
            if (typeof toolResultObj.result === 'string' && toolResultObj.result.length < 200) {
              console.log(`Result: ${toolResultObj.result}`);
            }
          }

          const continuePrompt = toolResultContext;
          
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

          // Check task completion status
          const completionStatus = taskManager.getCompletionStatus();
          if (completionStatus.isComplete) {
            if (completionStatus.reason) {
              console.log(`\n✅ ${YELLOW}Multi-step task completed (${completionStatus.reason}). Steps taken: ${completionStatus.stepCount}${RESET}`);
            } else {
              console.log(`\n✅ ${YELLOW}Multi-step task completed. Steps taken: ${completionStatus.stepCount}${RESET}`);
            }
            taskManager.resetTask();
          } else if (taskManager.shouldContinueAutomatically(assistantResponse, toolName)) {
            console.log(`\n${YELLOW}Task continuation detected (step ${completionStatus.stepCount}). Press Enter to continue or modify the prompt:${RESET}`);
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

        // Check task completion status
        const completionStatus = taskManager.getCompletionStatus();
        if (completionStatus.isComplete) {
          if (completionStatus.reason) {
            console.log(`\n✅ ${YELLOW}Multi-step task completed (${completionStatus.reason}). Steps taken: ${completionStatus.stepCount}${RESET}`);
          } else {
            console.log(`\n✅ ${YELLOW}Multi-step task completed. Steps taken: ${completionStatus.stepCount}${RESET}`);
          }
          taskManager.resetTask();
        } else if (taskManager.shouldContinueAutomatically(assistantResponse)) {
          console.log(`\n${YELLOW}Task continuation detected (step ${completionStatus.stepCount}). Press Enter to continue or modify the prompt:${RESET}`);
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

    // Handle special commands
    if (prompt === "/complete" || prompt === "/done") {
      if (taskManager.isTaskActive()) {
        taskManager.forceComplete("Manual completion by user");
        console.log(`✅ ${YELLOW}Task manually marked as complete.${RESET}`);
      } else {
        console.log(`${YELLOW}No active task to complete.${RESET}`);
      }
      rl.prompt();
      return;
    }
    
    if (prompt === "/status") {
      if (taskManager.isTaskActive()) {
        const context = taskManager.getTaskContext();
        const status = taskManager.getCompletionStatus();
        console.log(`\n📋 ${YELLOW}Current Task Status:${RESET}`);
        console.log(`Task: ${context.taskDescription}`);
        console.log(`Steps completed: ${status.stepCount}`);
        console.log(`Completed: ${context.completedSteps.join(', ') || 'None'}`);
        console.log(`Next steps: ${context.nextSteps.join(', ') || 'None'}`);
      } else {
        console.log(`${YELLOW}No active task.${RESET}`);
      }
      rl.prompt();
      return;
    }
    
    if (prompt === "/help") {
      console.log(`\n${YELLOW}Available commands:${RESET}`);
      console.log(`/complete or /done - Manually mark current task as complete`);
      console.log(`/status - Show current task status`);
      console.log(`/help - Show this help message`);
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