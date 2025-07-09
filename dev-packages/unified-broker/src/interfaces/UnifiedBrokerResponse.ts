/**
 * Unified Broker Response Interface
 * Standardizes all broker module responses to eliminate broker-specific logic in unified flow
 */

// Account status enum for authentication flow
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'PROCEED_TO_OAUTH' | 'TOKEN_EXPIRED' | 'REFRESH_REQUIRED';

// Authentication step enum for UI flow control
export type AuthenticationStep = 
  | 'DIRECT_AUTH'           // Direct authentication (Shoonya)
  | 'OAUTH_REQUIRED'        // OAuth flow needed (Fyers initial)
  | 'OAUTH_COMPLETION'      // OAuth completion with auth code
  | 'TOKEN_REFRESH'         // Token refresh using refresh token
  | 'REAUTH_REQUIRED';      // Full re-authentication needed

// Error types for consistent error handling
export type BrokerErrorType = 
  | 'AUTH_FAILED'           // Authentication failed
  | 'AUTH_CODE_EXPIRED'     // OAuth auth code expired
  | 'TOKEN_EXPIRED'         // Access token expired
  | 'REFRESH_TOKEN_EXPIRED' // Refresh token expired
  | 'NETWORK_ERROR'         // Network/connectivity issues
  | 'BROKER_ERROR'          // Broker-specific errors
  | 'VALIDATION_ERROR';     // Input validation errors

/**
 * Standardized Account Information
 * All brokers must return account info in this format
 */
export interface UnifiedAccountInfo {
  accountId: string;           // Broker's account ID
  userName: string;            // User's display name
  email?: string;              // User's email (if available)
  brokerDisplayName: string;   // Formatted broker name for display
  exchanges: string[];         // Available exchanges
  products: string[];          // Available product types
}

/**
 * Standardized Token Information
 * Handles token lifecycle for all brokers
 */
export interface UnifiedTokenInfo {
  accessToken?: string;        // Current access token
  refreshToken?: string;       // Refresh token (if supported)
  expiryTime: string | null;   // ISO string or null for infinity (Shoonya)
  isExpired: boolean;          // Whether token is currently expired
  canRefresh: boolean;         // Whether token can be refreshed
}

/**
 * Standardized Authentication Response
 * Base response for all authentication operations
 */
export interface UnifiedAuthResponse {
  success: boolean;
  message: string;
  accountStatus: AccountStatus;
  authenticationStep: AuthenticationStep;
  errorType?: BrokerErrorType;
  
  // Account information (populated on successful auth)
  accountInfo?: UnifiedAccountInfo;
  
  // Token information (populated on successful auth)
  tokenInfo?: UnifiedTokenInfo;
  
  // OAuth-specific fields (for OAuth brokers)
  authUrl?: string;            // OAuth URL for user redirection
  requiresAuthCode?: boolean;  // Whether auth code input is needed
  
  // Additional data for specific flows
  data?: any;
}

/**
 * Standardized Connection Response
 * Response for initial broker connection attempts
 */
export interface UnifiedConnectionResponse extends UnifiedAuthResponse {
  // Inherits all fields from UnifiedAuthResponse
  // Additional connection-specific fields can be added here if needed
}

/**
 * Standardized OAuth Completion Response
 * Response for OAuth completion with auth code
 */
export interface UnifiedOAuthResponse extends UnifiedAuthResponse {
  // Inherits all fields from UnifiedAuthResponse
  // OAuth completion should always populate accountInfo and tokenInfo on success
}

/**
 * Standardized Token Refresh Response
 * Response for token refresh operations
 */
export interface UnifiedTokenRefreshResponse extends UnifiedAuthResponse {
  // Inherits all fields from UnifiedAuthResponse
  // Token refresh should update tokenInfo with new tokens
}

/**
 * Standardized Account Validation Response
 * Response for account/session validation
 */
export interface UnifiedValidationResponse {
  isValid: boolean;
  accountStatus: AccountStatus;
  message?: string;
  errorType?: BrokerErrorType;
  
  // Updated token info if refresh occurred during validation
  tokenInfo?: UnifiedTokenInfo;
}

/**
 * Enhanced Broker Service Interface
 * All broker modules must implement this interface
 */
export interface IUnifiedBrokerService {
  // Core identification
  getBrokerName(): string;
  
  // Authentication methods
  connect(credentials: any): Promise<UnifiedConnectionResponse>;
  completeOAuth(authCode: string, credentials: any): Promise<UnifiedOAuthResponse>;
  refreshToken(credentials: any): Promise<UnifiedTokenRefreshResponse>;
  validateSession(credentials: any): Promise<UnifiedValidationResponse>;
  disconnect(): Promise<boolean>;
  
  // Account information
  getAccountInfo(): UnifiedAccountInfo | null;
  getTokenInfo(): UnifiedTokenInfo | null;
  
  // Status checks
  isConnected(): boolean;
  getAccountStatus(): AccountStatus;
  
  // Trading operations (existing interface)
  placeOrder(orderRequest: any): Promise<any>;
  getOrderStatus(accountId: string, orderId: string): Promise<any>;
  getOrderHistory(accountId: string): Promise<any>;
  getPositions(accountId: string): Promise<any>;
  getQuote(symbol: string, exchange: string): Promise<any>;
  searchSymbols(query: string, exchange: string): Promise<any>;
}

/**
 * Broker Module Factory Interface
 * For creating standardized broker instances
 */
export interface IBrokerModuleFactory {
  createBroker(brokerName: string): IUnifiedBrokerService;
  getSupportedBrokers(): string[];
  isBrokerSupported(brokerName: string): boolean;
}

/**
 * Helper functions for creating standardized responses
 */
export class UnifiedResponseHelper {
  static createSuccessResponse(
    message: string,
    accountStatus: AccountStatus,
    authStep: AuthenticationStep,
    accountInfo?: UnifiedAccountInfo,
    tokenInfo?: UnifiedTokenInfo,
    additionalData?: any
  ): UnifiedAuthResponse {
    return {
      success: true,
      message,
      accountStatus,
      authenticationStep: authStep,
      accountInfo,
      tokenInfo,
      data: additionalData
    };
  }

  static createErrorResponse(
    message: string,
    errorType: BrokerErrorType,
    accountStatus: AccountStatus = 'INACTIVE',
    authStep: AuthenticationStep = 'REAUTH_REQUIRED'
  ): UnifiedAuthResponse {
    return {
      success: false,
      message,
      errorType,
      accountStatus,
      authenticationStep: authStep
    };
  }

  static createOAuthResponse(
    authUrl: string,
    message: string = 'OAuth authentication required'
  ): UnifiedConnectionResponse {
    return {
      success: false, // OAuth requires user action
      message,
      accountStatus: 'PROCEED_TO_OAUTH',
      authenticationStep: 'OAUTH_REQUIRED',
      authUrl,
      requiresAuthCode: true
    };
  }

  static createTokenExpiredResponse(
    canRefresh: boolean,
    message: string = 'Token has expired'
  ): UnifiedValidationResponse {
    return {
      isValid: false,
      accountStatus: canRefresh ? 'REFRESH_REQUIRED' : 'INACTIVE',
      message,
      errorType: 'TOKEN_EXPIRED'
    };
  }
}
