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
  private maxSteps: number = 20; // Prevent infinite loops
  private lastResponseWithoutTools: number = 0; // Track responses without tool usage
  private maxResponsesWithoutTools: number = 3; // Stop if too many responses without tools
  
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
    
    // Track responses without tool usage
    if (!toolUsed) {
      this.lastResponseWithoutTools++;
    } else {
      this.lastResponseWithoutTools = 0;
    }
    
    // Check for completion conditions
    if (this.isTaskComplete(response)) {
      this.completeTask();
      return;
    }
    
    // Check for safety limits to prevent infinite loops
    if (this.stepCount >= this.maxSteps) {
      console.log(`\n⚠️ Task has reached maximum step limit (${this.maxSteps}). Marking as complete.`);
      this.completeTask();
      return;
    }
    
    if (this.lastResponseWithoutTools >= this.maxResponsesWithoutTools) {
      console.log(`\n⚠️ Task appears to be complete (no tool usage for ${this.maxResponsesWithoutTools} responses).`);
      this.completeTask();
      return;
    }
    
    // Update task progress based on response
    this.updateTaskProgress(response, toolUsed);
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
   * Checks if the task is complete based on the response.
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
    
    // If we have a project creation task, check for specific completion indicators
    if (this.taskDescription.toLowerCase().includes('create') || 
        this.taskDescription.toLowerCase().includes('build') ||
        this.taskDescription.toLowerCase().includes('setup')) {
      
      // Check if response indicates all files are created and ready
      if (lowerResponse.includes('package.json') && 
          (lowerResponse.includes('created') || lowerResponse.includes('ready')) &&
          !lowerResponse.includes('will') && 
          !lowerResponse.includes('next')) {
        return true;
      }
      
      // Check if response mentions testing or running the application
      if ((lowerResponse.includes('run') || lowerResponse.includes('test') || 
           lowerResponse.includes('start')) && 
          (lowerResponse.includes('npm') || lowerResponse.includes('bun') || 
           lowerResponse.includes('yarn'))) {
        return true;
      }
    }
    
    // If no clear continuation indicators and we have completed steps, might be done
    if (this.completedSteps.length > 0 && 
        !this.hasContinuationIndicators(response) &&
        !lowerResponse.includes('will') &&
        !lowerResponse.includes('next')) {
      
      // Additional check: if response is providing final instructions or summary
      if (lowerResponse.includes('you can') || 
          lowerResponse.includes('to run') ||
          lowerResponse.includes('to start') ||
          lowerResponse.includes('to test')) {
        return true;
      }
    }
    
    return false;
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
    
    // Don't continue if we've hit safety limits
    if (this.stepCount >= this.maxSteps || 
        this.lastResponseWithoutTools >= this.maxResponsesWithoutTools) {
      return false;
    }
    
    const lowerResponse = response.toLowerCase();
    
    // Don't continue if there are clear stopping indicators
    if (this.stoppingPatterns.some(pattern => lowerResponse.includes(pattern))) {
      return false;
    }
    
    // Don't continue if task seems complete based on context
    if (this.isTaskComplete(response)) {
      return false;
    }
    
    // If a continuation tool was just used, likely need to continue
    if (toolUsed && this.continuationTools.some(tool => toolUsed.includes(tool))) {
      return true;
    }
    
    // Check for continuation indicators
    if (this.continuationPatterns.some(pattern => lowerResponse.includes(pattern))) {
      return true;
    }
    
    // For project creation tasks, continue if we have clear next steps
    if ((this.taskDescription.toLowerCase().includes('create') || 
         this.taskDescription.toLowerCase().includes('build')) &&
        this.completedSteps.length > 0 && 
        this.completedSteps.length < 5 && // Don't go on forever
        toolUsed) {
      return true;
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