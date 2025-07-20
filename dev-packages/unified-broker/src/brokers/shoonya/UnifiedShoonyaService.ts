/**
 * Unified Shoonya Service
 * Implements the new IUnifiedBrokerService interface with all business logic encapsulated
 * Handles authentication, token management, and provides standardized responses
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

import { ShoonyaService, ShoonyaCredentials } from '../../services/shoonyaService';

export class UnifiedShoonyaService implements IUnifiedBrokerService {
  private shoonyaService: ShoonyaService;
  private isConnectedFlag: boolean = false;
  private accountInfo: UnifiedAccountInfo | null = null;
  private tokenInfo: UnifiedTokenInfo | null = null;
  private currentCredentials: ShoonyaCredentials | null = null;

  constructor() {
    this.shoonyaService = new ShoonyaService();
  }

  getBrokerName(): string {
    return 'shoonya';
  }

  /**
   * Connect to Shoonya broker with direct authentication
   * Handles all authentication logic internally and returns standardized response
   */
  async connect(credentials: any): Promise<UnifiedConnectionResponse> {
    try {
      const shoonyaCredentials = credentials as ShoonyaCredentials;
      this.currentCredentials = shoonyaCredentials;

      console.log('🔄 Attempting Shoonya authentication...');
      
      const response = await this.shoonyaService.login(shoonyaCredentials);
      
      if (response.stat === 'Ok') {
        // Authentication successful - populate account and token info
        this.accountInfo = {
          accountId: response.actid || shoonyaCredentials.userId,
          userName: response.uname || shoonyaCredentials.userId,
          email: response.email || '',
          brokerDisplayName: 'Shoonya (Finvasia)',
          exchanges: response.exarr || ['NSE', 'BSE'],
          products: response.prarr || ['C', 'M', 'I']
        };

        // Shoonya tokens don't expire (infinity)
        this.tokenInfo = {
          accessToken: response.susertoken,
          refreshToken: undefined, // Shoonya doesn't use refresh tokens
          expiryTime: null, // null indicates infinity
          isExpired: false,
          canRefresh: false // Shoonya doesn't need token refresh
        };

        this.isConnectedFlag = true;

        console.log('✅ Shoonya authentication successful');

        return UnifiedResponseHelper.createSuccessResponse(
          'Shoonya account connected successfully',
          'ACTIVE',
          'DIRECT_AUTH',
          this.accountInfo,
          this.tokenInfo
        );
      } else {
        // Authentication failed
        console.error('❌ Shoonya authentication failed:', response.emsg);
        
        return UnifiedResponseHelper.createErrorResponse(
          response.emsg || 'Shoonya authentication failed',
          'AUTH_FAILED',
          'INACTIVE',
          'REAUTH_REQUIRED'
        );
      }
    } catch (error: any) {
      console.error('🚨 Shoonya connection error:', error);
      
      // Determine error type based on error message
      let errorType: BrokerErrorType = 'BROKER_ERROR';
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        errorType = 'NETWORK_ERROR';
      } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
        errorType = 'VALIDATION_ERROR';
      }

      return UnifiedResponseHelper.createErrorResponse(
        error.message || 'Failed to connect to Shoonya',
        errorType,
        'INACTIVE',
        'REAUTH_REQUIRED'
      );
    }
  }

  /**
   * Shoonya doesn't use OAuth, so this method returns an error
   */
  async completeOAuth(authCode: string, credentials: any): Promise<UnifiedOAuthResponse> {
    return UnifiedResponseHelper.createErrorResponse(
      'Shoonya does not support OAuth authentication',
      'VALIDATION_ERROR',
      'INACTIVE',
      'DIRECT_AUTH'
    ) as UnifiedOAuthResponse;
  }

  /**
   * Shoonya tokens don't expire, so refresh is not needed
   */
  async refreshToken(credentials: any): Promise<UnifiedTokenRefreshResponse> {
    if (this.isConnectedFlag && this.tokenInfo) {
      return UnifiedResponseHelper.createSuccessResponse(
        'Shoonya tokens do not require refresh',
        'ACTIVE',
        'DIRECT_AUTH',
        this.accountInfo || undefined,
        this.tokenInfo || undefined
      ) as UnifiedTokenRefreshResponse;
    }

    return UnifiedResponseHelper.createErrorResponse(
      'No active Shoonya session to refresh',
      'AUTH_FAILED',
      'INACTIVE',
      'REAUTH_REQUIRED'
    ) as UnifiedTokenRefreshResponse;
  }

  /**
   * Validate current Shoonya session
   */
  async validateSession(credentials: any): Promise<UnifiedValidationResponse> {
    if (!this.isConnectedFlag || !this.tokenInfo) {
      return {
        isValid: false,
        accountStatus: 'INACTIVE',
        message: 'No active Shoonya session',
        errorType: 'AUTH_FAILED'
      };
    }

    try {
      // For Shoonya, we can validate by making a simple API call
      // Since tokens don't expire, if we have a connection, it should be valid
      const shoonyaCredentials = credentials as ShoonyaCredentials;
      const isValid = await this.shoonyaService.validateSession(shoonyaCredentials.userId);
      
      if (isValid) {
        return {
          isValid: true,
          accountStatus: 'ACTIVE',
          message: 'Shoonya session is valid',
          tokenInfo: this.tokenInfo
        };
      } else {
        // Session is no longer valid, reset state
        this.isConnectedFlag = false;
        this.accountInfo = null;
        this.tokenInfo = null;
        
        return {
          isValid: false,
          accountStatus: 'INACTIVE',
          message: 'Shoonya session has expired',
          errorType: 'TOKEN_EXPIRED'
        };
      }
    } catch (error: any) {
      console.error('🚨 Shoonya session validation error:', error);
      
      return {
        isValid: false,
        accountStatus: 'INACTIVE',
        message: 'Failed to validate Shoonya session',
        errorType: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Disconnect from Shoonya
   */
  async disconnect(): Promise<boolean> {
    try {
      if (this.isConnectedFlag) {
        await this.shoonyaService.logout();
      }
      
      // Reset all state
      this.isConnectedFlag = false;
      this.accountInfo = null;
      this.tokenInfo = null;
      this.currentCredentials = null;
      
      console.log('✅ Shoonya disconnected successfully');
      return true;
    } catch (error: any) {
      console.error('🚨 Shoonya disconnect error:', error);
      
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
    return this.isConnectedFlag;
  }

  /**
   * Get current account status
   */
  getAccountStatus(): AccountStatus {
    if (!this.isConnectedFlag) {
      return 'INACTIVE';
    }
    
    // Shoonya tokens don't expire, so if connected, always active
    return 'ACTIVE';
  }

  // Trading operations - delegate to existing service
  async placeOrder(orderRequest: any): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }

    // Transform unified order request to Shoonya format
    const shoonyaOrderRequest = {
      userId: this.accountInfo?.accountId || '',
      buyOrSell: orderRequest.action === 'BUY' ? 'B' as const : 'S' as const,
      productType: this.mapProductType(orderRequest.productType),
      exchange: orderRequest.exchange || 'NSE',
      tradingSymbol: orderRequest.symbol, // Map symbol to tradingSymbol
      quantity: orderRequest.quantity,
      discloseQty: 0,
      priceType: this.mapOrderType(orderRequest.orderType),
      price: orderRequest.price || 0,
      triggerPrice: orderRequest.triggerPrice || 0,
      retention: orderRequest.validity || 'DAY',
      amo: 'NO' as const,
      remarks: orderRequest.remarks || 'Order via CopyTrade Pro'
    };

    try {
      const shoonyaResponse = await this.shoonyaService.placeOrder(shoonyaOrderRequest);

      // Transform Shoonya response to unified format
      if (shoonyaResponse.stat === 'Ok') {
        return {
          success: true,
          message: 'Order placed successfully',
          data: {
            brokerOrderId: shoonyaResponse.norenordno,
            orderId: shoonyaResponse.norenordno,
            status: 'PLACED'
          }
        };
      } else {
        return {
          success: false,
          message: shoonyaResponse.emsg || 'Order placement failed',
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

  async cancelOrder(orderId: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }

    try {
      console.log('🚫 Cancelling Shoonya order:', orderId);

      const shoonyaResponse = await this.shoonyaService.cancelOrder(orderId);

      // Transform Shoonya response to unified format
      if (shoonyaResponse.stat === 'Ok') {
        return {
          success: true,
          message: 'Order cancelled successfully',
          data: {
            orderId: orderId,
            status: 'CANCELLED'
          }
        };
      } else {
        return {
          success: false,
          message: shoonyaResponse.emsg || 'Order cancellation failed',
          data: null
        };
      }
    } catch (error: any) {
      console.error('🚨 Shoonya order cancellation error:', error);
      return {
        success: false,
        message: error.message || 'Order cancellation failed',
        data: null
      };
    }
  }

  async modifyOrder(orderId: string, modifications: any): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }

    try {
      console.log('✏️ Modifying Shoonya order:', orderId, modifications);

      const shoonyaResponse = await this.shoonyaService.modifyOrder(orderId, modifications);

      // Transform Shoonya response to unified format
      if (shoonyaResponse.stat === 'Ok') {
        return {
          success: true,
          message: 'Order modified successfully',
          data: {
            orderId: orderId,
            status: 'MODIFIED'
          }
        };
      } else {
        return {
          success: false,
          message: shoonyaResponse.emsg || 'Order modification failed',
          data: null
        };
      }
    } catch (error: any) {
      console.error('🚨 Shoonya order modification error:', error);
      return {
        success: false,
        message: error.message || 'Order modification failed',
        data: null
      };
    }
  }

  private mapProductType(productType: string): string {
    const mapping: { [key: string]: string } = {
      'CNC': 'C',
      'MIS': 'M',
      'NRML': 'M',
      'BO': 'B',
      'CO': 'H'
    };
    return mapping[productType] || 'C'; // Default to CNC
  }

  private mapOrderType(orderType: string): 'LMT' | 'MKT' | 'SL-LMT' | 'SL-MKT' {
    const mapping: { [key: string]: 'LMT' | 'MKT' | 'SL-LMT' | 'SL-MKT' } = {
      'MARKET': 'MKT',
      'LIMIT': 'LMT',
      'SL-LIMIT': 'SL-LMT',
      'SL-MARKET': 'SL-MKT'
    };
    return mapping[orderType] || 'MKT'; // Default to MARKET
  }

  async getOrderStatus(accountId: string, orderId: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    return this.shoonyaService.getOrderStatus(accountId, orderId);
  }

  async getOrderHistory(accountId: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    // Use getOrderBook as Shoonya doesn't have separate getOrderHistory
    return this.shoonyaService.getOrderBook(accountId);
  }

  async getPositions(accountId: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    return this.shoonyaService.getPositions(accountId);
  }

  async getQuote(symbol: string, exchange: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    // For Shoonya, we need token instead of symbol, this is a simplified implementation
    return this.shoonyaService.getQuotes(exchange, symbol);
  }

  async searchSymbols(query: string, exchange: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    // Use searchScrip method from ShoonyaService
    return this.shoonyaService.searchScrip(exchange, query);
  }
}
