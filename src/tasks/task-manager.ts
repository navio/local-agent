/**
 * @fileoverview
 * Task State Manager for handling multi-step task logic.
 * Replaces complex string matching with clear state transitions.
 */
import { TaskState, TaskContext } from './task-state';

/**
 * Manages task state transitions and provides task context.
 */
export class TaskManager {
  private state: TaskState = TaskState.IDLE;
  private taskDescription: string = '';
  private completedSteps: string[] = [];
  private nextSteps: string[] = [];
  private toolsUsed: string[] = [];
  private stepCount: number = 0;
  private maxSteps: number = 50; // Increased limit for complex tasks
  private lastResponseWithoutTools: number = 0; // Track responses without tool usage
  private maxResponsesWithoutTools: number = 5; // Increased tolerance - projects need multiple steps
  private lastToolUsed: string = ''; // Track the last tool used
  private consecutiveNonToolResponses: number = 0; // More specific tracking
  
  // Pattern registries - moved from hard-coded arrays to configurable properties
  private continuationPatterns: string[] = [
    'created folder', 'created directory', 'made folder',
    'next step', 'continue', 'now i will', 'now i need to',
    'partially complete', 'still need', 'remaining',
    'created basic', 'initial setup', 'first step',
    'proceeding', 'moving on', 'next logical step',
    'will now', 'let me', 'i will create', 'i will add',
    'setting up', 'configuring', 'installing',
    'let me now', 'i should', 'i need to'
  ];
  
  private completionPatterns: string[] = [
    'task complete', 'finished', 'done', 'ready to use',
    'fully functional', 'all files created', 'project is complete',
    'successfully created', 'everything is set up',
    'application is now ready', 'setup is complete',
    'all necessary files', 'ready to run', 'task is now complete',
    'have successfully', 'is now fully', 'completed the',
    'you can now', 'everything needed', 'all set up'
  ];
  
  private stoppingPatterns: string[] = [
    'that completes', 'this finishes', 'no further steps',
    'that\'s all', 'nothing more', 'all done',
    'no additional', 'task finished', 'work is complete'
  ];
  
  private continuationTools: string[] = ['create_directory', 'write_file', 'edit_file'];

  /**
   * Determines if a user prompt describes a multi-step task.
   */
  isMultiStepTask(prompt: string): boolean {
    const multiStepKeywords = [
      'create', 'build', 'setup', 'make', 'develop', 'implement', 'generate',
      'react app', 'project', 'application', 'website', 'api', 'server',
      'all files', 'complete', 'full', 'entire', 'whole'
    ];
    const lowerPrompt = prompt.toLowerCase();
    return multiStepKeywords.some(keyword => lowerPrompt.includes(keyword));
  }

  /**
   * Starts a new task with the given description.
   */
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
  
