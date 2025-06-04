import { writeFileSync, appendFileSync } from 'fs';
import {
  createSessionFile,
  logUserPrompt,
  logToolUsed,
  logAgentResponse,
  logAgentError
} from '../src/memory.js';

// Mock fs module
jest.mock('fs');
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockAppendFileSync = appendFileSync as jest.MockedFunction<typeof appendFileSync>;

describe('memory.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSessionFile', () => {
    it('should create session file with correct header', () => {
      const now = new Date('2023-12-01T10:30:00.000Z');
      const toolRow = 'tools: [filesystem, memory]';
      const toolStatusMd = '- filesystem: ✅ loaded\n- memory: ✅ loaded\n';
      const agentName = 'TestAgent';

      const result = createSessionFile(now, toolRow, toolStatusMd, agentName);

      expect(result).toBe('memory/session-2023-12-01T10-30-00-000Z.md');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'memory/session-2023-12-01T10-30-00-000Z.md',
        expect.stringContaining('# TestAgent Session – 12/1/2023, 5:30:00 AM'),
        'utf8'
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(toolRow),
        'utf8'
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(toolStatusMd),
        'utf8'
      );
    });

    it('should format filename correctly with special characters replaced', () => {
      const now = new Date('2023-12-01T10:30:45.123Z');
      const result = createSessionFile(now, '', '', 'Agent');

      expect(result).toBe('memory/session-2023-12-01T10-30-45-123Z.md');
    });

    it('should include all sections in header', () => {
      const now = new Date();
      const toolRow = 'tools: [test]';
      const toolStatusMd = '- test: ✅ loaded\n';
      const agentName = 'TestAgent';

      createSessionFile(now, toolRow, toolStatusMd, agentName);

      const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenContent).toContain('# TestAgent Session');
      expect(writtenContent).toContain('tools: [test]');
      expect(writtenContent).toContain('## Tools Loaded');
      expect(writtenContent).toContain('- test: ✅ loaded');
    });
  });

  describe('logUserPrompt', () => {
    it('should append user prompt with correct formatting', () => {
      const sessionFile = 'test-session.md';
      const prompt = 'What files are in the current directory?';

      logUserPrompt(sessionFile, prompt);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## User\n\nWhat files are in the current directory?\n\n',
        'utf8'
      );
    });

    it('should handle empty prompt', () => {
      const sessionFile = 'test-session.md';
      const prompt = '';

      logUserPrompt(sessionFile, prompt);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## User\n\n\n\n',
        'utf8'
      );
    });

    it('should handle multiline prompts', () => {
      const sessionFile = 'test-session.md';
      const prompt = 'Line 1\nLine 2\nLine 3';

      logUserPrompt(sessionFile, prompt);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## User\n\nLine 1\nLine 2\nLine 3\n\n',
        'utf8'
      );
    });
  });

  describe('logToolUsed', () => {
    it('should append tool usage with correct formatting', () => {
      const sessionFile = 'test-session.md';
      const toolName = 'filesystem';

      logToolUsed(sessionFile, toolName);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## Tool Used\n\nfilesystem\n\n',
        'utf8'
      );
    });

    it('should handle complex tool names', () => {
      const sessionFile = 'test-session.md';
      const toolName = 'memory-bank-mcp-server';

      logToolUsed(sessionFile, toolName);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## Tool Used\n\nmemory-bank-mcp-server\n\n',
        'utf8'
      );
    });
  });

  describe('logAgentResponse', () => {
    it('should append agent response with correct formatting', () => {
      const sessionFile = 'test-session.md';
      const response = 'I found 5 files in the current directory.';

      logAgentResponse(sessionFile, response);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## Agent\n\nI found 5 files in the current directory.\n\n',
        'utf8'
      );
    });

    it('should handle markdown content in response', () => {
      const sessionFile = 'test-session.md';
      const response = '# Files Found\n\n- file1.txt\n- file2.js\n\n**Total**: 2 files';

      logAgentResponse(sessionFile, response);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## Agent\n\n# Files Found\n\n- file1.txt\n- file2.js\n\n**Total**: 2 files\n\n',
        'utf8'
      );
    });

    it('should handle empty response', () => {
      const sessionFile = 'test-session.md';
      const response = '';

      logAgentResponse(sessionFile, response);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## Agent\n\n\n\n',
        'utf8'
      );
    });
  });

  describe('logAgentError', () => {
    it('should append error message with correct formatting', () => {
      const sessionFile = 'test-session.md';
      const errMsg = 'Failed to connect to OpenAI API';

      logAgentError(sessionFile, errMsg);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## Agent (error)\n\nFailed to connect to OpenAI API\n\n',
        'utf8'
      );
    });

    it('should handle complex error messages', () => {
      const sessionFile = 'test-session.md';
      const errMsg = 'Error: ENOENT: no such file or directory, open \'/path/to/file\'';

      logAgentError(sessionFile, errMsg);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## Agent (error)\n\nError: ENOENT: no such file or directory, open \'/path/to/file\'\n\n',
        'utf8'
      );
    });

    it('should handle multiline error messages', () => {
      const sessionFile = 'test-session.md';
      const errMsg = 'Error occurred:\nStack trace line 1\nStack trace line 2';

      logAgentError(sessionFile, errMsg);

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        sessionFile,
        '## Agent (error)\n\nError occurred:\nStack trace line 1\nStack trace line 2\n\n',
        'utf8'
      );
    });
  });

  describe('Integration tests', () => {
    it('should create a complete session log flow', () => {
      const now = new Date('2023-12-01T10:30:00.000Z');
      const sessionFile = createSessionFile(now, 'tools: [filesystem]', '- filesystem: ✅ loaded\n', 'TestAgent');

      logUserPrompt(sessionFile, 'List files');
      logToolUsed(sessionFile, 'filesystem');
      logAgentResponse(sessionFile, 'Found 3 files: file1.txt, file2.js, file3.md');

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      expect(mockAppendFileSync).toHaveBeenCalledTimes(3);

      // Verify the sequence of calls
      expect(mockAppendFileSync.mock.calls[0][1]).toContain('## User\n\nList files\n\n');
      expect(mockAppendFileSync.mock.calls[1][1]).toContain('## Tool Used\n\nfilesystem\n\n');
      expect(mockAppendFileSync.mock.calls[2][1]).toContain('## Agent\n\nFound 3 files');
    });

    it('should handle error in session flow', () => {
      const now = new Date();
      const sessionFile = createSessionFile(now, 'tools: []', '', 'TestAgent');

      logUserPrompt(sessionFile, 'Do something');
      logAgentError(sessionFile, 'No tools available');

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      expect(mockAppendFileSync).toHaveBeenCalledTimes(2);

      expect(mockAppendFileSync.mock.calls[1][1]).toContain('## Agent (error)\n\nNo tools available\n\n');
    });
  });
});