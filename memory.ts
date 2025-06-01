import { writeFileSync, appendFileSync } from "fs";

/**
 * Create a new session memory file and write the session header.
 * Returns the session file path.
 */
export function createSessionFile(now: Date, toolRow: string, toolStatusMd: string, agentName: string): string {
  const sessionFile = `memory/session-${now.toISOString().replace(/[:.]/g, "-")}.md`;
  let header = `# ${agentName} Session – ${now.toLocaleString()}\n\n${toolRow}\n\n## Tools Loaded\n\n${toolStatusMd}\n`;
  writeFileSync(sessionFile, header, "utf8");
  return sessionFile;
}

/**
 * Append a tool usage entry to the session memory file.
 */
export function logToolUsed(sessionFile: string, toolName: string) {
  appendFileSync(sessionFile, `## Tool Used\n\n${toolName}\n\n`, "utf8");
}

/**
 * Append an agent response to the session memory file.
 */
export function logAgentResponse(sessionFile: string, response: string) {
  appendFileSync(sessionFile, `## Agent\n\n${response}\n\n`, "utf8");
}

/**
 * Append an error to the session memory file.
 */
export function logAgentError(sessionFile: string, errMsg: string) {
  appendFileSync(sessionFile, `## Agent (error)\n\n${errMsg}\n\n`, "utf8");
}