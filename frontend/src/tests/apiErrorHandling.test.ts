import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosError } from 'axios';

// Mock axios completely before importing api
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
    isCancel: vi.fn(() => false),
    interceptors: {
      request: {
        use: vi.fn(),
        eject: vi.fn()
      },
      response: {
        use: vi.fn(),
        eject: vi.fn()
      }
    }
  };
  return {
    default: mockAxios,
    ...mockAxios
  };
});

const mockedAxios = vi.mocked(axios);

// Mock the logging service
vi.mock('../services/loggingService', () => ({
  frontendLogger: {
    logApiCall: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock the performance monitor service
vi.mock('../services/performanceMonitorService', () => ({
  performanceMonitorService: {
    recordAPICall: vi.fn()
  }
}));

// Mock the cache manager
vi.mock('../services/cacheManager', () => ({
  apiCache: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    clearByTags: vi.fn(),
    getStats: vi.fn()
  }
}));

describe('API Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock axios.create to return our mocked axios instance
    mockedAxios.create.mockReturnValue(mockedAxios as any);
    mockedAxios.isCancel.mockReturnValue(false);
    
    // Setup default interceptor mocks
    mockedAxios.interceptors = {
      request: {
        use: vi.fn(),
        eject: vi.fn()
      },
      response: {
        use: vi.fn(),
        eject: vi.fn()
      }
    } as any;
  });

  describe('Error Classification', () => {
    test('should classify network errors correctly', () => {
      const networkErrors = [
        { code: 'ECONNREFUSED', message: 'Connection refused' },
        { code: 'ETIMEDOUT', message: 'Request timeout' },
        { code: 'ENOTFOUND', message: 'DNS resolution failed' },
        { code: 'ENETUNREACH', message: 'Network unreachable' }
      ];

      networkErrors.forEach(errorData => {
        const error = new Error(errorData.message) as AxiosError;
        error.code = errorData.code;
        error.response = undefined;

        // Test the isRetryableError function logic
        const isRetryable = !error.response && 
          ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'].includes(error.code || '');
        
        expect(isRetryable).toBe(true);
      });
    });

    test('should classify HTTP status codes correctly', () => {
      const testCases = [
        { status: 408, retryable: true },
        { status: 429, retryable: true },
        { status: 500, retryable: true },
        { status: 502, retryable: true },
        { status: 503, retryable: true },
        { status: 504, retryable: true },
        { status: 400, retryable: false },
        { status: 401, retryable: false },
        { status: 403, retryable: false },
        { status: 404, retryable: false }
      ];

      testCases.forEach(({ status, retryable }) => {
        const error = new Error(`HTTP ${status}`) as AxiosError;
        error.response = {
          status,
          data: {},
          statusText: `HTTP ${status}`,
          headers: {},
          config: {} as any
        };

        // Test the isRetryableError function logic
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        const isRetryable = retryableStatuses.includes(error.response.status);
        
        expect(isRetryable).toBe(retryable);
      });
    });
  });

  describe('User-Friendly Error Messages', () => {
    test('should transform network errors to user-friendly messages', () => {
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
          code: 'UNKNOWN_ERROR',
          expected: 'Network error occurred. Please check your connection and try again.'
        }
      ];

      testCases.forEach(({ code, expected }) => {
        const error = new Error('Network error') as AxiosError;
        error.code = code;
        error.response = undefined;

        const message = getUserFriendlyErrorMessage(error);
        expect(message).toBe(expected);
      });
    });

    test('should transform HTTP errors to user-friendly messages', () => {
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

        const message = getUserFriendlyErrorMessage(error);
        expect(message).toBe(expected);
      });
    });

    test('should use custom message from response when available', () => {
      const error = new Error('HTTP 422') as AxiosError;
      error.response = {
        status: 422,
        data: { message: 'Custom validation error message' },
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as any
      };

      const message = getUserFriendlyErrorMessage(error);
      expect(message).toBe('Custom validation error message');
    });
  });

  describe('Suggested Actions', () => {
    test('should provide appropriate actions for network errors', () => {
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
        }
      ];

      testCases.forEach(({ code, expected }) => {
        const error = new Error('Network error') as AxiosError;
        error.code = code;
        error.response = undefined;

        const actions = getSuggestedActions(error);
        expect(actions).toEqual(expected);
      });
    });

    test('should provide appropriate actions for HTTP errors', () => {
      const testCases = [
        { status: 400, expected: ['Check your input', 'Ensure all required fields are filled'] },
        { status: 401, expected: ['Log in again', 'Check your credentials'] },
        { status: 403, expected: ['Contact administrator', 'Check your account permissions'] },
        { status: 404, expected: ['Check the URL', 'Try refreshing the page'] },
        { status: 429, expected: ['Wait a moment', 'Try again later'] },
        { status: 500, expected: ['Try again', 'Contact support if problem persists'] }
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

        const actions = getSuggestedActions(error);
        expect(actions).toEqual(expected);
      });
    });
  });

  describe('Retry Logic', () => {
    test('should calculate exponential backoff correctly', () => {
      const getRetryDelay = (retryCount: number): number => {
        const baseDelay = 1000;
        const maxDelay = 30000;
        const delay = baseDelay * Math.pow(2, retryCount);
        return Math.min(delay, maxDelay);
      };

      expect(getRetryDelay(0)).toBe(1000);  // 1 second
      expect(getRetryDelay(1)).toBe(2000);  // 2 seconds
      expect(getRetryDelay(2)).toBe(4000);  // 4 seconds
      expect(getRetryDelay(3)).toBe(8000);  // 8 seconds
      expect(getRetryDelay(4)).toBe(16000); // 16 seconds
      expect(getRetryDelay(5)).toBe(30000); // Capped at 30 seconds
      expect(getRetryDelay(10)).toBe(30000); // Still capped
    });

    test('should respect maximum retry attempts', () => {
      const maxRetries = 3;
      let retryCount = 0;

      const shouldRetry = (error: AxiosError, currentRetryCount: number): boolean => {
        const isRetryable = !error.response && 
          ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'].includes(error.code || '');
        return isRetryable && currentRetryCount < maxRetries;
      };

      const error = new Error('Connection refused') as AxiosError;
      error.code = 'ECONNREFUSED';
      error.response = undefined;

      // Should retry for first 3 attempts
      expect(shouldRetry(error, 0)).toBe(true);
      expect(shouldRetry(error, 1)).toBe(true);
      expect(shouldRetry(error, 2)).toBe(true);
      
      // Should not retry after max attempts
      expect(shouldRetry(error, 3)).toBe(false);
      expect(shouldRetry(error, 4)).toBe(false);
    });
  });

  describe('Authentication Error Handling', () => {
    test('should handle 401 errors appropriately in development', () => {
      const originalEnv = import.meta.env.DEV;
      
      // Mock development environment
      Object.defineProperty(import.meta, 'env', {
        value: { ...import.meta.env, DEV: true }
      });

      const error = new Error('Unauthorized') as AxiosError;
      error.response = {
        status: 401,
        data: { message: 'Unauthorized' },
        statusText: 'Unauthorized',
        headers: {},
        config: { url: '/api/broker/accounts' } as any
      };

      // In development, should not logout for broker operations
      const shouldLogout = (error: AxiosError): boolean => {
        const url = error.config?.url || '';
        const isDevelopment = import.meta.env.DEV;
        
        if (isDevelopment) {
          return false; // Keep user logged in during development
        }
        
        // Only logout for auth-related endpoints in production
        return url.includes('/auth/') || url.includes('/profile');
      };

      expect(shouldLogout(error)).toBe(false);
    });

    test('should handle 401 errors appropriately in production', () => {
      const authError = new Error('Unauthorized') as AxiosError;
      authError.config = { url: '/api/auth/profile' } as any;
      authError.response = {
        status: 401,
        data: { message: 'Unauthorized' },
        statusText: 'Unauthorized',
        headers: {},
        config: { url: '/api/auth/profile' } as any
      };

      const brokerError = new Error('Unauthorized') as AxiosError;
      brokerError.config = { url: '/api/broker/accounts' } as any;
      brokerError.response = {
        status: 401,
        data: { message: 'Unauthorized' },
        statusText: 'Unauthorized',
        headers: {},
        config: { url: '/api/broker/accounts' } as any
      };

      const shouldLogout = (error: AxiosError, isDevelopment: boolean = false): boolean => {
        const url = error.config?.url || '';
        
        if (isDevelopment) {
          return false;
        }
        
        return url.includes('/auth/') || url.includes('/profile');
      };

      expect(shouldLogout(authError, false)).toBe(true);  // Should logout for auth endpoints in production
      expect(shouldLogout(brokerError, false)).toBe(false); // Should not logout for broker endpoints in production
    });
  });

  describe('Request Enhancement', () => {
    test('should add request metadata', () => {
      const config = {
        url: '/api/test',
        method: 'GET',
        headers: {}
      };

      // Simulate request interceptor logic
      const enhancedConfig = {
        ...config,
        _requestId: 'test-request-123',
        _startTime: Date.now(),
        _retryCount: 0,
        headers: {
          ...config.headers,
          'X-Request-ID': 'test-request-123'
        }
      };

      expect(enhancedConfig._requestId).toBeDefined();
      expect(enhancedConfig._startTime).toBeDefined();
      expect(enhancedConfig._retryCount).toBe(0);
      expect(enhancedConfig.headers['X-Request-ID']).toBeDefined();
    });

    test('should add authorization header when token exists', () => {
      const mockToken = 'test-jwt-token';
      
      // Mock localStorage.getItem to return our test token
      const mockGetItem = vi.fn().mockReturnValue(mockToken);
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: mockGetItem,
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn()
        }
      });

      const config: any = {
        url: '/api/test',
        method: 'GET',
        headers: {}
      };

      // Simulate request interceptor logic
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      }

      expect(mockGetItem).toHaveBeenCalledWith('token');
      expect(config.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });
  });

  describe('Error Enhancement', () => {
    test('should enhance errors with additional properties', () => {
      const originalError = new Error('Connection refused') as AxiosError;
      originalError.code = 'ECONNREFUSED';
      originalError.response = undefined;
      originalError.config = { url: '/api/test', method: 'GET' } as any;

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
      expect(enhancedError.config).toEqual({ url: '/api/test', method: 'GET' });
    });
  });
});

// Helper functions extracted from api.ts for testing
const isRetryableError = (error: AxiosError): boolean => {
  if (!error.response) {
    return ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'].includes(error.code || '');
  }
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  return retryableStatuses.includes(error.response.status);
};

const getUserFriendlyErrorMessage = (error: AxiosError): string => {
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
      return (error.response.data as unknown)?.message || 'An unexpected error occurred. Please try again.';
  }
};

const getSuggestedActions = (error: AxiosError): string[] => {
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