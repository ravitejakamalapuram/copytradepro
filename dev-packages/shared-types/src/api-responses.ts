/**
 * Standardized API Response Types
 * Shared between frontend and backend for consistent API communication
 */

// Authentication Step Constants
export const AuthenticationStep = {
  DIRECT_LOGIN: 'DIRECT_LOGIN',           // Direct login (Shoonya)
  OAUTH_REQUIRED: 'OAUTH_REQUIRED',       // OAuth flow required (Fyers)
  TOTP_REQUIRED: 'TOTP_REQUIRED',         // TOTP/2FA required
  CAPTCHA_REQUIRED: 'CAPTCHA_REQUIRED',   // Captcha required
  ALREADY_ACTIVE: 'ALREADY_ACTIVE',       // Account already active
  REAUTH_REQUIRED: 'REAUTH_REQUIRED'      // Re-authentication required
} as const;

export type AuthenticationStep = typeof AuthenticationStep[keyof typeof AuthenticationStep];

// Error Code Constants
export const ApiErrorCode = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  BROKER_ERROR: 'BROKER_ERROR',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  OAUTH_ERROR: 'OAUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  BROKER_MAINTENANCE: 'BROKER_MAINTENANCE'
} as const;

export type ApiErrorCode = typeof ApiErrorCode[keyof typeof ApiErrorCode];

// Standard Error Response
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: any;
  timestamp?: string;
}

// Base API Response
export interface BaseApiResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

// Account Activation Response
export interface ActivateAccountResponse extends BaseApiResponse {
  data?: {
    accountId: string;
    isActive: boolean;
    authStep: AuthenticationStep;
    authUrl?: string;           // For OAuth flows
    redirectUri?: string;       // For OAuth flows
    additionalData?: {
      brokerName?: string;
      userName?: string;
      exchanges?: string[];
      products?: string[];
      sessionValidUntil?: string;
    };
  };
  error?: ApiError;
}

// Account Deactivation Response
export interface DeactivateAccountResponse extends BaseApiResponse {
  data?: {
    accountId: string;
    isActive: boolean;
  };
  error?: ApiError;
}

// Connected Accounts Response
export interface ConnectedAccountsResponse extends BaseApiResponse {
  accounts?: Array<{
    id: string;
    brokerName: string;
    accountId: string;
    userId: string;
    userName: string;
    email: string;
    brokerDisplayName: string;
    exchanges: string[];
    products: string[];
    isActive: boolean;
    createdAt: string;
    lastActiveAt?: string;
  }>;
  error?: ApiError;
}

// OAuth Completion Response
export interface OAuthCompletionResponse extends BaseApiResponse {
  data?: {
    accountId: string;
    isActive: boolean;
    brokerName: string;
    userName: string;
  };
  error?: ApiError;
}

// Generic Success Response
export interface SuccessResponse extends BaseApiResponse {
  data?: any;
  error?: ApiError;
}

// Order Placement Response
export interface OrderResponse extends BaseApiResponse {
  data?: {
    orderId: string;
    status: string;
    brokerOrderId?: string;
    message?: string;
  };
  error?: ApiError;
}

// Portfolio Response
export interface PortfolioResponse extends BaseApiResponse {
  data?: {
    summary: any;
    holdings: any[];
    metrics: any;
  };
  error?: ApiError;
}

// Market Data Response
export interface MarketDataResponse extends BaseApiResponse {
  data?: {
    indices?: any[];
    stocks?: any[];
    lastUpdated?: string;
  };
  error?: ApiError;
}

// Helper function to create standardized success response
export function createSuccessResponse<T>(
  message: string,
  data?: T
): BaseApiResponse & { data?: T } {
  const response: BaseApiResponse & { data?: T } = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data !== undefined) {
    response.data = data;
  }
  
  return response;
}

// Helper function to create standardized error response
export function createErrorResponse(
  message: string,
  errorCode: ApiErrorCode,
  details?: any
): BaseApiResponse & { error: ApiError } {
  return {
    success: false,
    message,
    error: {
      code: errorCode,
      message,
      details,
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  };
}

// Helper function to create activation response
export function createActivationResponse(
  success: boolean,
  message: string,
  data?: ActivateAccountResponse['data'],
  error?: ApiError
): ActivateAccountResponse {
  const response: ActivateAccountResponse = {
    success,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data !== undefined) {
    response.data = data;
  }
  
  if (error !== undefined) {
    response.error = error;
  }
  
  return response;
}
