/**
 * Shared Constants for CopyTrade Application
 * 
 * This file contains all constants used across:
 * - Broker modules
 * - Unified broker module  
 * - Backend services
 * - Frontend UI
 * - Database structures
 */

// ============================================================================
// ACCOUNT STATUS CONSTANTS
// ============================================================================

/**
 * Account authentication status enum
 * Used across database, API responses, and UI
 */
export const ACCOUNT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE', 
  PROCEED_TO_OAUTH: 'PROCEED_TO_OAUTH'
} as const;

export type AccountStatus = typeof ACCOUNT_STATUS[keyof typeof ACCOUNT_STATUS];

// ============================================================================
// AUTHENTICATION STEP CONSTANTS
// ============================================================================

/**
 * Authentication flow steps
 * Used in broker connections and OAuth flows
 */
export const AUTHENTICATION_STEP = {
  DIRECT_AUTH: 'DIRECT_AUTH',
  OAUTH_REQUIRED: 'OAUTH_REQUIRED', 
  OAUTH_PENDING: 'OAUTH_PENDING',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  EXPIRED: 'EXPIRED',
  ERROR: 'ERROR'
} as const;

export type AuthenticationStep = typeof AUTHENTICATION_STEP[keyof typeof AUTHENTICATION_STEP];

// ============================================================================
// BROKER CONSTANTS
// ============================================================================

/**
 * Supported broker names
 */
export const BROKER_NAMES = {
  SHOONYA: 'shoonya',
  FYERS: 'fyers',
  ZERODHA: 'zerodha',
  UPSTOX: 'upstox',
  ANGEL_ONE: 'angelone'
} as const;

export type BrokerName = typeof BROKER_NAMES[keyof typeof BROKER_NAMES];

/**
 * Broker display names for UI
 */
export const BROKER_DISPLAY_NAMES = {
  [BROKER_NAMES.SHOONYA]: 'Shoonya (Finvasia)',
  [BROKER_NAMES.FYERS]: 'FYERS',
  [BROKER_NAMES.ZERODHA]: 'Zerodha',
  [BROKER_NAMES.UPSTOX]: 'Upstox',
  [BROKER_NAMES.ANGEL_ONE]: 'Angel One'
} as const;

// ============================================================================
// EXCHANGE CONSTANTS
// ============================================================================

/**
 * Supported exchanges
 */
export const EXCHANGES = {
  NSE: 'NSE',
  BSE: 'BSE', 
  NFO: 'NFO',
  BFO: 'BFO',
  MCX: 'MCX',
  CDS: 'CDS',
  NIPO: 'NIPO',
  BSTAR: 'BSTAR'
} as const;

export type Exchange = typeof EXCHANGES[keyof typeof EXCHANGES];

// ============================================================================
// ORDER CONSTANTS
// ============================================================================

/**
 * Order actions
 */
export const ORDER_ACTION = {
  BUY: 'BUY',
  SELL: 'SELL'
} as const;

export type OrderAction = typeof ORDER_ACTION[keyof typeof ORDER_ACTION];

/**
 * Order types
 */
export const ORDER_TYPE = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  SL_LIMIT: 'SL-LIMIT',
  SL_MARKET: 'SL-MARKET'
} as const;

export type OrderType = typeof ORDER_TYPE[keyof typeof ORDER_TYPE];

/**
 * Product types
 */
export const PRODUCT_TYPE = {
  CNC: 'CNC',     // Cash and Carry
  MIS: 'MIS',     // Margin Intraday Squareoff
  NRML: 'NRML',   // Normal
  BO: 'BO',       // Bracket Order
  CO: 'CO',       // Cover Order
  C: 'C',         // Cash (Shoonya)
  M: 'M',         // Margin (Shoonya)
  H: 'H',         // Hold (Shoonya)
  B: 'B'          // Bracket (Shoonya)
} as const;

export type ProductType = typeof PRODUCT_TYPE[keyof typeof PRODUCT_TYPE];

/**
 * Order status
 */
