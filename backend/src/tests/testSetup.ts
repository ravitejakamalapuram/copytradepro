/**
 * Test setup configuration to prevent hanging tests
 * Mocks all services that might create timers or persistent connections
 */

// Mock all services that might create timers or connections
jest.mock('../services/brokerSessionManager', () => ({
  brokerSessionManager: {
    startPeriodicValidation: jest.fn(),
    stopPeriodicValidation: jest.fn(),
    validateSession: jest.fn(),
    cleanupExpiredSessions: jest.fn()
  }
}));

// unified manager removed; no mock needed

jest.mock('../services/websocketService', () => ({
  default: {
    sendToUser: jest.fn(),
    broadcast: jest.fn(),
    initialize: jest.fn(),
    cleanup: jest.fn()
  }
}));

jest.mock('../services/orderStatusService', () => ({
  default: {
    refreshOrderStatus: jest.fn(),
    refreshAllOrderStatus: jest.fn(),
    checkOrderStatus: jest.fn()
  },
  setBrokerConnectionManager: jest.fn()
}));

jest.mock('../services/databaseCompatibility', () => ({
  userDatabase: {
    getOrderHistoryById: jest.fn(),
    getOrderHistoryByBrokerOrderId: jest.fn(),
    updateOrderStatus: jest.fn()
  }
}));

jest.mock('../helpers/brokerConnectionHelper', () => ({
  default: {
    findBrokerConnection: jest.fn(),
    sendAuthenticationError: jest.fn(),
    sendMissingParametersError: jest.fn()
  }
}));

jest.mock('../services/oauthStateManager', () => ({
  oauthStateManager: {
    generateState: jest.fn(),
    validateState: jest.fn()
  }
}));

jest.mock('../services/orderErrorClassifier', () => ({
  OrderErrorClassifier: {
    classifyError: jest.fn()
  }
}));

jest.mock('../services/orderRetryService', () => ({
  orderRetryService: {
    shouldRetry: jest.fn(),
    retry: jest.fn()
  }
}));

jest.mock('../services/orderStatusLogger', () => ({
  orderStatusLogger: {
    logOrderStatusError: jest.fn(),
    logOrderStatusSuccess: jest.fn()
  }
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock any MongoDB connections
jest.mock('mongoose', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  connection: {
    close: jest.fn(),
    on: jest.fn(),
    once: jest.fn()
  }
}));

// Set test timeout
jest.setTimeout(10000);

// Use fake timers by default
beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});