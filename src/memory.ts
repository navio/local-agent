/**
 * @fileoverview
 * Provides utilities for session memory logging.
 * Handles creation of session files and appending user prompts, tool usage, agent responses, and errors.
 */
import { writeFileSync, appendFileSync } from "fs";

/**
 * Creates a new session memory file and writes the session header.
 * The file is named with the current timestamp and stored in the memory directory.
 *
 * @param {Date} now - The current date and time.
 * @param {string} toolRow - A summary row listing all tools and their status.
 * @param {string} toolStatusMd - Markdown-formatted details of tool load status.
 * @param {string} agentName - The display name of the agent.
 * @returns {string} The path to the created session file.
 */
export function createSessionFile(now: Date, toolRow: string, toolStatusMd: string, agentName: string): string {
  const sessionFile = `memory/session-${now.toISOString().replace(/[:.]/g, "-")}.md`;
  let header = `# ${agentName} Session – ${now.toLocaleString()}\n\n${toolRow}\n\n## Tools Loaded\n\n${toolStatusMd}\n`;
  writeFileSync(sessionFile, header, "utf8");
  return sessionFile;
}

/**
 * Appends a user prompt to the session memory file.
 *
 * @param {string} sessionFile - Path to the session file.
 * @param {string} prompt - The user's input prompt.
 */
export function logUserPrompt(sessionFile: string, prompt: string) {
  appendFileSync(sessionFile, `## User\n\n${prompt}\n\n`, "utf8");
}

/**
 * Appends a tool usage entry to the session memory file.
 *
 * @param {string} sessionFile - Path to the session file.
 * @param {string} toolName - The name of the tool used.
 */
export function logToolUsed(sessionFile: string, toolName: string) {
  appendFileSync(sessionFile, `## Tool Used\n\n${toolName}\n\n`, "utf8");
}

/**
 * Appends an agent response to the session memory file.
 *
 * @param {string} sessionFile - Path to the session file.
 * @param {string} response - The agent's response text.
 */
export function logAgentResponse(sessionFile: string, response: string) {
  appendFileSync(sessionFile, `## Agent\n\n${response}\n\n`, "utf8");
}

/**
 * Appends an error message to the session memory file.
 *
 * @param {string} sessionFile - Path to the session file.
 * @param {string} errMsg - The error message to log.
 */
export function logAgentError(sessionFile: string, errMsg: string) {
  appendFileSync(sessionFile, `## Agent (error)\n\n${errMsg}\n\n`, "utf8");
}