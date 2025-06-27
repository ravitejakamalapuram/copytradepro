// Error message utility for user-friendly error handling

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestion: string;
  icon: string;
  type: 'error' | 'warning' | 'info';
  actionable?: boolean;
  retryable?: boolean;
}

// Common error patterns and their user-friendly equivalents
const ERROR_PATTERNS: Record<string, UserFriendlyError> = {
  // Network and Connection Errors
  'network_error': {
    title: 'Connection Problem',
    message: 'Unable to connect to the trading server. Please check your internet connection.',
    suggestion: 'Try refreshing the page or check your internet connection.',
    icon: '🌐',
    type: 'error',
    retryable: true,
  },
  'timeout': {
    title: 'Request Timeout',
    message: 'The request took too long to complete. The server might be busy.',
    suggestion: 'Please wait a moment and try again.',
    icon: '⏱️',
    type: 'warning',
    retryable: true,
  },
  'server_error': {
    title: 'Server Error',
    message: 'Something went wrong on our end. Our team has been notified.',
    suggestion: 'Please try again in a few minutes. If the problem persists, contact support.',
    icon: '🔧',
    type: 'error',
    retryable: true,
  },

  // Authentication Errors
  'unauthorized': {
    title: 'Session Expired',
    message: 'Your session has expired for security reasons.',
    suggestion: 'Please log in again to continue trading.',
    icon: '🔐',
    type: 'warning',
    actionable: true,
  },
  'invalid_credentials': {
    title: 'Login Failed',
    message: 'The email or password you entered is incorrect.',
    suggestion: 'Please check your credentials and try again. Use "Forgot Password" if needed.',
    icon: '🚫',
    type: 'error',
  },
  'account_locked': {
    title: 'Account Temporarily Locked',
    message: 'Your account has been temporarily locked due to multiple failed login attempts.',
    suggestion: 'Please wait 15 minutes before trying again or contact support.',
    icon: '🔒',
    type: 'error',
  },

  // Trading Errors
  'insufficient_funds': {
    title: 'Insufficient Balance',
    message: 'You don\'t have enough funds in your account to place this order.',
    suggestion: 'Please add funds to your account or reduce the order quantity.',
    icon: '💰',
    type: 'warning',
    actionable: true,
  },
  'invalid_symbol': {
    title: 'Invalid Stock Symbol',
    message: 'The stock symbol you entered is not valid or not available for trading.',
    suggestion: 'Please check the symbol spelling or search for the correct stock name.',
    icon: '📈',
    type: 'error',
  },
  'market_closed': {
    title: 'Market is Closed',
    message: 'The stock market is currently closed. Orders cannot be placed right now.',
    suggestion: 'You can place orders when the market opens (9:15 AM - 3:30 PM on weekdays).',
    icon: '🕐',
    type: 'info',
  },
  'order_rejected': {
    title: 'Order Rejected',
    message: 'Your order was rejected by the broker due to risk management or compliance rules.',
    suggestion: 'Please check order details and ensure they meet trading requirements.',
    icon: '❌',
    type: 'error',
  },
  'position_limit': {
    title: 'Position Limit Exceeded',
    message: 'This order would exceed your maximum position limit for this stock.',
    suggestion: 'Please reduce the quantity or close existing positions first.',
    icon: '📊',
    type: 'warning',
  },

  // Broker Connection Errors
  'broker_connection_failed': {
    title: 'Broker Connection Failed',
    message: 'Unable to connect to your broker account. The broker\'s servers might be down.',
    suggestion: 'Please try reconnecting your broker account or contact your broker.',
    icon: '🏦',
    type: 'error',
    retryable: true,
  },
  'broker_session_expired': {
    title: 'Broker Session Expired',
    message: 'Your broker session has expired and needs to be renewed.',
    suggestion: 'Please reactivate your broker account in the Account Setup page.',
    icon: '🔄',
    type: 'warning',
    actionable: true,
  },
  'broker_maintenance': {
    title: 'Broker Maintenance',
    message: 'Your broker is currently under maintenance and temporarily unavailable.',
    suggestion: 'Please try again later or use a different broker account if available.',
    icon: '🔧',
    type: 'info',
  },

  // Validation Errors
  'invalid_quantity': {
    title: 'Invalid Quantity',
    message: 'The quantity you entered is not valid. It must be a positive number.',
    suggestion: 'Please enter a valid quantity (minimum 1 share).',
    icon: '🔢',
    type: 'error',
  },
  'invalid_price': {
    title: 'Invalid Price',
    message: 'The price you entered is not valid or outside the allowed range.',
    suggestion: 'Please enter a valid price within the daily price range.',
    icon: '💲',
    type: 'error',
  },
  'missing_required_field': {
    title: 'Missing Information',
    message: 'Some required information is missing from your order.',
    suggestion: 'Please fill in all required fields before submitting.',
    icon: '📝',
    type: 'error',
  },
  'validation': {
    title: 'Validation Error',
    message: 'Please check the information you entered.',
    suggestion: 'Make sure all required fields are filled correctly.',
    icon: '⚠️',
    type: 'error',
  },
  'partial_success': {
    title: 'Partial Success',
    message: 'Some orders were placed successfully, but others failed.',
    suggestion: 'Check the failed orders and try placing them again if needed.',
    icon: '⚠️',
    type: 'warning',
    retryable: true,
  },
  'all_failed': {
    title: 'All Orders Failed',
    message: 'None of your orders could be placed successfully.',
    suggestion: 'Please check your account status and try again.',
    icon: '❌',
    type: 'error',
    retryable: true,
  },

  // Account Setup Errors
  'invalid_broker_credentials': {
    title: 'Invalid Broker Credentials',
    message: 'The broker credentials you provided are incorrect or expired.',
    suggestion: 'Please check your broker login details and try again.',
    icon: '🔑',
    type: 'error',
  },
  'broker_api_error': {
    title: 'Broker API Error',
    message: 'There was an error communicating with your broker\'s API.',
    suggestion: 'Please check if your broker account is active and try again.',
    icon: '🔌',
    type: 'error',
    retryable: true,
  },
  'totp_required': {
    title: 'Two-Factor Authentication Required',
    message: 'Your broker requires two-factor authentication to complete this action.',
    suggestion: 'Please enter your TOTP code or check your authenticator app.',
    icon: '🔐',
    type: 'info',
  },
};

