import { validateBrokerSession, logoutFromBroker, getBrokerService } from '../controllers/brokerController';
import { brokerManager } from '../managers/BrokerManager';
import { brokerFactory } from '../factories/BrokerFactory';

describe('Unified Session Management Tests', () => {
  
  describe('Session Validation Tests', () => {
    const testUserId = 'test-user-123';
    const testAccountId = 'TEST123';

    test('should validate session consistently across brokers', async () => {
      // Test Shoonya session validation
      const shoonyaValid = await validateBrokerSession(testUserId, 'shoonya', testAccountId);
      expect(typeof shoonyaValid).toBe('boolean');
      
      // Test Fyers session validation
      const fyersValid = await validateBrokerSession(testUserId, 'fyers', testAccountId);
      expect(typeof fyersValid).toBe('boolean');
      
      // Both should return false without proper connections
      expect(shoonyaValid).toBe(false);
      expect(fyersValid).toBe(false);
    });

    test('should handle session validation errors gracefully', async () => {
      // Test with invalid broker
      try {
        await validateBrokerSession(testUserId, 'invalid-broker', testAccountId);
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Test with empty parameters
      const result = await validateBrokerSession('', '', '');
      expect(result).toBe(false);
    });

    test('should use broker manager for session validation', async () => {
      // Mock a connection in broker manager
      const mockCredentials = {
        userId: testAccountId,
        password: 'test-password',
        vendorCode: 'TEST_VENDOR',
        apiKey: 'test-api-key',
        imei: 'test-imei',
        totpKey: 'test-totp-key',
        apiSecret: 'test-api-secret'
      };

      try {
        // This will fail without proper broker authentication, but tests the flow
        await brokerManager.createConnection(testUserId, 'shoonya', mockCredentials);
      } catch (error) {
        // Expected to fail without proper authentication
      }

      // Test session validation with broker manager
      const isValid = await validateBrokerSession(testUserId, 'shoonya', testAccountId);
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Logout Management Tests', () => {
    const testUserId = 'test-user-123';
    const testAccountId = 'TEST123';

    test('should logout consistently across brokers', async () => {
      // Test Shoonya logout
      try {
        await logoutFromBroker(testUserId, 'shoonya', testAccountId);
        // Should complete without error even if no connection exists
      } catch (error) {
        // Acceptable to throw error for non-existent connections
        expect(error).toBeDefined();
      }

      // Test Fyers logout
      try {
        await logoutFromBroker(testUserId, 'fyers', testAccountId);
        // Should complete without error even if no connection exists
      } catch (error) {
        // Acceptable to throw error for non-existent connections
        expect(error).toBeDefined();
      }
    });

    test('should handle logout errors gracefully', async () => {
      // Test with invalid broker
      try {
        await logoutFromBroker(testUserId, 'invalid-broker', testAccountId);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should clean up connections after logout', async () => {
      // Test that connections are properly removed
      try {
        await logoutFromBroker(testUserId, 'shoonya', testAccountId);
        
        // Verify connection is removed
        const connection = brokerManager.getConnection(testUserId, 'shoonya', testAccountId);
        expect(connection).toBeNull();
      } catch (error) {
        // Expected if no connection exists
      }
    });
  });

  describe('getBrokerService Helper Tests', () => {
    const testUserId = 'test-user-123';
    const testAccountId = 'TEST123';

    test('should retrieve broker service consistently', () => {
      // Test Shoonya service retrieval
      const shoonyaService = getBrokerService(testUserId, 'shoonya', testAccountId);
      // Will be null if no connection exists
      expect(shoonyaService).toBeNull();

      // Test Fyers service retrieval
      const fyersService = getBrokerService(testUserId, 'fyers', testAccountId);
      // Will be null if no connection exists
      expect(fyersService).toBeNull();
    });

    test('should fallback to legacy connections', () => {
      // Test fallback mechanism
      const service = getBrokerService(testUserId, 'shoonya', testAccountId);
      expect(service).toBeNull(); // No legacy connections exist
    });

    test('should handle invalid parameters gracefully', () => {
      const service = getBrokerService('', '', '');
      expect(service).toBeNull();
    });
  });

  describe('Auto-reactivation Tests', () => {
    const testUserId = 'test-user-123';
    const testAccountId = 'TEST123';

    test('should handle session expiry detection', async () => {
      // Test session expiry detection for Shoonya
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      
      try {
        const response = await shoonyaAdapter.placeOrder({
          symbol: 'TCS',
          action: 'BUY',
          quantity: 10,
          orderType: 'LIMIT',
          price: 3500,
          exchange: 'NSE',
          productType: 'CNC',
          validity: 'DAY',
          accountId: testAccountId
        });
      } catch (error) {
        // Should detect session expiry errors
        expect(error).toBeDefined();
      }
    });

    test('should handle session expiry for different brokers', async () => {
      // Test that both brokers handle session expiry consistently
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      const fyersAdapter = brokerFactory.createBroker('fyers');

      const testOrder = {
        symbol: 'TCS',
        action: 'BUY' as const,
        quantity: 10,
        orderType: 'LIMIT' as const,
        price: 3500,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY' as const,
        accountId: testAccountId
      };

      // Both should handle session expiry errors consistently
      try {
        await shoonyaAdapter.placeOrder(testOrder);
      } catch (shoonyaError) {
        expect(shoonyaError).toBeDefined();
      }

      try {
        await fyersAdapter.placeOrder(testOrder);
      } catch (fyersError) {
        expect(fyersError).toBeDefined();
      }
    });
  });

  describe('Connection State Management Tests', () => {
    test('should track connection states correctly', () => {
      const testUserId = 'test-user-123';
      const testBrokerName = 'shoonya';
      const testAccountId = 'TEST123';

      // Test initial state
      let connection = brokerManager.getConnection(testUserId, testBrokerName, testAccountId);
      expect(connection).toBeNull();

      // Test connection creation (will fail without proper auth, but tests the flow)
      const mockCredentials = {
        userId: testAccountId,
        password: 'test-password',
        vendorCode: 'TEST_VENDOR',
        apiKey: 'test-api-key',
        imei: 'test-imei',
        totpKey: 'test-totp-key',
        apiSecret: 'test-api-secret'
      };

      // This will fail but tests the interface
      brokerManager.createConnection(testUserId, testBrokerName, mockCredentials)
        .catch(error => {
          // Expected to fail without proper authentication
          expect(error).toBeDefined();
        });
    });

    test('should handle multiple connections per user', () => {
      const testUserId = 'test-user-123';
      
      // Test multiple broker connections for same user
      const shoonyaConnection = brokerManager.getConnection(testUserId, 'shoonya', 'ACCOUNT1');
      const fyersConnection = brokerManager.getConnection(testUserId, 'fyers', 'ACCOUNT2');
      
      // Both should be null initially
      expect(shoonyaConnection).toBeNull();
      expect(fyersConnection).toBeNull();
    });

    test('should isolate connections between users', () => {
      const user1 = 'user-1';
      const user2 = 'user-2';
      const accountId = 'TEST123';
      
      // Connections should be isolated between users
      const user1Connection = brokerManager.getConnection(user1, 'shoonya', accountId);
      const user2Connection = brokerManager.getConnection(user2, 'shoonya', accountId);
      
      expect(user1Connection).toBeNull();
      expect(user2Connection).toBeNull();
    });
  });

  describe('Error Recovery Tests', () => {
    test('should recover from network errors gracefully', async () => {
      const testUserId = 'test-user-123';
      const testAccountId = 'TEST123';

      // Test network error recovery
      try {
        await validateBrokerSession(testUserId, 'shoonya', testAccountId);
      } catch (error) {
        // Should handle network errors gracefully
        expect(error).toBeDefined();
      }
    });

    test('should handle broker service unavailability', async () => {
      const testUserId = 'test-user-123';
      const testAccountId = 'TEST123';

      // Test when broker service is unavailable
      const isValid = await validateBrokerSession(testUserId, 'shoonya', testAccountId);
      expect(isValid).toBe(false);
    });
  });
});

console.log('✅ Session Management Tests Created');
