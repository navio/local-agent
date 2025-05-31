/**
 * Agentech System CLI Entry Point
 * Compatible with Bun and Node.js
 *
 * This CLI expects MCP servers (e.g., basic-memory, server-filesystem) to be installed and running externally.
 * For example, to install and run basic-memory MCP:
 *   npx -y @smithery/cli install @basicmachines-co/basic-memory --client claude
 *
 * The CLI will connect to these MCP servers via their endpoints (e.g., HTTP, local socket).
 *
 * Uses @agentic/stdlib for agent orchestration and MCP tool integration.
 */

// Agentech System CLI – Bun/Node compatible
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import 'dotenv/config'

import { createAISDKTools } from '@agentic/ai-sdk'
import { createMcpTools } from '@agentic/mcp'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

const REQUIRED_FILES = [
  "system.md",
  "config.json",
  "tools.json",
  "keys.json"
];
const MEMORY_DIR = "memory";

import { DEFAULT_CONFIG, DEFAULT_TOOLS, DEFAULT_KEYS } from "./default-configs";
import {
  GenerateTextParams,
  GenerateTextParamsSchema,
  ToolsJson,
  ToolsJsonSchema,
  KeysJson,
  KeysJsonSchema
} from "./types";

function ensureProjectFiles() {
  let created = false;
  for (const file of REQUIRED_FILES) {
    if (!existsSync(file)) {
      let content = "";
      if (file === "system.md") content = "";
      else if (file === "tools.json") content = JSON.stringify(DEFAULT_TOOLS, null, 2);
      else if (file === "config.json") content = JSON.stringify(DEFAULT_CONFIG, null, 2);
      else if (file === "keys.json") content = JSON.stringify(DEFAULT_KEYS, null, 2);
      else if (file.endsWith(".json")) content = "{}";
      writeFileSync(file, content, "utf8");
      console.log(`[agentech] Created missing file: ${file}`);
      created = true;
    }
  }
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR);
    console.log(`[agentech] Created missing folder: ${MEMORY_DIR}/`);
    created = true;
  }
  return created;
}

// function checkMCPServers() {
//   // TODO: Implement MCP server connection checks
//   // For now, just print instructions
//   console.log("[agentech] Ensure MCP servers are running:");
//   console.log("  - basic-memory: npx -y @smithery/cli install @basicmachines-co/basic-memory --client claude");
//   console.log("  - server-filesystem: npx -y @modelcontextprotocol/server-filesystem <allowed_dirs>");
// }

/**
 * Validate and load required files and variables for Agentech CLI.
 * Returns config, tools, and keys if all are valid, otherwise exits.
 */
function validateAndLoadFiles() {
  const created = ensureProjectFiles();
  if (created) {
    console.log("[agentech] Project initialized. Please review the created files.");
    process.exit(0);
  }
  // checkMCPServers();

  let config: ReturnType<typeof GenerateTextParamsSchema['parse']>;
  let tools: ToolsJson;
  let keys: KeysJson;

  try {
    config = GenerateTextParamsSchema.parse(JSON.parse(readFileSync("config.json", "utf8")));
  } catch (err) {
    console.error("[agentech] Invalid config.json:", err);
    process.exit(1);
  }

  try {
    tools = ToolsJsonSchema.parse(JSON.parse(readFileSync("tools.json", "utf8")));
  } catch (err) {
    console.error("[agentech] Invalid tools.json:", err);
    process.exit(1);
  }

  try {
    keys = KeysJsonSchema.parse(JSON.parse(readFileSync("keys.json", "utf8")));
  } catch (err) {
    console.error("[agentech] Invalid keys.json:", err);
    process.exit(1);
  }

  return { config, tools, keys };
}

import * as readline from "readline";
import { appendFileSync } from "fs";

