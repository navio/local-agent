/**
 * @fileoverview
 * TypeScript interfaces and schemas for agent configuration, tool definitions, and API keys.
 * These types are used for validating and structuring configuration files and runtime parameters.
 */
import { z } from "zod";
export const GenerateTextParamsSchema = z.object({
    name: z.string().optional(),
    model: z.any(),
    tools: z.any().optional(),
    toolChoice: z.string().optional(),
    temperature: z.number().optional(),
    system: z.string().optional(),
    prompt: z.string(),
    prompt_style: z.string().optional(),
});
export const McpServerDefinitionSchema = z.object({
    command: z.string(),
    args: z.array(z.string()),
});
export const ToolsJsonSchema = z.object({
    mcpServers: z.record(McpServerDefinitionSchema),
});
export const KeysJsonSchema = z.record(z.string());
