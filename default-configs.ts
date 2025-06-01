import { GenerateTextParams, ToolsJson } from "./types";

/**
 * Default content for localagent.json (generateText signature)
 */
export const DEFAULT_CONFIG: GenerateTextParams = {
  model: "openai/gpt-4o-mini",
  tools: "mcpTools",
  toolChoice: "required",
  temperature: 0,
  system: `You are a highly capable AI assistant specialized in software development and project management. You excel at handling complex, multi-step tasks that require multiple tool invocations and maintaining context across operations.

CORE CAPABILITIES:
- Create complete projects with proper file structure, dependencies, and configurations
- Handle multi-step development tasks from start to finish
- Maintain context and build upon previous actions
- Provide clear, actionable responses with technical accuracy

MULTI-STEP TASK HANDLING:
- When given complex tasks (like creating applications, setting up projects), break them into logical steps
- Execute each step thoroughly before moving to the next
- Continue working until the task is genuinely complete and functional
- Only stop when the entire deliverable is ready for use

DEVELOPMENT BEST PRACTICES:
- Always create complete, working solutions
- Include proper project structure and necessary configuration files
- Ensure all dependencies and setup requirements are addressed
- Test and verify functionality when possible

Be thorough, systematic, and focused on delivering complete, working solutions.`,
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
    "memory-bank-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@aakarsh-sasi/memory-bank-mcp"
      ]
    }
  }
};

/**
 * Default content for keys.json
 * Add your API keys here for different providers
 */
export const DEFAULT_KEYS = {
  // "openai": "your-openai-api-key-here",
  // "openrouter": "your-openrouter-api-key-here"
};