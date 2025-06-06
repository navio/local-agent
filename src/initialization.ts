/**
 * @fileoverview
 * Initialization utilities for the local agent project.
 * Handles validation and creation of required configuration files, memory directory,
 * and loading of Model Context Protocol (MCP) tools for agent operation.
 * All log messages use the prefix [local-agent] for consistency and clarity.
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { DEFAULT_CONFIG, DEFAULT_TOOLS, DEFAULT_KEYS } from "./default-configs";
import { ToolsJson, KeysJson } from "./types";
import { createMcpTools } from "@agentic/mcp";
import { ConfigService } from "./config";
import { handleError, ConfigurationError } from "./errors";

/**
 * Checks for missing required files and the memory directory in the project.
 *
 * @param {string[]} REQUIRED_FILES - List of required file names to check for existence.
 * @param {string} MEMORY_DIR - Name of the memory directory to check.
 * @returns {string[]} Array of missing items (file names and/or the memory directory).
 */
export function getMissingProjectFiles(REQUIRED_FILES: string[], MEMORY_DIR: string): string[] {
  const missing: string[] = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(file)) {
      missing.push(file);
    }
  }
  if (!existsSync(MEMORY_DIR)) {
    missing.push(MEMORY_DIR + "/");
  }
  return missing;
}

/**
 * Creates any missing required files and the memory directory for the project.
 * Populates files with default content where appropriate.
 *
 * @param {string[]} REQUIRED_FILES - List of required file names to create if missing.
 * @param {string} MEMORY_DIR - Name of the memory directory to create if missing.
 */
export function initializeProjectFiles(REQUIRED_FILES: string[], MEMORY_DIR: string) {
  for (const file of REQUIRED_FILES) {
    if (!existsSync(file)) {
      let content = "";
      if (file === "system.md") content = "";
      else if (file === "mcp-tools.json") content = JSON.stringify(DEFAULT_TOOLS, null, 2);
      else if (file === "local-agent.json") content = JSON.stringify(DEFAULT_CONFIG, null, 2);
      else if (file === "keys.json") content = JSON.stringify(DEFAULT_KEYS, null, 2);
      else if (file.endsWith(".json")) content = "{}";
      writeFileSync(file, content, "utf8");
      console.log(`[local-agent] Created missing file: ${file}`);
    }
  }
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR);
    console.log(`[local-agent] Created missing folder: ${MEMORY_DIR}/`);
  }
}

import * as readline from "readline";

/**
 * Checks for missing files/dirs, prompts user to initialize if needed, and loads config/tools/keys.
 * Exits if user declines initialization or after initializing.
 */
/**
 * Validates the presence of all required files and the memory directory.
 * If any are missing, prompts the user to initialize the project and exits if declined.
 * Loads and parses the agent configuration, MCP tools, and API keys from their respective files.
 *
 * @param {string[]} REQUIRED_FILES - List of required file names.
 * @param {string} MEMORY_DIR - Name of the memory directory.
 * @returns {Promise<{ config: any, tools: any, keys: any }>} Parsed configuration, tools, and keys.
 */
export async function validateAndLoadFiles(REQUIRED_FILES: string[], MEMORY_DIR: string) {
  const missing = getMissingProjectFiles(REQUIRED_FILES, MEMORY_DIR);
  if (missing.length > 0) {
    console.log(`${YELLOW}[local-agent] The following required files or directories are missing:${RESET}`);
    for (const item of missing) {
      console.log(`  - ${item}`);
    }
    // Wrap readline in a Promise to ensure async/await flow
    await new Promise<void>((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question("[local-agent] Would you like to initialize the project now? (y/n): ", (answer) => {
        rl.close();
        if (answer.trim().toLowerCase().startsWith("y")) {
          initializeProjectFiles(REQUIRED_FILES, MEMORY_DIR);
          console.log(`${GREEN}[local-agent] Project initialized. Please review the created files.${RESET}`);
          process.exit(0);
        } else {
          console.log(`${RED}[local-agent] Project not initialized. Exiting.${RESET}`);
          process.exit(1);
        }
        resolve();
      });
    });
    // This line is never reached, but is required for type safety
    return undefined as any;
  }

  let config: any;
  let tools: ToolsJson;
  let keys: KeysJson;

  try {
    config = ConfigService.loadConfig("local-agent.json");
  } catch (err) {
    handleError(err, 'loading configuration');
    process.exit(1);
  }

  try {
    tools = ConfigService.loadTools("mcp-tools.json");
  } catch (err) {
    handleError(err, 'loading tools configuration');
    process.exit(1);
  }

  try {
    keys = ConfigService.loadKeys("keys.json");
  } catch (err) {
    handleError(err, 'loading keys configuration');
    process.exit(1);
  }

  return { config, tools, keys };
}

export const GREEN = "\x1b[32m";
export const RED = "\x1b[31m";
export const YELLOW = "\x1b[33m";
export const RESET = "\x1b[0m";

/**
 * Loads all Model Context Protocol (MCP) tools defined in the tools configuration.
 * Returns an object containing the loaded tools and a status array for each tool.
 *
 * @param {any} toolsConfig - The parsed tools configuration object (from mcp-tools.json).
 * @returns {Promise<{ loadedTools: Record<string, any>, toolStatus: Array<{name: string, status: "success"|"fail", error?: string}> }>}
 *   An object with loaded MCP tools and their load status.
 */
export async function loadAllMcpTools(toolsConfig: any) {
  const loadedTools: Record<string, any> = {};
  const toolStatus: Array<{ name: string; status: "success" | "fail"; error?: string }> = [];
 
  for (const [name, serverProcess] of Object.entries(toolsConfig.mcpServers || {})) {
    try {
      const tool = await createMcpTools({
        name: `agentic-mcp-${name}`,
        serverProcess: serverProcess as any
      });
      loadedTools[name] = tool;
      toolStatus.push({ name, status: "success" });
    } catch (err) {
      toolStatus.push({ name, status: "fail", error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { loadedTools, toolStatus };
}