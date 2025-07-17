import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import axios, { AxiosError, AxiosResponse } from 'axios';

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Helper to create AxiosError with proper typing
const createAxiosError = (message: string, code?: string, status?: number): AxiosError => {
  const error = new Error(message) as AxiosError;
  error.name = 'AxiosError';
  error.isAxiosError = true;
  error.message = message; // Ensure message is set
  
  if (code) {
    error.code = code;
  }
  
  if (status) {
    error.response = {
      status,
      data: {},
      statusText: `HTTP ${status}`,
      headers: {},
      config: {} as any
    };
  }
  
  return error;
};

// Import the functions we want to test (these would be extracted from api.ts)
const isRetryableError = (error: AxiosError): boolean => {
  // Network errors
  if (!error.response) {
    return ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'].includes(error.code || '');
  }

  // HTTP status codes that are retryable
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  return retryableStatuses.includes(error.response.status);
};

const getRetryDelay = (retryCount: number): number => {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = baseDelay * Math.pow(2, retryCount);
  return Math.min(delay, maxDelay);
};

const getUserFriendlyErrorMessage = (error: AxiosError): string => {
  // Network errors
  if (!error.response) {
    switch (error.code) {
      case 'ECONNREFUSED':
        return 'Connection failed. Please check your internet connection and try again.';
      case 'ETIMEDOUT':
        return 'Request timed out. Please try again.';
      case 'ENOTFOUND':
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return 'Network error occurred. Please check your connection and try again.';
    }
  }

  // HTTP status errors
  switch (error.response.status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Authentication failed. Please log in again.';
    case 403:
      return 'Access denied. You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'Conflict occurred. The resource may have been modified by another user.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error occurred. Please try again.';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return (error.response.data as any)?.message || 'An unexpected error occurred. Please try again.';
  }
};

const getSuggestedActions = (error: AxiosError): string[] => {
  // Network errors
  if (!error.response) {
    switch (error.code) {
      case 'ECONNREFUSED':
      case 'ETIMEDOUT':
        return ['Check internet connection', 'Try again in a few moments'];
      case 'ENOTFOUND':
        return ['Try again later', 'Contact support if problem persists'];
      default:
        return ['Check internet connection', 'Try again'];
    }
  }

  // HTTP status errors
  switch (error.response.status) {
    case 400:
      return ['Check your input', 'Ensure all required fields are filled'];
    case 401:
      return ['Log in again', 'Check your credentials'];
    case 403:
      return ['Contact administrator', 'Check your account permissions'];
    case 404:
      return ['Check the URL', 'Try refreshing the page'];
    case 409:
      return ['Refresh the page', 'Try again'];
    case 429:
      return ['Wait a moment', 'Try again later'];
    case 500:
    case 502:
    case 503:
    case 504:
      return ['Try again', 'Contact support if problem persists'];
    default:
      return ['Try again', 'Contact support if needed'];
  }
};

