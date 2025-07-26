/**
 * Standardized types for order status operations
 * Provides consistent error handling and response formats
 */

// Order Status Error Codes
export const OrderStatusErrorCode = {
  // Authentication & Authorization
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  ACCESS_DENIED: 'ACCESS_DENIED',
  
  // Validation Errors
  MISSING_ORDER_ID: 'MISSING_ORDER_ID',
  INVALID_BROKER_NAME: 'INVALID_BROKER_NAME',
  BROKER_MISMATCH: 'BROKER_MISMATCH',
  
  // Order Not Found
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_NOT_FOUND_IN_BROKER: 'ORDER_NOT_FOUND_IN_BROKER',
  
  // Broker Connection Issues
  BROKER_CONNECTION_ERROR: 'BROKER_CONNECTION_ERROR',
  BROKER_SERVICE_ERROR: 'BROKER_SERVICE_ERROR',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // API Errors
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  BROKER_ERROR: 'BROKER_ERROR',
  
  // Database Errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  DATABASE_UPDATE_ERROR: 'DATABASE_UPDATE_ERROR',
  
  // System Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR'
} as const;

export type OrderStatusErrorCode = typeof OrderStatusErrorCode[keyof typeof OrderStatusErrorCode];

// Standardized Error Response Structure
export interface OrderStatusError {
  message: string;
  code: OrderStatusErrorCode;
  retryable: boolean;
  details?: any;
}

// Success Response Data Structure
export interface OrderStatusData {
  orderId: string;
  brokerOrderId: string;
  status: string;
  symbol: string;
  quantity: number;
  filledQuantity: number;
  price: number;
  averagePrice: number;
  timestamp: Date;
  brokerName: string;
  rejectionReason?: string | null;
  statusChanged?: boolean;
  previousStatus?: string | null;
}

// Standardized Order Status Response
export interface OrderStatusResponse {
  success: boolean;
  data?: OrderStatusData;
  error?: OrderStatusError;
  requestId?: string;
  timestamp?: string;
}

// Refresh Order Status Response
export interface RefreshOrderStatusResponse {
  success: boolean;
  data?: {
    refreshedCount: number;
    failedCount: number;
    orders?: Array<{
      orderId: string;
      brokerOrderId: string;
      previousStatus: string;
      newStatus: string;
      statusChanged: boolean;
    }>;
  };
  error?: OrderStatusError;
  requestId?: string;
  timestamp?: string;
}

// Error categorization mapping
export const ERROR_CATEGORY_MAP: Record<OrderStatusErrorCode, {
  httpStatus: number;
  retryable: boolean;
  severity: 'low' | 'medium' | 'high';
}> = {
  // Authentication & Authorization - 401/403
  [OrderStatusErrorCode.AUTHENTICATION_ERROR]: {
    httpStatus: 401,
    retryable: false,
    severity: 'medium'
  },
  [OrderStatusErrorCode.ACCESS_DENIED]: {
    httpStatus: 403,
    retryable: false,
    severity: 'medium'
  },
  
  // Validation Errors - 400
  [OrderStatusErrorCode.MISSING_ORDER_ID]: {
    httpStatus: 400,
    retryable: false,
    severity: 'low'
  },
  [OrderStatusErrorCode.INVALID_BROKER_NAME]: {
    httpStatus: 400,
    retryable: false,
    severity: 'low'
  },
  [OrderStatusErrorCode.BROKER_MISMATCH]: {
    httpStatus: 400,
    retryable: false,
    severity: 'low'
  },
  
  // Not Found - 404
  [OrderStatusErrorCode.ORDER_NOT_FOUND]: {
    httpStatus: 404,
    retryable: false,
    severity: 'low'
  },
  [OrderStatusErrorCode.ORDER_NOT_FOUND_IN_BROKER]: {
    httpStatus: 404,
    retryable: false,
    severity: 'medium'
  },
  
  // Service Unavailable - 503
  [OrderStatusErrorCode.BROKER_CONNECTION_ERROR]: {
    httpStatus: 503,
    retryable: true,
    severity: 'high'
  },
  [OrderStatusErrorCode.BROKER_SERVICE_ERROR]: {
    httpStatus: 503,
    retryable: true,
    severity: 'high'
  },
  
  // Unauthorized - 401
  [OrderStatusErrorCode.SESSION_EXPIRED]: {
    httpStatus: 401,
    retryable: true,
    severity: 'medium'
  },
  
  // Rate Limited - 429
  [OrderStatusErrorCode.RATE_LIMIT_ERROR]: {
    httpStatus: 429,
    retryable: true,
    severity: 'medium'
  },
  
  // Service Unavailable - 503
  [OrderStatusErrorCode.NETWORK_ERROR]: {
    httpStatus: 503,
    retryable: true,
    severity: 'medium'
  },
  [OrderStatusErrorCode.BROKER_ERROR]: {
    httpStatus: 503,
    retryable: true,
    severity: 'medium'
  },
  
  // Internal Server Error - 500
  [OrderStatusErrorCode.DATABASE_ERROR]: {
    httpStatus: 500,
    retryable: true,
    severity: 'high'
  },
  [OrderStatusErrorCode.DATABASE_UPDATE_ERROR]: {
    httpStatus: 500,
    retryable: true,
    severity: 'high'
  },
  [OrderStatusErrorCode.INTERNAL_ERROR]: {
    httpStatus: 500,
    retryable: true,
    severity: 'high'
  },
  [OrderStatusErrorCode.WEBSOCKET_ERROR]: {
    httpStatus: 500,
    retryable: false,
    severity: 'low'
  }
};

// User-friendly error messages
export const USER_FRIENDLY_MESSAGES: Record<OrderStatusErrorCode, string> = {
  [OrderStatusErrorCode.AUTHENTICATION_ERROR]: 'User not authenticated. Please log in again.',
  [OrderStatusErrorCode.ACCESS_DENIED]: 'You do not have permission to access this order.',
  [OrderStatusErrorCode.MISSING_ORDER_ID]: 'Order ID is required and must be provided.',
  [OrderStatusErrorCode.INVALID_BROKER_NAME]: 'Invalid broker name provided.',
  [OrderStatusErrorCode.BROKER_MISMATCH]: 'Order belongs to a different broker than specified.',
  [OrderStatusErrorCode.ORDER_NOT_FOUND]: 'Order not found in the system.',
  [OrderStatusErrorCode.ORDER_NOT_FOUND_IN_BROKER]: 'Order not found in broker system.',
  [OrderStatusErrorCode.BROKER_CONNECTION_ERROR]: 'Not connected to broker. Please reconnect your account.',
  [OrderStatusErrorCode.BROKER_SERVICE_ERROR]: 'Broker service is currently unavailable.',
  [OrderStatusErrorCode.SESSION_EXPIRED]: 'Session expired. Please reconnect your broker account.',
  [OrderStatusErrorCode.RATE_LIMIT_ERROR]: 'Rate limit exceeded. Please try again later.',
  [OrderStatusErrorCode.NETWORK_ERROR]: 'Network error occurred. Please try again.',
  [OrderStatusErrorCode.BROKER_ERROR]: 'Broker API error occurred. Please try again.',
  [OrderStatusErrorCode.DATABASE_ERROR]: 'Database error occurred. Please try again.',
  [OrderStatusErrorCode.DATABASE_UPDATE_ERROR]: 'Failed to update order status in database.',
  [OrderStatusErrorCode.INTERNAL_ERROR]: 'Internal server error occurred. Please try again.',
  [OrderStatusErrorCode.WEBSOCKET_ERROR]: 'Failed to broadcast order update.'
};