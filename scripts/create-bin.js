const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, '..', 'bin');
const binFile = path.join(binDir, 'localagent.js');

const wrapperScript = `#!/usr/bin/env node

require('../dist/cli.js');
`;

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

fs.writeFileSync(binFile, wrapperScript);
fs.chmodSync(binFile, '755');

console.log('Created simple bin script at:', binFile);