# Memory Bank MCP Configuration

This document describes the configuration of the `memory-bank-mcp` in the MRAgent system.

## Overview

The Memory Bank MCP is configured to access the local `memory` folder where all session history is stored. It's set to run in "code" mode, which optimizes it for code-related conversations.

## Configuration Details

The Memory Bank MCP is configured in `default-configs.ts` with the following settings:

```typescript
"memory-bank-mcp": {
  "command": "npx",
  "args": [
    "-y",
    "@aakarsh-sasi/memory-bank-mcp",
    "--path", process.cwd(),
    "--folder", "memory",
    "--mode", "code"
  ]
}
```

### Parameters

- `--path`: Points to the current working directory of the application (`process.cwd()`)
- `--folder`: Specifies "memory" as the folder containing session history
- `--mode`: Set to "code" to optimize the MCP for code-related tasks

## Functionality

The Memory Bank MCP provides the following capabilities:

1. **Access to Session History**: The MCP can read all sessions stored in the memory folder, providing access to conversation history across multiple sessions.

2. **Automatic Summary Storage**: The system automatically generates and stores summaries of interactions, including:
   - User prompts
   - Tool usage
   - Agent responses
   - Errors

3. **Contextual Memory**: The MCP maintains context across sessions, allowing the agent to reference previous conversations and decisions.

## File Structure

The memory folder follows this structure:
- Each session is stored as a Markdown file
- Files are named with a timestamp pattern: `session-YYYY-MM-DDTHH-mm-ss-mssZ.md`
- Content includes user prompts, tool usage, and agent responses in chronological order

## Integration with Agent System

The Memory Bank MCP is automatically loaded during system initialization along with other MCPs defined in the tools configuration. The agent system's interaction logic handles the storage of summaries and session logs.

## Future Enhancements

Potential improvements to consider:
- Implementing more sophisticated memory indexing
- Adding memory compression for large history
- Supporting custom tagging of important information