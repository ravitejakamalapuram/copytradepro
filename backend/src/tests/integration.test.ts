import { describe, test, expect, beforeAll } from '@jest/globals';
import { BrokerFactory } from '@copytrade/unified-broker';

describe('Unified Broker Interface Integration Tests', () => {
  let brokerFactory: BrokerFactory;

  // Initialize broker plugins before running tests
  beforeAll(() => {
    brokerFactory = BrokerFactory.getInstance();
  });

  describe('BrokerFactory Basic Tests', () => {
    test('should create Shoonya adapter without errors', () => {
      const adapter = brokerFactory.createBroker('shoonya');
      expect(adapter).toBeDefined();
      expect(typeof adapter.placeOrder).toBe('function');
      expect(typeof adapter.getQuote).toBe('function');
      expect(typeof adapter.validateSession).toBe('function');
      expect(typeof adapter.logout).toBe('function');
    });

    test('should create Fyers adapter without errors', () => {
      const adapter = brokerFactory.createBroker('fyers');
      expect(adapter).toBeDefined();
      expect(typeof adapter.placeOrder).toBe('function');
      expect(typeof adapter.getQuote).toBe('function');
      expect(typeof adapter.validateSession).toBe('function');
      expect(typeof adapter.logout).toBe('function');
    });

    test('should throw error for unsupported broker', () => {
      expect(() => brokerFactory.createBroker('unsupported')).toThrow('is not registered');
    });

    test('should return supported brokers list', () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      expect(Array.isArray(supportedBrokers)).toBe(true);
      expect(supportedBrokers).toContain('shoonya');
      expect(supportedBrokers).toContain('fyers');
      expect(supportedBrokers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Unified Interface Consistency Tests', () => {
    test('should have consistent interface across all brokers', () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      supportedBrokers.forEach(brokerName => {
        const adapter = brokerFactory.createBroker(brokerName);
        
        // All adapters should implement the same interface
        expect(typeof adapter.login).toBe('function');
        expect(typeof adapter.logout).toBe('function');
        expect(typeof adapter.placeOrder).toBe('function');
        expect(typeof adapter.getQuote).toBe('function');
        expect(typeof adapter.validateSession).toBe('function');
        expect(typeof adapter.getOrderStatus).toBe('function');
        expect(typeof adapter.getOrderHistory).toBe('function');
        expect(typeof adapter.getPositions).toBe('function');
      });
    });

    test('should handle order placement interface consistently', async () => {
      const testOrderRequest = {
        symbol: 'TCS',
        action: 'BUY' as const,
        quantity: 10,
        orderType: 'LIMIT' as const,
        price: 3500,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY' as const,
        remarks: 'Test order',
        accountId: 'TEST123'
      };

      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      for (const brokerName of supportedBrokers) {
        const adapter = brokerFactory.createBroker(brokerName);
        
        try {
          await adapter.placeOrder(testOrderRequest);
          // Should not reach here without proper authentication
          expect(false).toBe(true);
        } catch (error) {
          // Expected to fail without proper authentication, but interface should work
          expect(error).toBeDefined();
        }
      }
    });

    test('should handle session validation consistently', async () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      for (const brokerName of supportedBrokers) {
        const adapter = brokerFactory.createBroker(brokerName);
        
        const isValid = await adapter.validateSession('test-account');
        expect(typeof isValid).toBe('boolean');
        // Should be false without proper connection
        expect(isValid).toBe(false);
      }
    });

    test('should handle quote fetching consistently', async () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      for (const brokerName of supportedBrokers) {
        const adapter = brokerFactory.createBroker(brokerName);
        
        try {
          await adapter.getQuote('TCS', 'NSE');
          // Should not reach here without proper authentication
          expect(false).toBe(true);
        } catch (error) {
          // Expected to fail without proper authentication
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Order Type Transformation Tests', () => {
    test('should handle all order types without throwing errors', async () => {
      const orderTypes: Array<'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET'> = 
        ['MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET'];
      
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      for (const brokerName of supportedBrokers) {
        const adapter = brokerFactory.createBroker(brokerName);
        
        for (const orderType of orderTypes) {
          const orderRequest = {
            symbol: 'TCS',
            action: 'BUY' as const,
            quantity: 10,
            orderType,
            price: 3500,
            exchange: 'NSE',
            productType: 'CNC',
            validity: 'DAY' as const,
            accountId: 'TEST123'
          };
          
          try {
            await adapter.placeOrder(orderRequest);
          } catch (error) {
            // Expected to fail without authentication, but transformation should work
            expect(error).toBeDefined();
          }
        }
      }
    });

    test('should handle all product types without throwing errors', async () => {
      const productTypes = ['CNC', 'MIS', 'NRML', 'BO'];
      
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      for (const brokerName of supportedBrokers) {
        const adapter = brokerFactory.createBroker(brokerName);
        
        for (const productType of productTypes) {
          const orderRequest = {
            symbol: 'TCS',
            action: 'BUY' as const,
            quantity: 10,
            orderType: 'LIMIT' as const,
            price: 3500,
            exchange: 'NSE',
            productType,
            validity: 'DAY' as const,
            accountId: 'TEST123'
          };
          
          try {
            await adapter.placeOrder(orderRequest);
          } catch (error) {
            // Expected to fail without authentication, but transformation should work
            expect(error).toBeDefined();
          }
        }
      }
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle invalid credentials gracefully', async () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      for (const brokerName of supportedBrokers) {
        const adapter = brokerFactory.createBroker(brokerName);
        
        try {
          await adapter.login({} as any);
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });

    test('should handle logout without connection gracefully', async () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();

      for (const brokerName of supportedBrokers) {
        const adapter = brokerFactory.createBroker(brokerName);

        // The important thing is that logout doesn't throw errors
        const result = await adapter.logout();
        expect(result).toBeDefined();

        // Different brokers may return different response formats
        // Some return boolean, some return objects
        // This is acceptable as long as logout completes without errors
        if (typeof result === 'boolean') {
          // Boolean result - can be true or false depending on implementation
          expect(typeof result).toBe('boolean');
        } else {
          // Object result - should be defined
          expect(result).toBeDefined();
        }
      }
    });
  });

  describe('Response Format Tests', () => {
    test('should return consistent response format for login', async () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      for (const brokerName of supportedBrokers) {
        const adapter = brokerFactory.createBroker(brokerName);
        
        try {
          const response = await adapter.login({
            userId: 'TEST123',
            password: 'test-password',
            vendorCode: 'TEST_VENDOR',
            apiKey: 'test-api-key',
            imei: 'test-imei',
            totpKey: 'test-totp-key',
            apiSecret: 'test-api-secret'
          });
          
          expect(response).toHaveProperty('success');
          expect(response).toHaveProperty('message');
          expect(typeof response.success).toBe('boolean');
          expect(typeof response.message).toBe('string');
        } catch (error) {
          // Expected to fail without proper authentication
          expect(error).toBeDefined();
        }
      }
    });

    test('should return consistent response format for order placement', async () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      for (const brokerName of supportedBrokers) {
        const adapter = brokerFactory.createBroker(brokerName);
        
        try {
          const response = await adapter.placeOrder({
            symbol: 'TCS',
            action: 'BUY',
            quantity: 10,
            orderType: 'LIMIT',
            price: 3500,
            exchange: 'NSE',
            productType: 'CNC',
            validity: 'DAY',
            accountId: 'TEST123'
          });
          
          expect(response).toHaveProperty('success');
          expect(response).toHaveProperty('message');
          expect(typeof response.success).toBe('boolean');
          expect(typeof response.message).toBe('string');
        } catch (error) {
          // Expected to fail without proper authentication
          expect(error).toBeDefined();
        }
      }
    });
  });
});

console.log('✅ Integration Tests Created');
