# MCP Tool Handling Improvements

## Issues Identified from Session Log

Based on the session file `memory/session-2025-06-05T02-28-11-164Z.md`, several critical issues were identified:

### 1. **Tool Result Processing Loop** ❌
- Agent kept calling `agentic-mcp-filesystem_create_directory` repeatedly
- No actual progress was made beyond creating the initial directory
- Tool results weren't being properly processed to advance the task

### 2. **Missing Error Context** ❌  
- Tool failures weren't being communicated to the LLM
- No visibility into what tools were actually doing or if they failed
- Agent would repeat failed operations without understanding why

### 3. **Infinite Repetition** ❌
- Agent repeated the same text over and over: "I will execute npx create-react-app"
- No understanding that filesystem MCP tools can't run shell commands
- No progression through actual file creation steps

### 4. **Poor Tool Result Visibility** ❌
- Session logs showed tool usage but not results
- No debug information about tool success/failure
- Unable to diagnose what was actually happening

## Fixes Implemented

### 1. **Enhanced Tool Result Processing** ✅

**Before**: Basic tool result detection
```typescript
// Simple detection, missing context
if (result.toolResults && Array.isArray(result.toolResults)) {
  toolResultObj = result.toolResults.find(tr => tr.type === "tool-result");
}
```

**After**: Comprehensive tool result analysis
```typescript
// Debug logging for visibility
console.log(`\n[DEBUG] Result structure:`, JSON.stringify({
  text: result.text ? `"${result.text.substring(0, 100)}..."` : result.text,
  toolCalls: result.toolCalls ? result.toolCalls.length : 0,
  toolResults: result.toolResults ? result.toolResults.length : 0,
  usage: result.usage
}, null, 2));

// Separate tool calls from tool results
if (result.toolCalls && Array.isArray(result.toolCalls) && result.toolCalls.length > 0) {
  hasToolCalls = true;
  const toolCall = result.toolCalls[0];
  toolName = toolCall.toolName;
  console.log(`\n[DEBUG] Tool call detected: ${toolName} with args:`, JSON.stringify(toolCall.args, null, 2));
}

if (result.toolResults && Array.isArray(result.toolResults) && result.toolResults.length > 0) {
  toolResultObj = result.toolResults[0];
  console.log(`\n[DEBUG] Tool result received for ${toolName}:`, JSON.stringify({
    type: toolResultObj.type,
    isError: toolResultObj.isError,
    result: typeof toolResultObj.result === 'string' ? 
      toolResultObj.result.substring(0, 200) + '...' : 
      toolResultObj.result
  }, null, 2));
}
```

### 2. **Explicit Error Handling** ✅

**Before**: No error context provided to LLM
```typescript
const continuePrompt = `Here is the result: ${JSON.stringify(toolResultObj, null, 2)}`;
```

**After**: Clear error vs success handling
```typescript
let toolResultContext = "";

if (toolResultObj.isError) {
  // Handle tool errors explicitly
  toolResultContext = `TOOL ERROR - ${toolName} failed with error:\n${JSON.stringify(toolResultObj.result, null, 2)}\n\nPlease acknowledge this error to the user, explain what went wrong, and if possible, try an alternative approach or fix the issue. Do not repeat the same action that failed.`;
  console.log(`\n❌ [TOOL ERROR] ${toolName}:`, toolResultObj.result);
} else {
  // Handle successful tool results
  toolResultContext = `TOOL SUCCESS - ${toolName} completed successfully with result:\n${resultData}\n\nPlease describe what happened to the user as if you performed the action yourself, in natural language. If this is part of a multi-step task and more work is needed to complete the overall goal, continue with the next logical step without waiting for user input.`;
  console.log(`\n✅ [TOOL SUCCESS] ${toolName}`);
}
```

### 3. **Enhanced System Prompt** ✅

**Added clear tool usage guidelines**:
```
TOOL USAGE GUIDELINES:
- Use filesystem tools to create directories and write files manually
- DO NOT try to run shell commands like 'npx create-react-app' - you don't have shell access
- Instead, manually create all necessary files for projects (package.json, source files, etc.)
- When creating React apps, manually create: package.json, src/App.js, src/index.js, public/index.html
- When creating Node.js projects, manually create: package.json, server.js, routes/, etc.
- If a tool fails with an error, acknowledge the error and try a different approach
- Never repeat the same tool call that just failed
```

