/**
 * @fileoverview
 * Script to create a simple executable wrapper for the local agent CLI.
 * Generates a bin/local-agent.js file that invokes the compiled CLI entry point.
 * Intended for use in npm package postinstall or setup scripts.
 */
const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, '..', 'bin');
const binFile = path.join(binDir, 'local-agent.js');

const wrapperScript = `#!/usr/bin/env node

require('../dist/cli.js');
`;

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

fs.writeFileSync(binFile, wrapperScript);
fs.chmodSync(binFile, '755');

console.log('Created simple bin script at:', binFile);