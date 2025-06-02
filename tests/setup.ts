// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock process.exit to prevent tests from actually exiting
const mockExit = jest.fn();
process.exit = mockExit as any;

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  mockExit.mockClear();
});

// Set up test environment variables
process.env.NODE_ENV = 'test';