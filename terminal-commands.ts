/**
 * @fileoverview
 * Provides terminal command detection and execution for the agent CLI.
 * Allows users to run standard terminal commands directly through the agent interface.
 */
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import { existsSync } from 'fs';

// Create a promise-based version of exec
const execPromise = promisify(exec);

// Common terminal commands that should be executed directly
const TERMINAL_COMMANDS = [
  // File system commands
  'ls', 'dir', 'cd', 'pwd', 'mkdir', 'rmdir', 'touch', 'rm', 'cp', 'mv', 'cat', 'less', 'more',
  'head', 'tail', 'find', 'grep', 'awk', 'sed', 'diff', 'chmod', 'chown',
  
  // Navigation commands
  'cd', 'pushd', 'popd', 'dirs',
  
  // Package managers
  'npm', 'yarn', 'pnpm', 'bun', 'pip', 'pip3', 'gem', 'bundle', 'cargo', 'go',
  
  // Git commands
  'git', 'svn', 'hg',
  
  // Process management
  'ps', 'top', 'htop', 'kill', 'pkill',
  
  // Network commands
  'ping', 'curl', 'wget', 'ssh', 'netstat', 'ifconfig', 'ip',
  
  // System commands
  'echo', 'date', 'whoami', 'hostname', 'uname', 'df', 'du', 'free',
  
  // Archiving and compression
  'tar', 'gzip', 'gunzip', 'zip', 'unzip',
  
  // Shell built-ins and other common commands
  'alias', 'bg', 'fg', 'jobs', 'history', 'clear', 'env', 'export', 'source',
  'sudo', 'su', 'man', 'info', 'which', 'whereis', 'type',
  
  // Text editors
  'vi', 'vim', 'nano', 'emacs', 'code'
];

// Known shell built-ins that require special handling
const SHELL_BUILTINS = ['cd', 'export', 'source', 'alias', 'unalias', 'set', 'unset'];

// Keep track of the current working directory
let currentWorkingDirectory = process.cwd();

/**
 * Determines if a user input is a terminal command.
 * Checks if the input starts with a known terminal command or appears to be a terminal command pattern.
 *
 * @param {string} input - The user input to check.
 * @returns {boolean} True if the input appears to be a terminal command.
 */
export function isTerminalCommand(input: string): boolean {
  const trimmedInput = input.trim();
  
  // Skip empty inputs
  if (!trimmedInput) return false;
  
  // Check for command with parameters
  const firstWord = trimmedInput.split(' ')[0];
  
  // Direct match with known command
  if (TERMINAL_COMMANDS.includes(firstWord)) {
    return true;
  }
  
  // Check for relative/absolute paths (common in terminal usage)
  if (trimmedInput.startsWith('./') || 
      trimmedInput.startsWith('../') || 
      trimmedInput.startsWith('/') ||
      /^[a-zA-Z]:\\/.test(trimmedInput)) {
    return true;
  }
  
  // Check for environment variables assignment (VAR=value)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*=/.test(trimmedInput)) {
    return true;
  }
  
  // Check for pipes and redirections (common in terminal usage)
  if (trimmedInput.includes('|') || 
      trimmedInput.includes('>') || 
      trimmedInput.includes('<')) {
    return true;
  }
  
  // Check for executable in PATH
  if (isExecutableInPath(firstWord)) {
    return true;
  }
  
  return false;
}

/**
 * Checks if a command is an executable in the PATH.
 *
 * @param {string} command - The command to check.
 * @returns {boolean} True if the command is found in PATH.
 */
function isExecutableInPath(command: string): boolean {
  // Skip obviously non-executable strings
  if (!command || command.includes(' ') || command.length < 2) {
    return false;
  }
  
  // Get PATH environment variable
  const envPath = process.env.PATH || '';
  const pathSeparator = os.platform() === 'win32' ? ';' : ':';
  const pathExtensions = os.platform() === 'win32' 
    ? (process.env.PATHEXT || '.exe;.cmd;.bat').split(';') 
    : [''];
  const paths = envPath.split(pathSeparator);
  
  // Check if the command exists in any of the PATH directories
  for (const directory of paths) {
    for (const ext of pathExtensions) {
      const fullPath = path.join(directory, command + ext);
      if (existsSync(fullPath)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Handles the special case of changing directory (cd command).
 * Updates the current working directory for the process.
 *
 * @param {string} command - The full cd command with arguments.
 * @returns {string} Message about the directory change.
 */
function handleCdCommand(command: string): string {
  const parts = command.trim().split(' ');
  
  // Extract the target directory
  let targetDir = parts.slice(1).join(' ').trim();
  
  // Handle special cases
  if (!targetDir || targetDir === '~') {
    targetDir = os.homedir();
  } else if (targetDir.startsWith('~')) {
    targetDir = path.join(os.homedir(), targetDir.substring(1));
  } else if (!path.isAbsolute(targetDir)) {
    targetDir = path.resolve(currentWorkingDirectory, targetDir);
  }
  
  // Check if directory exists
  if (!existsSync(targetDir)) {
    return `cd: ${parts[1]}: No such file or directory`;
  }
  
  try {
    // Update the current working directory
    process.chdir(targetDir);
    currentWorkingDirectory = process.cwd();
    return `Changed directory to ${currentWorkingDirectory}`;
  } catch (error) {
    return `cd: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Executes a terminal command and returns the result.
 * Handles special cases like 'cd' that change the environment state.
 *
 * @param {string} command - The command to execute.
 * @returns {Promise<{stdout: string, stderr: string}>} The command execution result.
 */
export async function executeTerminalCommand(command: string): Promise<{stdout: string, stderr: string}> {
  // Trim the command
  const trimmedCommand = command.trim();
  
  // Handle empty commands
  if (!trimmedCommand) {
    return { stdout: '', stderr: '' };
  }
  
  // Special handling for cd command
  if (trimmedCommand.startsWith('cd ') || trimmedCommand === 'cd') {
    const result = handleCdCommand(trimmedCommand);
    return { stdout: result, stderr: '' };
  }
  
  try {
    // Execute the command in the current working directory
    const { stdout, stderr } = await execPromise(trimmedCommand, { cwd: currentWorkingDirectory });
    return { stdout, stderr };
  } catch (error) {
    // Handle command execution errors
    if (error instanceof Error) {
      const execError = error as any;
      return {
        stdout: execError.stdout || '',
        stderr: execError.stderr || error.message
      };
    }
    return {
      stdout: '',
      stderr: error ? String(error) : 'Unknown error occurred'
    };
  }
}

/**
 * Executes a terminal command interactively, attaching stdin/stdout/stderr.
 * Useful for commands that require user interaction.
 *
 * @param {string} command - The command to execute.
 * @param {string[]} args - Arguments for the command.
 * @returns {Promise<number>} Exit code of the process.
 */
export function executeInteractiveCommand(command: string, args: string[] = []): Promise<number> {
  return new Promise((resolve) => {
    const childProcess = spawn(command, args, {
      cwd: currentWorkingDirectory,
      stdio: 'inherit', // Attach to parent process I/O
      shell: true
    });
    
    childProcess.on('close', (code) => {
      resolve(code || 0);
    });
  });
}

/**
 * Returns the current working directory.
 * 
 * @returns {string} The current working directory.
 */
export function getCurrentWorkingDirectory(): string {
  return currentWorkingDirectory;
}