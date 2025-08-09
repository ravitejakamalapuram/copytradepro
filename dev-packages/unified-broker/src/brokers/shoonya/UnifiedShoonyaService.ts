/**
 * Unified Shoonya Service
 * Implements the new IUnifiedBrokerService interface with all business logic encapsulated
 * Handles authentication, token management, and provides standardized responses
 * Uses comprehensive error handler for consistent error processing
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
  async completeOAuth(_authCode: string, _credentials: any): Promise<UnifiedOAuthResponse> {
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
  async refreshToken(_credentials: any): Promise<UnifiedTokenRefreshResponse> {
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
    // Use symbolMetadata if available
    let tradingSymbol: string;
    let exchange: string;
    const symbolMetadata = (orderRequest as any).symbolMetadata;

    if (symbolMetadata) {
      // Use pre-fetched symbol metadata
      tradingSymbol = symbolMetadata.tradingSymbol;
      exchange = symbolMetadata.exchange || 'NSE';
      console.log(`🔄 UnifiedShoonya using pre-fetched symbol metadata: ${orderRequest.symbol} -> ${tradingSymbol} (${exchange})`);
    } else {
      // Use symbol as-is when no metadata provided
      tradingSymbol = orderRequest.symbol;
      exchange = orderRequest.exchange || 'NSE';
      console.log(`🔄 UnifiedShoonya using symbol as-is: ${orderRequest.symbol} -> ${tradingSymbol} (${exchange})`);
    }

    const shoonyaOrderRequest = {
      userId: this.accountInfo?.accountId || '',
      buyOrSell: orderRequest.action === 'BUY' ? 'B' as const : 'S' as const,
      productType: this.mapProductType(orderRequest.productType),
      exchange: exchange,
      tradingSymbol: tradingSymbol,
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
    console.log(`🚫 UnifiedShoonyaService.cancelOrder called for order: ${orderId}`);
    
    // Validate authentication state
    if (!this.isConnectedFlag || !this.tokenInfo) {
      console.error('❌ UnifiedShoonyaService: Not authenticated for order cancellation');
      return {
        success: false,
        message: 'Not connected to Shoonya. Please authenticate first.',
        errorType: 'AUTH_FAILED',
        data: null
      };
    }

    try {
      console.log('🔄 UnifiedShoonyaService: Cancelling Shoonya order via API...');

      const shoonyaResponse = await this.shoonyaService.cancelOrder(this.accountInfo?.accountId || '', orderId);

      console.log('🔍 UnifiedShoonyaService: Cancel order response:', shoonyaResponse);

      // Transform Shoonya response to unified format
      if (shoonyaResponse.stat === 'Ok') {
        console.log(`✅ UnifiedShoonyaService: Order ${orderId} cancelled successfully`);
        return {
          success: true,
          message: 'Order cancelled successfully',
          data: {
            orderId: orderId,
            brokerOrderId: orderId,
            status: 'CANCELLED'
          }
        };
      } else {
        console.error(`❌ UnifiedShoonyaService: Order cancellation failed:`, shoonyaResponse.emsg);
        return {
          success: false,
          message: shoonyaResponse.emsg || 'Order cancellation failed',
          data: null
        };
      }
    } catch (error: any) {
      console.error('🚨 UnifiedShoonyaService: Order cancellation error:', error.message);
      return {
        success: false,
        message: error.message || 'Order cancellation failed',
        data: null
      };
    }
  }

  async modifyOrder(orderId: string, modifications: any): Promise<any> {
    console.log(`✏️ UnifiedShoonyaService.modifyOrder called for order: ${orderId}`, modifications);
    
    // Validate authentication state
    if (!this.isConnectedFlag || !this.tokenInfo) {
      console.error('❌ UnifiedShoonyaService: Not authenticated for order modification');
      return {
        success: false,
        message: 'Not connected to Shoonya. Please authenticate first.',
        errorType: 'AUTH_FAILED',
        data: null
      };
    }

    try {
      console.log('🔄 UnifiedShoonyaService: Modifying Shoonya order via API...');

      const shoonyaResponse = await this.shoonyaService.modifyOrder(this.accountInfo?.accountId || '', orderId, modifications);

      console.log('🔍 UnifiedShoonyaService: Modify order response:', shoonyaResponse);

      // Transform Shoonya response to unified format
      if (shoonyaResponse.stat === 'Ok') {
        console.log(`✅ UnifiedShoonyaService: Order ${orderId} modified successfully`);
        return {
          success: true,
          message: 'Order modified successfully',
          data: {
            orderId: orderId,
            brokerOrderId: orderId,
            status: 'MODIFIED'
          }
        };
      } else {
        console.error(`❌ UnifiedShoonyaService: Order modification failed:`, shoonyaResponse.emsg);
        return {
          success: false,
          message: shoonyaResponse.emsg || 'Order modification failed',
          data: null
        };
      }
    } catch (error: any) {
      console.error('🚨 UnifiedShoonyaService: Order modification error:', error.message);
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

  /**
   * Transform Shoonya order status response to unified format
   */
  private transformToUnifiedOrderStatus(shoonyaResponse: any, orderId: string): any {
    console.log('🔄 UnifiedShoonyaService: Transforming Shoonya response to unified format');
    
    // Map Shoonya status to unified status
    const unifiedStatus = this.mapShoonyaStatusToUnified(shoonyaResponse.status);
    
    // Parse numeric values safely
    const quantity = parseFloat(shoonyaResponse.qty || '0');
    const filledQuantity = parseFloat(shoonyaResponse.fillshares || '0');
    const price = parseFloat(shoonyaResponse.prc || '0');
    const averagePrice = parseFloat(shoonyaResponse.avgprc || '0');
    
    // Create unified order status object
    const unifiedOrderStatus = {
      orderId: orderId,                                    // Internal order ID
      brokerOrderId: shoonyaResponse.norenordno || orderId, // Broker's order ID
      status: unifiedStatus,                               // Standardized status
      symbol: shoonyaResponse.tsym || '',                  // Trading symbol
      quantity: quantity,                                  // Order quantity
      filledQuantity: filledQuantity,                      // Executed quantity
      price: price,                                        // Order price
      averagePrice: averagePrice,                          // Average execution price
      timestamp: this.parseTimestamp(shoonyaResponse.exch_tm || shoonyaResponse.norentm), // Last update time
      rejectionReason: shoonyaResponse.rejreason || undefined, // If rejected
      exchange: this.extractExchange(shoonyaResponse.tsym), // Exchange name
      brokerName: 'shoonya',                               // Broker identifier
      
      // Additional fields for backward compatibility and debugging
      rawResponse: shoonyaResponse,                        // Original response for debugging
      orderTime: shoonyaResponse.norentm || '',           // Order placement time
      updateTime: shoonyaResponse.exch_tm || '',          // Last update time from exchange
    };
    
    console.log('✅ UnifiedShoonyaService: Unified order status created:', unifiedOrderStatus);
    
    return unifiedOrderStatus;
  }

  /**
   * Map Shoonya order status to unified status types
   */
  private mapShoonyaStatusToUnified(shoonyaStatus: string): string {
    const SHOONYA_STATUS_MAP: { [key: string]: string } = {
      'OPEN': 'PLACED',
      'COMPLETE': 'EXECUTED',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED',
      'TRIGGER_PENDING': 'PENDING',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
      // Additional mappings for other possible Shoonya statuses
      'NEW': 'PLACED',
      'PENDING': 'PENDING',
      'MODIFY_PENDING': 'PENDING',
      'CANCEL_PENDING': 'PENDING',
      'AMO_REQ_RECEIVED': 'PENDING'
    };
    
    const unifiedStatus = SHOONYA_STATUS_MAP[shoonyaStatus] || 'PLACED';
    console.log(`🔄 UnifiedShoonyaService: Mapped Shoonya status '${shoonyaStatus}' to unified status '${unifiedStatus}'`);
    
    return unifiedStatus;
  }

  /**
   * Parse timestamp from Shoonya response
   */
  private parseTimestamp(timestamp?: string): Date {
    if (!timestamp) {
      return new Date(); // Return current time if no timestamp provided
    }
    
    try {
      // Shoonya timestamps are typically in format: "DD-MM-YYYY HH:mm:ss"
      // Convert to ISO format for proper parsing
      const parsedDate = new Date(timestamp);
      return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    } catch (error) {
      console.warn('⚠️ UnifiedShoonyaService: Failed to parse timestamp:', timestamp);
      return new Date();
    }
  }

  /**
   * Extract exchange from trading symbol
   */
  private extractExchange(tradingSymbol?: string): string {
    if (!tradingSymbol) return 'NSE'; // Default to NSE
    
    // Shoonya trading symbols often include exchange info
    if (tradingSymbol.includes('-EQ')) return 'NSE';
    if (tradingSymbol.includes('BSE:')) return 'BSE';
    
    // Default to NSE if cannot determine
    return 'NSE';
  }

  // Legacy error handling methods removed - now using comprehensive error handler

  async getOrderStatus(accountId: string, orderId: string): Promise<any> {
    const startTime = performance.now();
    const operationId = `unified_getOrderStatus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced logging context
    const logContext = {
      userId: accountId,
      brokerName: 'shoonya',
      accountId: accountId,
      operation: 'getOrderStatus',
      orderId: orderId,
      operationId,
      component: 'UNIFIED_SHOONYA_SERVICE',
      timestamp: new Date().toISOString()
    };

    console.log(`[${new Date().toISOString()}] [INFO] [UNIFIED_ORDER_STATUS] Order status request initiated`, logContext);
    console.log(`📊 UnifiedShoonyaService.getOrderStatus called for order: ${orderId}, account: ${accountId}`);
    
    // Validate authentication state
    if (!this.isConnectedFlag || !this.tokenInfo) {
      const responseTime = performance.now() - startTime;
      
      console.log(`[${new Date().toISOString()}] [ERROR] [UNIFIED_ORDER_STATUS] Authentication validation failed`, {
        ...logContext,
        responseTime: Math.round(responseTime),
        isConnected: this.isConnectedFlag,
        hasTokenInfo: !!this.tokenInfo,
        errorType: 'AUTH_FAILED'
      });
      
      console.error('❌ UnifiedShoonyaService: Not authenticated or missing token info');
      return {
        success: false,
        message: 'Not connected to Shoonya. Please authenticate first.',
        errorType: 'AUTH_FAILED',
        data: null,
        retryable: false,
        suggestedActions: [
          'Click the "Reconnect Account" button',
          'Re-enter your Shoonya credentials',
          'Ensure your account is active'
        ]
      };
    }

    // Note: Comprehensive error handler would be imported here in a real implementation
    // const errorHandlerModule = await import('../../../../../backend/src/services/comprehensiveErrorHandler');
    // comprehensiveErrorHandler = errorHandlerModule.comprehensiveErrorHandler;
    const comprehensiveErrorHandler: any = null; // Placeholder for now

    const context = {
      userId: accountId,
      brokerName: 'shoonya',
      accountId: accountId,
      operation: 'getOrderStatus',
      timestamp: new Date()
    };

    // Validate session before making API call
    try {
      const sessionStartTime = performance.now();
      const sessionValidation = await this.validateSession(this.currentCredentials);
      const sessionValidationTime = performance.now() - sessionStartTime;
      
      console.log(`[${new Date().toISOString()}] [DEBUG] [UNIFIED_ORDER_STATUS] Session validation completed`, {
        ...logContext,
        sessionValidationTime: Math.round(sessionValidationTime),
        isValid: sessionValidation.isValid,
        errorType: sessionValidation.errorType
      });
      
      if (!sessionValidation.isValid) {
        const responseTime = performance.now() - startTime;
        
        console.log(`[${new Date().toISOString()}] [ERROR] [UNIFIED_ORDER_STATUS] Session validation failed`, {
          ...logContext,
          responseTime: Math.round(responseTime),
          validationMessage: sessionValidation.message,
          errorType: sessionValidation.errorType
        });
        
        console.error('❌ UnifiedShoonyaService: Session validation failed');
        
        const errorMessage = sessionValidation.message || 'Shoonya session is invalid';
        const userFriendlyMessage = comprehensiveErrorHandler ? 
          comprehensiveErrorHandler.getUserFriendlyMessage({ message: errorMessage }, context) :
          errorMessage;
        
        return {
          success: false,
          message: userFriendlyMessage,
          errorType: sessionValidation.errorType || 'TOKEN_EXPIRED',
          data: null,
          retryable: false,
          suggestedActions: [
            'Reconnect your Shoonya account',
            'Check your credentials',
            'Ensure your account is active'
          ]
        };
      }
    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      
      console.log(`[${new Date().toISOString()}] [ERROR] [UNIFIED_ORDER_STATUS] Session validation error`, {
        ...logContext,
        responseTime: Math.round(responseTime),
        errorMessage: error.message,
        errorType: 'NETWORK_ERROR'
      });
      
      console.error('🚨 UnifiedShoonyaService: Session validation error:', error.message);
      
      const userFriendlyMessage = comprehensiveErrorHandler ? 
        comprehensiveErrorHandler.getUserFriendlyMessage(error, context) :
        'Failed to validate Shoonya session';
      
      return {
        success: false,
        message: userFriendlyMessage,
        errorType: 'NETWORK_ERROR',
        data: null,
        retryable: true,
        suggestedActions: [
          'Check your internet connection',
          'Try again in a few moments',
          'Contact support if issue persists'
        ]
      };
    }

    try {
      console.log(`🔄 UnifiedShoonyaService: Fetching order status from Shoonya API...`);
      
      // Use comprehensive error handler if available
      const executeOperation = async () => {
        // Check rate limiting if comprehensive error handler is available
        if (comprehensiveErrorHandler) {
          const rateLimitStartTime = performance.now();
          const rateLimitCheck = comprehensiveErrorHandler.checkRateLimit(
            accountId, 'shoonya', 'getOrderStatus'
          );
          const rateLimitCheckTime = performance.now() - rateLimitStartTime;
          
          console.log(`[${new Date().toISOString()}] [DEBUG] [UNIFIED_ORDER_STATUS] Rate limit check completed`, {
            ...logContext,
            rateLimitCheckTime: Math.round(rateLimitCheckTime),
            allowed: rateLimitCheck.allowed,
            remaining: rateLimitCheck.remaining
          });
          
          if (!rateLimitCheck.allowed) {
            const waitTime = rateLimitCheck.waitTime || 0;
            
            console.log(`[${new Date().toISOString()}] [WARN] [UNIFIED_ORDER_STATUS] Rate limit exceeded`, {
              ...logContext,
              waitTime: Math.ceil(waitTime / 1000),
              remaining: rateLimitCheck.remaining,
              resetTime: rateLimitCheck.resetTime
            });
            
            const error = new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
            (error as any).code = 'RATE_LIMITED';
            throw error;
          }
        }
        
        const apiStartTime = performance.now();
        const result = await this.shoonyaService.getOrderStatus(accountId, orderId);
        const apiDuration = performance.now() - apiStartTime;
        
        console.log(`[${new Date().toISOString()}] [DEBUG] [UNIFIED_ORDER_STATUS] Shoonya API call completed`, {
          ...logContext,
          apiDuration: Math.round(apiDuration),
          success: result?.stat === 'Ok'
        });
        
        return result;
      };

      let shoonyaResponse: any;
      
      if (comprehensiveErrorHandler) {
        // Use comprehensive error handler with retry logic
        console.log(`[${new Date().toISOString()}] [DEBUG] [UNIFIED_ORDER_STATUS] Using comprehensive error handler with retry logic`, logContext);
        
        shoonyaResponse = await comprehensiveErrorHandler.executeWithRetry(
          executeOperation,
          context,
          {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000
          }
        );
      } else {
        // Fallback to direct execution with basic retry
        console.log(`[${new Date().toISOString()}] [DEBUG] [UNIFIED_ORDER_STATUS] Using fallback execution with basic retry`, logContext);
        
        let lastError: any = null;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[${new Date().toISOString()}] [DEBUG] [UNIFIED_ORDER_STATUS] Retry attempt ${attempt}/${maxRetries}`, {
              ...logContext,
              attempt,
              maxRetries
            });
            
            shoonyaResponse = await executeOperation();
            break; // Success, exit retry loop
          } catch (error: any) {
            lastError = error;
            
            console.log(`[${new Date().toISOString()}] [WARN] [UNIFIED_ORDER_STATUS] Retry attempt ${attempt} failed`, {
              ...logContext,
              attempt,
              errorMessage: error.message,
              errorType: error.errorType || error.code
            });
            
            if (attempt === maxRetries) {
              throw error; // Last attempt failed, throw error
            }
            
            // Wait before retry (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            console.log(`[${new Date().toISOString()}] [DEBUG] [UNIFIED_ORDER_STATUS] Waiting ${delay}ms before retry`, {
              ...logContext,
              delay,
              nextAttempt: attempt + 1
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      const totalResponseTime = performance.now() - startTime;
      
      console.log('🔍 UnifiedShoonyaService: Raw Shoonya response:', shoonyaResponse);

      // Handle successful response
      if (shoonyaResponse.stat === 'Ok') {
        console.log(`✅ UnifiedShoonyaService: Successfully retrieved order status for ${orderId}`);
        
        // Transform to unified format
        const unifiedOrderStatus = this.transformToUnifiedOrderStatus(shoonyaResponse, orderId);
        
        console.log(`[${new Date().toISOString()}] [INFO] [UNIFIED_ORDER_STATUS] Order status retrieved successfully`, {
          ...logContext,
          responseTime: Math.round(totalResponseTime),
          orderStatus: unifiedOrderStatus.status,
          symbol: unifiedOrderStatus.symbol,
          quantity: unifiedOrderStatus.quantity,
          filledQuantity: unifiedOrderStatus.filledQuantity
        });
        
        console.log('🔄 UnifiedShoonyaService: Transformed to unified format:', unifiedOrderStatus);
        
        return {
          success: true,
          message: 'Order status retrieved successfully',
          data: unifiedOrderStatus
        };
      } else {
        // Handle API error response
        console.error(`❌ UnifiedShoonyaService: Shoonya API error for order ${orderId}:`, shoonyaResponse.emsg);
        
        console.log(`[${new Date().toISOString()}] [ERROR] [UNIFIED_ORDER_STATUS] Shoonya API error response`, {
          ...logContext,
          responseTime: Math.round(totalResponseTime),
          errorMessage: shoonyaResponse.emsg,
          errorType: shoonyaResponse.errorType,
          brokerResponse: shoonyaResponse
        });
        
        const userFriendlyMessage = comprehensiveErrorHandler ? 
          comprehensiveErrorHandler.getUserFriendlyMessage(
            { message: shoonyaResponse.emsg, code: shoonyaResponse.errorType },
            context
          ) :
          shoonyaResponse.emsg;
        
        const suggestedActions = comprehensiveErrorHandler ?
          comprehensiveErrorHandler.getSuggestedActions(
            { message: shoonyaResponse.emsg, code: shoonyaResponse.errorType },
            context
          ) :
          ['Try again later', 'Contact support if issue persists'];
        
        return {
          success: false,
          message: userFriendlyMessage,
          data: null,
          originalError: shoonyaResponse,
          retryable: shoonyaResponse.retryable || false,
          suggestedActions: suggestedActions
        };
      }
    } catch (error: any) {
      const totalResponseTime = performance.now() - startTime;
      
      console.error('🚨 UnifiedShoonyaService: Order status retrieval error:', error.message);
      
      console.log(`[${new Date().toISOString()}] [ERROR] [UNIFIED_ORDER_STATUS] Order status operation failed`, {
        ...logContext,
        responseTime: Math.round(totalResponseTime),
        errorMessage: error.message,
        errorType: error.errorType || error.code,
        stack: error.stack
      });
      
      // Handle different error types with comprehensive error handler
      const userFriendlyMessage = comprehensiveErrorHandler ? 
        comprehensiveErrorHandler.getUserFriendlyMessage(error, context) :
        error.message;
      
      const suggestedActions = comprehensiveErrorHandler ?
        comprehensiveErrorHandler.getSuggestedActions(error, context) :
        ['Try again later', 'Contact support if issue persists'];
      
      const isRetryable = comprehensiveErrorHandler ?
        comprehensiveErrorHandler.isRetryable(error, context) :
        false;
      
      return {
        success: false,
        message: userFriendlyMessage,
        data: null,
        originalError: error.message,
        retryable: isRetryable,
        suggestedActions: suggestedActions,
        context: context,
        responseTime: Math.round(totalResponseTime),
        operationId
      };
    }
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
