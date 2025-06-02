// Mock dependencies BEFORE importing modules
jest.mock('fs');
jest.mock('readline');
jest.mock('@agentic/mcp', () => ({
  createMcpTools: jest.fn()
}));

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import * as readline from 'readline';
import {
  getMissingProjectFiles,
  initializeProjectFiles,
  validateAndLoadFiles,
  loadAllMcpTools,
  GREEN,
  RED,
  YELLOW,
  RESET
} from '../initialization';
import { DEFAULT_CONFIG, DEFAULT_TOOLS, DEFAULT_KEYS } from '../default-configs';

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockReadline = readline as jest.Mocked<typeof readline>;

describe('initialization.ts', () => {
  const REQUIRED_FILES = ['system.md', 'local-agent.json', 'mcp-tools.json', 'keys.json'];
  const MEMORY_DIR = 'memory';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMissingProjectFiles', () => {
    it('should return empty array when all files exist', () => {
      mockExistsSync.mockReturnValue(true);

      const result = getMissingProjectFiles(REQUIRED_FILES, MEMORY_DIR);

      expect(result).toEqual([]);
      expect(mockExistsSync).toHaveBeenCalledTimes(5); // 4 files + 1 directory
    });

    it('should return missing files', () => {
      mockExistsSync.mockImplementation((path) => {
        return path !== 'system.md' && path !== 'memory';
      });

      const result = getMissingProjectFiles(REQUIRED_FILES, MEMORY_DIR);

      expect(result).toEqual(['system.md', 'memory/']);
    });

    it('should return all files when none exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = getMissingProjectFiles(REQUIRED_FILES, MEMORY_DIR);

      expect(result).toEqual([
        'system.md',
        'local-agent.json',
        'mcp-tools.json',
        'keys.json',
        'memory/'
      ]);
    });
  });

  describe('initializeProjectFiles', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
    });

    it('should create all missing files with correct content', () => {
      initializeProjectFiles(REQUIRED_FILES, MEMORY_DIR);

      expect(mockWriteFileSync).toHaveBeenCalledWith('system.md', '', 'utf8');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'local-agent.json',
        JSON.stringify(DEFAULT_CONFIG, null, 2),
        'utf8'
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'mcp-tools.json',
        JSON.stringify(DEFAULT_TOOLS, null, 2),
        'utf8'
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'keys.json',
        JSON.stringify(DEFAULT_KEYS, null, 2),
        'utf8'
      );
      expect(mockMkdirSync).toHaveBeenCalledWith(MEMORY_DIR);
    });

    it('should not create files that already exist', () => {
      mockExistsSync.mockImplementation((path) => path === 'system.md');

      initializeProjectFiles(REQUIRED_FILES, MEMORY_DIR);

      expect(mockWriteFileSync).toHaveBeenCalledTimes(3); // Only 3 files created
      expect(mockWriteFileSync).not.toHaveBeenCalledWith('system.md', expect.any(String), 'utf8');
    });

    it('should create directory if it does not exist', () => {
      mockExistsSync.mockImplementation((path) => path !== MEMORY_DIR);

      initializeProjectFiles(REQUIRED_FILES, MEMORY_DIR);

      expect(mockMkdirSync).toHaveBeenCalledWith(MEMORY_DIR);
    });

    it('should handle generic JSON files', () => {
      const customFiles = ['custom.json'];
      mockExistsSync.mockReturnValue(false);

      initializeProjectFiles(customFiles, MEMORY_DIR);

      expect(mockWriteFileSync).toHaveBeenCalledWith('custom.json', '{}', 'utf8');
    });
  });

  describe('validateAndLoadFiles', () => {
    it('should load and parse files when all exist', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((path) => {
        if (path === 'local-agent.json') {
          return JSON.stringify(DEFAULT_CONFIG);
        }
        if (path === 'mcp-tools.json') {
          return JSON.stringify(DEFAULT_TOOLS);
        }
        if (path === 'keys.json') {
          return JSON.stringify(DEFAULT_KEYS);
        }
        return '{}';
      });

      const result = await validateAndLoadFiles(REQUIRED_FILES, MEMORY_DIR);

      expect(result.config).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(result.keys).toBeDefined();
    });

    it('should prompt user when files are missing and user accepts', async () => {
      mockExistsSync.mockReturnValue(false);
      
      const mockRl = {
        question: jest.fn((question, callback) => {
          callback('y');
        }),
        close: jest.fn()
      };
      mockReadline.createInterface.mockReturnValue(mockRl as any);

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(validateAndLoadFiles(REQUIRED_FILES, MEMORY_DIR)).rejects.toThrow('process.exit called');
      
      expect(mockExit).toHaveBeenCalledWith(0);
      mockExit.mockRestore();
    });

    it('should exit when user declines initialization', async () => {
      mockExistsSync.mockReturnValue(false);
      
      const mockRl = {
        question: jest.fn((question, callback) => {
          callback('n');
        }),
        close: jest.fn()
      };
      mockReadline.createInterface.mockReturnValue(mockRl as any);

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(validateAndLoadFiles(REQUIRED_FILES, MEMORY_DIR)).rejects.toThrow('process.exit called');
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it('should handle invalid JSON in config files', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation((path) => {
        if (path === 'local-agent.json') {
          return 'invalid json';
        }
        return JSON.stringify({});
      });

      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(validateAndLoadFiles(REQUIRED_FILES, MEMORY_DIR)).rejects.toThrow('process.exit called');
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('loadAllMcpTools', () => {
    const { createMcpTools } = require('@agentic/mcp');
    const mockCreateMcpTools = createMcpTools as jest.MockedFunction<typeof createMcpTools>;

    it('should load all MCP tools successfully', async () => {
      const toolsConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
          },
          memory: {
            command: 'npx',
            args: ['-y', '@aakarsh-sasi/memory-bank-mcp']
          }
        }
      };

      const mockTool1 = { name: 'filesystem-tool' };
      const mockTool2 = { name: 'memory-tool' };
      
      mockCreateMcpTools
        .mockResolvedValueOnce(mockTool1)
        .mockResolvedValueOnce(mockTool2);

      const result = await loadAllMcpTools(toolsConfig);

      expect(result.loadedTools).toEqual({
        filesystem: mockTool1,
        memory: mockTool2
      });
      expect(result.toolStatus).toEqual([
        { name: 'filesystem', status: 'success' },
        { name: 'memory', status: 'success' }
      ]);
    });

    it('should handle tool loading failures', async () => {
      const toolsConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
          },
          failing: {
            command: 'invalid-command',
            args: []
          }
        }
      };

      const mockTool = { name: 'filesystem-tool' };
      const error = new Error('Tool loading failed');
      
      mockCreateMcpTools
        .mockResolvedValueOnce(mockTool)
        .mockRejectedValueOnce(error);

      const result = await loadAllMcpTools(toolsConfig);

      expect(result.loadedTools).toEqual({
        filesystem: mockTool
      });
      expect(result.toolStatus).toEqual([
        { name: 'filesystem', status: 'success' },
        { name: 'failing', status: 'fail', error: 'Tool loading failed' }
      ]);
    });

    it('should handle empty tools config', async () => {
      const toolsConfig = { mcpServers: {} };

      const result = await loadAllMcpTools(toolsConfig);

      expect(result.loadedTools).toEqual({});
      expect(result.toolStatus).toEqual([]);
    });

    it('should handle non-Error exceptions', async () => {
      const toolsConfig = {
        mcpServers: {
          failing: {
            command: 'invalid-command',
            args: []
          }
        }
      };

      mockCreateMcpTools.mockRejectedValueOnce('String error');

      const result = await loadAllMcpTools(toolsConfig);

      expect(result.toolStatus).toEqual([
        { name: 'failing', status: 'fail', error: 'String error' }
      ]);
    });
  });

  describe('Color constants', () => {
    it('should export correct ANSI color codes', () => {
      expect(GREEN).toBe('\x1b[32m');
      expect(RED).toBe('\x1b[31m');
      expect(YELLOW).toBe('\x1b[33m');
      expect(RESET).toBe('\x1b[0m');
    });
  });
});