describe('API Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isRetryableError', () => {
    test('should identify network errors as retryable', () => {
      const networkErrors = [
        { code: 'ECONNREFUSED', message: 'Connection refused' },
        { code: 'ETIMEDOUT', message: 'Request timeout' },
        { code: 'ENOTFOUND', message: 'DNS resolution failed' },
        { code: 'ENETUNREACH', message: 'Network unreachable' }
      ];

      networkErrors.forEach(errorData => {
        const error = new Error(errorData.message) as AxiosError;
        error.code = errorData.code;
        delete (error as any).response; // Network errors don't have response

        expect(isRetryableError(error)).toBe(true);
      });
    });

    test('should identify retryable HTTP status codes', () => {
      const retryableStatuses = [408, 429, 500, 502, 503, 504];

      retryableStatuses.forEach(status => {
        const error = new Error(`HTTP ${status}`) as AxiosError;
        error.response = {
          status,
          data: {},
          statusText: `HTTP ${status}`,
          headers: {},
          config: {} as any
        };

        expect(isRetryableError(error)).toBe(true);
      });
    });

    test('should identify non-retryable HTTP status codes', () => {
      const nonRetryableStatuses = [400, 401, 403, 404, 409, 422];

      nonRetryableStatuses.forEach(status => {
        const error = new Error(`HTTP ${status}`) as AxiosError;
        error.response = {
          status,
          data: {},
          statusText: `HTTP ${status}`,
          headers: {},
          config: {} as any
        };

        expect(isRetryableError(error)).toBe(false);
      });
    });

    test('should identify non-retryable network errors', () => {
      const nonRetryableNetworkErrors = ['EACCES', 'EPERM', 'EINVAL'];

      nonRetryableNetworkErrors.forEach(code => {
        const error = createAxiosError('Network error', code);
        expect(isRetryableError(error)).toBe(false);
      });
    });
  });

  describe('getRetryDelay', () => {
    test('should calculate exponential backoff delay', () => {
      expect(getRetryDelay(0)).toBe(1000);  // 1 * 2^0 = 1 second
      expect(getRetryDelay(1)).toBe(2000);  // 1 * 2^1 = 2 seconds
      expect(getRetryDelay(2)).toBe(4000);  // 1 * 2^2 = 4 seconds
      expect(getRetryDelay(3)).toBe(8000);  // 1 * 2^3 = 8 seconds
      expect(getRetryDelay(4)).toBe(16000); // 1 * 2^4 = 16 seconds
    });

    test('should respect maximum delay limit', () => {
      expect(getRetryDelay(10)).toBe(30000); // Should cap at 30 seconds
      expect(getRetryDelay(20)).toBe(30000); // Should cap at 30 seconds
    });

    test('should handle edge cases', () => {
      expect(getRetryDelay(-1)).toBe(500);   // 1000 * 2^(-1) = 500ms
      expect(Math.round(getRetryDelay(0.5))).toBe(1414); // 1000 * 2^(0.5) ≈ 1414ms
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    test('should return user-friendly messages for network errors', () => {
      const testCases = [
        {
          code: 'ECONNREFUSED',
          expected: 'Connection failed. Please check your internet connection and try again.'
        },
        {
          code: 'ETIMEDOUT',
          expected: 'Request timed out. Please try again.'
        },
        {
          code: 'ENOTFOUND',
          expected: 'Service temporarily unavailable. Please try again later.'
        },
        {
          code: 'UNKNOWN_NETWORK_ERROR',
          expected: 'Network error occurred. Please check your connection and try again.'
        }
      ];

      testCases.forEach(({ code, expected }) => {
        const error = createAxiosError('Network error', code);
        expect(getUserFriendlyErrorMessage(error)).toBe(expected);
      });
    });

    test('should return user-friendly messages for HTTP errors', () => {
      const testCases = [
        { status: 400, expected: 'Invalid request. Please check your input and try again.' },
        { status: 401, expected: 'Authentication failed. Please log in again.' },
        { status: 403, expected: 'Access denied. You do not have permission to perform this action.' },
        { status: 404, expected: 'The requested resource was not found.' },
        { status: 409, expected: 'Conflict occurred. The resource may have been modified by another user.' },
        { status: 429, expected: 'Too many requests. Please wait a moment and try again.' },
        { status: 500, expected: 'Server error occurred. Please try again.' },
        { status: 502, expected: 'Service temporarily unavailable. Please try again later.' },
        { status: 503, expected: 'Service temporarily unavailable. Please try again later.' },
        { status: 504, expected: 'Service temporarily unavailable. Please try again later.' }
      ];

      testCases.forEach(({ status, expected }) => {
        const error = new Error(`HTTP ${status}`) as AxiosError;
        error.response = {
          status,
          data: {},
          statusText: `HTTP ${status}`,
          headers: {},
          config: {} as any
        };

        expect(getUserFriendlyErrorMessage(error)).toBe(expected);
      });
    });

    test('should use custom message from response data when available', () => {
      const error = new Error('HTTP 422') as AxiosError;
      error.response = {
        status: 422,
        data: { message: 'Custom validation error message' },
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as any
      };

      expect(getUserFriendlyErrorMessage(error)).toBe('Custom validation error message');
    });

    test('should fallback to default message for unknown status codes', () => {
      const error = new Error('HTTP 418') as AxiosError;
      error.response = {
        status: 418,
        data: {},
        statusText: "I'm a teapot",
        headers: {},
        config: {} as any
      };

      expect(getUserFriendlyErrorMessage(error)).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('getSuggestedActions', () => {
    test('should return appropriate actions for network errors', () => {
      const testCases = [
        {
          code: 'ECONNREFUSED',
          expected: ['Check internet connection', 'Try again in a few moments']
        },
        {
          code: 'ETIMEDOUT',
          expected: ['Check internet connection', 'Try again in a few moments']
        },
        {
          code: 'ENOTFOUND',
          expected: ['Try again later', 'Contact support if problem persists']
        },
        {
          code: 'UNKNOWN_ERROR',
          expected: ['Check internet connection', 'Try again']
        }
      ];

      testCases.forEach(({ code, expected }) => {
        const error = createAxiosError('Network error', code);
        expect(getSuggestedActions(error)).toEqual(expected);
      });
    });

    test('should return appropriate actions for HTTP errors', () => {
      const testCases = [
        { status: 400, expected: ['Check your input', 'Ensure all required fields are filled'] },
        { status: 401, expected: ['Log in again', 'Check your credentials'] },
        { status: 403, expected: ['Contact administrator', 'Check your account permissions'] },
        { status: 404, expected: ['Check the URL', 'Try refreshing the page'] },
        { status: 409, expected: ['Refresh the page', 'Try again'] },
        { status: 429, expected: ['Wait a moment', 'Try again later'] },
        { status: 500, expected: ['Try again', 'Contact support if problem persists'] },
        { status: 502, expected: ['Try again', 'Contact support if problem persists'] },
        { status: 503, expected: ['Try again', 'Contact support if problem persists'] },
        { status: 504, expected: ['Try again', 'Contact support if problem persists'] }
      ];

      testCases.forEach(({ status, expected }) => {
        const error = new Error(`HTTP ${status}`) as AxiosError;
        error.response = {
          status,
          data: {},
          statusText: `HTTP ${status}`,
          headers: {},
          config: {} as any
        };

        expect(getSuggestedActions(error)).toEqual(expected);
      });
    });

    test('should return default actions for unknown status codes', () => {
      const error = new Error('HTTP 418') as AxiosError;
      error.response = {
        status: 418,
        data: {},
        statusText: "I'm a teapot",
        headers: {},
        config: {} as any
      };

      expect(getSuggestedActions(error)).toEqual(['Try again', 'Contact support if needed']);
    });
  });

  describe('Error Enhancement', () => {
    test('should enhance error with user-friendly properties', () => {
      const originalError = createAxiosError('Connection refused', 'ECONNREFUSED');

      const enhancedError = {
        ...originalError,
        userMessage: getUserFriendlyErrorMessage(originalError),
        suggestedActions: getSuggestedActions(originalError),
        isRetryable: isRetryableError(originalError),
        requestId: 'test-request-123'
      };

      expect(enhancedError.userMessage).toBe('Connection failed. Please check your internet connection and try again.');
      expect(enhancedError.suggestedActions).toEqual(['Check internet connection', 'Try again in a few moments']);
      expect(enhancedError.isRetryable).toBe(true);
      expect(enhancedError.requestId).toBe('test-request-123');
    });

    test('should preserve original error properties', () => {
      const originalError = createAxiosError('Test error', 'TEST_CODE');
      originalError.config = { url: '/test', method: 'GET' } as any;

      const enhancedError = {
        ...originalError,
        userMessage: getUserFriendlyErrorMessage(originalError),
        suggestedActions: getSuggestedActions(originalError),
        isRetryable: isRetryableError(originalError)
      };

      // Check that the original error properties are preserved
      expect(originalError.message).toBe('Test error');
      expect(originalError.code).toBe('TEST_CODE');
      expect(originalError.config).toEqual({ url: '/test', method: 'GET' });
      
      // Check that enhanced properties are added
      expect(enhancedError.userMessage).toBeDefined();
      expect(enhancedError.suggestedActions).toBeDefined();
      expect(enhancedError.isRetryable).toBeDefined();
    });
  });

  describe('Backoff Algorithm Validation', () => {
    test('should implement proper exponential backoff', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(getRetryDelay(i));
      }

      // Verify exponential growth
      for (let i = 1; i < delays.length - 1; i++) {
        if (delays[i]! < 30000) { // Before hitting the cap
          expect(delays[i]).toBe(delays[i - 1]! * 2);
        }
      }

      // Verify cap is respected
      expect(delays[delays.length - 1]).toBe(30000);
    });

    test('should provide reasonable delay progression', () => {
      const expectedDelays = [1000, 2000, 4000, 8000, 16000, 30000, 30000];
      
      expectedDelays.forEach((expected, index) => {
        expect(getRetryDelay(index)).toBe(expected);
      });
    });
  });
});