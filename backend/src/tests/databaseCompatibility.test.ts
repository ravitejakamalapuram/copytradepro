import { userDatabase } from '../services/databaseCompatibility';
import { MongoDatabase } from '../services/mongoDatabase';
import { OrderHistory } from '../interfaces/IDatabaseAdapter';

// Mock the database factory to return a mock database
jest.mock('../services/databaseFactory', () => ({
  getDatabase: jest.fn()
}));

describe('DatabaseCompatibility - String ID Handling', () => {
  let mockDb: jest.Mocked<MongoDatabase>;

  beforeEach(() => {
    // Create a mock database instance
    mockDb = {
      getOrderHistoryById: jest.fn(),
      getOrderHistoryByBrokerOrderId: jest.fn(),
      updateOrderStatus: jest.fn(),
      deleteOrderHistory: jest.fn(),
      updateOrderWithError: jest.fn(),
      incrementOrderRetryCount: jest.fn(),
    } as any;

    // Mock the getDb method to return our mock database
    (userDatabase as any).getDb = jest.fn().mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrderHistoryById - String ID Only', () => {
    it('should accept string ID and pass it to database', async () => {
      const testId = '507f1f77bcf86cd799439011';
      const mockOrder: OrderHistory = {
        id: testId,
        user_id: '507f1f77bcf86cd799439012',
        account_id: '507f1f77bcf86cd799439013',
        broker_name: 'test_broker',
        broker_order_id: 'TEST123',
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        order_type: 'LIMIT',
        status: 'PLACED',
        exchange: 'NSE',
        product_type: 'C',
        remarks: 'Test order',
        executed_at: '2024-01-01T10:00:00.000Z',
        created_at: '2024-01-01T10:00:00.000Z'
      };

      mockDb.getOrderHistoryById.mockResolvedValue(mockOrder);

      const result = await userDatabase.getOrderHistoryById(testId);

      expect(mockDb.getOrderHistoryById).toHaveBeenCalledWith(testId);
      expect(mockDb.getOrderHistoryById).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockOrder);
    });

    it('should return null when order not found', async () => {
      const testId = '507f1f77bcf86cd799439011';
      mockDb.getOrderHistoryById.mockResolvedValue(null);

      const result = await userDatabase.getOrderHistoryById(testId);

      expect(mockDb.getOrderHistoryById).toHaveBeenCalledWith(testId);
      expect(result).toBeNull();
    });

    it('should handle MongoDB ObjectId format strings correctly', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockDb.getOrderHistoryById.mockResolvedValue(null);

      await userDatabase.getOrderHistoryById(validObjectId);

      expect(mockDb.getOrderHistoryById).toHaveBeenCalledWith(validObjectId);
      expect(typeof mockDb.getOrderHistoryById.mock.calls[0]?.[0]).toBe('string');
    });

    it('should handle various valid MongoDB ObjectId strings', async () => {
      const validObjectIds = [
        '507f1f77bcf86cd799439011',
        '507f191e810c19729de860ea',
        '5f8d0d55b54764421b7156c9',
        '60b5d8f5e8b4c72a3c8d9e0f'
      ];

      for (const id of validObjectIds) {
        mockDb.getOrderHistoryById.mockResolvedValue(null);
        
        await userDatabase.getOrderHistoryById(id);
        
        expect(mockDb.getOrderHistoryById).toHaveBeenCalledWith(id);
        expect(typeof mockDb.getOrderHistoryById.mock.calls[mockDb.getOrderHistoryById.mock.calls.length - 1]?.[0]).toBe('string');
      }
    });

    it('should pass through string IDs without any conversion', async () => {
      const testId = '507f1f77bcf86cd799439011';
      mockDb.getOrderHistoryById.mockResolvedValue(null);

      await userDatabase.getOrderHistoryById(testId);

      // Verify the exact same string was passed through
      expect(mockDb.getOrderHistoryById).toHaveBeenCalledWith(testId);
      expect(mockDb.getOrderHistoryById.mock.calls[0]?.[0]).toBe(testId);
    });
  });

  describe('getOrderHistoryByBrokerOrderId - Broker Order ID Lookup', () => {
    it('should accept broker order ID string and return matching order', async () => {
      const brokerOrderId = 'BROKER123456';
      const mockOrder: OrderHistory = {
        id: '507f1f77bcf86cd799439011',
        user_id: '507f1f77bcf86cd799439012',
        account_id: '507f1f77bcf86cd799439013',
        broker_name: 'test_broker',
        broker_order_id: brokerOrderId,
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        order_type: 'LIMIT',
        status: 'PLACED',
        exchange: 'NSE',
        product_type: 'C',
        remarks: 'Test order',
        executed_at: '2024-01-01T10:00:00.000Z',
        created_at: '2024-01-01T10:00:00.000Z'
      };

      mockDb.getOrderHistoryByBrokerOrderId.mockResolvedValue(mockOrder);

      const result = await userDatabase.getOrderHistoryByBrokerOrderId(brokerOrderId);

      expect(mockDb.getOrderHistoryByBrokerOrderId).toHaveBeenCalledWith(brokerOrderId);
      expect(mockDb.getOrderHistoryByBrokerOrderId).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockOrder);
    });

    it('should return null when broker order ID not found', async () => {
      const brokerOrderId = 'NONEXISTENT123';
      mockDb.getOrderHistoryByBrokerOrderId.mockResolvedValue(null);

      const result = await userDatabase.getOrderHistoryByBrokerOrderId(brokerOrderId);

      expect(mockDb.getOrderHistoryByBrokerOrderId).toHaveBeenCalledWith(brokerOrderId);
      expect(result).toBeNull();
    });

    it('should handle various broker order ID formats', async () => {
      const testCases = [
        'ZERODHA123456',
        'FYERS_ORD_789',
        'SH-2024-001',
        '1234567890',
        'ANGEL_20240101_001',
        'UPSTOX-ORD-456789'
      ];

      for (const brokerOrderId of testCases) {
        mockDb.getOrderHistoryByBrokerOrderId.mockResolvedValue(null);
        
        await userDatabase.getOrderHistoryByBrokerOrderId(brokerOrderId);
        
        expect(mockDb.getOrderHistoryByBrokerOrderId).toHaveBeenCalledWith(brokerOrderId);
      }
    });

    it('should handle empty and special character broker order IDs', async () => {
      const specialCases = [
        'ORDER-WITH-DASHES',
        'ORDER_WITH_UNDERSCORES',
        'ORDER.WITH.DOTS',
        'ORDER123ABC'
      ];

      for (const brokerOrderId of specialCases) {
        mockDb.getOrderHistoryByBrokerOrderId.mockResolvedValue(null);
        
        await userDatabase.getOrderHistoryByBrokerOrderId(brokerOrderId);
        
        expect(mockDb.getOrderHistoryByBrokerOrderId).toHaveBeenCalledWith(brokerOrderId);
      }
    });
  });

  describe('updateOrderStatus - String ID Only', () => {
    it('should accept string ID and update status', async () => {
      const testId = '507f1f77bcf86cd799439011';
      const newStatus = 'EXECUTED';
      mockDb.updateOrderStatus.mockResolvedValue(true);

      const result = await userDatabase.updateOrderStatus(testId, newStatus);

      expect(mockDb.updateOrderStatus).toHaveBeenCalledWith(testId, newStatus);
      expect(mockDb.updateOrderStatus).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should return false when update fails', async () => {
      const testId = '507f1f77bcf86cd799439011';
      const newStatus = 'EXECUTED';
      mockDb.updateOrderStatus.mockResolvedValue(false);

      const result = await userDatabase.updateOrderStatus(testId, newStatus);

      expect(result).toBe(false);
    });

    it('should handle all valid order status values', async () => {
      const testId = '507f1f77bcf86cd799439011';
      const statusValues = ['PLACED', 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED', 'PARTIALLY_FILLED', 'FAILED'];

      for (const status of statusValues) {
        mockDb.updateOrderStatus.mockResolvedValue(true);
        
        const result = await userDatabase.updateOrderStatus(testId, status);
        
        expect(mockDb.updateOrderStatus).toHaveBeenCalledWith(testId, status);
        expect(result).toBe(true);
      }
    });
  });

  describe('deleteOrderHistory - String ID Only', () => {
    it('should accept string ID and delete order', async () => {
      const testId = '507f1f77bcf86cd799439011';
      mockDb.deleteOrderHistory.mockResolvedValue(true);

      const result = await userDatabase.deleteOrderHistory(testId);

      expect(mockDb.deleteOrderHistory).toHaveBeenCalledWith(testId);
      expect(mockDb.deleteOrderHistory).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      const testId = '507f1f77bcf86cd799439011';
      mockDb.deleteOrderHistory.mockResolvedValue(false);

      const result = await userDatabase.deleteOrderHistory(testId);

      expect(result).toBe(false);
    });

    it('should handle multiple deletion attempts', async () => {
      const testIds = [
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012',
        '507f1f77bcf86cd799439013'
      ];

      for (const testId of testIds) {
        mockDb.deleteOrderHistory.mockResolvedValue(true);
        
        const result = await userDatabase.deleteOrderHistory(testId);
        
        expect(mockDb.deleteOrderHistory).toHaveBeenCalledWith(testId);
        expect(result).toBe(true);
      }
    });
  });

  describe('updateOrderWithError - String ID Only', () => {
    it('should accept string ID and error data', async () => {
      const testId = '507f1f77bcf86cd799439011';
      const errorData = {
        status: 'FAILED',
        error_message: 'Insufficient funds',
        error_code: 'FUNDS_ERROR',
        error_type: 'BROKER' as const,
        failure_reason: 'Not enough balance',
        is_retryable: false
      };
      mockDb.updateOrderWithError.mockResolvedValue(true);

      const result = await userDatabase.updateOrderWithError(testId, errorData);

      expect(mockDb.updateOrderWithError).toHaveBeenCalledWith(testId, errorData);
      expect(mockDb.updateOrderWithError).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should handle all error types', async () => {
      const testId = '507f1f77bcf86cd799439011';
      const errorTypes = ['NETWORK', 'BROKER', 'VALIDATION', 'AUTH', 'SYSTEM', 'MARKET'] as const;

      for (const errorType of errorTypes) {
        const errorData = {
          status: 'FAILED',
          error_message: `Test ${errorType} error`,
          error_type: errorType
        };
        mockDb.updateOrderWithError.mockResolvedValue(true);
        
        const result = await userDatabase.updateOrderWithError(testId, errorData);
        
        expect(mockDb.updateOrderWithError).toHaveBeenCalledWith(testId, errorData);
        expect(result).toBe(true);
      }
    });

    it('should handle missing updateOrderWithError method gracefully', async () => {
      const testId = '507f1f77bcf86cd799439011';
      const errorData = {
        status: 'FAILED',
        error_message: 'Test error'
      };
      
      // Mock database without updateOrderWithError method
      const mockDbWithoutMethod = {} as any;
      (userDatabase as any).getDb = jest.fn().mockResolvedValue(mockDbWithoutMethod);

      const result = await userDatabase.updateOrderWithError(testId, errorData);

      expect(result).toBe(false);
    });

    it('should handle partial error data', async () => {
      const testId = '507f1f77bcf86cd799439011';
      const minimalErrorData = {
        status: 'FAILED'
      };
      mockDb.updateOrderWithError.mockResolvedValue(true);

      const result = await userDatabase.updateOrderWithError(testId, minimalErrorData);

      expect(mockDb.updateOrderWithError).toHaveBeenCalledWith(testId, minimalErrorData);
      expect(result).toBe(true);
    });
  });

  describe('incrementOrderRetryCount - String ID Only', () => {
    it('should accept string ID and increment retry count', async () => {
      const testId = '507f1f77bcf86cd799439011';
      mockDb.incrementOrderRetryCount.mockResolvedValue(true);

      const result = await userDatabase.incrementOrderRetryCount(testId);

      expect(mockDb.incrementOrderRetryCount).toHaveBeenCalledWith(testId);
      expect(mockDb.incrementOrderRetryCount).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should handle missing incrementOrderRetryCount method gracefully', async () => {
      const testId = '507f1f77bcf86cd799439011';
      
      // Mock database without incrementOrderRetryCount method
      const mockDbWithoutMethod = {} as any;
      (userDatabase as any).getDb = jest.fn().mockResolvedValue(mockDbWithoutMethod);

      const result = await userDatabase.incrementOrderRetryCount(testId);

      expect(result).toBe(false);
    });

    it('should handle multiple retry count increments', async () => {
      const testId = '507f1f77bcf86cd799439011';
      
      for (let i = 0; i < 3; i++) {
        mockDb.incrementOrderRetryCount.mockResolvedValue(true);
        
        const result = await userDatabase.incrementOrderRetryCount(testId);
        
        expect(mockDb.incrementOrderRetryCount).toHaveBeenCalledWith(testId);
        expect(result).toBe(true);
      }
    });
  });

  describe('String ID Validation and Consistency', () => {
    it('should consistently use string IDs across all order methods', async () => {
      const testId = '507f1f77bcf86cd799439011';
      
      // Mock all methods to return success
      mockDb.getOrderHistoryById.mockResolvedValue(null);
      mockDb.updateOrderStatus.mockResolvedValue(true);
      mockDb.deleteOrderHistory.mockResolvedValue(true);
      mockDb.updateOrderWithError.mockResolvedValue(true);
      mockDb.incrementOrderRetryCount.mockResolvedValue(true);

      // Test all methods with the same string ID
      await userDatabase.getOrderHistoryById(testId);
      await userDatabase.updateOrderStatus(testId, 'EXECUTED');
      await userDatabase.deleteOrderHistory(testId);
      await userDatabase.updateOrderWithError(testId, { status: 'FAILED' });
      await userDatabase.incrementOrderRetryCount(testId);

      // Verify all methods received string IDs
      expect(mockDb.getOrderHistoryById).toHaveBeenCalledWith(testId);
      expect(mockDb.updateOrderStatus).toHaveBeenCalledWith(testId, 'EXECUTED');
      expect(mockDb.deleteOrderHistory).toHaveBeenCalledWith(testId);
      expect(mockDb.updateOrderWithError).toHaveBeenCalledWith(testId, { status: 'FAILED' });
      expect(mockDb.incrementOrderRetryCount).toHaveBeenCalledWith(testId);
    });

    it('should not perform any ID conversion or transformation', async () => {
      const originalId = '507f1f77bcf86cd799439011';
      mockDb.getOrderHistoryById.mockResolvedValue(null);

      await userDatabase.getOrderHistoryById(originalId);

      // Verify the ID passed to the database is exactly the same
      const passedId = mockDb.getOrderHistoryById.mock.calls[0]?.[0];
      expect(passedId).toBe(originalId);
      expect(passedId).toEqual(originalId);
    });

    it('should handle edge case string IDs', async () => {
      const edgeCaseIds = [
        '000000000000000000000000', // All zeros
        'ffffffffffffffffffffffff', // All f's
        '123456789012345678901234'  // All numbers
      ];

      for (const id of edgeCaseIds) {
        mockDb.getOrderHistoryById.mockResolvedValue(null);
        
        await userDatabase.getOrderHistoryById(id);
        
        expect(mockDb.getOrderHistoryById).toHaveBeenCalledWith(id);
        expect(typeof mockDb.getOrderHistoryById.mock.calls[mockDb.getOrderHistoryById.mock.calls.length - 1]?.[0]).toBe('string');
      }
    });
  });

  describe('Legacy Code Removal Verification', () => {
    it('should not have any numeric ID handling in order methods', async () => {
      const testId = '507f1f77bcf86cd799439011';
      mockDb.getOrderHistoryById.mockResolvedValue(null);

      await userDatabase.getOrderHistoryById(testId);

      // Verify no numeric conversion was attempted
      const passedId = mockDb.getOrderHistoryById.mock.calls[0]?.[0];
      expect(typeof passedId).toBe('string');
      expect(Number.isInteger(passedId)).toBe(false);
    });

    it('should not have legacy ID conversion utilities', () => {
      // Verify that the compatibility layer doesn't have legacy conversion methods
      expect((userDatabase as any).convertNumericToStringId).toBeUndefined();
      expect((userDatabase as any).convertLegacyId).toBeUndefined();
      expect((userDatabase as any).handleNumericId).toBeUndefined();
    });
  });
});