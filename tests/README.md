# Test Suite Documentation

This directory contains comprehensive tests for all features of the local-agent CLI system.

## Test Structure

### Core Module Tests

1. **`initialization.test.ts`** - Tests for the initialization module
   - File validation and creation
   - MCP tool loading
   - Configuration parsing
   - Error handling

2. **`memory.test.ts`** - Tests for the memory/logging module
   - Session file creation
   - User prompt logging
   - Tool usage logging
   - Agent response logging
   - Error logging

3. **`types.test.ts`** - Tests for TypeScript types and schemas
   - Zod schema validation
   - Type interface compliance
   - Configuration validation
   - Edge case handling

4. **`default-configs.test.ts`** - Tests for default configuration values
   - Default agent configuration
   - Default MCP tools setup
   - Default API keys structure
   - Environment-specific configurations

5. **`interactions.test.ts`** - Tests for the interactive session module
   - Readline interface setup
   - User input processing
   - Multi-step task detection
   - Model provider selection
   - Session management

6. **`cli.test.ts`** - Tests for the main CLI entry point
   - Help option handling
   - Main function execution flow
   - Environment variable setup
   - Integration testing

### Test Features Covered

#### Initialization Module
- ✅ Missing file detection
- ✅ Project file creation with default content
- ✅ Configuration file validation and parsing
- ✅ MCP tool loading and error handling
- ✅ User prompts for initialization
- ✅ Color output constants

#### Memory Module
- ✅ Session file creation with timestamps
- ✅ User prompt logging
- ✅ Tool usage tracking
- ✅ Agent response logging
- ✅ Error message logging
- ✅ Markdown formatting
- ✅ Integration flow testing

#### Types Module
- ✅ GenerateTextParams schema validation
- ✅ MCP server definition validation
- ✅ Tools configuration validation
- ✅ API keys configuration validation
- ✅ Type interface compliance
- ✅ Edge case and error handling

#### Default Configs Module
- ✅ Default agent configuration validation
- ✅ System prompt comprehensiveness
- ✅ MCP tools configuration
- ✅ Environment-specific path handling
- ✅ Security validation (no hardcoded keys)
- ✅ Schema compliance

#### Interactions Module
- ✅ Readline interface initialization
- ✅ Event listener setup
- ✅ User input processing
- ✅ Multi-step task detection
- ✅ Task continuation logic
- ✅ Session management
- ✅ Error handling

#### CLI Module
- ✅ Help option display
- ✅ Main execution flow
- ✅ Environment variable setup
- ✅ Tool status display
- ✅ Integration testing
- ✅ Error handling

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Specific Test File
```bash
npm test -- initialization.test.ts
```

### Run Tests with Verbose Output
```bash
npm test -- --verbose
```

## Test Configuration

The test suite uses:
- **Jest** as the test runner
- **ts-jest** for TypeScript support
- **Node.js** test environment
- Custom setup file for mocking

### Jest Configuration
- Located in `jest.config.js`
- TypeScript preset with ts-jest
- Coverage collection from all `.ts` files
- Custom setup file for global mocks

### Mock Strategy
- File system operations are mocked
- External dependencies (AI SDK, MCP tools) are mocked
- Console output is suppressed during tests
- Process.exit is mocked to prevent test termination

## Coverage Goals

The test suite aims for high coverage across all modules:
- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

## Test Patterns

### Unit Tests
- Test individual functions in isolation
- Mock all external dependencies
- Focus on specific functionality

### Integration Tests
- Test module interactions
- Verify complete workflows
- Test error propagation

### Edge Case Testing
- Invalid inputs
- Missing files
- Network errors
- Malformed configurations

## Mocking Strategy

### File System
- `fs` module is mocked for all file operations
- Tests can control file existence and content
- No actual files are created during testing

### External APIs
- AI SDK calls are mocked
- MCP tool creation is mocked
- Network requests are avoided

### Console Output
- Console methods are mocked to avoid noise
- Output can be verified in tests
- Spinners and progress indicators are mocked

## Adding New Tests

When adding new features:

1. Create test file with `.test.ts` extension
2. Follow existing naming conventions
3. Mock external dependencies
4. Test both success and error cases
5. Include edge case testing
6. Update this documentation

### Test File Template
```typescript
import { functionToTest } from '../module';

// Mock dependencies
jest.mock('external-dependency');

describe('module.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('functionToTest', () => {
    it('should handle normal case', () => {
      // Test implementation
    });

    it('should handle error case', () => {
      // Error test implementation
    });
  });
});
```

## Continuous Integration

Tests are designed to run in CI environments:
- No external dependencies required
- All file operations are mocked
- Deterministic test results
- Fast execution time

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Ensure all mocks are properly typed
2. **Async Test Issues**: Use proper async/await patterns
3. **Mock Cleanup**: Always clear mocks between tests
4. **File Path Issues**: Use relative paths consistently

### Debug Tips

1. Use `--verbose` flag for detailed output
2. Run single test files to isolate issues
3. Check mock implementations
4. Verify async operations complete

## Future Improvements

- Add performance benchmarks
- Add browser compatibility tests
- Add end-to-end testing
- Add mutation testing
- Add visual regression testing