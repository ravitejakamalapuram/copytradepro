/**
 * Unified Fyers Service
 * Implements the new IUnifiedBrokerService interface with all business logic encapsulated
 * Handles OAuth flow, token refresh, profile fetching, expiry management, and provides standardized responses
 */

import { 
  IUnifiedBrokerService,
  UnifiedConnectionResponse,
  UnifiedOAuthResponse,
  UnifiedTokenRefreshResponse,
  UnifiedValidationResponse,
  UnifiedAccountInfo,
  UnifiedTokenInfo,
  UnifiedResponseHelper,
  AccountStatus,
  AuthenticationStep,
  BrokerErrorType
} from '../../interfaces/UnifiedBrokerResponse';

import { FyersService, FyersCredentials } from '../../services/fyersService';

export class UnifiedFyersService implements IUnifiedBrokerService {
  private fyersService: FyersService;
  private isConnectedFlag: boolean = false;
  private accountInfo: UnifiedAccountInfo | null = null;
  private tokenInfo: UnifiedTokenInfo | null = null;
  private currentCredentials: FyersCredentials | null = null;

  constructor() {
    this.fyersService = new FyersService();
  }

  getBrokerName(): string {
    return 'fyers';
  }

  /**
   * Connect to Fyers broker - initiates OAuth flow
   * Returns OAuth URL for user authentication
   */
  async connect(credentials: any): Promise<UnifiedConnectionResponse> {
    try {
      const fyersCredentials = credentials as FyersCredentials;
      this.currentCredentials = fyersCredentials;

      console.log('🔄 Initiating Fyers OAuth flow...');
      
      // Validate required credentials
      if (!fyersCredentials.clientId || !fyersCredentials.secretKey) {
        return UnifiedResponseHelper.createErrorResponse(
          'Client ID and Secret Key are required for Fyers authentication',
          'VALIDATION_ERROR',
          'INACTIVE',
          'REAUTH_REQUIRED'
        );
      }

      // Set default redirect URI if not provided
      if (!fyersCredentials.redirectUri) {
        fyersCredentials.redirectUri = process.env.FYERS_REDIRECT_URI || 'http://localhost:3001/api/broker/oauth/callback';
      }
      
      // Generate OAuth URL for user authentication
      const authUrl = this.fyersService.generateAuthUrl(fyersCredentials);
      
      if (authUrl) {
        console.log('✅ Fyers OAuth URL generated successfully');
        console.log(`🔗 OAuth URL: ${authUrl}`);
        
        return UnifiedResponseHelper.createOAuthResponse(
          authUrl,
          'Please complete OAuth authentication. You will be redirected back after authorization.'
        );
      } else {
        console.error('❌ Failed to generate Fyers OAuth URL');
        
        return UnifiedResponseHelper.createErrorResponse(
          'Failed to generate OAuth URL for Fyers. Please check your credentials.',
          'BROKER_ERROR',
          'INACTIVE',
          'REAUTH_REQUIRED'
        );
      }
    } catch (error: any) {
      console.error('🚨 Fyers connection error:', error);
      
      return UnifiedResponseHelper.createErrorResponse(
        error.message || 'Failed to initiate Fyers OAuth flow',
        'BROKER_ERROR',
        'INACTIVE',
        'REAUTH_REQUIRED'
      );
    }
  }

