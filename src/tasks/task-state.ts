/**
 * @fileoverview
 * Task state definitions and types for the task management system.
 */

/**
 * Possible states for a task in the task management system.
 */
export enum TaskState {
  IDLE = 'idle',
  STARTING = 'starting',
  IN_PROGRESS = 'in_progress',
  AWAITING_TOOL = 'awaiting_tool',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Context information about the current task.
 */
export interface TaskContext {
  isMultiStep: boolean;
  taskDescription: string;
  completedSteps: string[];
  nextSteps: string[];
  isComplete: boolean;
}