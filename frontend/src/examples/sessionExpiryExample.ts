/**
 * Example demonstrating the improved session expiry handling
 * 
 * This example shows how the application now correctly distinguishes between
 * actual session expiry and other API errors that return 401/403 status codes.
 */

import api from '../services/api';
import { isSessionExpiredError, shouldLogoutOnError } from '../utils/sessionUtils';

// Example 1: Session expired error - user will be logged out
export const exampleSessionExpired = async () => {
  try {
    // This would typically happen when JWT token expires
    await api.get('/api/profile');
  } catch (error: any) {
    // Backend returns: { status: 401, message: "Token expired" }
    
    console.log('Error message:', error.response?.data?.message); // "Token expired"
    console.log('Is session expired?', isSessionExpiredError(error)); // true
    console.log('Should logout?', shouldLogoutOnError(error, '/api/profile', false)); // true
    
    // Result: User is automatically logged out and redirected to login
  }
};

// Example 2: Broker connection error - user stays logged in
export const exampleBrokerError = async () => {
  try {
    // This happens when broker API is down or credentials are invalid
    await api.get('/api/broker/accounts');
  } catch (error: any) {
    // Backend returns: { status: 401, message: "Broker connection failed" }
    
    console.log('Error message:', error.response?.data?.message); // "Broker connection failed"
    console.log('Is session expired?', isSessionExpiredError(error)); // false
    console.log('Should logout?', shouldLogoutOnError(error, '/api/broker/accounts', false)); // false
    
    // Result: User stays logged in, can fix broker connection or try other features
  }
};

// Example 3: Development mode - user always stays logged in
export const exampleDevelopmentMode = async () => {
  try {
    await api.get('/api/profile');
  } catch (error: any) {
    // Even if token is expired in development
    console.log('Error message:', error.response?.data?.message); // "Token expired"
    console.log('Is session expired?', isSessionExpiredError(error)); // true
    console.log('Should logout?', shouldLogoutOnError(error, '/api/profile', true)); // false (dev mode)
    
    // Result: User stays logged in during development for better DX
  }
};

// Example 4: Different error message formats are handled
export const exampleDifferentErrorFormats = () => {
  const errors = [
    'Token expired',
    'Invalid token', 
    'Invalid or expired token',
    'session expired',
    'jwt expired',
    { message: 'Token expired' },
    { response: { data: { message: 'Invalid token' } } }
  ];

  errors.forEach((error, index) => {
    console.log(`Error ${index + 1}:`, isSessionExpiredError(error));
    // All return true - session expired detected
  });

  const nonSessionErrors = [
    'Network error',
    'Server error', 
    'Broker connection failed',
    'Validation failed'
  ];

  nonSessionErrors.forEach((error, index) => {
    console.log(`Non-session error ${index + 1}:`, isSessionExpiredError(error));
    // All return false - not session expiry
  });
};

/**
 * Key improvements:
 * 
 * 1. **Precise Detection**: Only logs out when session is actually expired,
 *    not for any 401/403 error
 * 
 * 2. **Better UX**: Users don't get logged out when broker connections fail
 *    or other non-session errors occur
 * 
 * 3. **Development Friendly**: Never logs out in development mode
 * 
 * 4. **Centralized Logic**: Session expiry detection is reusable across
 *    the application
 * 
 * 5. **Comprehensive**: Handles various error message formats and sources
 */