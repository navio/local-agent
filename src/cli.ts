#!/usr/bin/env bun
/**
 * @fileoverview
 * Command-line interface for launching the local agent with configured tools and API keys.
 * This CLI loads configuration files, initializes all Model Context Protocol (MCP) tools,
 * and starts an interactive session for agent operations.
 *
 * Usage: bun cli.ts [options]
 *
 * For configuration and usage details, see README.md.
 */
import 'dotenv/config'
import { validateAndLoadFiles, loadAllMcpTools, GREEN, RED, RESET } from "./initialization";

// Help option: show usage and config instructions if -h or --help is present
if (process.argv.includes('-h') || process.argv.includes('--help')) {
  console.log(`
Usage: bun cli.ts [options]

This CLI launches the agent with your configured tools and keys.

Options:
  -h, --help        Show this help message

Configuration:
  1. Place the following files in the project root:
     - system.md           (system prompt and instructions)
     - local-agent.json    (agent configuration)
     - mcp-tools.json      (MCP tool definitions)
     - keys.json           (API keys for providers)

  2. Edit keys.json to include your API keys:
     {
       "openai": "sk-...",
       "openrouter": "or-...",
       // Add other provider keys as needed
     }

  3. Edit mcp-tools.json to define your MCP tools.
     See README.md for examples.

  4. To run the CLI:
     npx local-agent

  The agent will load your configuration and keys, initialize all MCP tools, and start an interactive session.

For more details, see README.md.
`);
  process.exit(0);
}
import { runInteractiveSession } from "./interactions";
import { createSessionFile } from "./memory";
import { dirname, basename, resolve } from "path";
import { existsSync } from "fs";

const REQUIRED_FILES = [
  "system.md",
  "local-agent.json",
  "mcp-tools.json",
  "keys.json"
];
const MEMORY_DIR = "memory";

/**
 * Determines the agent's display name based on the configuration.
 * If a name is specified in the config, it is used. Otherwise, falls back to the parent folder name.
 *
 * @param {any} config - The agent configuration object, expected to have a 'name' property.
 * @returns {string} The resolved agent name for display and logging.
 */
function getAgentName(config: any): string {
  if (config.name && typeof config.name === "string" && config.name.trim() !== "") {
    return config.name.trim();
  }
  // Fallback: just the parent folder name (no "agent-" prefix)
  let configPath = "local-agent.json";
  if (!existsSync(configPath)) {
    // Try to find local-agent.json in cwd or subfolders
    configPath = require.resolve("./local-agent.json", { paths: [process.cwd()] });
  }
  return basename(dirname(resolve(configPath)));
}

/**
 * Main entry point for the CLI.
 * Loads configuration files, sets up API keys, initializes all MCP tools,
 * prepares the session memory log, and starts the interactive agent session.
 *
 * This function is asynchronous and is invoked immediately at the end of the script.
 */
async function main() {
  const { config, tools, keys } = await validateAndLoadFiles(REQUIRED_FILES, MEMORY_DIR);

  const agentName = getAgentName(config);

  // Set API keys from keys.json or environment variables
  const openaiApiKey = keys["openai"] || process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    process.env.OPENAI_API_KEY = openaiApiKey;
  }

  const openrouterApiKey = keys["openrouter"] || process.env.OPENROUTER_API_KEY;
  if (openrouterApiKey) {
    process.env.OPENROUTER_API_KEY = openrouterApiKey;
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
  console.log(`${agentName} CLI`);
  console.log(toolRow);

  // Prepare session memory log file
  const now = new Date();
  let toolStatusMd = "";
  for (const t of toolStatus) {
    if (t.status === "success") {
      toolStatusMd += `- ${t.name}: ✅ loaded\n`;
    } else {
      toolStatusMd += `- ${t.name}: ❌ failed (${t.error})\n`;
    }
  }
  toolStatusMd += "\n";
  const sessionFile = createSessionFile(now, toolRow, toolStatusMd, agentName);

  // Pass all loaded tools and keys to the session
  runInteractiveSession(config, loadedTools, sessionFile, agentName, keys);
}

main();
