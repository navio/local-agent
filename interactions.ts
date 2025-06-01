import * as readline from "readline";
import { createAISDKTools } from "@agentic/ai-sdk";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { logToolUsed, logAgentResponse, logAgentError, logUserPrompt } from "./memory";
import { YELLOW, RESET } from "./initialization";

/**
 * Run the interactive prompt loop for the agent session.
 */
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolUsed?: string;
}

interface TaskContext {
  isMultiStep: boolean;
  taskDescription: string;
  completedSteps: string[];
  nextSteps: string[];
  isComplete: boolean;
}

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
- When a user requests a complex task (like creating a React app, setting up a project, etc.), break it down into logical steps
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

  // Helper function to detect if a task is multi-step
  function isMultiStepTask(prompt: string): boolean {
    const multiStepKeywords = [
      'create', 'build', 'setup', 'make', 'develop', 'implement', 'generate',
      'react app', 'project', 'application', 'website', 'api', 'server',
      'all files', 'complete', 'full', 'entire', 'whole'
    ];
    const lowerPrompt = prompt.toLowerCase();
    return multiStepKeywords.some(keyword => lowerPrompt.includes(keyword));
  }

  // Helper function to build conversation context
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

  // Helper function to analyze if task needs continuation
  function shouldContinueTask(response: string, toolUsed?: string): boolean {
    if (!currentTaskContext || currentTaskContext.isComplete) return false;
    
    const continuationIndicators = [
      'created folder', 'created directory', 'made folder',
      'next step', 'continue', 'now i will', 'now i need to',
      'partially complete', 'still need', 'remaining',
      'created basic', 'initial setup', 'first step'
    ];
    
    const completionIndicators = [
      'task complete', 'finished', 'done', 'ready to use',
      'fully functional', 'all files created', 'project is complete',
      'successfully created', 'everything is set up'
    ];
    
    const lowerResponse = response.toLowerCase();
    
    // Check for completion indicators first
    if (completionIndicators.some(indicator => lowerResponse.includes(indicator))) {
      currentTaskContext.isComplete = true;
      return false;
    }
    
    // Check for continuation indicators
    return continuationIndicators.some(indicator => lowerResponse.includes(indicator));
  }

  // Main processing function
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

      const result = await generateText({
        model: openai(config.model),
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
          const summaryResult = await generateText({
            model: openai(config.model),
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
            console.log(`\n${YELLOW}Continuing with next step...${RESET}\n`);
            // Continue with the task automatically
            setTimeout(() => {
              processUserInput("Continue with the next step of the current task", true);
            }, 1000);
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
          console.log(`\n${YELLOW}Continuing with next step...${RESET}\n`);
          setTimeout(() => {
            processUserInput("Continue with the next step of the current task", true);
          }, 1000);
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