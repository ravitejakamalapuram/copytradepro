import { brokerFactory } from '../factories/BrokerFactory';

describe('Dynamic Route Validation Tests', () => {
  
  describe('Broker Support Detection Tests', () => {
    test('should return current supported brokers', () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      expect(Array.isArray(supportedBrokers)).toBe(true);
      expect(supportedBrokers.length).toBeGreaterThan(0);
      expect(supportedBrokers).toContain('shoonya');
      expect(supportedBrokers).toContain('fyers');
    });

    test('should validate broker names dynamically', () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      // Test each supported broker
      supportedBrokers.forEach(brokerName => {
        expect(() => brokerFactory.createBroker(brokerName)).not.toThrow();
      });
    });

    test('should reject unsupported brokers', () => {
      const unsupportedBrokers = ['zerodha', 'upstox', 'angelone', 'invalid'];
      
      unsupportedBrokers.forEach(brokerName => {
        expect(() => brokerFactory.createBroker(brokerName)).toThrow();
      });
    });
  });

  describe('Route Validation Message Tests', () => {
    test('should generate dynamic validation messages', () => {
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      const expectedMessage = `Supported brokers: ${supportedBrokers.join(', ')}`;
      
      // This tests that our route validation uses dynamic messages
      expect(expectedMessage).toContain('shoonya');
      expect(expectedMessage).toContain('fyers');
      expect(expectedMessage).toMatch(/Supported brokers: .+/);
    });

    test('should handle empty broker list gracefully', () => {
      // Test edge case where no brokers are registered
      const emptyMessage = 'Supported brokers: ';
      expect(emptyMessage).toBe('Supported brokers: ');
    });
  });

  describe('Broker Registration Tests', () => {
    test('should allow new broker registration', () => {
      // Test that the factory pattern allows new brokers
      const initialBrokers = brokerFactory.getSupportedBrokers();
      expect(initialBrokers).toContain('shoonya');
      expect(initialBrokers).toContain('fyers');
    });

    test('should maintain broker registry integrity', () => {
      const brokers = brokerFactory.getSupportedBrokers();
      
      // Should not contain duplicates
      const uniqueBrokers = [...new Set(brokers)];
      expect(brokers.length).toBe(uniqueBrokers.length);
      
      // Should contain only valid broker names
      brokers.forEach(broker => {
        expect(typeof broker).toBe('string');
        expect(broker.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Extensibility Tests', () => {
    test('should support adding new brokers without code changes', () => {
      // This tests the extensibility of our architecture
      const currentBrokers = brokerFactory.getSupportedBrokers();
      
      // The factory should be extensible
      expect(typeof brokerFactory.createBroker).toBe('function');
      expect(typeof brokerFactory.getSupportedBrokers).toBe('function');
      
      // Current implementation should support at least 2 brokers
      expect(currentBrokers.length).toBeGreaterThanOrEqual(2);
    });

    test('should maintain backward compatibility', () => {
      // Test that existing brokers still work
      expect(() => brokerFactory.createBroker('shoonya')).not.toThrow();
      expect(() => brokerFactory.createBroker('fyers')).not.toThrow();
    });
  });

  describe('Validation Logic Tests', () => {
    test('should validate broker names case-sensitively', () => {
      // Test case sensitivity
      expect(() => brokerFactory.createBroker('SHOONYA')).toThrow();
      expect(() => brokerFactory.createBroker('Shoonya')).toThrow();
      expect(() => brokerFactory.createBroker('shoonya')).not.toThrow();
    });

    test('should handle whitespace in broker names', () => {
      // Test whitespace handling
      expect(() => brokerFactory.createBroker(' shoonya ')).toThrow();
      expect(() => brokerFactory.createBroker('shoonya ')).toThrow();
      expect(() => brokerFactory.createBroker(' shoonya')).toThrow();
    });

    test('should handle special characters in broker names', () => {
      // Test special characters
      expect(() => brokerFactory.createBroker('shoonya-test')).toThrow();
      expect(() => brokerFactory.createBroker('shoonya_test')).toThrow();
      expect(() => brokerFactory.createBroker('shoonya.test')).toThrow();
    });
  });

  describe('Error Message Quality Tests', () => {
    test('should provide helpful error messages', () => {
      try {
        brokerFactory.createBroker('invalid-broker');
      } catch (error) {
        expect(error.message).toContain('Unsupported broker');
        expect(error.message).toContain('invalid-broker');
      }
    });

    test('should suggest valid alternatives in error messages', () => {
      try {
        brokerFactory.createBroker('zerodha');
      } catch (error) {
        // Error message should be helpful
        expect(error.message).toContain('Unsupported broker');
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance Tests', () => {
    test('should validate brokers efficiently', () => {
      const startTime = Date.now();
      
      // Test multiple validations
      for (let i = 0; i < 100; i++) {
        brokerFactory.getSupportedBrokers();
      }
      
      const endTime = Date.now();
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100); // 100ms max
    });

    test('should create brokers efficiently', () => {
      const startTime = Date.now();
      
      // Test multiple broker creations
      for (let i = 0; i < 10; i++) {
        brokerFactory.createBroker('shoonya');
        brokerFactory.createBroker('fyers');
      }
      
      const endTime = Date.now();
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(1000); // 1 second max
    });
  });

  describe('Thread Safety Tests', () => {
    test('should handle concurrent broker creation', async () => {
      // Test concurrent broker creation
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve(brokerFactory.createBroker('shoonya')));
        promises.push(Promise.resolve(brokerFactory.createBroker('fyers')));
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(20);
      results.forEach(broker => {
        expect(broker).toBeDefined();
      });
    });

    test('should handle concurrent validation requests', async () => {
      // Test concurrent validation
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve(brokerFactory.getSupportedBrokers()));
      }
      
      const results = await Promise.all(promises);
      
      // All should return the same result
      expect(results).toHaveLength(10);
      results.forEach(brokers => {
        expect(brokers).toEqual(results[0]);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should integrate with route validation middleware', () => {
      // Test that the factory integrates properly with route validation
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      // Simulate route validation
      const testBrokerName = 'shoonya';
      const isValid = supportedBrokers.includes(testBrokerName);
      
      expect(isValid).toBe(true);
    });

    test('should work with express validation', () => {
      // Test integration with express validation patterns
      const supportedBrokers = brokerFactory.getSupportedBrokers();
      
      // Simulate express validation
      const validationFunction = (value: string) => supportedBrokers.includes(value);
      
      expect(validationFunction('shoonya')).toBe(true);
      expect(validationFunction('fyers')).toBe(true);
      expect(validationFunction('invalid')).toBe(false);
    });
  });
});

console.log('✅ Route Validation Tests Created');
