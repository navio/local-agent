import { z } from 'zod';
import {
  GenerateTextParams,
  GenerateTextParamsSchema,
  McpServerDefinition,
  ToolsJson,
  McpServerDefinitionSchema,
  ToolsJsonSchema,
  KeysJson,
  KeysJsonSchema
} from '../src/types.js';

describe('types.ts', () => {
  describe('GenerateTextParamsSchema', () => {
    it('should validate valid GenerateTextParams', () => {
      const validParams = {
        name: 'test-agent',
        model: 'gpt-4',
        tools: ['tool1', 'tool2'],
        toolChoice: 'auto',
        temperature: 0.7,
        system: 'You are a helpful assistant',
      };

      const result = GenerateTextParamsSchema.parse(validParams);
      expect(result).toEqual(validParams);
    });

    it('should validate minimal valid params (only prompt required)', () => {
      const minimalParams = {
      };

      const result = GenerateTextParamsSchema.parse(minimalParams);
      expect(result).toEqual(minimalParams);
    });

    it('should accept any type for model and tools', () => {
      const params = {
        model: { provider: 'openai', name: 'gpt-4' },
        tools: { filesystem: true },
      };

      const result = GenerateTextParamsSchema.parse(params);
      expect(result).toEqual(params);
    });

    // Removed: prompt is no longer required, so this test is obsolete.

    it('should reject invalid temperature type', () => {
      const invalidParams = {
        temperature: 'invalid'
      };

      expect(() => GenerateTextParamsSchema.parse(invalidParams)).toThrow();
    });

    it('should reject invalid system type', () => {
      const invalidParams = {
        system: 123
      };

      expect(() => GenerateTextParamsSchema.parse(invalidParams)).toThrow();
    });
  });

  describe('McpServerDefinitionSchema', () => {
    it('should validate valid MCP server definition', () => {
      const validDefinition = {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
      };

      const result = McpServerDefinitionSchema.parse(validDefinition);
      expect(result).toEqual(validDefinition);
    });

    it('should validate definition with empty args', () => {
      const definition = {
        command: 'node',
        args: []
      };

      const result = McpServerDefinitionSchema.parse(definition);
      expect(result).toEqual(definition);
    });

    it('should reject definition without command', () => {
      const invalidDefinition = {
        args: ['arg1', 'arg2']
      };

      expect(() => McpServerDefinitionSchema.parse(invalidDefinition)).toThrow();
    });

    it('should reject definition without args', () => {
      const invalidDefinition = {
        command: 'npx'
      };

      expect(() => McpServerDefinitionSchema.parse(invalidDefinition)).toThrow();
    });

    it('should reject definition with invalid command type', () => {
      const invalidDefinition = {
        command: 123,
        args: ['arg1']
      };

      expect(() => McpServerDefinitionSchema.parse(invalidDefinition)).toThrow();
    });

    it('should reject definition with invalid args type', () => {
      const invalidDefinition = {
        command: 'npx',
        args: 'not-an-array'
      };

      expect(() => McpServerDefinitionSchema.parse(invalidDefinition)).toThrow();
    });

    it('should reject definition with non-string args', () => {
      const invalidDefinition = {
        command: 'npx',
        args: ['valid-arg', 123, 'another-valid-arg']
      };

      expect(() => McpServerDefinitionSchema.parse(invalidDefinition)).toThrow();
    });
  });

  describe('ToolsJsonSchema', () => {
    it('should validate valid tools configuration', () => {
      const validTools = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
          },
          memory: {
            command: 'node',
            args: ['memory-server.js']
          }
        }
      };

      const result = ToolsJsonSchema.parse(validTools);
      expect(result).toEqual(validTools);
    });

    it('should validate empty mcpServers', () => {
      const emptyTools = {
        mcpServers: {}
      };

      const result = ToolsJsonSchema.parse(emptyTools);
      expect(result).toEqual(emptyTools);
    });

    it('should reject tools without mcpServers', () => {
      const invalidTools = {
        servers: {}
      };

      expect(() => ToolsJsonSchema.parse(invalidTools)).toThrow();
    });

    it('should reject invalid server definitions', () => {
      const invalidTools = {
        mcpServers: {
          filesystem: {
            command: 'npx'
            // missing args
          }
        }
      };

      expect(() => ToolsJsonSchema.parse(invalidTools)).toThrow();
    });

    it('should validate complex tools configuration', () => {
      const complexTools = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()]
          },
          'memory-bank': {
            command: 'npx',
            args: ['-y', '@aakarsh-sasi/memory-bank-mcp', '--path', '/tmp', '--mode', 'code']
          },
          'custom-server': {
            command: 'python',
            args: ['custom_mcp_server.py', '--port', '8080']
          }
        }
      };

      const result = ToolsJsonSchema.parse(complexTools);
      expect(result).toEqual(complexTools);
    });
  });

  describe('KeysJsonSchema', () => {
    it('should validate valid keys configuration', () => {
      const validKeys = {
        openai: 'sk-1234567890abcdef',
        openrouter: 'or-1234567890abcdef',
        anthropic: 'ant-1234567890abcdef'
      };

      const result = KeysJsonSchema.parse(validKeys);
      expect(result).toEqual(validKeys);
    });

    it('should validate empty keys', () => {
      const emptyKeys = {};

      const result = KeysJsonSchema.parse(emptyKeys);
      expect(result).toEqual(emptyKeys);
    });

    it('should reject non-string values', () => {
      const invalidKeys = {
        openai: 'valid-key',
        openrouter: 123
      };

      expect(() => KeysJsonSchema.parse(invalidKeys)).toThrow();
    });

    it('should reject null values', () => {
      const invalidKeys = {
        openai: 'valid-key',
        openrouter: null
      };

      expect(() => KeysJsonSchema.parse(invalidKeys)).toThrow();
    });

    it('should accept any string keys', () => {
      const keys = {
        'custom-provider': 'custom-key',
        'another_provider': 'another-key',
        'provider-with-numbers-123': 'key-123'
      };

      const result = KeysJsonSchema.parse(keys);
      expect(result).toEqual(keys);
    });
  });

  describe('Type interfaces', () => {
    it('should have correct GenerateTextParams interface structure', () => {
      const params: GenerateTextParams = {
        name: 'test',
        model: 'gpt-4',
        tools: ['tool1'],
        toolChoice: 'auto',
        temperature: 0.5,
        system: 'system prompt',
      };

      // TypeScript compilation validates the interface structure
      expect(params.name).toBe('test');
      expect(params.temperature).toBe(0.5);
    });

    it('should have correct McpServerDefinition interface structure', () => {
      const definition: McpServerDefinition = {
        command: 'npx',
        args: ['-y', 'package-name']
      };

      expect(definition.command).toBe('npx');
      expect(definition.args).toEqual(['-y', 'package-name']);
    });

    it('should have correct ToolsJson interface structure', () => {
      const tools: ToolsJson = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem']
          }
        }
      };

      expect(tools.mcpServers.filesystem.command).toBe('npx');
    });

    it('should have correct KeysJson type structure', () => {
      const keys: KeysJson = {
        openai: 'key1',
        openrouter: 'key2'
      };

      expect(keys.openai).toBe('key1');
      expect(keys.openrouter).toBe('key2');
    });
  });

  describe('Schema validation edge cases', () => {
    it('should handle undefined optional fields in GenerateTextParams', () => {
      const params = {
        name: undefined,
        temperature: undefined
      };

      const result = GenerateTextParamsSchema.parse(params);
      expect(result.name).toBeUndefined();
      expect(result.temperature).toBeUndefined();
    });

    it('should handle extra properties in schemas', () => {
      const paramsWithExtra = {
        extraProperty: 'should be ignored'
      };

      // Zod by default strips unknown properties
      const result = GenerateTextParamsSchema.parse(paramsWithExtra);
      expect((result as any).extraProperty).toBeUndefined();
    });

    it('should validate nested schema errors in ToolsJson', () => {
      const invalidNestedTools = {
        mcpServers: {
          validServer: {
            command: 'npx',
            args: ['valid']
          },
          invalidServer: {
            command: 123, // invalid type
            args: ['valid']
          }
        }
      };

      expect(() => ToolsJsonSchema.parse(invalidNestedTools)).toThrow();
    });
  });
});