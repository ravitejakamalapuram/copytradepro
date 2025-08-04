import axios from 'axios';
import type { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { frontendLogger } from './loggingService';
import { errorCaptureService } from './errorCaptureService';
import { apiCache } from './cacheManager';
import { performanceMonitorService } from './performanceMonitorService';
import { shouldLogoutOnError, handleSessionExpiry } from '../utils/sessionUtils';

// Enhanced request configuration with retry metadata
interface EnhancedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
  _requestId?: string;
  _startTime?: number;
}

// Request deduplication cache
const pendingRequests = new Map<string, Promise<AxiosResponse>>();

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Utility functions for request handling
const generateRequestId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateRequestKey = (config: AxiosRequestConfig): string => {
  const { method, url, params, data } = config;
  return `${method?.toUpperCase()}-${url}-${JSON.stringify(params)}-${JSON.stringify(data)}`;
};

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

const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Enhanced request interceptor with metadata
api.interceptors.request.use(
  async (config: EnhancedAxiosRequestConfig) => {
    // Add request metadata
    config._requestId = generateRequestId();
    config._startTime = Date.now();
    config._retryCount = config._retryCount || 0;

    // Add auth token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID header for tracking
    config.headers = config.headers || {};
    config.headers['X-Request-ID'] = config._requestId;

    return config;
  },
  (error) => {
    console.error('🚨 Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with retry logic and error classification
api.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as EnhancedAxiosRequestConfig;
    
    // Remove from pending requests cache
    if (config.method?.toLowerCase() === 'get') {
      const requestKey = generateRequestKey(config);
      pendingRequests.delete(requestKey);
    }

    // Log successful requests and record performance metrics
    if (config._startTime) {
      const duration = Date.now() - config._startTime;
      const responseSize = JSON.stringify(response.data).length;
      const cached = response.headers['x-cache-hit'] === 'true';
      
      // Log to frontend logger
      frontendLogger.logApiCall(
        config.method?.toUpperCase() || 'GET',
        config.url || '',
        duration,
        response.status,
        {
          requestId: config._requestId,
          component: 'API_CLIENT'
        }
      );
      
      // Record performance metrics
      performanceMonitorService.recordAPICall(
        config.url || '',
        config.method?.toUpperCase() || 'GET',
        duration,
        response.status,
        responseSize,
        cached
      );
    }

    return response;
  },
  async (error: any) => {
    // Skip retry for cancelled requests
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    // Type guard to ensure we're working with an AxiosError
    const axiosError: AxiosError = error;
    const config = axiosError.config as EnhancedAxiosRequestConfig;
    
    // Remove from pending requests cache
    if (config?.method?.toLowerCase() === 'get') {
      const requestKey = generateRequestKey(config);
      pendingRequests.delete(requestKey);
    }



    // Enhanced error logging
    const errorDetails = {
      requestId: config?._requestId,
      status: axiosError.response?.status,
      message: axiosError.message,
      code: axiosError.code,
      url: config?.url,
      method: config?.method,
      retryCount: config?._retryCount || 0,
      data: axiosError.response?.data,
    };

    // Capture API error using error capture service
    const duration = config?._startTime ? Date.now() - config._startTime : undefined;
    errorCaptureService.captureApiError(axiosError, {
      method: config?.method?.toUpperCase(),
      url: config?.url,
      requestId: config?._requestId,
      status: axiosError.response?.status,
      duration
    });

    // Log error using frontend logger
    frontendLogger.error('API request failed', {
      requestId: config?._requestId,
      component: 'API_CLIENT',
      method: config?.method,
      url: config?.url,
      status: axiosError.response?.status,
      retryCount: config?._retryCount || 0
    }, axiosError);

    console.error('🚨 API Error:', errorDetails);

    // Retry logic for retryable errors
    if (config && isRetryableError(axiosError)) {
      const maxRetries = 3;
      const currentRetryCount = config._retryCount || 0;

      if (currentRetryCount < maxRetries) {
        const retryDelay = getRetryDelay(currentRetryCount);
        
        console.log(`🔄 Retrying request (${currentRetryCount + 1}/${maxRetries}) after ${retryDelay}ms:`, config.url);
        
        // Wait before retrying
        await sleep(retryDelay);
        
        // Update retry count
        config._retryCount = currentRetryCount + 1;
        
        // Retry the request
        return api.request(config);
      } else {
        console.error(`❌ Max retries (${maxRetries}) exceeded for:`, config.url);
      }
    }

    // Handle authentication errors - only logout for actual session expiry
    if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
      const url = config?.url || '';
      const isDevelopment = import.meta.env.DEV;

      if (shouldLogoutOnError(axiosError, url, isDevelopment)) {
        console.log('🚨 Session expired detected, logging out user');
        handleSessionExpiry(`API call to ${url} failed with session expiry`);
      } else {
        const errorMessage = (axiosError.response?.data as any)?.message || '';
        console.log('🔍 API error (not session expiry), keeping user logged in:', {
          url,
          errorMessage,
          status: axiosError.response?.status,
          isDevelopment
        });
      }
    }

    // Transform error for better user experience
    const enhancedError = {
      ...axiosError,
      userMessage: getUserFriendlyErrorMessage(axiosError),
      suggestedActions: getSuggestedActions(axiosError),
      isRetryable: isRetryableError(axiosError),
      requestId: config?._requestId,
    };

    return Promise.reject(enhancedError);
  }
);

// Error message transformation functions
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

