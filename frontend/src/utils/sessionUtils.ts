/**
 * Utility functions for session management and expiry detection
 */

/**
 * Interface for error objects that might contain auth information
 */
interface AuthError {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  status?: number;
  userMessage?: string;
}

/**
 * Enum defining different types of logout scenarios
 */
export const LogoutReason = {
  JWT_EXPIRED: 'JWT_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_MALFORMED: 'TOKEN_MALFORMED',
  AUTH_REVOKED: 'AUTH_REVOKED',
  NO_LOGOUT_NEEDED: 'NO_LOGOUT_NEEDED'
} as const;

export type LogoutReason = typeof LogoutReason[keyof typeof LogoutReason];

/**
 * Analyze error to determine the appropriate logout action
 * @param error - The error object
 * @returns LogoutReason enum indicating what action to take
 */
export const analyzeAuthError = (error: unknown): LogoutReason => {
  if (!error) return LogoutReason.NO_LOGOUT_NEEDED;

  // Extract error message from various error formats
  let errorMessage = '';

  if (typeof error === 'string') {
    errorMessage = error;
  } else {
    const authError = error as AuthError;
    if (authError.message) {
      errorMessage = authError.message;
    } else if (authError.response?.data?.message) {
      errorMessage = authError.response.data.message;
    } else if (authError.userMessage) {
      errorMessage = authError.userMessage;
    }
  }

  const lowerMessage = errorMessage.toLowerCase();

  // Check for explicit JWT expiration
  if (lowerMessage.includes('token expired') ||
      lowerMessage.includes('jwt expired') ||
      lowerMessage.includes('tokenexpirederror')) {
    return LogoutReason.JWT_EXPIRED;
  }

  // Check for invalid/malformed tokens
  if (lowerMessage.includes('invalid token') ||
      lowerMessage.includes('malformed token') ||
      lowerMessage.includes('jsonwebtokenerror') ||
      lowerMessage.includes('invalid signature')) {
    return LogoutReason.INVALID_TOKEN;
  }

  // Check for token format issues
  if (lowerMessage.includes('token malformed') ||
      lowerMessage.includes('invalid jwt format') ||
      lowerMessage.includes('jwt malformed')) {
    return LogoutReason.TOKEN_MALFORMED;
  }

  // Check for explicit auth revocation
  if (lowerMessage.includes('authentication revoked') ||
      lowerMessage.includes('access revoked') ||
      lowerMessage.includes('token revoked')) {
    return LogoutReason.AUTH_REVOKED;
  }

  // For all other cases (network errors, server issues, etc.), don't logout
  return LogoutReason.NO_LOGOUT_NEEDED;
};

/**
 * Check if an error indicates session expiry
 * @param error - The error object or message
 * @returns true if the error indicates session expiry
 */
export const isSessionExpiredError = (error: unknown): boolean => {
  if (!error) return false;

  // Extract error message from various error formats
  let errorMessage = '';

  if (typeof error === 'string') {
    errorMessage = error;
  } else {
    const authError = error as AuthError;
    if (authError.message) {
      errorMessage = authError.message;
    } else if (authError.response?.data?.message) {
      errorMessage = authError.response.data.message;
    } else if (authError.userMessage) {
      errorMessage = authError.userMessage;
    }
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
 * Store the current page for redirect after login
 * @param path - The path to redirect to after login
 */
export const storeRedirectPath = (path?: string): void => {
  const currentPath = path || window.location.pathname + window.location.search;

  // Don't store login/register pages as redirect paths
  if (currentPath === '/' || currentPath.includes('/login') || currentPath.includes('/register')) {
    return;
  }

  localStorage.setItem('redirectAfterLogin', currentPath);
  console.log('📍 Stored redirect path:', currentPath);
};

/**
 * Get and clear the stored redirect path
 * @returns The stored redirect path or default dashboard path
 */
export const getAndClearRedirectPath = (): string => {
  const redirectPath = localStorage.getItem('redirectAfterLogin');
  localStorage.removeItem('redirectAfterLogin');

  // Return stored path or default to dashboard
  const finalPath = redirectPath && redirectPath !== '/' ? redirectPath : '/dashboard';
  console.log('🎯 Redirect path retrieved:', finalPath);
  return finalPath;
};

/**
 * Handle session expiry by clearing local storage and redirecting
 * @param reason - Optional reason for logging
 */
export const handleSessionExpiry = (reason?: string): void => {
  console.log('🚨 Session expired, logging out user:', reason || 'Unknown reason');

  // Store current page for redirect after re-login
  storeRedirectPath();

  // Clear authentication data
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  // Force a page reload to trigger React Router navigation
  // This ensures the auth context is properly updated
  window.location.href = '/';
};

/**
 * Check if we should logout based on error analysis
 * @param error - The error object
 * @param url - The request URL that failed (for logging)
 * @param isDevelopment - Whether we're in development mode (for logging)
 * @returns true if user should be logged out
 */
export const shouldLogoutOnError = (
  error: unknown,
  url: string = '',
  isDevelopment: boolean = false
): boolean => {
  // Analyze the error to determine logout reason
  const logoutReason = analyzeAuthError(error);

  // Check HTTP status for auth failures
  const authError = error as AuthError;
  const status = authError?.response?.status || authError?.status || 0;
  const isAuthError = isAuthFailureStatus(status);

  // Only logout for auth errors (401/403) that indicate real JWT issues
  if (!isAuthError) {
    console.log(`🔍 Non-auth error (${status}), keeping user logged in:`, url);
    return false;
  }

  // Determine if we should logout based on the specific reason
  const shouldLogout = logoutReason !== LogoutReason.NO_LOGOUT_NEEDED;

  if (shouldLogout) {
    const env = isDevelopment ? 'development' : 'production';
    console.log(`🔑 ${env}: Logging out user due to ${logoutReason} on ${url}`);
  } else {
    const env = isDevelopment ? 'development' : 'production';
    const errorMessage = authError?.response?.data?.message || authError?.message || 'Unknown error';
    console.log(`🔧 ${env}: Keeping user logged in - not a JWT issue:`, { url, errorMessage, logoutReason });
  }

  return shouldLogout;
};