import * as readline from "readline";
import { createAISDKTools } from "@agentic/ai-sdk";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { logToolUsed, logAgentResponse, logAgentError } from "./memory";
import { YELLOW, RESET } from "./initialization";

/**
 * Run the interactive prompt loop for the agent session.
 */
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

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

  // Remove custom _writeToOutput override to avoid color issues with editing

  console.log(`Type your prompt for ${agentName} (Ctrl+C to exit):`);
  rl.prompt();
  // Set the prompt color for user input (using type assertion for private property)
  (rl as any)._writeToOutput = function (stringToWrite: string) {
    // Always write user input in blue
    ((rl as any).output as NodeJS.WriteStream).write(BLUE + stringToWrite + RESET);
  };

  rl.on("line", async (line) => {
    const prompt = line.trim();
    if (!prompt) {
      rl.prompt();
      return;
    }

    const userTime = new Date();
    // Log user prompt with timestamp
    // (User logging can be added here if needed)

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

      const result = await generateText({
        model: openai(config.model),
        tools: allTools,
        temperature: config.temperature,
        system: config.system,
        prompt
      });
      spinnerActive = false;
      clearInterval(spinnerInterval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      let toolResultObj: any = null;
      let toolName: string | undefined = undefined;

      if (typeof result.text === "string" && result.text.trim() !== "") {
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
          const continuePrompt = `Here is the result of my last action:\n\n${JSON.stringify(toolResultObj, null, 2)}\n\nPlease describe what happened to the user as if you performed the action yourself, in natural language.`;
          const summaryResult = await generateText({
            model: openai(config.model),
            temperature: config.temperature,
            system: config.system,
            prompt: continuePrompt
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
        } catch (err) {
          clearInterval(toolSpinnerInterval);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Error: ${errMsg}`);
          logAgentError(sessionFile, errMsg);
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

    rl.prompt();
  });

  rl.on("close", () => {
    console.log(`\nSession saved to ${sessionFile}`);
    process.exit(0);
  });
}