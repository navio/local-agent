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

export function ensureProjectFiles(REQUIRED_FILES: string[], MEMORY_DIR: string) {
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

export function validateAndLoadFiles(REQUIRED_FILES: string[], MEMORY_DIR: string) {
  const created = ensureProjectFiles(REQUIRED_FILES, MEMORY_DIR);
  if (created) {
    console.log("[agentech] Project initialized. Please review the created files.");
    process.exit(0);
  }

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
    const toolsData = JSON.parse(readFileSync("tools.json", "utf8"));
    tools = ToolsJsonSchema.parse(toolsData);
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