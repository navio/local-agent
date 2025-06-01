#!/usr/bin/env node

// Runtime detection wrapper for localagent
const { spawn } = require('child_process');
const path = require('path');

// Check if Bun is available and prefer it for TypeScript execution
function hasBun() {
  try {
    require('child_process').execSync('bun --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const projectRoot = path.dirname(__filename);
const tsFile = path.join(projectRoot, '..', 'cli.ts');
const jsFile = path.join(projectRoot, '..', 'dist', 'cli.js');

// Prefer Bun for direct TypeScript execution if available
if (hasBun() && require('fs').existsSync(tsFile)) {
  const child = spawn('bun', [tsFile], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
} else if (require('fs').existsSync(jsFile)) {
  // Fallback to Node.js with transpiled JavaScript
  require(jsFile);
} else {
  console.error('Error: Neither TypeScript source nor compiled JavaScript found.');
  console.error('Please run "npm run build" or ensure Bun is installed.');
  process.exit(1);
}