  /**
   * Complete Fyers OAuth flow with auth code
   * Generates access token, fetches profile, and sets up account
   */
  async completeOAuth(authCode: string, credentials: any): Promise<UnifiedOAuthResponse> {
    try {
      const fyersCredentials = credentials as FyersCredentials;
      
      console.log('🔄 Completing Fyers OAuth with auth code...');
      
      // Generate access token from auth code
      const tokenResponse = await this.fyersService.generateAccessToken(authCode, fyersCredentials);
      
      if (tokenResponse.success) {
        console.log('✅ Fyers access token generated successfully');
        
        // Fetch user profile to get real account information
        let realAccountId = tokenResponse.accountId || fyersCredentials.clientId;
        let realUserName = tokenResponse.accountId || fyersCredentials.clientId;
        
        try {
          const profileResponse = await this.fyersService.getProfile();
          if (profileResponse && profileResponse.data) {
            realAccountId = profileResponse.data.fy_id || profileResponse.data.id || profileResponse.data.user_id || realAccountId;
            realUserName = profileResponse.data.name || profileResponse.data.display_name || realAccountId;
            console.log(`✅ Fyers profile fetched - Account ID: ${realAccountId}, User Name: ${realUserName}`);
          }
        } catch (profileError: any) {
          console.warn('⚠️ Failed to fetch Fyers profile, using fallback values:', profileError.message);
        }

        // Set up account information
        this.accountInfo = {
          accountId: realAccountId,
          userName: realUserName,
          email: '', // Fyers doesn't provide email in profile
          brokerDisplayName: 'Fyers',
          exchanges: ['NSE', 'BSE', 'MCX'], // Fyers supported exchanges
          products: ['CNC', 'INTRADAY', 'MARGIN', 'CO', 'BO'] // Fyers product types
        };

        // Set up token information with expiry
        const expiryTime = tokenResponse.expiryTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        this.tokenInfo = {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          expiryTime: expiryTime,
          isExpired: false,
          canRefresh: !!tokenResponse.refreshToken
        };

        this.isConnectedFlag = true;

        console.log('✅ Fyers OAuth completion successful');

        return UnifiedResponseHelper.createSuccessResponse(
          'Fyers OAuth authentication completed successfully',
          'ACTIVE',
          'OAUTH_COMPLETION',
          this.accountInfo,
          this.tokenInfo
        ) as UnifiedOAuthResponse;
      } else {
        console.error('❌ Fyers OAuth completion failed:', tokenResponse.message);
        
        // Check if it's an auth code expiry issue
        const isAuthCodeExpired = tokenResponse.message && (
          tokenResponse.message.includes('expired') || 
          tokenResponse.message.includes('invalid auth code') ||
          tokenResponse.message.includes('code has expired')
        );

        if (isAuthCodeExpired) {
          return UnifiedResponseHelper.createErrorResponse(
            'Auth code has expired. Please try again.',
            'AUTH_CODE_EXPIRED',
            'PROCEED_TO_OAUTH',
            'OAUTH_REQUIRED'
          ) as UnifiedOAuthResponse;
        } else {
          return UnifiedResponseHelper.createErrorResponse(
            tokenResponse.message || 'Access token generation failed. Please try again.',
            'AUTH_FAILED',
            'PROCEED_TO_OAUTH',
            'OAUTH_REQUIRED'
          ) as UnifiedOAuthResponse;
        }
      }
    } catch (error: any) {
      console.error('🚨 Fyers OAuth completion error:', error);
      
      return UnifiedResponseHelper.createErrorResponse(
        error.message || 'OAuth completion failed. Please try again.',
        'BROKER_ERROR',
        'PROCEED_TO_OAUTH',
        'OAUTH_REQUIRED'
      ) as UnifiedOAuthResponse;
    }
  }

  /**
   * Refresh Fyers access token using refresh token
   */
  async refreshToken(credentials: any): Promise<UnifiedTokenRefreshResponse> {
    if (!this.tokenInfo || !this.tokenInfo.refreshToken) {
      return UnifiedResponseHelper.createErrorResponse(
        'No refresh token available for Fyers',
        'REFRESH_TOKEN_EXPIRED',
        'PROCEED_TO_OAUTH',
        'OAUTH_REQUIRED'
      ) as UnifiedTokenRefreshResponse;
    }

    try {
      console.log('🔄 Refreshing Fyers access token...');
      
      // TODO: Implement actual refresh token API call
      // For now, we'll simulate the refresh process
      console.warn('⚠️ Fyers token refresh not fully implemented - triggering re-auth');
      
      // If refresh fails, user needs to re-authenticate
      return UnifiedResponseHelper.createErrorResponse(
        'Token refresh failed. Please re-authenticate.',
        'REFRESH_TOKEN_EXPIRED',
        'PROCEED_TO_OAUTH',
        'OAUTH_REQUIRED'
      ) as UnifiedTokenRefreshResponse;
      
    } catch (error: any) {
      console.error('🚨 Fyers token refresh error:', error);
      
      return UnifiedResponseHelper.createErrorResponse(
        'Token refresh failed. Please re-authenticate.',
        'REFRESH_TOKEN_EXPIRED',
        'PROCEED_TO_OAUTH',
        'OAUTH_REQUIRED'
      ) as UnifiedTokenRefreshResponse;
    }
  }

