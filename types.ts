import { z } from "zod";

/**
 * Type for generateText config, based on ai SDK usage.
 */
export interface GenerateTextParams {
  model: any; // e.g., openai('gpt-4o-mini')
  tools?: any;
  toolChoice?: string;
  temperature?: number;
  system?: string;
  prompt: string;
  // ...other optional params
}

export const GenerateTextParamsSchema = z.object({
  model: z.any(), // required
  tools: z.any().optional(),
  toolChoice: z.string().optional(),
  temperature: z.number().optional(),
  system: z.string().optional(),
  prompt: z.string(),
});

/**
 * Type and schema for tools.json (MCP servers)
 */
export interface McpServerDefinition {
  command: string;
  args: string[];
}
export interface ToolsJson {
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
 * Type and schema for keys.json (API keys)
 */
export type KeysJson = Record<string, string>;
export const KeysJsonSchema = z.record(z.string());