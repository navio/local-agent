#!/usr/bin/env node
/**
 * Helper script to launch the agent with the shell's native prompt
 * 
 * This script:
 * 1. Captures the current shell's prompt (PS1)
 * 2. Sets up environment variables for the agent
 * 3. Launches the agent
 */

const { spawn } = require('child_process');
const { resolve } = require('path');

// Main function
async function main() {
  try {
    // Get the shell's PS1 prompt
    const shellPrompt = process.env.PS1 || '';
    
    // Pass the shell prompt to the agent
    const env = { 
      ...process.env,
      SHELL_PROMPT: shellPrompt,
      USE_SHELL_PROMPT: 'true'
    };
    
    // Launch the agent with the current shell's environment
    const agentPath = resolve(__dirname, 'cli.ts');
    const agent = spawn('bun', [agentPath], {
      env,
      stdio: 'inherit',
      shell: true
    });
    
    // Handle agent exit
    agent.on('close', (code) => {
      process.exit(code);
    });
  } catch (error) {
    console.error('Error launching agent:', error);
    process.exit(1);
  }
}

main();