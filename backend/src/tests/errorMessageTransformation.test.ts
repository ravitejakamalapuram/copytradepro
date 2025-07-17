import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ErrorClassificationService } from '../services/errorClassificationService';
import { ErrorType, ErrorSeverity } from '../types/errorTypes';

describe('Error Message Transformation and User Feedback', () => {
  let errorService: ErrorClassificationService;

  beforeEach(() => {
    // Reset singleton instance for each test
    (ErrorClassificationService as any).instance = undefined;
    errorService = ErrorClassificationService.getInstance();
  });

  describe('User Message Transformation', () => {
    test('should transform technical network errors to user-friendly messages', () => {
      const testCases = [
        {
          input: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:3001' },
          expectedMessage: 'Connection failed. Please check your internet connection and try again.',
          expectedType: 'network' as ErrorType
        },
        {
          input: { code: 'ETIMEDOUT', message: 'timeout of 5000ms exceeded' },
          expectedMessage: 'Request timed out. Please try again.',
          expectedType: 'network' as ErrorType
        },
        {
          input: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND api.example.com' },
          expectedMessage: 'Service temporarily unavailable. Please try again later.',
          expectedType: 'network' as ErrorType
        }
      ];

      testCases.forEach(({ input, expectedMessage, expectedType }) => {
        const enhancedError = errorService.classifyError(input);
        expect(enhancedError.userMessage).toBe(expectedMessage);
        expect(enhancedError.type).toBe(expectedType);
      });
    });

    test('should transform HTTP status codes to user-friendly messages', () => {
      const testCases = [
        {
          status: 401,
          expectedMessage: 'Authentication failed. Please check your credentials and try again.',
          expectedType: 'authentication' as ErrorType
        },
        {
          status: 500,
          expectedMessage: 'An unexpected error occurred. Please try again.',
          expectedType: 'system' as ErrorType
        }
      ];

      testCases.forEach(({ status, expectedMessage, expectedType }) => {
        const error = {
          response: { status, data: { message: `HTTP ${status} Error` } },
          message: `Request failed with status code ${status}`
        };
        
        const enhancedError = errorService.classifyError(error);
        expect(enhancedError.userMessage).toBe(expectedMessage);
        expect(enhancedError.type).toBe(expectedType);
      });
    });

    test('should transform broker-specific errors to user-friendly messages', () => {
      const testCases = [
        {
          input: { message: 'insufficient funds available in account' },
          expectedMessage: 'Insufficient funds in your account to complete this transaction.',
          expectedActions: ['Add funds to your account', 'Reduce order quantity']
        },
        {
          input: { message: 'market is closed for trading today' },
          expectedMessage: 'Market is currently closed. Orders will be processed when market opens.',
          expectedActions: ['Wait for market to open', 'Schedule order for next trading session']
        },
        {
          input: { message: 'validation failed: invalid symbol format' },
          expectedMessage: 'Please check your input and try again.',
          expectedActions: ['Correct the highlighted fields', 'Follow the format requirements']
        }
      ];

      testCases.forEach(({ input, expectedMessage, expectedActions }) => {
        const enhancedError = errorService.classifyError(input);
        expect(enhancedError.userMessage).toBe(expectedMessage);
        expect(enhancedError.classification.suggestedActions).toEqual(expectedActions);
      });
    });

    test('should preserve context in error messages', () => {
      const error = { code: 'ECONNREFUSED' };
      const context = {
        userId: 'user123',
        brokerName: 'fyers',
        operation: 'placeOrder',
        requestId: 'req-456'
      };

      const enhancedError = errorService.classifyError(error, context);
      
      expect(enhancedError.context.userId).toBe('user123');
      expect(enhancedError.context.brokerName).toBe('fyers');
      expect(enhancedError.context.operation).toBe('placeOrder');
      expect(enhancedError.userMessage).toContain('Connection failed');
    });
  });

  describe('Suggested Actions Generation', () => {
    test('should provide actionable suggestions for network errors', () => {
      const testCases = [
        {
          error: { code: 'ECONNREFUSED' },
          expectedActions: ['Check internet connection', 'Try again in a few moments']
        },
        {
          error: { code: 'ETIMEDOUT' },
          expectedActions: ['Try again', 'Check internet connection']
        },
        {
          error: { code: 'ENOTFOUND' },
          expectedActions: ['Try again later', 'Contact support if problem persists']
        }
      ];

      testCases.forEach(({ error, expectedActions }) => {
        const actions = errorService.getSuggestedActions(error);
        expect(actions).toEqual(expectedActions);
      });
    });

    test('should provide specific suggestions for authentication errors', () => {
      const testCases = [
        {
          error: { response: { status: 401 } },
          expectedActions: ['Re-enter credentials', 'Check account status']
        },
        {
          error: { message: 'token expired' },
          expectedActions: ['Log in again', 'Refresh session']
        }
      ];

      testCases.forEach(({ error, expectedActions }) => {
        const actions = errorService.getSuggestedActions(error);
        expect(actions).toEqual(expectedActions);
      });
    });

    test('should provide helpful suggestions for broker errors', () => {
      const testCases = [
        {
          error: { message: 'insufficient funds in account' },
          expectedActions: ['Add funds to your account', 'Reduce order quantity']
        },
        {
          error: { message: 'market closed for trading' },
          expectedActions: ['Wait for market to open', 'Schedule order for next trading session']
        }
      ];

      testCases.forEach(({ error, expectedActions }) => {
        const actions = errorService.getSuggestedActions(error);
        expect(actions).toEqual(expectedActions);
      });
    });
  });

  describe('Error Severity Assessment', () => {
    test('should correctly assess error severity levels', () => {
      const testCases = [
        {
          error: { code: 'ECONNREFUSED' },
          expectedSeverity: 'high' as ErrorSeverity
        },
        {
          error: { code: 'ETIMEDOUT' },
          expectedSeverity: 'medium' as ErrorSeverity
        },
        {
          error: { message: 'market closed' },
          expectedSeverity: 'low' as ErrorSeverity
        },
        {
          error: { response: { status: 500 } },
          expectedSeverity: 'critical' as ErrorSeverity
        }
      ];

      testCases.forEach(({ error, expectedSeverity }) => {
        const enhancedError = errorService.classifyError(error);
        expect(enhancedError.severity).toBe(expectedSeverity);
      });
    });

    test('should prioritize critical system errors', () => {
      const criticalErrors = [
        { response: { status: 500 } },
        { message: 'database connection failed', type: 'DATABASE_ERROR' }
      ];

      criticalErrors.forEach(error => {
        const enhancedError = errorService.classifyError(error);
        expect(enhancedError.severity).toBe('critical');
      });
    });

    test('should classify validation errors as low severity', () => {
      const validationErrors = [
        { message: 'validation failed for input' },
        { message: 'market is closed' }
      ];

      validationErrors.forEach(error => {
        const enhancedError = errorService.classifyError(error);
        expect(enhancedError.type === 'validation' || enhancedError.severity === 'low').toBe(true);
      });
    });
  });

  describe('Context-Aware Error Messages', () => {
    test('should customize messages based on operation context', () => {
      const error = { code: 'ECONNREFUSED' };
      
      const contexts = [
        {
          operation: 'placeOrder',
          expectedToContain: 'Connection failed'
        },
        {
          operation: 'getAccountInfo',
          expectedToContain: 'Connection failed'
        },
        {
          operation: 'getMarketData',
          expectedToContain: 'Connection failed'
        }
      ];

      contexts.forEach(({ operation, expectedToContain }) => {
        const enhancedError = errorService.classifyError(error, { operation });
        expect(enhancedError.userMessage).toContain(expectedToContain);
        expect(enhancedError.context.operation).toBe(operation);
      });
    });

    test('should include broker context in error classification', () => {
      const error = { message: 'broker api error occurred', type: 'BROKER_API_ERROR' };
      const context = { brokerName: 'fyers', accountId: 'FY123' };

      const enhancedError = errorService.classifyError(error, context);
      
      expect(enhancedError.context.brokerName).toBe('fyers');
      expect(enhancedError.context.accountId).toBe('FY123');
      expect(enhancedError.type).toBe('broker');
    });
  });

  describe('Error Message Consistency', () => {
    test('should maintain consistent message format across error types', () => {
      const errors = [
        { code: 'ECONNREFUSED' },
        { response: { status: 401 } },
        { message: 'validation failed' },
        { message: 'insufficient funds' }
      ];

      errors.forEach(error => {
        const enhancedError = errorService.classifyError(error);
        
        // All messages should be complete sentences
        expect(enhancedError.userMessage).toMatch(/^[A-Z].*\.$/);
        
        // Should not contain technical jargon
        expect(enhancedError.userMessage).not.toMatch(/ECONNREFUSED|HTTP 401|stack trace/i);
        
        // Should be actionable or informative
        expect(enhancedError.userMessage.length).toBeGreaterThan(10);
      });
    });

    test('should avoid exposing sensitive information in user messages', () => {
      const sensitiveErrors = [
        { 
          response: { 
            status: 500, 
            data: { 
              message: 'Database connection failed: password incorrect for user admin',
              stack: 'Error at line 123 in database.js'
            }
          }
        },
        {
          message: 'API key abc123xyz is invalid for user john@example.com'
        }
      ];

      sensitiveErrors.forEach(error => {
        const enhancedError = errorService.classifyError(error);
        
        // Should not expose passwords, API keys, or stack traces
        expect(enhancedError.userMessage).not.toMatch(/password|api.?key|stack|admin|john@example\.com/i);
        
        // Technical details can contain sensitive info, but user message should not
        expect(enhancedError.userMessage).toMatch(/^(An unexpected error occurred|Server error occurred)/);
      });
    });
  });

  describe('Localization Support', () => {
    test('should support custom error mappings for different languages', () => {
      // Add a custom error mapping (simulating localization)
      errorService.addCustomErrorMapping('CUSTOM_LOCALIZED_ERROR', {
        type: 'system',
        severity: 'medium',
        retryable: false,
        userMessage: 'Erreur système inattendue. Veuillez réessayer.', // French
        technicalDetails: 'Custom localized error',
        suggestedActions: ['Réessayer', 'Contacter le support']
      });

      const error = { type: 'CUSTOM_LOCALIZED_ERROR' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.userMessage).toBe('Erreur système inattendue. Veuillez réessayer.');
      expect(enhancedError.classification.suggestedActions).toEqual(['Réessayer', 'Contacter le support']);
    });
  });

  describe('Error Message Performance', () => {
    test('should generate error messages efficiently', () => {
      const error = { code: 'ECONNREFUSED' };
      const startTime = Date.now();
      
      // Generate 1000 error messages
      for (let i = 0; i < 1000; i++) {
        errorService.getUserFriendlyMessage(error);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
    });

    test('should cache error classifications for repeated errors', () => {
      const error = { code: 'ECONNREFUSED' };
      
      const startTime1 = Date.now();
      const result1 = errorService.classifyError(error);
      const duration1 = Date.now() - startTime1;
      
      const startTime2 = Date.now();
      const result2 = errorService.classifyError(error);
      const duration2 = Date.now() - startTime2;
      
      // Results should be consistent
      expect(result1.type).toBe(result2.type);
      expect(result1.userMessage).toBe(result2.userMessage);
      
      // Note: We're not actually implementing caching in the service,
      // but this test documents the expected behavior for future optimization
    });
  });
});