function runInteractiveSession(config: any, loadedTools: Record<string, any>, sessionFile: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You> "
  });

  console.log("Type your prompt (Ctrl+C to exit):");
  rl.prompt();

  rl.on("line", async (line) => {
    const prompt = line.trim();
    if (!prompt) {
      rl.prompt();
      return;
    }

    const userTime = new Date();
    // Log user prompt with timestamp
    appendFileSync(
      sessionFile,
      `## User (${userTime.toLocaleString()})\n\n${prompt}\n\n`,
      "utf8"
    );

    // Add a space before the thinking/loading spinner
    console.log("");

    // Spinner animation for "Thinking..."
    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinnerIndex = 0;
    let spinnerActive = true;
    const spinnerInterval = setInterval(() => {
      process.stdout.write(
        `\rAgent> ${spinnerFrames[spinnerIndex]} Thinking...`
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
        // toolChoice: config.toolChoice as any,
        temperature: config.temperature,
        system: config.system,
        prompt
      });
      spinnerActive = false;
      clearInterval(spinnerInterval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);

      // Prefer text, then toolResults (stringified if object), then full result
      let response = "";
      let toolResultObj: any = null;
      if (typeof result.text === "string" && result.text.trim() !== "") {
        response = result.text;
      } else if (result.toolResults && Array.isArray(result.toolResults) && result.toolResults.length > 0) {
        // If any tool result is an object with type "tool-result", auto-summarize
        toolResultObj = result.toolResults.find(
          (tr) => typeof tr === "object" && tr !== null && tr.type === "tool-result"
        );
        response = result.toolResults
          .map((tr) =>
            typeof tr === "string"
              ? tr
              : typeof tr === "object"
              ? JSON.stringify(tr, null, 2)
              : String(tr)
          )
          .join("\n");
      } else {
        // If the result itself is a tool result (rare, but possible)
        if (
          typeof result === "object" &&
          result !== null &&
          (result as any).type === "tool-result"
        ) {
          toolResultObj = result;
        }
        response = JSON.stringify(result, null, 2);
      }

      console.log(""); // Add a space between user input and answer
      console.log(`Agent> ${response}\n`);
      appendFileSync(sessionFile, `## Agent\n\n${response}\n\n`, "utf8");

      // If a tool result was detected, auto-summarize it with the LLM
      if (toolResultObj) {
        // Compose a summary prompt
        const summaryPrompt = `Summarize the following tool result for the user in natural language:\n\n${JSON.stringify(toolResultObj, null, 2)}`;
        // Show loading spinner
        console.log("");
        const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        let spinnerIndex = 0;
        const spinnerInterval = setInterval(() => {
          process.stdout.write(
            `\rAgent> ${spinnerFrames[spinnerIndex]} Thinking...`
          );
          spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
        }, 100);

        try {
          const summaryResult = await generateText({
            model: openai(config.model),
            tools: allTools,
            temperature: config.temperature,
            system: config.system,
            prompt: summaryPrompt
          });
          clearInterval(spinnerInterval);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);

          let summaryResponse = "";
          if (typeof summaryResult.text === "string" && summaryResult.text.trim() !== "") {
            summaryResponse = summaryResult.text;
          } else {
            summaryResponse = JSON.stringify(summaryResult, null, 2);
          }
          console.log("");
          console.log(`Agent> ${summaryResponse}\n`);
          appendFileSync(sessionFile, `## Agent\n\n${summaryResponse}\n\n`, "utf8");
        } catch (err) {
          clearInterval(spinnerInterval);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[agentech] Error: ${errMsg}`);
          appendFileSync(sessionFile, `## Agent (error)\n\n${errMsg}\n\n`, "utf8");
        }
      }
    } catch (err) {
      spinnerActive = false;
      clearInterval(spinnerInterval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[agentech] Error: ${errMsg}`);
      appendFileSync(sessionFile, `## Agent (error)\n\n${errMsg}\n\n`, "utf8");
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log(`\nSession saved to ${sessionFile}`);
    process.exit(0);
  });
}

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

/**
 * Attempt to load all MCP tools from tools.json.
 * Returns: { loadedTools: Record<string, any>, toolStatus: Array<{name: string, status: "success"|"fail", error?: string}> }
 */
async function loadAllMcpTools(toolsConfig: any) {
  const loadedTools: Record<string, any> = {};
  const toolStatus: Array<{ name: string; status: "success" | "fail"; error?: string }> = [];

  for (const [name, serverProcess] of Object.entries(toolsConfig.mcpServers || {})) {
    // process.stdout.write(`Loading tool "${name}"... `);
    try {
      const tool = await createMcpTools({
        name: `agentic-mcp-${name}`,
        serverProcess: serverProcess as any
      });
      loadedTools[name] = tool;
      toolStatus.push({ name, status: "success" });
      // console.log(`${GREEN}success${RESET}`);
    } catch (err) {
      toolStatus.push({ name, status: "fail", error: err instanceof Error ? err.message : String(err) });
      // console.log(`${RED}fail${RESET}`);
    }
  }
  return { loadedTools, toolStatus };
}

// Main CLI logic
async function main() {
  console.log("Agentech System CLI");
  const { config, tools, keys } = validateAndLoadFiles();

  // Set the OPENAI_API_KEY env var if found in keys.json
  const openaiApiKey = keys["openai"] || process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    process.env.OPENAI_API_KEY = openaiApiKey;
  }

  // Load all MCP tools
  const { loadedTools, toolStatus } = await loadAllMcpTools(tools);

  // Display a single row listing all tools, green if loaded, red if not
  const toolRow =
    "tools: [" +
    toolStatus
      .map((t) =>
        t.status === "success"
          ? `${GREEN}${t.name}${RESET}`
          : `${RED}${t.name}${RESET}`
      )
      .join(", ") +
    "]";
  console.log(toolRow);

  // Prepare session memory log file
  const now = new Date();
  const sessionFile = `memory/session-${now.toISOString().replace(/[:.]/g, "-")}.md`;

  // Write session header with tool status
  let toolStatusMd = `# Agentech Session – ${now.toLocaleString()}\n\n${toolRow}\n\n## Tools Loaded\n\n`;
  for (const t of toolStatus) {
    if (t.status === "success") {
      toolStatusMd += `- ${t.name}: ✅ loaded\n`;
    } else {
      toolStatusMd += `- ${t.name}: ❌ failed (${t.error})\n`;
    }
  }
  toolStatusMd += "\n";
  writeFileSync(sessionFile, toolStatusMd, "utf8");

  // Pass all loaded tools to the session
  runInteractiveSession(config, loadedTools, sessionFile);
}

main();