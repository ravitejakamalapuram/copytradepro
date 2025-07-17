// Test setup file
import { jest, beforeAll, afterAll } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PORT = '3001';

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn() as any;
  console.error = jest.fn() as any;
  console.warn = jest.fn() as any;
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
global.testUtils = {
  createMockCredentials: (brokerName: string) => {
    if (brokerName === 'shoonya') {
      return {
        userId: 'TEST123',
        password: 'test-password',
        vendorCode: 'TEST_VENDOR',
        apiKey: 'test-api-key',
        imei: 'test-imei',
        totpKey: 'test-totp-key',
        apiSecret: 'test-api-secret'
      };
    } else if (brokerName === 'fyers') {
      return {
        clientId: 'TEST_CLIENT',
        secretKey: 'TEST_SECRET',
        redirectUri: 'http://test.com'
      };
    }
    return {};
  },

  createMockOrderRequest: () => ({
    symbol: 'TCS',
    action: 'BUY' as const,
    quantity: 10,
    orderType: 'LIMIT' as const,
    price: 3500,
    triggerPrice: undefined,
    exchange: 'NSE',
    productType: 'CNC',
    validity: 'DAY' as const,
    remarks: 'Test order',
    accountId: 'TEST123'
  })
};

// Declare global types
declare global {
  var testUtils: {
    createMockCredentials: (brokerName: string) => any;
    createMockOrderRequest: () => any;
  };
}

console.log('✅ Test setup completed');
