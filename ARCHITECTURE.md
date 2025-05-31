# Agentech System CLI – Architecture Plan

## 1. Platform & Compatibility

- **Primary Runtime:** [Bun](https://bun.sh/) for fast startup and modern JS/TS features.
- **Compatibility:** All code and dependencies must also work with Node.js (npx, tsx, etc.).

## 2. Core Framework

- **Agentic:** Use [`agentic`](https://github.com/transitive-bullshit/agentic) for agent orchestration, prompt management, and MCP tool integration.
- **MCP Tooling:** Leverage agentic’s built-in support for MCP tools ([agentic MCP docs](https://agentic.so/tools/mcp)).

## 3. Default MCP Integrations

- **basic-memory MCP:** 
  - Use [`basic-memory`](https://github.com/basicmachines-co/basic-memory) as a default MCP.
  - Configure it to use the local `memory/` folder for session and memory storage.
- **@modelcontextprotocol/server-filesystem MCP:**
  - Include and auto-configure with access to the current working directory (the scope of the running application).
- **Extensibility:** Additional MCPs can be declared in `tools.json`.

## 4. File/Folder Structure

```
/agentech-system/
  ├── system.md
  ├── config.json
  ├── tools.json
  ├── keys.json
  ├── memory/
  └── [cli.ts|cli.js]
```

## 5. Startup & Flow

- On launch, check for required files.
- If missing, prompt to create (empty or template).
- Load system, config, tools, and keys.
- Register default MCPs (basic-memory, server-filesystem) and any in tools.json.
- Display loaded tools, enter prompt loop.
- Log all interactions in `memory/` (markdown, session-based).
- Handle tool approval/authorization as needed.

## 6. Frameworks & Libraries

- **CLI:** `commander`, `yargs`, or Bun’s built-in CLI helpers.
- **Agentic:** For agent orchestration and MCP.
- **basic-memory:** For memory MCP.
- **@modelcontextprotocol/server-filesystem:** For filesystem MCP.
- **fs/promises:** For file operations (Bun and Node compatible).
- **readline/enquirer:** For prompt loop (Bun and Node compatible).

## 7. Extensibility

- Users can add more MCPs via `tools.json`.
- Future: Tool search, advanced memory, custom LLMs, etc.

## 8. High-Level Architecture Diagram

```mermaid
flowchart TD
    Start([Start CLI])
    CheckFiles{Check for system.md, config.json, tools.json, keys.json}
    PromptCreate[Prompt user to create missing files]
    LoadFiles[Load system, config, tools, keys]
    RegisterMCPs[Register default MCPs (basic-memory, server-filesystem) + tools.json MCPs]
    CheckKeys{Keys present?}
    PromptKey[Prompt user to provide API key]
    Ready[Display loaded tools, show "Ready"]
    UserPrompt[Wait for user prompt]
    SendToAgentic[Send prompt to agentic agent (system, config, tools)]
    AgenticResponse[Receive agentic/LLM response]
    ToolApproval{Tool requires approval?}
    PromptApproval[Prompt user for approval]
    LogMemory[Log interaction to memory/session file]
    LoopBack[Loop for next prompt]
    End([Exit, finalize session log])

    Start --> CheckFiles
    CheckFiles -- All present --> LoadFiles
    CheckFiles -- Missing files --> PromptCreate --> LoadFiles
    LoadFiles --> RegisterMCPs
    RegisterMCPs --> CheckKeys
    CheckKeys -- No --> PromptKey --> RegisterMCPs
    CheckKeys -- Yes --> Ready
    Ready --> UserPrompt
    UserPrompt --> SendToAgentic
    SendToAgentic --> AgenticResponse
    AgenticResponse --> ToolApproval
    ToolApproval -- Yes --> PromptApproval --> LogMemory
    ToolApproval -- No --> LogMemory
    LogMemory --> LoopBack
    LoopBack --> UserPrompt
    UserPrompt -- User exits --> End
```

## 9. References

- [agentic](https://github.com/transitive-bullshit/agentic)
- [basic-memory](https://github.com/basicmachines-co/basic-memory)
- [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/server-filesystem)
- [agentic MCP tools](https://agentic.so/tools/mcp)
- [Bun](https://bun.sh/)