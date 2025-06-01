#!/usr/bin/env bun
import 'dotenv/config'
import { validateAndLoadFiles, loadAllMcpTools, GREEN, RED, RESET } from "./initialization";
import { runInteractiveSession } from "./interactions";
import { createSessionFile } from "./memory";
import { dirname, basename, resolve } from "path";
import { existsSync } from "fs";

const REQUIRED_FILES = [
  "system.md",
  "localagent.json",
  "mcp-tools.json",
  "keys.json"
];
const MEMORY_DIR = "memory";

function getAgentName(config: any): string {
  if (config.name && typeof config.name === "string" && config.name.trim() !== "") {
    return config.name.trim();
  }
  // Fallback: just the parent folder name (no "agent-" prefix)
  let configPath = "localagent.json";
  if (!existsSync(configPath)) {
    // Try to find localagent.json in cwd or subfolders
    configPath = require.resolve("./localagent.json", { paths: [process.cwd()] });
  }
  return basename(dirname(resolve(configPath)));
}

async function main() {
  const { config, tools, keys } = await validateAndLoadFiles(REQUIRED_FILES, MEMORY_DIR);

  const agentName = getAgentName(config);

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

  // Pass all loaded tools to the session
  runInteractiveSession(config, loadedTools, sessionFile, agentName);
}

main();
