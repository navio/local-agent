# localagent Scripts Reference

This document lists all available npm scripts for the localagent project.

## Development Scripts

### `npm run dev`
Run the CLI in development mode using tsx (TypeScript execution)
```bash
npm run dev
```

### `npm run dev:bun`
Run the CLI in development mode using Bun (direct TypeScript execution)
```bash
npm run dev:bun
```

## Build Scripts

### `npm run build`
Compile TypeScript files to JavaScript in the `dist/` directory
```bash
npm run build
```

### `npm run build:clean`
Clean the dist directory and rebuild everything
```bash
npm run build:clean
```

### `npm run create-bin`
Generate the runtime detection wrapper in `bin/localagent.js`
```bash
npm run create-bin
```

## Testing Scripts

### `npm run test:build`
Test the complete build process (compile + create bin wrapper)
```bash
npm run test:build
```

### `npm run test:node`
Test the compiled Node.js version
```bash
npm run test:node
```

### `npm run test:bun`
Test the Bun TypeScript version
```bash
npm run test:bun
```

### `npm run test:bin`
Test the bin wrapper (runtime detection)
```bash
npm run test:bin
```

## Production Scripts

### `npm run start`
Run the compiled Node.js version
```bash
npm run start
```

### `npm run start:bun`
Run the Bun TypeScript version
```bash
npm run start:bun
```

## Package Management Scripts

### `npm run package`
Create an npm package tarball
```bash
npm run package
```

### `npm run package:test`
Create package and install it globally for testing
```bash
npm run package:test
```

## Release Scripts

### `npm run release:prepare`
Prepare for release (clean build + package)
```bash
npm run release:prepare
```

### `npm run release:test`
Full release test (prepare + global install test)
```bash
npm run release:test
```

## Maintenance Scripts

### `npm run clean`
Remove all generated files and dependencies
```bash
npm run clean
```

### `npm run reset`
Clean everything and reinstall dependencies
```bash
npm run reset
```

### `npm run setup`
Complete setup from scratch (install + build + create bin)
```bash
npm run setup
```

## Quick Start Workflow

1. **First time setup:**
   ```bash
   npm run setup
   ```

2. **Development:**
   ```bash
   npm run dev
   # or for Bun users:
   npm run dev:bun
   ```

3. **Testing builds:**
   ```bash
   npm run test:build
   npm run test:node
   npm run test:bin
   ```

4. **Preparing for release:**
   ```bash
   npm run release:test
   ```

5. **Publishing to npm:**
   ```bash
   npm publish
   ```

## Runtime Detection

The bin wrapper (`bin/localagent.js`) automatically detects the best runtime:
- **Bun available + TypeScript source exists**: Runs `bun cli.ts`
- **Node.js fallback**: Runs `node dist/cli.js`
- **Error handling**: Shows helpful error messages if neither option works