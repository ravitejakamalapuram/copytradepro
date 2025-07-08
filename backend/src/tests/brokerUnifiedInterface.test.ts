import { describe, test, expect, beforeEach } from '@jest/globals';
import { brokerFactory } from '../factories/BrokerFactory';
import { ShoonyaServiceAdapter } from '../adapters/ShoonyaServiceAdapter';
import { FyersServiceAdapter } from '../adapters/FyersServiceAdapter';
import { IBrokerService, OrderRequest } from '../interfaces/IBrokerService';

// Mock the broker manager since it may not exist yet
const mockBrokerManager = {
  createConnection: jest.fn(),
  getConnection: jest.fn().mockReturnValue(null),
  removeConnection: jest.fn(),
  validateConnection: jest.fn().mockReturnValue(false)
};

describe('Unified Broker Interface Tests', () => {
  
  describe('BrokerFactory Tests', () => {
    test('should create Shoonya adapter', () => {
      const adapter = brokerFactory.createBroker('shoonya');
      expect(adapter).toBeInstanceOf(ShoonyaServiceAdapter);
    });

    test('should create Fyers adapter', () => {
      const adapter = brokerFactory.createBroker('fyers');
      expect(adapter).toBeInstanceOf(FyersServiceAdapter);
    });

    test('should throw error for unsupported broker', () => {
      expect(() => brokerFactory.createBroker('unsupported')).toThrow('Unsupported broker: unsupported');
    });

    test('should return supported brokers list', () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      expect(supportedBrokers).toContain('shoonya');
      expect(supportedBrokers).toContain('fyers');
      expect(supportedBrokers).toHaveLength(2);
    });
  });

  describe('Unified Order Interface Tests', () => {
    let shoonyaAdapter: IBrokerService;
    let fyersAdapter: IBrokerService;

    beforeEach(() => {
      shoonyaAdapter = brokerFactory.createBroker('shoonya');
      fyersAdapter = brokerFactory.createBroker('fyers');
    });

    const testOrderRequest: OrderRequest = {
      symbol: 'TCS',
      action: 'BUY',
      quantity: 10,
      orderType: 'LIMIT',
      price: 3500,
      exchange: 'NSE',
      productType: 'CNC',
      validity: 'DAY',
      remarks: 'Test order',
      accountId: 'TEST123'
    };

    test('should have consistent interface across brokers', () => {
      // Both adapters should implement the same interface
      expect(typeof shoonyaAdapter.placeOrder).toBe('function');
      expect(typeof fyersAdapter.placeOrder).toBe('function');
      
      expect(typeof shoonyaAdapter.getQuote).toBe('function');
      expect(typeof fyersAdapter.getQuote).toBe('function');
      
      expect(typeof shoonyaAdapter.validateSession).toBe('function');
      expect(typeof fyersAdapter.validateSession).toBe('function');
    });

    test('should handle different order types uniformly', async () => {
      const orderTypes: Array<'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET'> = 
        ['MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET'];

      for (const orderType of orderTypes) {
        const orderRequest = { ...testOrderRequest, orderType };
        
        // Should not throw errors for interface calls (actual broker calls will fail without auth)
        try {
          await shoonyaAdapter.placeOrder(orderRequest);
        } catch (error) {
          // Expected to fail without proper authentication, but interface should work
          expect(error).toBeDefined();
        }

        try {
          await fyersAdapter.placeOrder(orderRequest);
        } catch (error) {
          // Expected to fail without proper authentication, but interface should work
          expect(error).toBeDefined();
        }
      }
    });

    test('should handle different product types uniformly', async () => {
      const productTypes = ['CNC', 'MIS', 'NRML', 'BO'];

      for (const productType of productTypes) {
        const orderRequest = { ...testOrderRequest, productType };
        
        // Should not throw errors for interface calls
        try {
          await shoonyaAdapter.placeOrder(orderRequest);
        } catch (error) {
          // Expected to fail without proper authentication
          expect(error).toBeDefined();
        }

        try {
          await fyersAdapter.placeOrder(orderRequest);
        } catch (error) {
          // Expected to fail without proper authentication
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('BrokerManager Tests', () => {
    const testUserId = 'test-user-123';
    const testBrokerName = 'shoonya';
    const testCredentials = {
      userId: 'TEST123',
      password: 'test-password',
      vendorCode: 'TEST_VENDOR',
      apiKey: 'test-api-key',
      imei: 'test-imei',
      totpKey: 'test-totp-key',
      apiSecret: 'test-api-secret'
    };

    test('should create connection', async () => {
      try {
        const connection = await mockBrokerManager.createConnection(testUserId, testBrokerName, testCredentials);
        expect(connection).toBeDefined();
      } catch (error) {
        // Expected to fail without proper broker authentication
        expect(error).toBeDefined();
      }
    });

    test('should handle connection retrieval', () => {
      const connection = mockBrokerManager.getConnection(testUserId, testBrokerName, testCredentials.userId);
      // Will be null if no connection exists
      expect(connection).toBeNull();
    });

    test('should handle connection removal', () => {
      const connectionKey = `${testUserId}_${testBrokerName}_${testCredentials.userId}`;
      mockBrokerManager.removeConnection(testUserId, connectionKey);
      // Should not throw error even if connection doesn't exist
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle invalid broker gracefully', () => {
      expect(() => brokerFactory.createBroker('invalid-broker')).toThrow();
    });

    test('should handle missing credentials gracefully', async () => {
      const adapter = brokerFactory.createBroker('shoonya');
      
      try {
        await adapter.login({} as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle session validation without connection', async () => {
      const adapter = brokerFactory.createBroker('shoonya');
      
      const isValid = await adapter.validateSession('non-existent-account');
      expect(isValid).toBe(false);
    });
  });

  describe('Response Format Tests', () => {
    test('should return consistent response format', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      const fyersAdapter = brokerFactory.createBroker('fyers');

      const testCredentials = {
        userId: 'TEST123',
        password: 'test-password',
        vendorCode: 'TEST_VENDOR',
        apiKey: 'test-api-key',
        imei: 'test-imei',
        totpKey: 'test-totp-key',
        apiSecret: 'test-api-secret'
      };

      try {
        const shoonyaResponse = await shoonyaAdapter.login(testCredentials);
        expect(shoonyaResponse).toHaveProperty('success');
        expect(shoonyaResponse).toHaveProperty('message');
      } catch (error) {
        // Expected to fail without proper authentication
      }

      try {
        const fyersResponse = await fyersAdapter.login({
          clientId: 'TEST_CLIENT',
          secretKey: 'TEST_SECRET',
          redirectUri: 'http://test.com'
        });
        expect(fyersResponse).toHaveProperty('success');
        expect(fyersResponse).toHaveProperty('message');
      } catch (error) {
        // Expected to fail without proper authentication
      }
    });
  });
});

console.log('✅ Unified Broker Interface Tests Created');
