/**
 * Test Setup for Unified Trading API
 */

// Global test configuration
beforeAll(() => {
  // Set up any global test configuration
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Clean up after all tests
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
