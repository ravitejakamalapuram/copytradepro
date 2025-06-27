import api from './api';
import type { LoginCredentials, RegisterCredentials, AuthResponse } from '../types/auth';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Login error:', error);

      // If we have a response with error data, throw it so the UI can handle it
      if (error.response?.data) {
        const errorResponse = error.response.data;
        throw new Error(errorResponse.message || 'Login failed');
      }

      // For network errors, throw a generic error
      throw new Error('Network error. Please check your connection and try again.');
    }
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/register', credentials);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Register error:', error);

      // If we have a response with error data, throw it so the UI can handle it
      if (error.response?.data) {
        const errorResponse = error.response.data;
        throw new Error(errorResponse.message || 'Registration failed');
      }

      // For network errors, throw a generic error
      throw new Error('Network error. Please check your connection and try again.');
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('🚨 Logout error:', error);
      // Continue with logout even if API call fails
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  async getProfile(): Promise<AuthResponse> {
    try {
      const response = await api.get<AuthResponse>('/auth/profile');
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get profile error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Failed to fetch user profile.',
      };
    }
  },

  getToken(): string | null {
    return localStorage.getItem('token');
  },
};