export const ORDER_STATUS = {
  SUBMITTED: 'SUBMITTED',
  PLACED: 'PLACED',
  PENDING: 'PENDING',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  EXECUTED: 'EXECUTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// ============================================================================
// API ERROR CODES
// ============================================================================

/**
 * Standardized API error codes
 */
export const API_ERROR_CODE = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  BROKER_CONNECTION_FAILED: 'BROKER_CONNECTION_FAILED',
  BROKER_ERROR: 'BROKER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  OAUTH_ERROR: 'OAUTH_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  ORDER_REJECTED: 'ORDER_REJECTED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
} as const;

export type ApiErrorCode = typeof API_ERROR_CODE[keyof typeof API_ERROR_CODE];

// ============================================================================
// DATABASE FIELD NAMES
// ============================================================================

/**
 * Standardized database field names
 * Used across MongoDB adapters
 */
export const DB_FIELDS = {
  // User fields
  USER_ID: 'user_id',
  EMAIL: 'email',
  NAME: 'name',
  PASSWORD: 'password',
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
  
  // Connected Account fields
  BROKER_NAME: 'broker_name',
  ACCOUNT_ID: 'account_id',
  USER_NAME: 'user_name',
  BROKER_DISPLAY_NAME: 'broker_display_name',
  EXCHANGES: 'exchanges',
  PRODUCTS: 'products',
  ENCRYPTED_CREDENTIALS: 'encrypted_credentials',
  ACCOUNT_STATUS: 'account_status',
  TOKEN_EXPIRY_TIME: 'token_expiry_time',
  
  // Order History fields
  BROKER_ORDER_ID: 'broker_order_id',
  SYMBOL: 'symbol',
  EXCHANGE: 'exchange',
  ACTION: 'action',
  QUANTITY: 'quantity',
  ORDER_TYPE: 'order_type',
  PRODUCT_TYPE: 'product_type',
  PRICE: 'price',
  TRIGGER_PRICE: 'trigger_price',
  ORDER_STATUS: 'order_status',
  EXECUTED_QUANTITY: 'executed_quantity',
  EXECUTED_PRICE: 'executed_price',
  ORDER_TIME: 'order_time',
  EXECUTION_TIME: 'execution_time',
  ERROR_MESSAGE: 'error_message'
} as const;

// ============================================================================
// TOKEN EXPIRY CONSTANTS
// ============================================================================

/**
 * Token expiry settings for different brokers
 */
export const TOKEN_EXPIRY = {
  SHOONYA_HOURS: null, // Infinity - tokens don't expire
  FYERS_HOURS: 24,     // 24 hours
  DEFAULT_HOURS: 24    // Default for new brokers
} as const;

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/**
 * Validation rules and limits
 */
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  MAX_QUANTITY: 999999,
  MIN_QUANTITY: 1,
  MAX_PRICE: 999999.99,
  MIN_PRICE: 0.01
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * UI-specific constants
 */
export const UI_CONSTANTS = {
  TOAST_DURATION: 5000,
  POLLING_INTERVAL: 5000,
  DEBOUNCE_DELAY: 300,
  MAX_RETRY_ATTEMPTS: 3,
  DEFAULT_PAGE_SIZE: 20
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if account status is active
 */
export const isAccountActive = (status: AccountStatus): boolean => {
  return status === ACCOUNT_STATUS.ACTIVE;
};

/**
 * Check if account requires OAuth
 */
export const requiresOAuth = (status: AccountStatus): boolean => {
  return status === ACCOUNT_STATUS.PROCEED_TO_OAUTH;
};

/**
 * Get broker display name
 */
export const getBrokerDisplayName = (brokerName: BrokerName): string => {
  return BROKER_DISPLAY_NAMES[brokerName] || brokerName.toUpperCase();
};

/**
 * Check if order is in final state
 */
export const isOrderFinal = (status: OrderStatus): boolean => {
  const finalStatuses: OrderStatus[] = [
    ORDER_STATUS.EXECUTED,
    ORDER_STATUS.REJECTED,
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.FAILED
  ];
  return finalStatuses.includes(status);
};

/**
 * Get token expiry hours for broker
 */
export const getTokenExpiryHours = (brokerName: BrokerName): number | null => {
  switch (brokerName) {
    case BROKER_NAMES.SHOONYA:
      return TOKEN_EXPIRY.SHOONYA_HOURS;
    case BROKER_NAMES.FYERS:
      return TOKEN_EXPIRY.FYERS_HOURS;
    default:
      return TOKEN_EXPIRY.DEFAULT_HOURS;
  }
};
