#!/usr/bin/env node

/**
 * Test runner script for local-agent
 * Provides enhanced test running capabilities with better output formatting
 */

const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log(colorize('\n🧪 Local Agent Test Suite', 'cyan'));
  console.log(colorize('=' .repeat(50), 'blue'));
}

function printUsage() {
  console.log(colorize('\nUsage:', 'yellow'));
  console.log('  npm run test:runner [options]');
  console.log('\nOptions:');
  console.log('  --coverage     Run tests with coverage report');
  console.log('  --watch        Run tests in watch mode');
  console.log('  --verbose      Run tests with verbose output');
  console.log('  --file <name>  Run specific test file');
  console.log('  --help         Show this help message');
  console.log('\nExamples:');
  console.log('  npm run test:runner');
  console.log('  npm run test:runner -- --coverage');
  console.log('  npm run test:runner -- --file initialization');
  console.log('  npm run test:runner -- --watch --verbose');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    coverage: false,
    watch: false,
    verbose: false,
    file: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--coverage':
        options.coverage = true;
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--file':
        options.file = args[++i];
        break;
      case '--help':
        options.help = true;
        break;
    }
  }

  return options;
}

function buildJestArgs(options) {
  const args = [];

  if (options.coverage) {
    args.push('--coverage');
  }

  if (options.watch) {
    args.push('--watch');
  }

  if (options.verbose) {
    args.push('--verbose');
  }

  if (options.file) {
    args.push(`--testNamePattern=${options.file}`);
  }

  // Always use colors in output
  args.push('--colors');

  return args;
}

function runTests(options) {
  const jestArgs = buildJestArgs(options);
  
  console.log(colorize('\n📋 Test Configuration:', 'yellow'));
  console.log(`Coverage: ${options.coverage ? colorize('✓', 'green') : colorize('✗', 'red')}`);
  console.log(`Watch Mode: ${options.watch ? colorize('✓', 'green') : colorize('✗', 'red')}`);
  console.log(`Verbose: ${options.verbose ? colorize('✓', 'green') : colorize('✗', 'red')}`);
  console.log(`Specific File: ${options.file ? colorize(options.file, 'cyan') : colorize('All files', 'blue')}`);
  
  console.log(colorize('\n🚀 Starting tests...', 'green'));
  console.log(colorize('-'.repeat(50), 'blue'));

  const jest = spawn('npx', ['jest', ...jestArgs], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    shell: true
  });

  jest.on('close', (code) => {
    console.log(colorize('\n' + '='.repeat(50), 'blue'));
    
    if (code === 0) {
      console.log(colorize('✅ All tests passed!', 'green'));
      
      if (options.coverage) {
        console.log(colorize('\n📊 Coverage report generated in ./coverage/', 'cyan'));
        console.log(colorize('   Open ./coverage/lcov-report/index.html to view detailed coverage', 'blue'));
      }
    } else {
      console.log(colorize('❌ Some tests failed!', 'red'));
      console.log(colorize('   Check the output above for details', 'yellow'));
    }
    
    process.exit(code);
  });

  jest.on('error', (error) => {
    console.error(colorize('❌ Failed to start test runner:', 'red'));
    console.error(error.message);
    process.exit(1);
  });
}

function printTestInfo() {
  console.log(colorize('\n📁 Test Files:', 'yellow'));
  console.log('  • initialization.test.ts - File validation and MCP tool loading');
  console.log('  • memory.test.ts - Session logging and memory management');
  console.log('  • types.test.ts - TypeScript schemas and validation');
  console.log('  • default-configs.test.ts - Default configuration validation');
  console.log('  • interactions.test.ts - Interactive session management');
  console.log('  • cli.test.ts - Main CLI entry point');
  
  console.log(colorize('\n🎯 Coverage Goals:', 'yellow'));
  console.log('  • Statements: >90%');
  console.log('  • Branches: >85%');
  console.log('  • Functions: >90%');
  console.log('  • Lines: >90%');
}

function main() {
  const options = parseArgs();

  printHeader();

  if (options.help) {
    printUsage();
    printTestInfo();
    return;
  }

  // Check if Jest is available
  try {
    require.resolve('jest');
  } catch (error) {
    console.error(colorize('❌ Jest is not installed!', 'red'));
    console.error(colorize('   Run: npm install', 'yellow'));
    process.exit(1);
  }

  runTests(options);
}

// Handle process signals
process.on('SIGINT', () => {
  console.log(colorize('\n\n👋 Test runner interrupted', 'yellow'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(colorize('\n\n👋 Test runner terminated', 'yellow'));
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { runTests, parseArgs, buildJestArgs };