  /**
   * Validate current Fyers session and check token expiry
   */
  async validateSession(credentials: any): Promise<UnifiedValidationResponse> {
    if (!this.isConnectedFlag || !this.tokenInfo) {
      return {
        isValid: false,
        accountStatus: 'INACTIVE',
        message: 'No active Fyers session',
        errorType: 'AUTH_FAILED'
      };
    }

    // Check if token is expired
    if (this.tokenInfo.expiryTime) {
      const now = new Date();
      const expiryTime = new Date(this.tokenInfo.expiryTime);
      
      if (now > expiryTime) {
        this.tokenInfo.isExpired = true;
        
        if (this.tokenInfo.canRefresh) {
          return {
            isValid: false,
            accountStatus: 'REFRESH_REQUIRED',
            message: 'Fyers token has expired but can be refreshed',
            errorType: 'TOKEN_EXPIRED',
            tokenInfo: this.tokenInfo
          };
        } else {
          return {
            isValid: false,
            accountStatus: 'PROCEED_TO_OAUTH',
            message: 'Fyers token has expired. Re-authentication required.',
            errorType: 'TOKEN_EXPIRED'
          };
        }
      }
    }

    try {
      // Validate session with Fyers API
      const isValid = await this.fyersService.validateSession();
      
      if (isValid) {
        return {
          isValid: true,
          accountStatus: 'ACTIVE',
          message: 'Fyers session is valid',
          tokenInfo: this.tokenInfo
        };
      } else {
        // Session is no longer valid
        this.isConnectedFlag = false;
        
        return {
          isValid: false,
          accountStatus: 'PROCEED_TO_OAUTH',
          message: 'Fyers session is no longer valid',
          errorType: 'TOKEN_EXPIRED'
        };
      }
    } catch (error: any) {
      console.error('🚨 Fyers session validation error:', error);
      
      return {
        isValid: false,
        accountStatus: 'INACTIVE',
        message: 'Failed to validate Fyers session',
        errorType: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Disconnect from Fyers
   */
  async disconnect(): Promise<boolean> {
    try {
      if (this.isConnectedFlag) {
        await this.fyersService.logout();
      }
      
      // Reset all state
      this.isConnectedFlag = false;
      this.accountInfo = null;
      this.tokenInfo = null;
      this.currentCredentials = null;
      
      console.log('✅ Fyers disconnected successfully');
      return true;
    } catch (error: any) {
      console.error('🚨 Fyers disconnect error:', error);
      
      // Reset state even if logout fails
      this.isConnectedFlag = false;
      this.accountInfo = null;
      this.tokenInfo = null;
      this.currentCredentials = null;
      
      return false;
    }
  }

  /**
   * Get current account information
   */
  getAccountInfo(): UnifiedAccountInfo | null {
    return this.accountInfo;
  }

  /**
   * Get current token information
   */
  getTokenInfo(): UnifiedTokenInfo | null {
    return this.tokenInfo;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.isConnectedFlag && !this.isTokenExpired();
  }

  /**
   * Get current account status
   */
  getAccountStatus(): AccountStatus {
    if (!this.isConnectedFlag) {
      return 'INACTIVE';
    }
    
    if (this.isTokenExpired()) {
      return this.tokenInfo?.canRefresh ? 'REFRESH_REQUIRED' : 'PROCEED_TO_OAUTH';
    }
    
    return 'ACTIVE';
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.tokenInfo || !this.tokenInfo.expiryTime) {
      return false;
    }
    
    const now = new Date();
    const expiryTime = new Date(this.tokenInfo.expiryTime);
    return now > expiryTime;
  }

  // Trading operations - delegate to existing service
  async placeOrder(orderRequest: any): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }

    // Transform unified order request to Fyers format
    const fyersOrderRequest = {
      symbol: orderRequest.symbol,
      qty: orderRequest.quantity,
      type: this.mapOrderType(orderRequest.orderType),
      side: orderRequest.action as 'BUY' | 'SELL',
      productType: this.mapProductType(orderRequest.productType),
      limitPrice: orderRequest.price || 0,
      stopPrice: orderRequest.triggerPrice || 0,
      validity: orderRequest.validity || 'DAY',
      disclosedQty: 0,
      offlineOrder: false
    };

    try {
      const fyersResponse = await this.fyersService.placeOrder(fyersOrderRequest);

      // Transform Fyers response to unified format
      if (fyersResponse.s === 'ok') {
        return {
          success: true,
          message: 'Order placed successfully',
          data: {
            brokerOrderId: fyersResponse.id,
            orderId: fyersResponse.id,
            status: 'PLACED'
          }
        };
      } else {
        return {
          success: false,
          message: fyersResponse.message || 'Order placement failed',
          data: null
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Order placement failed',
        data: null
      };
    }
  }

  private mapProductType(productType: string): 'CNC' | 'INTRADAY' | 'MARGIN' | 'CO' | 'BO' {
    const mapping: { [key: string]: 'CNC' | 'INTRADAY' | 'MARGIN' | 'CO' | 'BO' } = {
      'CNC': 'CNC',
      'MIS': 'INTRADAY',
      'NRML': 'MARGIN',
      'BO': 'BO',
      'CO': 'CO'
    };
    return mapping[productType] || 'CNC'; // Default to CNC
  }

  private mapOrderType(orderType: string): 'LIMIT' | 'MARKET' | 'SL' | 'SL-M' {
    const mapping: { [key: string]: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M' } = {
      'MARKET': 'MARKET',
      'LIMIT': 'LIMIT',
      'SL-LIMIT': 'SL',
      'SL-MARKET': 'SL-M'
    };
    return mapping[orderType] || 'MARKET'; // Default to MARKET
  }

  async getOrderStatus(accountId: string, orderId: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    // Use getOrderBook and filter by orderId
    const orderBook = await this.fyersService.getOrderBook();
    return orderBook.find((order: any) => order.id === orderId) || null;
  }

  async getOrderHistory(accountId: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    return this.fyersService.getOrderBook();
  }

  async getPositions(accountId: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    return this.fyersService.getPositions();
  }

  async getQuote(symbol: string, exchange: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    const fullSymbol = `${exchange}:${symbol}`;
    const quotes = await this.fyersService.getQuotes([fullSymbol]);
    return quotes.length > 0 ? quotes[0] : null;
  }

  async searchSymbols(query: string, exchange: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    return this.fyersService.searchScrip(exchange, query);
  }
}
