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

function checkMCPServers() {
  // TODO: Implement MCP server connection checks
  // For now, just print instructions
  console.log("[agentech] Ensure MCP servers are running:");
  console.log("  - basic-memory: npx -y @smithery/cli install @basicmachines-co/basic-memory --client claude");
  console.log("  - server-filesystem: npx -y @modelcontextprotocol/server-filesystem <allowed_dirs>");
}

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
  checkMCPServers();

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

function runInteractiveSession(config: any, mcpTools: any, sessionFile: string) {
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
      const result = await generateText({
        model: openai(config.model),
        // tools: createAISDKTools(mcpTools),
        // toolChoice: config.toolChoice as any,
        temperature: config.temperature,
        system: config.system,
        prompt
      });
      spinnerActive = false;
      clearInterval(spinnerInterval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      const response = result.toolResults?.[0] || result.text || result;
      console.log(""); // Add a space between user input and answer
      console.log(`Agent> ${response}\n`);
      appendFileSync(sessionFile, `## Agent\n\n${response}\n\n`, "utf8");
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

// Main CLI logic
async function main() {
  console.log("Agentech System CLI");
  const { config, tools, keys } = validateAndLoadFiles();

  // Set the OPENAI_API_KEY env var if found in keys.json
  const openaiApiKey = keys["openai"] || process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    process.env.OPENAI_API_KEY = openaiApiKey;
  }

  // Create an MCP tools provider (example: filesystem)
  const mcpTools = await createMcpTools({
    name: 'agentic-mcp-filesystem',
    serverProcess: tools.mcpServers.filesystem
  });

  // Prepare session memory log file
  const now = new Date();
  const sessionFile = `memory/session-${now.toISOString().replace(/[:.]/g, "-")}.md`;
  writeFileSync(sessionFile, `# Agentech Session – ${now.toLocaleString()}\n\n`, "utf8");

  runInteractiveSession(config, mcpTools, sessionFile);
}

main();