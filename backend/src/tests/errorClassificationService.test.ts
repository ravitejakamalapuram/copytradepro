import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ErrorClassificationService } from '../services/errorClassificationService';
import { ErrorType, ErrorSeverity, ErrorClassification, EnhancedError } from '../types/errorTypes';

describe('ErrorClassificationService', () => {
  let errorService: ErrorClassificationService;

  beforeEach(() => {
    // Reset singleton instance for each test
    (ErrorClassificationService as any).instance = undefined;
    errorService = ErrorClassificationService.getInstance();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = ErrorClassificationService.getInstance();
      const instance2 = ErrorClassificationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Error Classification', () => {
    test('should classify network connection refused error', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('network');
      expect(enhancedError.severity).toBe('high');
      expect(enhancedError.classification.retryable).toBe(true);
      expect(enhancedError.userMessage).toContain('Connection failed');
      expect(enhancedError.classification.suggestedActions).toContain('Check internet connection');
    });

    test('should classify network timeout error', () => {
      const error = { code: 'ETIMEDOUT', message: 'Request timeout' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('network');
      expect(enhancedError.severity).toBe('medium');
      expect(enhancedError.classification.retryable).toBe(true);
      expect(enhancedError.userMessage).toContain('Request timed out');
    });

    test('should classify DNS resolution error', () => {
      const error = { code: 'ENOTFOUND', message: 'DNS resolution failed' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('network');
      expect(enhancedError.severity).toBe('high');
      expect(enhancedError.classification.retryable).toBe(false);
      expect(enhancedError.userMessage).toContain('Service temporarily unavailable');
    });

    test('should classify HTTP 401 unauthorized error', () => {
      const error = { 
        response: { status: 401, data: { message: 'Unauthorized' } },
        message: 'Request failed with status code 401'
      };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('authentication');
      expect(enhancedError.severity).toBe('high');
      expect(enhancedError.classification.retryable).toBe(false);
      expect(enhancedError.userMessage).toContain('Authentication failed');
    });

    test('should classify HTTP 500 internal server error', () => {
      const error = { 
        response: { status: 500, data: { message: 'Internal Server Error' } },
        message: 'Request failed with status code 500'
      };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('system');
      expect(enhancedError.severity).toBe('critical');
      expect(enhancedError.classification.retryable).toBe(true);
      expect(enhancedError.userMessage).toContain('An unexpected error occurred');
    });

    test('should classify token expired error from message', () => {
      const error = { message: 'token expired', type: 'TOKEN_EXPIRED' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('authentication');
      expect(enhancedError.severity).toBe('medium');
      expect(enhancedError.classification.retryable).toBe(true);
      expect(enhancedError.userMessage).toContain('Session expired');
    });

    test('should classify insufficient funds error from message', () => {
      const error = { message: 'insufficient funds in account' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('broker');
      expect(enhancedError.severity).toBe('medium');
      expect(enhancedError.classification.retryable).toBe(false);
      expect(enhancedError.userMessage).toContain('Insufficient funds');
    });

    test('should classify market closed error from message', () => {
      const error = { message: 'market is closed for trading' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('broker');
      expect(enhancedError.severity).toBe('low');
      expect(enhancedError.classification.retryable).toBe(false);
      expect(enhancedError.userMessage).toContain('Market is currently closed');
    });

    test('should classify validation error from message', () => {
      const error = { message: 'validation failed for input data' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('validation');
      expect(enhancedError.severity).toBe('low');
      expect(enhancedError.classification.retryable).toBe(false);
      expect(enhancedError.userMessage).toContain('Please check your input');
    });

    test('should handle unknown error with default classification', () => {
      const error = { message: 'some unknown error occurred' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('system');
      expect(enhancedError.severity).toBe('medium');
      expect(enhancedError.classification.retryable).toBe(false);
      expect(enhancedError.userMessage).toContain('An unexpected error occurred');
    });

    test('should include context in enhanced error', () => {
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
      expect(enhancedError.context.requestId).toBe('req-456');
      expect(enhancedError.context.timestamp).toBeInstanceOf(Date);
    });

    test('should generate unique IDs for each error', () => {
      const error = { code: 'ECONNREFUSED' };
      const error1 = errorService.classifyError(error);
      const error2 = errorService.classifyError(error);

      expect(error1.id).not.toBe(error2.id);
      expect(error1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Retry Logic', () => {
    test('should determine if error is retryable', () => {
      const retryableError = errorService.classifyError({ code: 'ECONNREFUSED' });
      const nonRetryableError = errorService.classifyError({ code: 'ENOTFOUND' });

      expect(errorService.shouldRetry(retryableError)).toBe(true);
      expect(errorService.shouldRetry(nonRetryableError)).toBe(false);
    });

    test('should not retry if max retries exceeded', () => {
      const error = errorService.classifyError({ code: 'ECONNREFUSED' });
      error.retryCount = 5; // Exceed max retries

      expect(errorService.shouldRetry(error)).toBe(false);
    });

    test('should calculate retry delay with exponential backoff', () => {
      const error = errorService.classifyError({ code: 'ECONNREFUSED' });
      
      // First retry
      error.retryCount = 0;
      const delay1 = errorService.getRetryDelay(error);
      expect(delay1).toBe(2000); // Custom delay for ECONNREFUSED

      // Second retry
      error.retryCount = 1;
      const delay2 = errorService.getRetryDelay(error);
      expect(delay2).toBe(4000); // 2000 * 2^1

      // Third retry
      error.retryCount = 2;
      const delay3 = errorService.getRetryDelay(error);
      expect(delay3).toBe(8000); // 2000 * 2^2
    });

    test('should respect maximum delay limit', () => {
      const error = errorService.classifyError({ code: 'ECONNREFUSED' });
      error.retryCount = 10; // High retry count

      const delay = errorService.getRetryDelay(error);
      expect(delay).toBeLessThanOrEqual(30000); // Max delay is 30 seconds
    });

    test('should use default delay for errors without custom delay', () => {
      const error = errorService.classifyError({ 
        response: { status: 500 },
        message: 'Internal server error'
      });
      
      error.retryCount = 0;
      const delay = errorService.getRetryDelay(error);
      expect(delay).toBe(2000); // Custom delay for INTERNAL_SERVER_ERROR
    });

    test('should increment retry count', () => {
      const error = errorService.classifyError({ code: 'ECONNREFUSED' });
      expect(error.retryCount).toBe(0);

      const incrementedError = errorService.incrementRetryCount(error);
      expect(incrementedError.retryCount).toBe(1);
      expect(error.retryCount).toBe(0); // Original should be unchanged
    });
  });

  describe('User-Friendly Messages', () => {
    test('should return user-friendly message for network errors', () => {
      const error = { code: 'ECONNREFUSED' };
      const message = errorService.getUserFriendlyMessage(error);
      
      expect(message).toBe('Connection failed. Please check your internet connection and try again.');
    });

    test('should return user-friendly message for authentication errors', () => {
      const error = { response: { status: 401 } };
      const message = errorService.getUserFriendlyMessage(error);
      
      expect(message).toBe('Authentication failed. Please check your credentials and try again.');
    });

    test('should return suggested actions for errors', () => {
      const error = { code: 'ECONNREFUSED' };
      const actions = errorService.getSuggestedActions(error);
      
      expect(actions).toContain('Check internet connection');
      expect(actions).toContain('Try again in a few moments');
    });
  });

  describe('Configuration Management', () => {
    test('should update retry configuration', () => {
      const newConfig = {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 60000
      };

      errorService.updateRetryConfig(newConfig);

      // Create an error without specific maxRetries (will use global config)
      const error = errorService.classifyError({ message: 'unknown error' });
      // Make it retryable by adding a custom mapping
      errorService.addCustomErrorMapping('UNKNOWN_ERROR', {
        type: 'system',
        severity: 'medium',
        retryable: true,
        userMessage: 'Unknown error occurred',
        technicalDetails: 'Unknown error',
        suggestedActions: ['Try again']
      });
      
      const retryableError = errorService.classifyError({ type: 'UNKNOWN_ERROR' });
      retryableError.retryCount = 4;
      expect(errorService.shouldRetry(retryableError)).toBe(true);

      retryableError.retryCount = 5;
      expect(errorService.shouldRetry(retryableError)).toBe(false);
    });

    test('should add custom error mapping', () => {
      const customClassification: ErrorClassification = {
        type: 'broker',
        severity: 'high',
        retryable: true,
        userMessage: 'Custom broker error occurred',
        technicalDetails: 'Custom technical details',
        suggestedActions: ['Custom action 1', 'Custom action 2'],
        retryDelay: 5000,
        maxRetries: 2
      };

      errorService.addCustomErrorMapping('CUSTOM_BROKER_ERROR', customClassification);

      const error = { type: 'CUSTOM_BROKER_ERROR' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('broker');
      expect(enhancedError.severity).toBe('high');
      expect(enhancedError.userMessage).toBe('Custom broker error occurred');
      expect(enhancedError.classification.retryDelay).toBe(5000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined errors', () => {
      const enhancedError1 = errorService.classifyError(null);
      const enhancedError2 = errorService.classifyError(undefined);

      expect(enhancedError1.type).toBe('system');
      expect(enhancedError2.type).toBe('system');
      expect(enhancedError1.userMessage).toContain('An unexpected error occurred');
    });

    test('should handle errors without message', () => {
      const error = { code: 'UNKNOWN_CODE' };
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.type).toBe('system');
      expect(enhancedError.userMessage).toContain('An unexpected error occurred');
    });

    test('should handle complex nested error objects', () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_FAILED',
              details: ['Field A is required', 'Field B is invalid']
            }
          }
        },
        config: {
          url: '/api/orders',
          method: 'POST'
        }
      };

      const enhancedError = errorService.classifyError(error);
      // HTTP 400 errors get default classification as system type
      expect(enhancedError.type).toBe('system');
      expect(enhancedError.originalError).toEqual(error);
    });

    test('should preserve stack trace when available', () => {
      const error = new Error('Test error with stack');
      const enhancedError = errorService.classifyError(error);

      expect(enhancedError.stackTrace).toBeDefined();
      expect(enhancedError.stackTrace).toContain('Test error with stack');
    });
  });
});