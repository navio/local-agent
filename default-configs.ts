import { GenerateTextParams, ToolsJson } from "./types";

/**
 * Default content for localagent.json (generateText signature)
 */
export const DEFAULT_CONFIG: GenerateTextParams = {
  model: "openai/gpt-4o-mini",
  tools: "mcpTools",
  toolChoice: "required",
  temperature: 0,
  system: "You are a helpful assistant. Be as concise as possible.",
  prompt: "What files are in the current directory?"
};

/**
 * Default content for mcp-tools.json (mcpServers pattern)
 * Only includes filesystem and basic-memory.
 */
export const DEFAULT_TOOLS: ToolsJson = {
  mcpServers: {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        process.cwd()
      ]
    },
    "basic-memory": {
      "command": "uvx",
      "args": [
        "basic-memory",
        "mcp"
      ]
    }
  }
};

/**
 * Default content for keys.json (empty object)
 */
export const DEFAULT_KEYS = {};