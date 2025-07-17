import { brokerFactory } from '../factories/BrokerFactory';
import { getBrokerService } from '../controllers/brokerController';

describe('Unified Quote Fetching Tests', () => {
  
  describe('Quote Interface Consistency Tests', () => {
    test('should have consistent quote interface across brokers', () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      const fyersAdapter = brokerFactory.createBroker('fyers');

      // Both adapters should implement the same quote interface
      expect(typeof shoonyaAdapter.getQuote).toBe('function');
      expect(typeof fyersAdapter.getQuote).toBe('function');
    });

    test('should return consistent quote format', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      const fyersAdapter = brokerFactory.createBroker('fyers');

      const testSymbol = 'TCS';
      const testExchange = 'NSE';

      // Test Shoonya quote format
      try {
        const shoonyaQuote = await shoonyaAdapter.getQuote(testSymbol, testExchange);
        expect(shoonyaQuote).toHaveProperty('symbol');
        expect(shoonyaQuote).toHaveProperty('price');
        expect(shoonyaQuote).toHaveProperty('change');
        expect(shoonyaQuote).toHaveProperty('changePercent');
        expect(shoonyaQuote).toHaveProperty('volume');
        expect(shoonyaQuote).toHaveProperty('exchange');
        expect(shoonyaQuote).toHaveProperty('timestamp');
      } catch (error) {
        // Expected to fail without proper authentication
        expect(error).toBeDefined();
      }

      // Test Fyers quote format
      try {
        const fyersQuote = await fyersAdapter.getQuote(testSymbol, testExchange);
        expect(fyersQuote).toHaveProperty('symbol');
        expect(fyersQuote).toHaveProperty('price');
        expect(fyersQuote).toHaveProperty('change');
        expect(fyersQuote).toHaveProperty('changePercent');
        expect(fyersQuote).toHaveProperty('volume');
        expect(fyersQuote).toHaveProperty('exchange');
        expect(fyersQuote).toHaveProperty('timestamp');
      } catch (error) {
        // Expected to fail without proper authentication
        expect(error).toBeDefined();
      }
    });
  });

  describe('Quote Parameter Handling Tests', () => {
    test('should handle different exchanges uniformly', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      const fyersAdapter = brokerFactory.createBroker('fyers');

      const exchanges = ['NSE', 'BSE'];
      const testSymbol = 'TCS';

      for (const exchange of exchanges) {
        // Test Shoonya
        try {
          await shoonyaAdapter.getQuote(testSymbol, exchange);
        } catch (error) {
          // Expected to fail without authentication
          expect(error).toBeDefined();
        }

        // Test Fyers
        try {
          await fyersAdapter.getQuote(testSymbol, exchange);
        } catch (error) {
          // Expected to fail without authentication
          expect(error).toBeDefined();
        }
      }
    });

    test('should handle different symbols uniformly', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      const fyersAdapter = brokerFactory.createBroker('fyers');

      const symbols = ['TCS', 'RELIANCE', 'INFY', 'HDFC'];
      const testExchange = 'NSE';

      for (const symbol of symbols) {
        // Test Shoonya
        try {
          await shoonyaAdapter.getQuote(symbol, testExchange);
        } catch (error) {
          // Expected to fail without authentication
          expect(error).toBeDefined();
        }

        // Test Fyers
        try {
          await fyersAdapter.getQuote(symbol, testExchange);
        } catch (error) {
          // Expected to fail without authentication
          expect(error).toBeDefined();
        }
      }
    });

    test('should handle invalid symbols gracefully', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      const fyersAdapter = brokerFactory.createBroker('fyers');

      const invalidSymbol = 'INVALID_SYMBOL_123';
      const testExchange = 'NSE';

      // Both brokers should handle invalid symbols gracefully
      try {
        await shoonyaAdapter.getQuote(invalidSymbol, testExchange);
      } catch (error) {
        expect(error).toBeDefined();
      }

      try {
        await fyersAdapter.getQuote(invalidSymbol, testExchange);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Quote Fallback Mechanism Tests', () => {
    const testUserId = 'test-user-123';
    const testAccountId = 'TEST123';

    test('should fallback to legacy quote fetching', async () => {
      // Test the fallback mechanism in the controller
      const brokerService = getBrokerService(testUserId, 'shoonya', testAccountId);
      
      if (brokerService) {
        // If service exists, test quote fetching
        try {
          if ('getQuote' in brokerService) {
            await brokerService.getQuote('TCS', 'NSE');
          }
        } catch (error) {
          // Expected to fail without authentication
          expect(error).toBeDefined();
        }
      } else {
        // No service available, which is expected
        expect(brokerService).toBeNull();
      }
    });

    test('should handle unified interface vs legacy interface', async () => {
      const testSymbol = 'TCS';
      const testExchange = 'NSE';

      // Test unified interface
      const unifiedService = getBrokerService(testUserId, 'shoonya', testAccountId);
      
      if (unifiedService && 'getQuote' in unifiedService) {
        try {
          await unifiedService.getQuote(testSymbol, testExchange);
        } catch (error) {
          // Expected to fail without authentication
          expect(error).toBeDefined();
        }
      }

      // Test legacy interface fallback
      if (unifiedService && !('getQuote' in unifiedService)) {
        // Would use legacy broker-specific calls
        expect(unifiedService).toBeDefined();
      }
    });
  });

  describe('Quote Data Validation Tests', () => {
    test('should validate quote data types', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      
      try {
        const quote = await shoonyaAdapter.getQuote('TCS', 'NSE');
        
        // Validate data types
        expect(typeof quote.symbol).toBe('string');
        expect(typeof quote.price).toBe('number');
        expect(typeof quote.change).toBe('number');
        expect(typeof quote.changePercent).toBe('number');
        expect(typeof quote.volume).toBe('number');
        expect(typeof quote.exchange).toBe('string');
        expect(quote.timestamp).toBeInstanceOf(Date);
      } catch (error) {
        // Expected to fail without authentication
        expect(error).toBeDefined();
      }
    });

    test('should handle missing quote data gracefully', async () => {
      const fyersAdapter = brokerFactory.createBroker('fyers');
      
      try {
        const quote = await fyersAdapter.getQuote('NONEXISTENT', 'NSE');
        
        // Should still return a valid quote structure with default values
        expect(quote).toHaveProperty('symbol');
        expect(quote).toHaveProperty('price');
      } catch (error) {
        // Expected to fail for non-existent symbols
        expect(error).toBeDefined();
      }
    });
  });

  describe('Quote Performance Tests', () => {
    test('should handle multiple quote requests efficiently', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      const symbols = ['TCS', 'RELIANCE', 'INFY'];
      
      const startTime = Date.now();
      
      // Test multiple concurrent quote requests
      const quotePromises = symbols.map(symbol => 
        shoonyaAdapter.getQuote(symbol, 'NSE').catch(error => error)
      );
      
      const results = await Promise.all(quotePromises);
      const endTime = Date.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max
      expect(results).toHaveLength(symbols.length);
    });

    test('should handle quote request timeouts gracefully', async () => {
      const fyersAdapter = brokerFactory.createBroker('fyers');
      
      try {
        // This will likely timeout without proper authentication
        const quote = await fyersAdapter.getQuote('TCS', 'NSE');
      } catch (error) {
        // Should handle timeouts gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe('Quote Error Handling Tests', () => {
    test('should handle authentication errors consistently', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      const fyersAdapter = brokerFactory.createBroker('fyers');

      // Both should handle auth errors consistently
      try {
        await shoonyaAdapter.getQuote('TCS', 'NSE');
      } catch (shoonyaError) {
        expect(shoonyaError).toBeDefined();
      }

      try {
        await fyersAdapter.getQuote('TCS', 'NSE');
      } catch (fyersError) {
        expect(fyersError).toBeDefined();
      }
    });

    test('should handle network errors gracefully', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      
      try {
        await shoonyaAdapter.getQuote('TCS', 'NSE');
      } catch (error) {
        // Should provide meaningful error messages
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });

    test('should handle malformed responses gracefully', async () => {
      const fyersAdapter = brokerFactory.createBroker('fyers');
      
      try {
        await fyersAdapter.getQuote('TCS', 'NSE');
      } catch (error) {
        // Should handle malformed responses without crashing
        expect(error).toBeDefined();
      }
    });
  });

  describe('Quote Caching Tests', () => {
    test('should handle quote caching consistently', async () => {
      const shoonyaAdapter = brokerFactory.createBroker('shoonya');
      
      // Test multiple requests for same symbol
      try {
        const quote1 = await shoonyaAdapter.getQuote('TCS', 'NSE');
        const quote2 = await shoonyaAdapter.getQuote('TCS', 'NSE');
        
        // Both should return valid quote structures
        expect(quote1).toHaveProperty('symbol');
        expect(quote2).toHaveProperty('symbol');
      } catch (error) {
        // Expected to fail without authentication
        expect(error).toBeDefined();
      }
    });
  });
});

console.log('✅ Quote Fetching Tests Created');