  /**
   * Analyzes task description to identify potential steps.
   */
  private analyzeTaskRequirements(description: string): void {
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
  
  /**
   * Transitions task to in-progress state.
   */
  private transitionToInProgress(): void {
    this.state = TaskState.IN_PROGRESS;
  }
  
  /**
   * Records that a tool was used in the current task.
   */
  recordToolUse(toolName: string, result: any): void {
    this.toolsUsed.push(toolName);
    
    if (this.state === TaskState.IN_PROGRESS) {
      this.state = TaskState.AWAITING_TOOL;
    }
  }
  
  /**
   * Processes a response from the assistant and updates task state.
   */
  processResponse(response: string, toolUsed?: string): void {
    // Reset from awaiting tool state if we were in it
    if (this.state === TaskState.AWAITING_TOOL) {
      this.state = TaskState.IN_PROGRESS;
    }
    
    this.stepCount++;
    
    // Track tool usage more carefully
    if (toolUsed) {
      this.lastToolUsed = toolUsed;
      this.consecutiveNonToolResponses = 0;
      this.lastResponseWithoutTools = 0;
    } else {
      this.consecutiveNonToolResponses++;
      this.lastResponseWithoutTools++;
    }
    
    // Update task progress based on response FIRST
    this.updateTaskProgress(response, toolUsed);
    
    // Only check for completion AFTER processing the response
    // Be more conservative about marking tasks complete
    if (this.shouldMarkComplete(response, toolUsed)) {
      this.completeTask();
      return;
    }
    
    // Safety limits - but be more lenient for complex tasks
    if (this.stepCount >= this.maxSteps) {
      console.log(`\n⚠️ Task has reached maximum step limit (${this.maxSteps}). Marking as complete.`);
      this.completeTask();
      return;
    }
    
    // Only stop if we have consecutive non-tool responses AND explicit completion signals
    if (this.consecutiveNonToolResponses >= this.maxResponsesWithoutTools && 
        this.hasExplicitCompletionSignal(response)) {
      console.log(`\n⚠️ Task appears to be complete (${this.consecutiveNonToolResponses} responses without tools + completion signal).`);
      this.completeTask();
      return;
    }
  }
  
  /**
   * Updates task progress based on the assistant's response.
   */
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
  
  /**
   * Extracts accomplishments from the response text.
   */
  private extractAccomplishment(response: string): string | null {
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
  
  /**
   * Extracts next steps from the response text.
   */
  private extractNextSteps(response: string): string[] {
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
  
  /**
   * Determines if task should be marked complete (more conservative).
   */
  private shouldMarkComplete(response: string, toolUsed?: string): boolean {
    const lowerResponse = response.toLowerCase();
    
    // Don't complete if we just used a tool - let it continue
    if (toolUsed && this.continuationTools.some(tool => toolUsed.includes(tool))) {
      return false;
    }
    
    // Only complete on very explicit completion signals
    return this.hasExplicitCompletionSignal(response);
  }
  
  /**
   * Checks for explicit completion signals.
   */
  private hasExplicitCompletionSignal(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    
    // Very explicit completion indicators
    const strongCompletionPatterns = [
      'task is complete', 'task completed', 'project is complete',
      'all done', 'finished creating', 'everything is set up',
      'application is ready', 'ready to use', 'setup complete',
      'you can now run', 'you can now use', 'all files have been created'
    ];
    
    return strongCompletionPatterns.some(pattern => lowerResponse.includes(pattern));
  }
  
  /**
   * Original completion check (now used for reference but not for auto-completion).
   */
  private isTaskComplete(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    
    // Check for explicit completion patterns
    if (this.completionPatterns.some(pattern => lowerResponse.includes(pattern))) {
      return true;
    }
    
    // Check for stopping patterns
    if (this.stoppingPatterns.some(pattern => lowerResponse.includes(pattern))) {
      return true;
    }
    
    // For project tasks, be more careful about completion
    if (this.isProjectCreationTask()) {
      // Only complete if we have clear end-state indicators
      if (lowerResponse.includes('npm start') || 
          lowerResponse.includes('npm run') ||
          lowerResponse.includes('you can now')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Checks if this is a project creation task.
   */
  private isProjectCreationTask(): boolean {
    const lowerDesc = this.taskDescription.toLowerCase();
    return (lowerDesc.includes('create') || lowerDesc.includes('build')) &&
           (lowerDesc.includes('project') || lowerDesc.includes('app') || 
            lowerDesc.includes('application') || lowerDesc.includes('website'));
  }
  
  /**
   * Checks if response has continuation indicators.
   */
  private hasContinuationIndicators(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    return this.continuationPatterns.some(pattern => lowerResponse.includes(pattern));
  }
  
  /**
   * Marks the task as completed.
   */
  private completeTask(): void {
    this.state = TaskState.COMPLETED;
  }
  
  /**
   * Resets the task to idle state.
   */
  resetTask(): void {
    this.state = TaskState.IDLE;
    this.taskDescription = '';
    this.completedSteps = [];
    this.nextSteps = [];
    this.toolsUsed = [];
    this.stepCount = 0;
    this.lastResponseWithoutTools = 0;
    this.lastToolUsed = '';
    this.consecutiveNonToolResponses = 0;
  }
  
  /**
   * Gets task completion status with details.
   */
  getCompletionStatus(): { isComplete: boolean; reason?: string; stepCount: number } {
    if (this.state === TaskState.COMPLETED) {
      return { 
        isComplete: true, 
        reason: 'Task marked as complete',
        stepCount: this.stepCount 
      };
    }
    
    if (this.stepCount >= this.maxSteps) {
      return { 
        isComplete: true, 
        reason: `Reached maximum steps (${this.maxSteps})`,
        stepCount: this.stepCount 
      };
    }
    
    if (this.lastResponseWithoutTools >= this.maxResponsesWithoutTools) {
      return { 
        isComplete: true, 
        reason: `No tool usage for ${this.maxResponsesWithoutTools} responses`,
        stepCount: this.stepCount 
      };
    }
    
    return { isComplete: false, stepCount: this.stepCount };
  }
  
  /**
   * Manually marks the task as complete.
   */
  forceComplete(reason?: string): void {
    this.state = TaskState.COMPLETED;
    if (reason) {
      console.log(`\n✅ Task completed: ${reason}`);
    }
  }
  
  /**
   * Determines if the task should continue automatically.
   */
  shouldContinueAutomatically(response: string, toolUsed?: string): boolean {
    if (this.state !== TaskState.IN_PROGRESS && 
        this.state !== TaskState.AWAITING_TOOL) {
      return false;
    }
    
    // Don't continue if we've hit hard safety limits
    if (this.stepCount >= this.maxSteps) {
      return false;
    }
    
    const lowerResponse = response.toLowerCase();
    
    // Don't continue if there are very explicit stopping indicators
    if (this.hasExplicitCompletionSignal(response)) {
      return false;
    }
    
    // AGGRESSIVE CONTINUATION for project tasks
    if (this.isProjectCreationTask()) {
      // Continue if we just used a tool
      if (toolUsed && this.continuationTools.some(tool => toolUsed.includes(tool))) {
        return true;
      }
      
      // Continue if we're in early stages (< 10 steps for complex projects)
      if (this.stepCount < 10 && this.completedSteps.length > 0) {
        // Continue if response suggests more work needed
        if (lowerResponse.includes('now i') || 
            lowerResponse.includes('next i') || 
            lowerResponse.includes('i will') ||
            lowerResponse.includes('let me') ||
            lowerResponse.includes('i need to') ||
            lowerResponse.includes('i should')) {
          return true;
        }
        
        // Continue if just created a directory but no files yet
        if (this.lastToolUsed === 'create_directory' && 
            !this.toolsUsed.includes('write_file')) {
          return true;
        }
        
        // Continue if created some files but probably need more
        const fileToolsUsed = this.toolsUsed.filter(tool => 
          tool.includes('write_file') || tool.includes('create')).length;
        if (fileToolsUsed > 0 && fileToolsUsed < 5) {
          return true;
        }
      }
    }
    
    // Standard continuation logic
    if (toolUsed && this.continuationTools.some(tool => toolUsed.includes(tool))) {
      return true;
    }
    
    // Check for continuation indicators
    if (this.continuationPatterns.some(pattern => lowerResponse.includes(pattern))) {
      return true;
    }
    
    // Continue if response indicates work in progress
    if (lowerResponse.includes('creating') ||
        lowerResponse.includes('setting up') ||
        lowerResponse.includes('configuring') ||
        lowerResponse.includes('installing')) {
      return true;
    }
    
    // Don't continue if we have many responses without tools AND no indication of more work
    if (this.consecutiveNonToolResponses >= 3 && 
        !this.hasContinuationIndicators(response)) {
      return false;
    }
    
    return false;
  }
  
  /**
   * Checks if a task is currently active.
   */
  isTaskActive(): boolean {
    return this.state === TaskState.IN_PROGRESS || 
           this.state === TaskState.AWAITING_TOOL || 
           this.state === TaskState.STARTING;
  }
  
  /**
   * Gets the current task context.
   */
  getTaskContext(): TaskContext {
    return {
      isMultiStep: this.isTaskActive(),
      taskDescription: this.taskDescription,
      completedSteps: this.completedSteps,
      nextSteps: this.nextSteps,
      isComplete: this.state === TaskState.COMPLETED
    };
  }
  
  /**
   * Configuration methods for adding patterns and tools.
   */
  
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