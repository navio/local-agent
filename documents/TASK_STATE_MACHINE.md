# Task State Machine Design

The current multi-step task handling in `interactions.ts` relies on complex string matching patterns and conditional logic. This approach is difficult to maintain, test, and extend. This document proposes a state machine pattern to simplify task management.

## Current Implementation Issues

1. **String-Based Detection**: The current implementation uses large arrays of string patterns to detect task continuations and completions.

2. **Complex Conditional Logic**: Multiple nested conditions for determining task state and continuation.

3. **Mixed Concerns**: Task detection, tracking, and state management are intertwined with the interaction loop.

4. **Limited Extensibility**: Adding new task patterns or behaviors requires modifying multiple code sections.

## Proposed Solution: Task State Machine

A state machine approach clearly defines task states, transitions between states, and the actions associated with each transition.

### Task States

```typescript
enum TaskState {
  IDLE = 'idle',               // No active task
  STARTING = 'starting',       // Task identified, being initialized
  IN_PROGRESS = 'in_progress', // Task is actively being worked on
  AWAITING_TOOL = 'awaiting_tool', // Waiting for tool execution to complete
  COMPLETED = 'completed',     // Task successfully completed
  FAILED = 'failed'            // Task encountered an error
}
```

### State Machine Implementation

```typescript
class TaskStateManager {
  private state: TaskState = TaskState.IDLE;
  private taskDescription: string = '';
  private completedSteps: string[] = [];
  private nextSteps: string[] = [];
  private toolsUsed: string[] = [];
  private stepCount: number = 0;
  
  // Pattern registries - moved from hard-coded arrays to configurable properties
  private continuationPatterns: string[] = [
    'created folder', 'created directory', 'made folder',
    'next step', 'continue', 'now i will', 'now i need to',
    'partially complete', 'still need', 'remaining',
    'created basic', 'initial setup', 'first step',
    'proceeding', 'moving on', 'next logical step',
    'will now', 'let me', 'i will create', 'i will add',
    'setting up', 'configuring', 'installing'
  ];
  
  private completionPatterns: string[] = [
    'task complete', 'finished', 'done', 'ready to use',
    'fully functional', 'all files created', 'project is complete',
    'successfully created', 'everything is set up',
    'application is now ready', 'setup is complete',
    'all necessary files', 'ready to run'
  ];
  
  private continuationTools: string[] = ['create_directory', 'write_file'];

  // State transition methods
  
  startTask(description: string): void {
    if (this.state !== TaskState.IDLE) {
      this.resetTask();
    }
    
    this.taskDescription = description;
    this.state = TaskState.STARTING;
    this.stepCount = 0;
    
    // Analyze task to set initial expectations
    this.analyzeTaskRequirements(description);
    
    this.transitionToInProgress();
  }
  
  private analyzeTaskRequirements(description: string): void {
    // Logic to parse task description and identify potential steps
    // This could use NLP patterns or keywords to set initial nextSteps
    const lowerDesc = description.toLowerCase();
    
    // Example: if task mentions creating a project, we know we'll need several steps
    if (lowerDesc.includes('create') && 
        (lowerDesc.includes('project') || lowerDesc.includes('application'))) {
      this.nextSteps = [
        'Create project directory',
        'Initialize configuration files',
        'Set up basic structure',
        'Install dependencies'
      ];
    }
  }
  
  private transitionToInProgress(): void {
    this.state = TaskState.IN_PROGRESS;
    // Any actions needed when task is officially in progress
  }
  
  recordToolUse(toolName: string, result: any): void {
    this.toolsUsed.push(toolName);
    
    if (this.state === TaskState.IN_PROGRESS) {
      this.state = TaskState.AWAITING_TOOL;
    }
  }
  
  processResponse(response: string, toolUsed?: string): void {
    // Reset from awaiting tool state if we were in it
    if (this.state === TaskState.AWAITING_TOOL) {
      this.state = TaskState.IN_PROGRESS;
    }
    
    this.stepCount++;
    
    // Check for completion first
    if (this.isTaskComplete(response)) {
      this.completeTask();
      return;
    }
    
    // Update task progress based on response
    this.updateTaskProgress(response, toolUsed);
  }
  
  private updateTaskProgress(response: string, toolUsed?: string): void {
    // Extract what was accomplished from the response
    const accomplishment = this.extractAccomplishment(response);
    if (accomplishment) {
      this.completedSteps.push(accomplishment);
      
      // Remove from next steps if it was there
      const matchingNextStep = this.nextSteps.find(step => 
        step.toLowerCase().includes(accomplishment.toLowerCase()));
      if (matchingNextStep) {
        this.nextSteps = this.nextSteps.filter(step => step !== matchingNextStep);
      }
    }
    
    // Extract potential next steps from response
    const potentialNextSteps = this.extractNextSteps(response);
    this.nextSteps = [...this.nextSteps, ...potentialNextSteps];
  }
  
  private extractAccomplishment(response: string): string | null {
    // Simplified example - in a real implementation this would use more
    // sophisticated NLP to extract what was accomplished
    const lines = response.split('\n');
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('created') || 
          lowerLine.includes('added') || 
          lowerLine.includes('installed') ||
          lowerLine.includes('configured')) {
        return line;
      }
    }
    return null;
  }
  
  private extractNextSteps(response: string): string[] {
    // Simplified example - would use more sophisticated NLP
    const steps: string[] = [];
    const lines = response.split('\n');
    let nextStepSection = false;
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (lowerLine.includes('next step') || lowerLine.includes('next, i will')) {
        nextStepSection = true;
        steps.push(line.replace(/next step:?|next, i will/i, '').trim());
        continue;
      }
      
      if (nextStepSection && lowerLine.trim() && !lowerLine.includes('done')) {
        steps.push(line.trim());
      }
      
      if (nextStepSection && (lowerLine.includes('done') || lowerLine.length === 0)) {
        nextStepSection = false;
      }
    }
    
    return steps;
  }
  
  private isTaskComplete(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    
    // Check for completion patterns
    return this.completionPatterns.some(pattern => 
      lowerResponse.includes(pattern));
  }
  
  private completeTask(): void {
    this.state = TaskState.COMPLETED;
    // Additional completion logic if needed
  }
  
  resetTask(): void {
    this.state = TaskState.IDLE;
    this.taskDescription = '';
    this.completedSteps = [];
    this.nextSteps = [];
    this.toolsUsed = [];
    this.stepCount = 0;
  }
  
  // Predicates and state queries
  
  shouldContinueAutomatically(response: string, toolUsed?: string): boolean {
    if (this.state !== TaskState.IN_PROGRESS && 
        this.state !== TaskState.AWAITING_TOOL) {
      return false;
    }
    
    const lowerResponse = response.toLowerCase();
    
    // If a continuation tool was just used, likely need to continue
    if (toolUsed && this.continuationTools.some(tool => toolUsed.includes(tool))) {
      return true;
    }
    
    // Check for continuation indicators
    return this.continuationPatterns.some(pattern => 
      lowerResponse.includes(pattern));
  }
  
  isTaskActive(): boolean {
    return this.state === TaskState.IN_PROGRESS || 
           this.state === TaskState.AWAITING_TOOL || 
           this.state === TaskState.STARTING;
  }
  
  getTaskContext(): TaskContext {
    return {
      isMultiStep: this.isTaskActive(),
      taskDescription: this.taskDescription,
      completedSteps: this.completedSteps,
      nextSteps: this.nextSteps,
      isComplete: this.state === TaskState.COMPLETED
    };
  }
  
  // Configuration methods
  
  addContinuationPattern(pattern: string): void {
    if (!this.continuationPatterns.includes(pattern)) {
      this.continuationPatterns.push(pattern);
    }
  }
  
  addCompletionPattern(pattern: string): void {
    if (!this.completionPatterns.includes(pattern)) {
      this.completionPatterns.push(pattern);
    }
  }
  
  addContinuationTool(tool: string): void {
    if (!this.continuationTools.includes(tool)) {
      this.continuationTools.push(tool);
    }
  }
}
```

