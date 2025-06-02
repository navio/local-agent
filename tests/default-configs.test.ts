import { DEFAULT_CONFIG, DEFAULT_TOOLS, DEFAULT_KEYS } from '../default-configs';
import { GenerateTextParamsSchema, ToolsJsonSchema, KeysJsonSchema } from '../types';

describe('default-configs.ts', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should be a valid GenerateTextParams object', () => {
      expect(() => GenerateTextParamsSchema.parse(DEFAULT_CONFIG)).not.toThrow();
    });

    it('should have correct default values', () => {
      expect(DEFAULT_CONFIG.model).toBe('openai/gpt-4o-mini');
      expect(DEFAULT_CONFIG.tools).toBe('mcpTools');
      expect(DEFAULT_CONFIG.toolChoice).toBe('required');
      expect(DEFAULT_CONFIG.temperature).toBe(0);
      expect(DEFAULT_CONFIG.prompt).toBe('What files are in the current directory?');
    });

    it('should have a comprehensive system prompt', () => {
      expect(DEFAULT_CONFIG.system).toBeDefined();
      expect(typeof DEFAULT_CONFIG.system).toBe('string');
      if (DEFAULT_CONFIG.system) {
        expect(DEFAULT_CONFIG.system.length).toBeGreaterThan(100);
        
        // Check for key sections in the system prompt
        expect(DEFAULT_CONFIG.system).toContain('CORE CAPABILITIES');
        expect(DEFAULT_CONFIG.system).toContain('MULTI-STEP TASK HANDLING');
        expect(DEFAULT_CONFIG.system).toContain('DEVELOPMENT BEST PRACTICES');
      }
    });

    it('should contain software development guidance', () => {
      const systemPrompt = DEFAULT_CONFIG.system;
      if (systemPrompt) {
        expect(systemPrompt).toContain('software development');
        expect(systemPrompt).toContain('project management');
        expect(systemPrompt).toContain('multi-step tasks');
        expect(systemPrompt).toContain('complete, working solutions');
      }
    });

    it('should have appropriate temperature for deterministic responses', () => {
      expect(DEFAULT_CONFIG.temperature).toBe(0);
    });

    it('should specify required tool choice', () => {
      expect(DEFAULT_CONFIG.toolChoice).toBe('required');
    });
  });

  describe('DEFAULT_TOOLS', () => {
    it('should be a valid ToolsJson object', () => {
      expect(() => ToolsJsonSchema.parse(DEFAULT_TOOLS)).not.toThrow();
    });

    it('should include filesystem server', () => {
      expect(DEFAULT_TOOLS.mcpServers.filesystem).toBeDefined();
      expect(DEFAULT_TOOLS.mcpServers.filesystem.command).toBe('npx');
      expect(DEFAULT_TOOLS.mcpServers.filesystem.args).toContain('-y');
      expect(DEFAULT_TOOLS.mcpServers.filesystem.args).toContain('@modelcontextprotocol/server-filesystem');
      expect(DEFAULT_TOOLS.mcpServers.filesystem.args).toContain(process.cwd());
    });

    it('should include memory-bank-mcp server', () => {
      expect(DEFAULT_TOOLS.mcpServers['memory-bank-mcp']).toBeDefined();
      expect(DEFAULT_TOOLS.mcpServers['memory-bank-mcp'].command).toBe('npx');
      expect(DEFAULT_TOOLS.mcpServers['memory-bank-mcp'].args).toContain('-y');
      expect(DEFAULT_TOOLS.mcpServers['memory-bank-mcp'].args).toContain('@aakarsh-sasi/memory-bank-mcp');
    });

    it('should configure memory-bank-mcp with correct parameters', () => {
      const memoryServer = DEFAULT_TOOLS.mcpServers['memory-bank-mcp'];
      expect(memoryServer.args).toContain('--path');
      expect(memoryServer.args).toContain(process.cwd());
      expect(memoryServer.args).toContain('--folder');
      expect(memoryServer.args).toContain('memory');
      expect(memoryServer.args).toContain('--mode');
      expect(memoryServer.args).toContain('code');
    });

    it('should have exactly two default servers', () => {
      const serverNames = Object.keys(DEFAULT_TOOLS.mcpServers);
      expect(serverNames).toHaveLength(2);
      expect(serverNames).toContain('filesystem');
      expect(serverNames).toContain('memory-bank-mcp');
    });

    it('should use current working directory for filesystem server', () => {
      const filesystemArgs = DEFAULT_TOOLS.mcpServers.filesystem.args;
      expect(filesystemArgs[filesystemArgs.length - 1]).toBe(process.cwd());
    });

    it('should have valid command and args structure', () => {
      Object.values(DEFAULT_TOOLS.mcpServers).forEach(server => {
        expect(typeof server.command).toBe('string');
        expect(server.command.length).toBeGreaterThan(0);
        expect(Array.isArray(server.args)).toBe(true);
        server.args.forEach(arg => {
          expect(typeof arg).toBe('string');
        });
      });
    });
  });

  describe('DEFAULT_KEYS', () => {
    it('should be a valid KeysJson object', () => {
      expect(() => KeysJsonSchema.parse(DEFAULT_KEYS)).not.toThrow();
    });

    it('should be an empty object by default', () => {
      expect(DEFAULT_KEYS).toEqual({});
    });

    it('should not contain any actual API keys', () => {
      const keys = Object.values(DEFAULT_KEYS);
      keys.forEach(key => {
        expect(key).not.toMatch(/^sk-/); // OpenAI key pattern
        expect(key).not.toMatch(/^or-/); // OpenRouter key pattern
        expect(key).not.toMatch(/^ant-/); // Anthropic key pattern
      });
    });

    it('should be safe to commit to version control', () => {
      // Ensure no sensitive data is in default keys
      const keysString = JSON.stringify(DEFAULT_KEYS);
      expect(keysString).not.toContain('sk-');
      expect(keysString).not.toContain('or-');
      expect(keysString).not.toContain('ant-');
      expect(keysString).not.toContain('api_key');
      expect(keysString).not.toContain('secret');
    });
  });

  describe('Configuration consistency', () => {
    it('should have consistent model format in DEFAULT_CONFIG', () => {
      expect(DEFAULT_CONFIG.model).toMatch(/^[a-z]+\/[a-z0-9-]+$/);
    });

    it('should reference mcpTools in DEFAULT_CONFIG tools', () => {
      expect(DEFAULT_CONFIG.tools).toBe('mcpTools');
    });

    it('should have a helpful default prompt', () => {
      expect(DEFAULT_CONFIG.prompt).toBe('What files are in the current directory?');
      expect(DEFAULT_CONFIG.prompt.length).toBeGreaterThan(10);
    });

    it('should use npx for all default tools', () => {
      Object.values(DEFAULT_TOOLS.mcpServers).forEach(server => {
        expect(server.command).toBe('npx');
      });
    });

    it('should use -y flag for all npx commands', () => {
      Object.values(DEFAULT_TOOLS.mcpServers).forEach(server => {
        expect(server.args).toContain('-y');
        expect(server.args[0]).toBe('-y');
      });
    });
  });

  describe('Environment-specific configurations', () => {
    it('should use process.cwd() for path-dependent configurations', () => {
      const filesystemServer = DEFAULT_TOOLS.mcpServers.filesystem;
      const memoryServer = DEFAULT_TOOLS.mcpServers['memory-bank-mcp'];
      
      expect(filesystemServer.args).toContain(process.cwd());
      expect(memoryServer.args).toContain(process.cwd());
    });

    it('should be adaptable to different working directories', () => {
      // The configuration should work regardless of where it's executed
      const originalCwd = process.cwd();
      
      // Simulate different working directory
      Object.defineProperty(process, 'cwd', {
        value: () => '/different/path',
        configurable: true
      });
      
      // Re-import to get fresh configuration
      jest.resetModules();
      const { DEFAULT_TOOLS: newDefaultTools } = require('../default-configs');
      
      expect(newDefaultTools.mcpServers.filesystem.args).toContain('/different/path');
      
      // Restore original cwd
      Object.defineProperty(process, 'cwd', {
        value: () => originalCwd,
        configurable: true
      });
    });
  });

  describe('Schema validation', () => {
    it('should pass all schema validations', () => {
      expect(() => {
        GenerateTextParamsSchema.parse(DEFAULT_CONFIG);
        ToolsJsonSchema.parse(DEFAULT_TOOLS);
        KeysJsonSchema.parse(DEFAULT_KEYS);
      }).not.toThrow();
    });

    it('should maintain type safety', () => {
      // TypeScript compilation ensures type safety
      const config = DEFAULT_CONFIG;
      const tools = DEFAULT_TOOLS;
      const keys = DEFAULT_KEYS;
      
      expect(typeof config.model).toBe('string');
      expect(typeof config.temperature).toBe('number');
      expect(typeof tools.mcpServers).toBe('object');
      expect(typeof keys).toBe('object');
    });
  });

  describe('Documentation and comments', () => {
    it('should have meaningful configuration values', () => {
      // Check that the system prompt is comprehensive
      if (DEFAULT_CONFIG.system) {
        expect(DEFAULT_CONFIG.system.split('\n').length).toBeGreaterThan(10);
      }
      
      // Check that tool configurations are complete
      Object.values(DEFAULT_TOOLS.mcpServers).forEach(server => {
        expect(server.args.length).toBeGreaterThan(1);
      });
    });

    it('should provide good defaults for new users', () => {
      // Temperature 0 for deterministic responses
      expect(DEFAULT_CONFIG.temperature).toBe(0);
      
      // Required tool choice to ensure tools are used
      expect(DEFAULT_CONFIG.toolChoice).toBe('required');
      
      // Helpful default prompt
      expect(DEFAULT_CONFIG.prompt).toContain('files');
      expect(DEFAULT_CONFIG.prompt).toContain('directory');
    });
  });
});