### 4. **Improved Logging** ✅

**Enhanced memory logging with tool results**:
```typescript
export function logToolUsed(sessionFile: string, toolName: string, toolResult?: any) {
  let logEntry = `## Tool Used\n\n${toolName}\n\n`;
  
  if (toolResult) {
    logEntry += `### Tool Result\n\n`;
    if (toolResult.isError) {
      logEntry += `**ERROR**: ${JSON.stringify(toolResult.result, null, 2)}\n\n`;
    } else {
      const result = typeof toolResult.result === 'string' 
        ? toolResult.result.length > 500 
          ? toolResult.result.substring(0, 500) + '\n...(truncated)'
          : toolResult.result
        : JSON.stringify(toolResult.result, null, 2);
      logEntry += `**SUCCESS**: ${result}\n\n`;
    }
  }
  
  appendFileSync(sessionFile, logEntry, "utf8");
}
```

### 5. **Timeout Protection** ✅

**Prevent hanging operations**:
```typescript
const generateTextWithTimeout = (timeoutMs: number = 120000) => {
  return Promise.race([
    generateText({
      model,
      tools: allTools,
      temperature: config.temperature,
      system: enhancedSystemPrompt,
      prompt: contextualPrompt
    }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Tool operation timeout after 2 minutes')), timeoutMs)
    )
  ]);
};
```

## Expected Behavior Now

### ✅ **Proper React App Creation**
```
User: Create a React app called "my-app"

Agent: I'll create a React app for you by manually creating all the necessary files.

[DEBUG] Tool call detected: agentic-mcp-filesystem_create_directory with args: {"path": "my-app"}
✅ [TOOL SUCCESS] agentic-mcp-filesystem_create_directory

Agent: I've successfully created the directory "my-app". Now I will create the package.json file with React dependencies.

[DEBUG] Tool call detected: agentic-mcp-filesystem_write_file with args: {"path": "my-app/package.json", "content": "..."}
✅ [TOOL SUCCESS] agentic-mcp-filesystem_write_file

Agent: I've created the package.json file. Now I'll create the src directory and App.js file.

[Continues creating all files...]

✅ Task completed. Steps taken: 6
```

### ✅ **Error Handling**
```
User: Create a file in /restricted/path

[DEBUG] Tool call detected: agentic-mcp-filesystem_write_file
❌ [TOOL ERROR] agentic-mcp-filesystem_write_file: Access denied

Agent: I encountered an error - access was denied to the restricted path. Let me create the file in the current project directory instead.

[Creates file in allowed location]
```

### ✅ **Proper Session Logging**
```markdown
## Tool Used

agentic-mcp-filesystem_create_directory

### Tool Result

**SUCCESS**: Directory created successfully at /Users/alnavarro/Development/mragent/my-app

## Agent

I've successfully created the directory "my-app". Now I will create the package.json file...
```

## Debug Features Added

### 1. **Console Debug Output**
- Real-time visibility into tool calls and results
- Clear success/error indicators
- Structured logging of tool arguments and responses

### 2. **Enhanced Session Files**
- Tool results now included in session logs
- Error details captured for debugging
- Truncated long outputs for readability

### 3. **Error Recovery**
- LLM receives explicit error context
- Prompted to try alternative approaches
- Prevented from repeating failed operations

## Testing Scenarios

### Test 1: Simple File Creation
```
User: Create a file called test.txt with "Hello World"
Expected: Single file created successfully with debug output
```

### Test 2: Complex Project Creation
```
User: Create a Node.js Express server
Expected: Multiple files created (package.json, server.js, routes/) with progress tracking
```

### Test 3: Error Handling
```
User: Create a file in an invalid path
Expected: Error acknowledged, alternative path used
```

### Test 4: Tool Timeout
```
User: Perform an operation that might hang
Expected: Operation times out after 2 minutes with clear error message
```

## Key Improvements Summary

1. **Visibility**: Full debug output shows exactly what tools are doing
2. **Error Handling**: Explicit error context prevents loops and provides alternatives  
3. **Progress Tracking**: Clear indication of tool success/failure at each step
4. **Documentation**: Enhanced session logs capture full tool interactions
5. **Safety**: Timeout protection prevents hanging operations
6. **Education**: System prompt clarifies MCP tool capabilities and limitations

The agent should now handle MCP tools much more reliably, with clear feedback about what's happening at each step and proper error recovery when things go wrong.