// Cache configuration for different endpoints
const getCacheConfig = (url: string) => {
  // Market data - short TTL
  if (url.includes('/market-data') || url.includes('/quotes')) {
    return { ttl: 30000, tags: ['market-data'], priority: 'high' as const };
  }
  
  // Account data - medium TTL
  if (url.includes('/accounts') || url.includes('/profile')) {
    return { ttl: 300000, tags: ['account-data'], priority: 'high' as const };
  }
  
  // Order history - medium TTL
  if (url.includes('/orders') || url.includes('/history')) {
    return { ttl: 60000, tags: ['order-data'], priority: 'medium' as const };
  }
  
  // Portfolio data - medium TTL
  if (url.includes('/portfolio') || url.includes('/holdings')) {
    return { ttl: 120000, tags: ['portfolio-data'], priority: 'medium' as const };
  }
  
  // Static data - long TTL
  if (url.includes('/brokers') || url.includes('/symbols')) {
    return { ttl: 600000, tags: ['static-data'], priority: 'low' as const };
  }
  
  // Default cache config
  return { ttl: 60000, tags: ['api-data'], priority: 'medium' as const };
};

// Check if request should be cached
const shouldCache = (url: string, config?: AxiosRequestConfig): boolean => {
  // Don't cache if explicitly disabled
  if ((config as any)?.skipCache) return false;
  
  // Don't cache authentication requests
  if (url.includes('/auth/') || url.includes('/login')) return false;
  
  // Don't cache real-time data requests
  if (url.includes('/realtime') || url.includes('/live')) return false;
  
  // Cache everything else
  return true;
};

// Request deduplication and caching wrapper
const createEnhancedRequest = (originalApi: AxiosInstance) => {
  return {
    ...originalApi,
    get: async <T = unknown>(url: string, config?: AxiosRequestConfig) => {
      const requestKey = generateRequestKey({ method: 'GET', url, ...config });
      
      // Check cache first if caching is enabled
      if (shouldCache(url, config)) {
        const cachedResponse = apiCache.get<AxiosResponse<T>>(requestKey);
        if (cachedResponse) {
          console.log('📦 Cache hit for GET request:', url);
          return cachedResponse;
        }
      }
      
      // Check for pending request (deduplication)
      const pendingRequest = pendingRequests.get(requestKey);
      if (pendingRequest) {
        console.log('🔄 Deduplicating GET request:', url);
        return pendingRequest as Promise<AxiosResponse<T>>;
      }
      
      // Make the actual request
      const requestPromise = originalApi.get<T>(url, config);
      pendingRequests.set(requestKey, requestPromise);
      
      // Handle response and caching
      requestPromise
        .then((response) => {
          // Cache successful responses
          if (shouldCache(url, config) && response.status >= 200 && response.status < 300) {
            const cacheConfig = getCacheConfig(url);
            apiCache.set(requestKey, response, cacheConfig);
            console.log('📦 Cached GET response:', url);
          }
          return response;
        })
        .catch((error) => {
          // Don't cache errors, but clean up pending requests
          return Promise.reject(error);
        })
        .finally(() => {
          pendingRequests.delete(requestKey);
        });
      
      return requestPromise;
    },
    
    // Invalidate cache for mutation operations
    post: async <T = unknown>(url: string, data?: any, config?: AxiosRequestConfig) => {
      const response = await originalApi.post<T>(url, data, config);
      
      // Invalidate related cache entries
      if (response.status >= 200 && response.status < 300) {
        invalidateCacheForUrl(url);
      }
      
      return response;
    },
    
    put: async <T = unknown>(url: string, data?: any, config?: AxiosRequestConfig) => {
      const response = await originalApi.put<T>(url, data, config);
      
      // Invalidate related cache entries
      if (response.status >= 200 && response.status < 300) {
        invalidateCacheForUrl(url);
      }
      
      return response;
    },
    
    delete: async <T = unknown>(url: string, config?: AxiosRequestConfig) => {
      const response = await originalApi.delete<T>(url, config);
      
      // Invalidate related cache entries
      if (response.status >= 200 && response.status < 300) {
        invalidateCacheForUrl(url);
      }
      
      return response;
    },
    
    patch: async <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => {
      const response = await originalApi.patch<T>(url, data, config);
      
      // Invalidate related cache entries
      if (response.status >= 200 && response.status < 300) {
        invalidateCacheForUrl(url);
      }
      
      return response;
    },
    
    request: originalApi.request.bind(originalApi),
    
    // Cache management methods
    clearCache: (tags?: string[]) => {
      if (tags) {
        const clearedCount = apiCache.clearByTags(tags);
        console.log(`🧹 Cleared ${clearedCount} cache entries with tags:`, tags);
        return clearedCount;
      } else {
        apiCache.clear();
        console.log('🧹 Cleared all API cache');
        return 0;
      }
    },
    
    getCacheStats: () => apiCache.getStats(),
    
    preloadCache: async (urls: string[]) => {
      const results = await Promise.allSettled(
        urls.map(url => originalApi.get(url))
      );
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      console.log(`📦 Preloaded ${successCount}/${urls.length} cache entries`);
      return successCount;
    }
  };
};

// Cache invalidation helper
const invalidateCacheForUrl = (url: string) => {
  const tagsToInvalidate: string[] = [];
  
  if (url.includes('/accounts')) {
    tagsToInvalidate.push('account-data');
  }
  if (url.includes('/orders')) {
    tagsToInvalidate.push('order-data');
  }
  if (url.includes('/portfolio') || url.includes('/holdings')) {
    tagsToInvalidate.push('portfolio-data');
  }
  if (url.includes('/market-data')) {
    tagsToInvalidate.push('market-data');
  }
  
  if (tagsToInvalidate.length > 0) {
    const clearedCount = apiCache.clearByTags(tagsToInvalidate);
    console.log(`🧹 Invalidated ${clearedCount} cache entries for tags:`, tagsToInvalidate);
  }
};

// Export the enhanced API with caching and deduplication
export default createEnhancedRequest(api);
