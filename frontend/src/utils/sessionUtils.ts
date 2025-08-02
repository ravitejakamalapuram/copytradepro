/**
 * Utility functions for session management and expiry detection
 */

/**
 * Check if an error indicates session expiry
 * @param error - The error object or message
 * @returns true if the error indicates session expiry
 */
export const isSessionExpiredError = (error: any): boolean => {
  if (!error) return false;

  // Extract error message from various error formats
  let errorMessage = '';
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error.message) {
    errorMessage = error.message;
  } else if (error.response?.data?.message) {
    errorMessage = error.response.data.message;
  } else if (error.userMessage) {
    errorMessage = error.userMessage;
  }

  // Check for specific session expiry indicators
  const sessionExpiredIndicators = [
    'Token expired',
    'Invalid token',
    'Invalid or expired token',
    'session expired',
    'token expired',
    'jwt expired',
    'authentication failed',
    'TokenExpiredError',
    'JsonWebTokenError'
  ];

  return sessionExpiredIndicators.some(indicator => 
    errorMessage.toLowerCase().includes(indicator.toLowerCase())
  );
};

/**
 * Check if an HTTP status code indicates authentication failure
 * @param status - HTTP status code
 * @returns true if status indicates auth failure
 */
export const isAuthFailureStatus = (status: number): boolean => {
  return status === 401 || status === 403;
};

/**
 * Handle session expiry by clearing local storage and redirecting
 * @param reason - Optional reason for logging
 */
export const handleSessionExpiry = (reason?: string): void => {
  console.log('🚨 Session expired, logging out user:', reason || 'Unknown reason');
  
  // Clear authentication data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Redirect to login page
  window.location.href = '/';
};

/**
 * Check if we should logout based on error and context
 * @param error - The error object
 * @param url - The request URL that failed
 * @param isDevelopment - Whether we're in development mode
 * @returns true if user should be logged out
 */
export const shouldLogoutOnError = (
  error: any, 
  _url: string = '', 
  isDevelopment: boolean = false
): boolean => {
  // Never logout in development mode
  if (isDevelopment) {
    return false;
  }

  // Check if error indicates session expiry
  if (!isSessionExpiredError(error)) {
    return false;
  }

  // Check HTTP status
  const status = error.response?.status || error.status;
  if (!isAuthFailureStatus(status)) {
    return false;
  }

  // Session is expired - should logout
  return true;
};