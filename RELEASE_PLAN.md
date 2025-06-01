# Release Plan for localagent

## Package.json Configuration

The current `package.json` needs to be updated with the following configuration for npm release:

```json
{
  "name": "localagent",
  "version": "1.0.0",
  "description": "A CLI agentic system for orchestrating tools and memory with per-folder scoping",
  "main": "dist/cli.js",
  "bin": {
    "localagent": "./bin/localagent.js"
  },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build && npm run create-bin",
    "create-bin": "mkdir -p bin && node scripts/create-bin.js",
    "start": "node dist/cli.js",
    "start:bun": "bun cli.ts",
    "dev": "tsx cli.ts",
    "dev:bun": "bun cli.ts"
  },
  "files": [
    "dist/**/*",
    "bin/**/*",
    "cli.ts",
    "*.ts",
    "README.md",
    "ARCHITECTURE.md"
  ],
  "keywords": [
    "cli",
    "agent",
    "mcp",
    "agentic",
    "tools",
    "memory",
    "ai"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/localagent.git"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.15.29",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  },
  "dependencies": {
    "@agentic/ai-sdk": "^7.6.5",
    "@agentic/mcp": "^7.6.5",
    "@agentic/stdlib": "^7.6.5",
    "@ai-sdk/openai": "^1.3.22",
    "ai": "^4.3.16",
    "dotenv": "^16.5.0",
    "zod": "^3.25.42"
  },
  "bun": {
    "bin": {
      "localagent": "cli.ts"
    }
  }
}
```

## Bin Wrapper Script

Create a `scripts/create-bin.js` file to generate the runtime-aware wrapper:

```javascript
const fs = require('fs');
const path = require('path');

const binDir = path.join(__dirname, '..', 'bin');
const binFile = path.join(binDir, 'localagent.js');

const wrapperScript = `#!/usr/bin/env node

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
`;

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

fs.writeFileSync(binFile, wrapperScript);
fs.chmodSync(binFile, '755');

console.log('Created bin wrapper script at:', binFile);
```

## TypeScript Configuration

Create a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": [
    "*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

## CLI Entry Point

The `cli.ts` file needs a shebang line at the top for proper CLI execution:

```typescript
#!/usr/bin/env bun
import 'dotenv/config'
// ... rest of the file
```

Note: The shebang uses `bun` since Bun can execute TypeScript directly. The bin wrapper will handle runtime detection.

## Build Process

1. **TypeScript Compilation**: The `tsc` command will transpile TypeScript files to JavaScript in the `dist/` directory.

2. **Bin Wrapper Creation**: The `create-bin` script generates a runtime-aware wrapper that detects Bun vs Node.js.

3. **Pre-publish Hook**: The `prepublishOnly` script ensures the project is built and bin wrapper is created before publishing.

4. **File Inclusion**: The `files` field specifies which files are included in the npm package, including both TypeScript source and compiled JavaScript.

5. **Runtime Detection**: The bin wrapper automatically chooses:
   - **Bun + TypeScript**: If Bun is available, runs `cli.ts` directly
   - **Node.js + JavaScript**: Falls back to transpiled `dist/cli.js`

## Release Steps

### 1. Prepare for Release

```bash
# Install TypeScript and build tools
npm install -D typescript tsx

# Build the project and create bin wrapper
npm run build
npm run create-bin

# Test with Bun (if available)
bun cli.ts

# Test with Node.js
node dist/cli.js

# Test the bin wrapper
node bin/localagent.js
```

### 2. Test Installation

```bash
# Test global installation locally
npm pack
npm install -g localagent-1.0.0.tgz

# Test with Bun (if available)
localagent

# Test with Node.js fallback
localagent

# Test npx usage
npx ./localagent-1.0.0.tgz
```

### 3. Publish to npm

```bash
# Login to npm (if not already logged in)
npm login

# Publish the package
npm publish
```

### 4. Verify Publication

```bash
# Test the published package
npx localagent
```

## Runtime Compatibility

- **Bun Support**: Direct TypeScript execution with `#!/usr/bin/env bun` shebang
- **Node.js Fallback**: Transpiled JavaScript in CommonJS format for Node.js compatibility
- **Runtime Detection**: Automatic detection and preference for Bun when available
- **Engine Requirements**: Node.js 18+ or Bun 1.0+ for modern features
- **Dual Distribution**: Ships with both TypeScript source and compiled JavaScript

## Directory Structure After Build

```
/localagent/
├── bin/
│   └── localagent.js       # Runtime detection wrapper
├── dist/
│   ├── cli.js              # Transpiled CLI entry point
│   ├── cli.js.map          # Source map
│   ├── cli.d.ts            # Type declarations
│   ├── initialization.js   # Transpiled modules
│   ├── interactions.js
│   ├── memory.js
│   ├── types.js
│   └── default-configs.js
├── scripts/
│   └── create-bin.js       # Bin wrapper generator
├── cli.ts                  # Source TypeScript files (Bun entry point)
├── initialization.ts
├── interactions.ts
├── memory.ts
├── types.ts
├── default-configs.ts
├── package.json
├── tsconfig.json
├── README.md
└── ARCHITECTURE.md
```

## Additional Dependencies Needed

The existing dependencies are sufficient. The `readline` module is built into Node.js and Bun.

## Bun-Specific Features

- **Direct TypeScript Execution**: Bun can run `.ts` files without compilation
- **Fast Startup**: Bun's fast startup time improves CLI responsiveness
- **Built-in TypeScript**: No need for additional TypeScript runtime dependencies
- **Native Performance**: Bun's native performance benefits for file operations and tool loading

## Testing the Release

1. **Runtime Testing**: Test with both Bun and Node.js runtimes
2. **Local Testing**: Test the built CLI locally before publishing
3. **Fresh Environment**: Test installation in a fresh directory to ensure all dependencies are included
4. **Cross-Platform**: Test on different operating systems if possible
5. **Version Management**: Use semantic versioning for releases
6. **Bun Availability**: Test behavior when Bun is and isn't available

### Test Commands

```bash
# Test with Bun directly
bun cli.ts

# Test Node.js fallback
node dist/cli.js

# Test bin wrapper detection
node bin/localagent.js

# Test npm installation
npm pack && npm install -g localagent-*.tgz
localagent

# Test npx usage
npx localagent
```

## Post-Release

1. **Documentation**: Ensure README.md is up to date with installation instructions.
2. **GitHub Release**: Create a GitHub release with changelog.
3. **Monitor**: Watch for issues and user feedback.
4. **Updates**: Plan for future releases with bug fixes and features.