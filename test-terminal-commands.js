#!/usr/bin/env node
/**
 * Simple test script for verifying terminal command detection and execution.
 * This script tests the isTerminalCommand and executeTerminalCommand functions
 * from the terminal-commands.ts file.
 */

// Dynamically import the ESM module (terminal-commands.ts is TypeScript)
async function runTests() {
  try {
    console.log('Testing terminal command detection and execution...\n');
    
    // This requires the terminal-commands.ts file to be compiled to JS first
    // You can compile it using: npx tsc terminal-commands.ts --module ESNext
    const { isTerminalCommand, executeTerminalCommand, getCurrentWorkingDirectory } = 
      await import('./terminal-commands.js');
    
    // Test command detection
    const testCommands = [
      'ls -la', 
      'echo "hello world"', 
      'cd /tmp',
      'pwd',
      'what is the weather today?',
      'How do I create a React application?',
      './script.sh',
      'node -v',
      'VAR=value echo $VAR',
      'grep pattern file.txt',
      'find . -name "*.js"'
    ];
    
    console.log('Testing command detection:');
    for (const cmd of testCommands) {
      const isCmd = isTerminalCommand(cmd);
      console.log(`"${cmd}" ${isCmd ? 'IS' : 'is NOT'} detected as a terminal command`);
    }
    
    // Test command execution
    console.log('\nTesting command execution:');
    const commandsToRun = ['pwd', 'echo "Current directory:"', 'ls -la'];
    
    console.log(`Current working directory: ${getCurrentWorkingDirectory()}`);
    
    for (const cmd of commandsToRun) {
      console.log(`\nExecuting: ${cmd}`);
      try {
        const result = await executeTerminalCommand(cmd);
        if (result.stdout) console.log(`stdout: ${result.stdout}`);
        if (result.stderr) console.error(`stderr: ${result.stderr}`);
      } catch (error) {
        console.error(`Error executing command: ${error.message}`);
      }
    }
    
    // Test directory change
    console.log('\nTesting directory change:');
    console.log(`Starting directory: ${getCurrentWorkingDirectory()}`);
    
    await executeTerminalCommand('cd ..');
    console.log(`After 'cd ..': ${getCurrentWorkingDirectory()}`);
    
    await executeTerminalCommand('cd -');
    console.log(`After 'cd -': ${getCurrentWorkingDirectory()}`);
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Error running tests:', error);
    console.error('\nMake sure to compile the TypeScript file first:');
    console.error('npx tsc terminal-commands.ts --module ESNext');
  }
}

runTests();