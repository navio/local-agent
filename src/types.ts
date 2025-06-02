/**
 * @fileoverview
 * TypeScript interfaces and schemas for agent configuration, tool definitions, and API keys.
 * These types are used for validating and structuring configuration files and runtime parameters.
 */
import { z } from "zod";

/**
 * Parameters for generating text using the AI SDK.
 * Used to configure model, tools, temperature, and prompt for text generation.
 */
export interface GenerateTextParams {
  /** Optional name for the session or agent. */
  name?: string;
  /** The model instance to use (e.g., openai('gpt-4o-mini')). */
  model: any;
  /** Optional tools to provide to the model for tool-augmented generation. */
  tools?: any;
  /** Optional tool choice to guide the model's tool selection. */
  toolChoice?: string;
  /** Optional temperature for sampling (higher = more random). */
  temperature?: number;
  /** Optional system prompt to provide context or instructions to the model. */
  system?: string;
  // ...other optional params
}

export const GenerateTextParamsSchema = z.object({
  name: z.string().optional(),
  model: z.any(),
  tools: z.any().optional(),
  toolChoice: z.string().optional(),
  temperature: z.number().optional(),
  system: z.string().optional(),
});

/**
 * Definition for a single MCP server, as specified in tools.json.
 */
export interface McpServerDefinition {
  /** The command to launch the MCP server process. */
  command: string;
  /** Arguments to pass to the MCP server command. */
  args: string[];
}

/**
 * Structure of the tools.json file, mapping MCP server names to their definitions.
 */
export interface ToolsJson {
  /** A mapping of MCP server names to their command/argument definitions. */
  mcpServers: Record<string, McpServerDefinition>;
}
export const McpServerDefinitionSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
});
export const ToolsJsonSchema = z.object({
  mcpServers: z.record(McpServerDefinitionSchema),
});

/**
 * Structure of the keys.json file, mapping provider names to API keys.
 */
export type KeysJson = Record<string, string>;
export const KeysJsonSchema = z.record(z.string());
