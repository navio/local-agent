/**
 * All log messages use the prefix [local-agent] to match the project name.
 * (Changed from [agentech] for consistency and clarity.)
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { DEFAULT_CONFIG, DEFAULT_TOOLS, DEFAULT_KEYS } from "./default-configs";
import {
  GenerateTextParamsSchema,
  ToolsJson,
  ToolsJsonSchema,
  KeysJson,
  KeysJsonSchema
} from "./types";
import { createMcpTools } from "@agentic/mcp";

/**
 * Checks for missing required files and memory directory.
 * Returns an array of missing items (files and/or the memory directory).
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
 * Actually creates the missing files and memory directory.
 */
export function initializeProjectFiles(REQUIRED_FILES: string[], MEMORY_DIR: string) {
  for (const file of REQUIRED_FILES) {
    if (!existsSync(file)) {
      let content = "";
      if (file === "system.md") content = "";
      else if (file === "mcp-tools.json") content = JSON.stringify(DEFAULT_TOOLS, null, 2);
      else if (file === "localagent.json") content = JSON.stringify(DEFAULT_CONFIG, null, 2);
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
 * Checks for missing files/dirs, prompts user to initialize if needed, and loads config/tools/keys.
 * Exits if user declines initialization or after initializing.
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

  let config: ReturnType<typeof GenerateTextParamsSchema['parse']>;
  let tools: ToolsJson;
  let keys: KeysJson;

  try {
    config = GenerateTextParamsSchema.parse(JSON.parse(readFileSync("localagent.json", "utf8")));
  } catch (err) {
    console.error("[local-agent] Invalid localagent.json:", err);
    process.exit(1);
  }

  try {
    const toolsData = JSON.parse(readFileSync("mcp-tools.json", "utf8"));
    tools = ToolsJsonSchema.parse(toolsData);
  } catch (err) {
    console.error("[local-agent] Invalid mcp-tools.json:", err);
    process.exit(1);
  }

  try {
    keys = KeysJsonSchema.parse(JSON.parse(readFileSync("keys.json", "utf8")));
  } catch (err) {
    console.error("[local-agent] Invalid keys.json:", err);
    process.exit(1);
  }

  return { config, tools, keys };
}

export const GREEN = "\x1b[32m";
export const RED = "\x1b[31m";
export const YELLOW = "\x1b[33m";
export const RESET = "\x1b[0m";

/**
 * Attempt to load all MCP tools from tools.json.
 * Returns: { loadedTools: Record<string, any>, toolStatus: Array<{name: string, status: "success"|"fail", error?: string}> }
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