// Function to get user-friendly error message
export function getUserFriendlyError(
  error: any,
  context?: string
): UserFriendlyError {
  // Default fallback error
  const defaultError: UserFriendlyError = {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
    suggestion: 'If the problem continues, please contact our support team.',
    icon: '⚠️',
    type: 'error',
    retryable: true,
  };

  if (!error) return defaultError;

  // Extract error message
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.error || error.toString();

  const lowerMessage = errorMessage.toLowerCase();

  // Check for specific error patterns
  for (const [pattern, friendlyError] of Object.entries(ERROR_PATTERNS)) {
    if (lowerMessage.includes(pattern.replace('_', ' ')) || 
        lowerMessage.includes(pattern.replace('_', ''))) {
      return friendlyError;
    }
  }

  // Check for HTTP status codes
  if (error.status || error.response?.status) {
    const status = error.status || error.response?.status;
    
    switch (status) {
      case 401:
        return ERROR_PATTERNS.unauthorized;
      case 403:
        return ERROR_PATTERNS.account_locked;
      case 404:
        return {
          title: 'Not Found',
          message: 'The requested resource could not be found.',
          suggestion: 'Please check the URL or try refreshing the page.',
          icon: '🔍',
          type: 'error',
        };
      case 429:
        return {
          title: 'Too Many Requests',
          message: 'You\'re making requests too quickly. Please slow down.',
          suggestion: 'Please wait a moment before trying again.',
          icon: '🚦',
          type: 'warning',
          retryable: true,
        };
      case 500:
      case 502:
      case 503:
        return ERROR_PATTERNS.server_error;
    }
  }

  // Check for specific error keywords
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
    return ERROR_PATTERNS.network_error;
  }
  
  if (lowerMessage.includes('timeout')) {
    return ERROR_PATTERNS.timeout;
  }
  
  if (lowerMessage.includes('insufficient') && lowerMessage.includes('fund')) {
    return ERROR_PATTERNS.insufficient_funds;
  }
  
  if (lowerMessage.includes('invalid') && lowerMessage.includes('symbol')) {
    return ERROR_PATTERNS.invalid_symbol;
  }
  
  if (lowerMessage.includes('market') && lowerMessage.includes('closed')) {
    return ERROR_PATTERNS.market_closed;
  }

  // Context-specific errors
  if (context === 'login' && lowerMessage.includes('invalid')) {
    return ERROR_PATTERNS.invalid_credentials;
  }
  
  if (context === 'broker' && lowerMessage.includes('connection')) {
    return ERROR_PATTERNS.broker_connection_failed;
  }

  // Return default error with original message if no pattern matches
  return {
    ...defaultError,
    message: `${defaultError.message} (${errorMessage})`,
  };
}

// Function to check if an error is retryable
export function isRetryableError(error: UserFriendlyError): boolean {
  return error.retryable === true;
}

// Function to check if an error requires user action
export function isActionableError(error: UserFriendlyError): boolean {
  return error.actionable === true;
}