### Integration with Interaction Loop

The state machine would integrate with the interaction loop in `interactions.ts` as follows:

```typescript
// Initialize the task manager
const taskManager = new TaskStateManager();

// When processing a user input
async function processUserInput(prompt: string, isAutoContinuation = false): Promise<void> {
  const userTime = new Date();
  
  // Log user prompt
  if (!isAutoContinuation) {
    logUserPrompt(sessionFile, prompt);
    conversationHistory.push({
      role: 'user',
      content: prompt,
      timestamp: userTime
    });

    // Detect if this is a new multi-step task
    if (isMultiStepTask(prompt)) {
      taskManager.startTask(prompt);
    }
  }

  // ... LLM call and processing ...

  // When handling tool usage
  if (toolResultObj && toolName) {
    taskManager.recordToolUse(toolName, toolResultObj);
    // ... existing tool handling ...
  }

  // After getting assistant response
  if (assistantResponse) {
    // Process the response in the task manager
    taskManager.processResponse(assistantResponse, toolName);

    // Check if we should continue the task automatically
    if (taskManager.shouldContinueAutomatically(assistantResponse, toolName)) {
      console.log(`\n${YELLOW}Task continuation detected. Press Enter to continue or modify the prompt:${RESET}`);
      // Pre-populate the readline with continuation prompt
      rl.write("continue");
      rl.prompt();
      return;
    }
  }
}

// Replace buildConversationContext with task-aware version
function buildConversationContext(): string {
  if (conversationHistory.length === 0) return '';
  
  const recentHistory = conversationHistory.slice(-10); // Keep last 10 messages
  let context = '\n\nCONVERSATION HISTORY:\n';
  
  recentHistory.forEach((msg, index) => {
    const timeStr = msg.timestamp.toLocaleTimeString();
    context += `[${timeStr}] ${msg.role.toUpperCase()}: ${msg.content}\n`;
    if (msg.toolUsed) {
      context += `[${timeStr}] TOOL_USED: ${msg.toolUsed}\n`;
    }
  });
  
  // Get current task context directly from the manager
  if (taskManager.isTaskActive()) {
    const taskContext = taskManager.getTaskContext();
    context += `\nCURRENT TASK CONTEXT:\n`;
    context += `Task: ${taskContext.taskDescription}\n`;
    context += `Completed Steps: ${taskContext.completedSteps.join(', ')}\n`;
    context += `Next Steps: ${taskContext.nextSteps.join(', ')}\n`;
  }
  
  return context;
}
```

## Benefits of State Machine Approach

1. **Clear State Transitions**: Explicit states and transitions make the code easier to understand and debug.

2. **Separation of Concerns**: Task management logic is separated from the interaction loop.

3. **Improved Testability**: Task states and transitions can be tested independently.

4. **Extensibility**: New task states, patterns, and behaviors can be added without modifying core logic.

5. **Configurability**: Pattern matching can be configured without changing code.

6. **Richer Context**: The state machine maintains more detailed information about task progress.

7. **Reduced Complexity**: Eliminates complex string matching logic embedded in the interaction loop.

## Implementation Steps

1. Create the `TaskStateManager` class in a new file `src/tasks/task-state-manager.ts`.

2. Update the interface definitions in `src/types.ts` to include the task state and context types.

3. Refactor `interactions.ts` to use the task state manager instead of direct string matching.

4. Update tests to cover the new task state management approach.

This state machine design provides a more maintainable and extensible solution for handling multi-step tasks in the agent, while reducing the cognitive complexity of the codebase.