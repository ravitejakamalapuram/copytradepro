import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('🚨 Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error('🚨 API Error:', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
    });

    // Handle 401/403 errors (unauthorized/forbidden) - but only for auth endpoints
    if (error.response?.status === 401 || error.response?.status === 403) {
      const url = error.config?.url || '';

      // Only logout for authentication-related endpoints, not broker operations
      if (url.includes('/auth/') || url.includes('/profile')) {
        console.log('🚨 User authentication failed, logging out');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
      } else {
        console.log('🔍 Broker operation failed, keeping user logged in');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
