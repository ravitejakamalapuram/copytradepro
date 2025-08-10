import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorClassificationService } from '../services/errorClassificationService';
import { ErrorType, ErrorSeverity, ErrorClassification, EnhancedError } from '../types/errorTypes';

describe('ErrorClassificationService', () => {
  let errorClassificationService: ErrorClassificationService;

  beforeEach(() => {
    // Get fresh instance
    errorClassificationService = ErrorClassificationService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      // Act
      const instance1 = ErrorClassificationService.getInstance();
      const instance2 = ErrorClassificationService.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });

  describe('classifyError', () => {
    it('should classify network connection refused error', () => {
      // Arrange
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      const context = { component: 'BROKER_CONTROLLER', operation: 'CONNECT' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          timestamp: expect.any(Date),
          type: 'network',
          severity: 'high',
          context: expect.objectContaining(context),
          originalError: error,
          userMessage: 'Connection failed. Please check your internet connection and try again.',
          technicalMessage: 'Connection refused by server',
          retryCount: 0,
          resolved: false,
          classification: expect.objectContaining({
            type: 'network',
            severity: 'high',
            retryable: true,
            suggestedActions: ['Check internet connection', 'Try again in a few moments']
          })
        })
      );
    });

    it('should classify timeout error', () => {
      // Arrange
      const error = { code: 'ETIMEDOUT', message: 'Request timeout' };
      const context = { component: 'API_CLIENT', operation: 'FETCH_DATA' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('network');
      expect(result.severity).toBe('medium');
      expect(result.classification.retryable).toBe(true);
      expect(result.classification.maxRetries).toBe(2);
      expect(result.classification.retryDelay).toBe(1000);
    });

    it('should classify DNS resolution error', () => {
      // Arrange
      const error = { code: 'ENOTFOUND', message: 'DNS resolution failed' };
      const context = { component: 'EXTERNAL_API', operation: 'CALL' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('network');
      expect(result.severity).toBe('high');
      expect(result.classification.retryable).toBe(false);
      expect(result.userMessage).toBe('Service temporarily unavailable. Please try again later.');
    });

    it('should classify HTTP 401 unauthorized error', () => {
      // Arrange
      const error = { 
        response: { status: 401 }, 
        message: 'Unauthorized' 
      };
      const context = { component: 'AUTH_CONTROLLER', operation: 'LOGIN' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('authentication');
      expect(result.severity).toBe('high');
      expect(result.classification.retryable).toBe(false);
      expect(result.userMessage).toBe('Authentication failed. Please check your credentials and try again.');
    });

    it('should classify HTTP 500 internal server error', () => {
      // Arrange
      const error = { 
        response: { status: 500 }, 
        message: 'Internal server error' 
      };
      const context = { component: 'API_CONTROLLER', operation: 'PROCESS' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('system');
      expect(result.severity).toBe('critical');
      expect(result.classification.retryable).toBe(true);
      expect(result.classification.maxRetries).toBe(1);
    });

    it('should classify token expired error', () => {
      // Arrange
      const error = { message: 'token expired' };
      const context = { component: 'AUTH_MIDDLEWARE', operation: 'VERIFY_TOKEN' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('authentication');
      expect(result.severity).toBe('medium');
      expect(result.classification.retryable).toBe(true);
      expect(result.classification.maxRetries).toBe(1);
      expect(result.classification.retryDelay).toBe(0);
    });

    it('should classify validation error', () => {
      // Arrange
      const error = { message: 'validation failed for field email' };
      const context = { component: 'USER_CONTROLLER', operation: 'CREATE_USER' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('validation');
      expect(result.severity).toBe('low');
      expect(result.classification.retryable).toBe(false);
      expect(result.userMessage).toBe('Please check your input and try again.');
    });

    it('should classify insufficient funds error', () => {
      // Arrange
      const error = { message: 'insufficient funds in account' };
      const context = { component: 'BROKER_CONTROLLER', operation: 'PLACE_ORDER' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('broker');
      expect(result.severity).toBe('medium');
      expect(result.classification.retryable).toBe(false);
      expect(result.userMessage).toBe('Insufficient funds in your account to complete this transaction.');
      expect(result.classification.suggestedActions).toContain('Add funds to your account');
    });

    it('should classify market closed error', () => {
      // Arrange
      const error = { message: 'market is closed for trading' };
      const context = { component: 'TRADING_CONTROLLER', operation: 'EXECUTE_TRADE' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('broker');
      expect(result.severity).toBe('low');
      expect(result.classification.retryable).toBe(false);
      expect(result.userMessage).toBe('Market is currently closed. Orders will be processed when market opens.');
    });

    it('should classify unknown error with default classification', () => {
      // Arrange
      const error = { message: 'some unknown error occurred' };
      const context = { component: 'UNKNOWN_COMPONENT', operation: 'UNKNOWN_OPERATION' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('system');
      expect(result.severity).toBe('medium');
      expect(result.classification.retryable).toBe(false);
      expect(result.userMessage).toBe('An unexpected error occurred. Please try again or contact support.');
      expect(result.classification.technicalDetails).toBe('some unknown error occurred');
    });

    it('should handle error without message', () => {
      // Arrange
      const error = {};
      const context = { component: 'TEST_COMPONENT', operation: 'TEST_OPERATION' };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.type).toBe('system');
      expect(result.classification.technicalDetails).toBe('Unknown error');
    });

    it('should include context in enhanced error', () => {
      // Arrange
      const error = { code: 'ECONNREFUSED' };
      const context = { 
        component: 'BROKER_CONTROLLER', 
        operation: 'CONNECT',
        userId: 'user_123',
        brokerName: 'zerodha'
      };

      // Act
      const result = errorClassificationService.classifyError(error, context);

      // Assert
      expect(result.context).toEqual(
        expect.objectContaining({
          component: 'BROKER_CONTROLLER',
          operation: 'CONNECT',
          userId: 'user_123',
          brokerName: 'zerodha',
          timestamp: expect.any(Date)
        })
      );
    });
  });

  describe('shouldRetry', () => {
    it('should return true for retryable error within retry limit', () => {
      // Arrange
      const enhancedError: EnhancedError = {
        id: 'error_1',
        timestamp: new Date(),
        type: 'network',
        severity: 'medium',
        context: { timestamp: new Date() },
        originalError: { code: 'ETIMEDOUT' },
        userMessage: 'Request timed out',
        technicalMessage: 'Request timeout',
        retryCount: 1,
        resolved: false,
        classification: {
          type: 'network',
          severity: 'medium',
          retryable: true,
          maxRetries: 3,
          userMessage: 'Request timed out',
          technicalDetails: 'Request timeout',
          suggestedActions: []
        }
      };

      // Act
      const result = errorClassificationService.shouldRetry(enhancedError);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-retryable error', () => {
      // Arrange
      const enhancedError: EnhancedError = {
        id: 'error_1',
        timestamp: new Date(),
        type: 'validation',
        severity: 'low',
        context: { timestamp: new Date() },
        originalError: { message: 'validation failed' },
        userMessage: 'Validation failed',
        technicalMessage: 'Input validation failed',
        retryCount: 0,
        resolved: false,
        classification: {
          type: 'validation',
          severity: 'low',
          retryable: false,
          userMessage: 'Validation failed',
          technicalDetails: 'Input validation failed',
          suggestedActions: []
        }
      };

      // Act
      const result = errorClassificationService.shouldRetry(enhancedError);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when retry count exceeds limit', () => {
      // Arrange
      const enhancedError: EnhancedError = {
        id: 'error_1',
        timestamp: new Date(),
        type: 'network',
        severity: 'medium',
        context: { timestamp: new Date() },
        originalError: { code: 'ETIMEDOUT' },
        userMessage: 'Request timed out',
        technicalMessage: 'Request timeout',
        retryCount: 3,
        resolved: false,
        classification: {
          type: 'network',
          severity: 'medium',
          retryable: true,
          maxRetries: 2,
          userMessage: 'Request timed out',
          technicalDetails: 'Request timeout',
          suggestedActions: []
        }
      };

      // Act
      const result = errorClassificationService.shouldRetry(enhancedError);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff delay', () => {
      // Arrange
      const enhancedError: EnhancedError = {
        id: 'error_1',
        timestamp: new Date(),
        type: 'network',
        severity: 'medium',
        context: { timestamp: new Date() },
        originalError: { code: 'ETIMEDOUT' },
        userMessage: 'Request timed out',
        technicalMessage: 'Request timeout',
        retryCount: 2,
        resolved: false,
        classification: {
          type: 'network',
          severity: 'medium',
          retryable: true,
          retryDelay: 1000,
          userMessage: 'Request timed out',
          technicalDetails: 'Request timeout',
          suggestedActions: []
        }
      };

      // Act
      const delay = errorClassificationService.getRetryDelay(enhancedError);

      // Assert
      // Base delay (1000) * backoffMultiplier^retryCount (2^2) = 4000
      expect(delay).toBe(4000);
    });

    it('should use default base delay when not specified', () => {
      // Arrange
      const enhancedError: EnhancedError = {
        id: 'error_1',
        timestamp: new Date(),
        type: 'system',
        severity: 'high',
        context: { timestamp: new Date() },
        originalError: { message: 'system error' },
        userMessage: 'System error',
        technicalMessage: 'System error',
        retryCount: 1,
        resolved: false,
        classification: {
          type: 'system',
          severity: 'high',
          retryable: true,
          userMessage: 'System error',
          technicalDetails: 'System error',
          suggestedActions: []
        }
      };

      // Act
      const delay = errorClassificationService.getRetryDelay(enhancedError);

      // Assert
      // Default base delay (1000) * backoffMultiplier^retryCount (2^1) = 2000
      expect(delay).toBe(2000);
    });

    it('should cap delay at maximum value', () => {
      // Arrange
      const enhancedError: EnhancedError = {
        id: 'error_1',
        timestamp: new Date(),
        type: 'network',
        severity: 'high',
        context: { timestamp: new Date() },
        originalError: { code: 'ECONNREFUSED' },
        userMessage: 'Connection failed',
        technicalMessage: 'Connection refused',
        retryCount: 10, // High retry count to exceed max delay
        resolved: false,
        classification: {
          type: 'network',
          severity: 'high',
          retryable: true,
          retryDelay: 5000,
          userMessage: 'Connection failed',
          technicalDetails: 'Connection refused',
          suggestedActions: []
        }
      };

      // Act
      const delay = errorClassificationService.getRetryDelay(enhancedError);

      // Assert
      // Should be capped at maxDelay (30000)
      expect(delay).toBe(30000);
    });
  });

  describe('incrementRetryCount', () => {
    it('should increment retry count', () => {
      // Arrange
      const enhancedError: EnhancedError = {
        id: 'error_1',
        timestamp: new Date(),
        type: 'network',
        severity: 'medium',
        context: { timestamp: new Date() },
        originalError: { code: 'ETIMEDOUT' },
        userMessage: 'Request timed out',
        technicalMessage: 'Request timeout',
        retryCount: 1,
        resolved: false,
        classification: {
          type: 'network',
          severity: 'medium',
          retryable: true,
          userMessage: 'Request timed out',
          technicalDetails: 'Request timeout',
          suggestedActions: []
        }
      };

      // Act
      const result = errorClassificationService.incrementRetryCount(enhancedError);

      // Assert
      expect(result.retryCount).toBe(2);
      expect(result.id).toBe(enhancedError.id); // Should preserve other properties
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for classified error', () => {
      // Arrange
      const error = { code: 'ECONNREFUSED' };
      const context = { component: 'BROKER_CONTROLLER', operation: 'CONNECT' };

      // Act
      const message = errorClassificationService.getUserFriendlyMessage(error, context);

      // Assert
      expect(message).toBe('Connection failed. Please check your internet connection and try again.');
    });

    it('should return default message for unknown error', () => {
      // Arrange
      const error = { message: 'unknown error' };
      const context = { component: 'UNKNOWN_COMPONENT', operation: 'UNKNOWN_OPERATION' };

      // Act
      const message = errorClassificationService.getUserFriendlyMessage(error, context);

      // Assert
      expect(message).toBe('An unexpected error occurred. Please try again or contact support.');
    });
  });

  describe('getSuggestedActions', () => {
    it('should return suggested actions for classified error', () => {
      // Arrange
      const error = { code: 'ECONNREFUSED' };
      const context = { component: 'BROKER_CONTROLLER', operation: 'CONNECT' };

      // Act
      const actions = errorClassificationService.getSuggestedActions(error, context);

      // Assert
      expect(actions).toEqual(['Check internet connection', 'Try again in a few moments']);
    });

    it('should return default actions for unknown error', () => {
      // Arrange
      const error = { message: 'unknown error' };
      const context = { component: 'UNKNOWN_COMPONENT', operation: 'UNKNOWN_OPERATION' };

      // Act
      const actions = errorClassificationService.getSuggestedActions(error, context);

      // Assert
      expect(actions).toEqual(['Try again', 'Contact support if problem persists']);
    });
  });

  describe('updateRetryConfig', () => {
    it('should update retry configuration', () => {
      // Arrange
      const newConfig = {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 60000
      };

      // Act
      errorClassificationService.updateRetryConfig(newConfig);

      // Test the updated config by checking retry behavior
      const enhancedError: EnhancedError = {
        id: 'error_1',
        timestamp: new Date(),
        type: 'network',
        severity: 'medium',
        context: { timestamp: new Date() },
        originalError: { code: 'ETIMEDOUT' },
        userMessage: 'Request timed out',
        technicalMessage: 'Request timeout',
        retryCount: 4,
        resolved: false,
        classification: {
          type: 'network',
          severity: 'medium',
          retryable: true,
          userMessage: 'Request timed out',
          technicalDetails: 'Request timeout',
          suggestedActions: []
        }
      };

      // Assert
      expect(errorClassificationService.shouldRetry(enhancedError)).toBe(true); // Should allow 5 retries now
    });
  });

  describe('addCustomErrorMapping', () => {
    it('should add custom error mapping', () => {
      // Arrange
      const customErrorCode = 'CUSTOM_ERROR';
      const customClassification: ErrorClassification = {
        type: 'custom',
        severity: 'high',
        retryable: false,
        userMessage: 'Custom error occurred',
        technicalDetails: 'Custom technical details',
        suggestedActions: ['Custom action 1', 'Custom action 2']
      };

      // Act
      errorClassificationService.addCustomErrorMapping(customErrorCode, customClassification);

      // Test the custom mapping
      const error = { type: 'CUSTOM_ERROR' };
      const result = errorClassificationService.classifyError(error);

      // Assert
      expect(result.type).toBe('custom');
      expect(result.severity).toBe('high');
      expect(result.userMessage).toBe('Custom error occurred');
      expect(result.classification.suggestedActions).toEqual(['Custom action 1', 'Custom action 2']);
    });
  });

  describe('error code extraction', () => {
    it('should extract error code from axios error response', () => {
      // Arrange
      const error = {
        response: { status: 429 },
        message: 'Too many requests'
      };

      // Act
      const result = errorClassificationService.classifyError(error);

      // Assert
      expect(result.type).toBe('system'); // Default for HTTP_429
    });

    it('should extract error code from error.code property', () => {
      // Arrange
      const error = {
        code: 'ENOTFOUND',
        message: 'DNS lookup failed'
      };

      // Act
      const result = errorClassificationService.classifyError(error);

      // Assert
      expect(result.type).toBe('network');
      expect(result.severity).toBe('high');
    });

    it('should extract error code from error.type property', () => {
      // Arrange
      const error = {
        type: 'VALIDATION_ERROR',
        message: 'Input validation failed'
      };

      // Act
      const result = errorClassificationService.classifyError(error);

      // Assert
      expect(result.type).toBe('validation');
      expect(result.severity).toBe('low');
    });

    it('should detect broker-specific errors from message content', () => {
      // Arrange
      const error = {
        message: 'Broker API returned insufficient funds error'
      };

      // Act
      const result = errorClassificationService.classifyError(error);

      // Assert
      expect(result.type).toBe('broker');
      expect(result.classification.retryable).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle null error', () => {
      // Act
      const result = errorClassificationService.classifyError(null);

      // Assert
      expect(result.type).toBe('system');
      expect(result.classification.technicalDetails).toBe('Unknown error');
    });

    it('should handle undefined error', () => {
      // Act
      const result = errorClassificationService.classifyError(undefined);

      // Assert
      expect(result.type).toBe('system');
      expect(result.classification.technicalDetails).toBe('Unknown error');
    });

    it('should handle error with circular references', () => {
      // Arrange
      const error: any = { message: 'Circular error' };
      error.self = error; // Create circular reference

      // Act & Assert
      expect(() => errorClassificationService.classifyError(error)).not.toThrow();
    });
  });
});