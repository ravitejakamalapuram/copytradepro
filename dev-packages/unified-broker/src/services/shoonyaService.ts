import crypto from 'crypto';
import axios from 'axios';
import { authenticator } from 'otplib';

// Import enhanced logging for order status operations
// Note: In a real implementation, this would be imported from the backend
// For now, we'll use console logging with structured format
interface OrderStatusLogContext {
  userId?: string;
  brokerName?: string;
  accountId?: string;
  operation?: string;
  orderId?: string;
  responseTime?: number;
  sessionId?: string;
  requestId?: string;
}

class StructuredLogger {
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  logOrderStatusRequest(context: OrderStatusLogContext): string {
    const requestId = this.generateRequestId();
    console.log(`[${new Date().toISOString()}] [INFO] [ORDER_STATUS] Order status request initiated`, {
      requestId,
      ...context,
      component: 'SHOONYA_SERVICE',
      operation: 'getOrderStatus'
    });
    return requestId;
  }

  logOrderStatusSuccess(context: OrderStatusLogContext, orderData: any, requestId: string): void {
    console.log(`[${new Date().toISOString()}] [INFO] [ORDER_STATUS] Order status retrieved successfully`, {
      requestId,
      ...context,
      orderStatus: orderData.status,
      symbol: orderData.tsym,
      quantity: orderData.qty,
      filledQuantity: orderData.fillshares,
      responseTime: context.responseTime
    });
  }

  logOrderStatusError(context: OrderStatusLogContext, error: any, requestId: string): void {
    console.error(`[${new Date().toISOString()}] [ERROR] [ORDER_STATUS] Order status request failed`, {
      requestId,
      ...context,
      errorMessage: error.message,
      errorType: error.errorType || 'UNKNOWN_ERROR',
      originalError: error.originalError
    });
  }

  logApiCall(method: string, endpoint: string, duration: number, success: boolean, context?: any): void {
    const level = success ? 'INFO' : 'ERROR';
    console.log(`[${new Date().toISOString()}] [${level}] [API_CALL] ${method} ${endpoint} - ${success ? 'SUCCESS' : 'FAILED'} (${Math.round(duration)}ms)`, {
      method,
      endpoint,
      duration: Math.round(duration),
      success,
      ...context
    });
  }

  logRateLimit(context: OrderStatusLogContext, rateLimitInfo: any): void {
    const level = rateLimitInfo.exceeded ? 'WARN' : 'DEBUG';
    console.log(`[${new Date().toISOString()}] [${level}] [RATE_LIMIT] Rate limit check`, {
      ...context,
      exceeded: rateLimitInfo.exceeded,
      remaining: rateLimitInfo.remaining,
      resetTime: rateLimitInfo.resetTime
    });
  }
}

const structuredLogger = new StructuredLogger();

export interface ShoonyaCredentials {
  userId: string;
  password: string;
  totpKey: string;  // Changed from twoFA to totpKey
  vendorCode: string;
  apiSecret: string;
  imei: string;
}

export interface ShoonyaLoginResponse {
  stat: string;
  susertoken?: string;
  lastaccesstime?: string;
  spasswordreset?: string;
  exarr?: string[];
  uname?: string;
  prarr?: string[];
  actid?: string;
  email?: string;
  brkname?: string;
  emsg?: string;
}

export interface PlaceOrderRequest {
  userId: string;
  buyOrSell: 'B' | 'S';
  productType: string;
  exchange: string;
  tradingSymbol: string;
  quantity: number;
  discloseQty: number;
  priceType: 'LMT' | 'MKT' | 'SL-LMT' | 'SL-MKT';
  price: number;
  triggerPrice: number;
  retention?: 'DAY' | 'IOC' | 'EOS';
  amo?: 'YES' | 'NO';
  remarks?: string;
}

export class ShoonyaService {
  private baseUrl = 'https://api.shoonya.com/NorenWClientTP';
  private sessionToken: string | null = null;
  private userId: string | null = null;

  private generateSHA256Hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  private generateTOTP(secret: string): string {
    try {
      // Generate TOTP using the secret key
      const token = authenticator.generate(secret);
      console.log('🔐 Generated TOTP:', token);
      return token;
    } catch (error) {
      console.error('🚨 TOTP generation error:', error);
      throw new Error('Failed to generate TOTP');
    }
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    try {
      // Shoonya API expects data as jData parameter in form-encoded format (raw string)
      const jsonData = JSON.stringify(data);
      console.log('🔍 Sending jData:', jsonData);

      const formBody = `jData=${jsonData}`;
      console.log('🔍 Form body:', formBody);

      const response = await axios.post(`${this.baseUrl}/${endpoint}`, formBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      console.error(`🚨 Shoonya API Error [${endpoint}]:`, error.message);
      if (error.response) {
        console.error('🚨 Response status:', error.response.status);
        console.error('🚨 Response data:', error.response.data);
      }
      throw new Error(`Shoonya API request failed: ${error.message}`);
    }
  }

  private async makeAuthenticatedRequest(endpoint: string, data: any): Promise<any> {
    try {
      // For authenticated requests, pass session token as jKey parameter
      const jsonData = JSON.stringify(data);
      console.log('🔍 Sending authenticated jData:', jsonData);

      const formBody = `jData=${jsonData}&jKey=${this.sessionToken}`;
      console.log('🔍 Authenticated form body:', formBody);

      const response = await axios.post(`${this.baseUrl}/${endpoint}`, formBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      console.error(`🚨 Shoonya API Error [${endpoint}]:`, error.message);
      if (error.response) {
        console.error('🚨 Response status:', error.response.status);
        console.error('🚨 Response data:', error.response.data);
        console.error('🚨 Response headers:', error.response.headers);

        // If it's a 400 error, the response data usually contains the actual error
        if (error.response.status === 400 && error.response.data) {
          throw new Error(`Shoonya API Error: ${JSON.stringify(error.response.data)}`);
        }
      }
      throw new Error(`Shoonya API request failed: ${error.message}`);
    }
  }

  async login(credentials: ShoonyaCredentials): Promise<ShoonyaLoginResponse> {
    try {
      // Hash the password with SHA256
      const hashedPassword = this.generateSHA256Hash(credentials.password);

      // Generate TOTP from the secret key
      const currentTOTP = this.generateTOTP(credentials.totpKey);

      const loginData = {
        uid: credentials.userId,
        pwd: hashedPassword,
        factor2: currentTOTP,
        vc: credentials.vendorCode,
        appkey: this.generateSHA256Hash(`${credentials.userId}|${credentials.apiSecret}`),
        imei: credentials.imei,
        source: 'API',
        apkversion: '1.0.0', // Required field that was missing
      };

      console.log('🔐 Attempting Shoonya login for user:', credentials.userId);
      console.log('🔍 Login data:', {
        uid: loginData.uid,
        vc: loginData.vc,
        imei: loginData.imei,
        source: loginData.source,
        hasPassword: !!loginData.pwd,
        hasAppkey: !!loginData.appkey,
        hasFactor2: !!loginData.factor2
      });

      const response = await this.makeRequest('QuickAuth', loginData);
      
      if (response.stat === 'Ok' && response.susertoken) {
        this.sessionToken = response.susertoken;
        this.userId = credentials.userId; // Store userId for logout
        console.log('✅ Shoonya login successful');
        return response;
      } else {
        console.error('❌ Shoonya login failed:', response.emsg || 'Unknown error');
        throw new Error(response.emsg || 'Login failed');
      }
    } catch (error: any) {
      console.error('🚨 Shoonya login error:', error.message);
      throw error;
    }
  }

  async logout(userId?: string): Promise<any> {
    if (!this.sessionToken && !userId) {
      console.log('⚠️ No active session to logout from');
      return { stat: 'Ok', message: 'No active session' };
    }

    try {
      console.log('🔄 Logging out from Shoonya...');

      const logoutData = {
        uid: userId || this.userId || '', // Use provided userId or stored userId
        jKey: this.sessionToken, // Include session token for logout
      };

      const response = await this.makeRequest('Logout', logoutData);

      this.sessionToken = null;
      this.userId = null;

      if (response.stat === 'Ok') {
        console.log('✅ Shoonya logout successful');
        return response;
      } else {
        console.log('⚠️ Shoonya logout response:', response.emsg || 'Unknown response');
        return response;
      }
    } catch (error: any) {
      console.error('🚨 Shoonya logout error:', error.message);
      this.sessionToken = null;
      this.userId = null;
      // Don't throw error for logout - just log it
      return { stat: 'Ok', message: 'Logout completed with errors' };
    }
  }

  async placeOrder(orderData: PlaceOrderRequest): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }

    try {
      // Ensure trading symbol is in correct format for NSE
      let tradingSymbol = orderData.tradingSymbol;
      if (orderData.exchange === 'NSE' && !tradingSymbol.includes('-EQ')) {
        tradingSymbol = `${tradingSymbol}-EQ`;
      }

      const requestData = {
        uid: orderData.userId,
        actid: orderData.userId,
        exch: orderData.exchange,
        tsym: tradingSymbol,
        qty: orderData.quantity.toString(),
        dscqty: orderData.discloseQty.toString(),
        prc: orderData.priceType === 'MKT' ? '0' : orderData.price.toString(),
        prd: orderData.productType,
        trantype: orderData.buyOrSell,
        prctyp: orderData.priceType,
        ret: orderData.retention || 'DAY',
        remarks: orderData.remarks || '',
        // Add additional fields that might be required
        ordersource: 'API',
      };

      // Add trigger price for stop loss orders
      if (orderData.triggerPrice && (orderData.priceType === 'SL-LMT' || orderData.priceType === 'SL-MKT')) {
        (requestData as any).trgprc = orderData.triggerPrice.toString();
      }

      console.log('📊 Placing Shoonya order:', {
        symbol: orderData.tradingSymbol,
        action: orderData.buyOrSell,
        quantity: orderData.quantity,
        type: orderData.priceType,
      });

      console.log('🔍 Full Shoonya order request data:', requestData);

      const response = await this.makeAuthenticatedRequest('PlaceOrder', requestData);
      
      if (response.stat === 'Ok') {
        console.log('✅ Shoonya order placed successfully:', response.norenordno);
        return response;
      } else {
        console.error('❌ Shoonya order placement failed:', response.emsg);
        throw new Error(response.emsg || 'Order placement failed');
      }
    } catch (error: any) {
      console.error('🚨 Shoonya place order error:', error.message);
      throw error;
    }
  }

  async getOrderBook(userId: string): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }

    try {
      const response = await this.makeAuthenticatedRequest('OrderBook', {
        uid: userId,
        actid: userId,
      });

      return response;
    } catch (error: any) {
      console.error('🚨 Shoonya get order book error:', error.message);
      throw error;
    }
  }

  async getOrderStatus(userId: string, orderNumber: string, exchange?: string): Promise<any> {
    const startTime = performance.now();
    const logContext: OrderStatusLogContext = {
      userId,
      brokerName: 'shoonya',
      accountId: userId,
      operation: 'getOrderStatus',
      orderId: orderNumber
    };

    // Start structured logging
    const requestId = structuredLogger.logOrderStatusRequest(logContext);

    if (!this.sessionToken) {
      const error = new Error('Not logged in to Shoonya. Please login first.');
      (error as any).errorType = 'SESSION_EXPIRED';
      
      // Log authentication error
      structuredLogger.logOrderStatusError({
        ...logContext,
        responseTime: performance.now() - startTime
      }, error, requestId);
      
      throw error;
    }

    try {
      console.log(`📊 Checking order status for order: ${orderNumber}`);

      // Build request parameters according to Shoonya API specification
      const requestParams: any = {
        uid: userId,
        actid: userId, // Account ID (same as uid for most cases)
        norenordno: orderNumber // Order number from Shoonya
      };

      // Add exchange if provided (optional but recommended)
      if (exchange) {
        requestParams.exch = exchange;
      }

      console.log('🔍 Shoonya getOrderStatus request params:', requestParams);

      // Make API call with performance tracking
      const apiStartTime = performance.now();
      const response = await this.makeAuthenticatedRequest('SingleOrdStatus', requestParams);
      const apiDuration = performance.now() - apiStartTime;

      // Log API call performance
      structuredLogger.logApiCall('POST', 'SingleOrdStatus', apiDuration, response?.stat === 'Ok', {
        userId,
        orderNumber,
        exchange,
        requestId
      });

      console.log('🔍 Shoonya getOrderStatus raw response:', response);

      const totalResponseTime = performance.now() - startTime;

      // Handle successful response
      if (response && response.stat === 'Ok') {
        console.log(`📊 Order ${orderNumber} status: ${response.status}`);
        
        // Transform response to standardized format with proper error handling
        const transformedResponse = {
          stat: 'Ok',
          norenordno: response.norenordno || orderNumber,
          status: response.status || 'UNKNOWN',
          tsym: response.tsym || '',
          qty: response.qty || '0',
          prc: response.prc || '0',
          fillshares: response.fillshares || '0',
          avgprc: response.avgprc || '0',
          rejreason: response.rejreason || '',
          norentm: response.norentm || '',
          exch_tm: response.exch_tm || '',
          // Legacy format for backward compatibility
          orderNumber: response.norenordno || orderNumber,
          symbol: response.tsym || '',
          quantity: response.qty || '0',
          price: response.prc || '0',
          executedQuantity: response.fillshares || '0',
          averagePrice: response.avgprc || '0',
          rejectionReason: response.rejreason || '',
          orderTime: response.norentm || '',
          updateTime: response.exch_tm || '',
          rawOrder: response
        };

        // Log successful response
        structuredLogger.logOrderStatusSuccess({
          ...logContext,
          responseTime: totalResponseTime
        }, transformedResponse, requestId);

        return transformedResponse;
      } else {
        // Handle API error response
        const errorMessage = response?.emsg || 'Failed to get order status';
        console.log(`⚠️ Failed to get order status: ${errorMessage}`);
        
        // Create structured error response
        const errorResponse = {
          stat: 'Not_Ok',
          emsg: errorMessage,
          originalError: errorMessage,
          rawResponse: response,
          errorType: this.categorizeApiError(response)
        };

        // Log API error
        structuredLogger.logOrderStatusError({
          ...logContext,
          responseTime: totalResponseTime
        }, {
          message: errorMessage,
          errorType: errorResponse.errorType,
          originalError: errorMessage
        }, requestId);
        
        return errorResponse;
      }
    } catch (error: any) {
      const totalResponseTime = performance.now() - startTime;
      
      console.error('🚨 Shoonya get order status error:', error.message);
      
      // Categorize the error for better logging
      const errorType = this.categorizeNetworkError(error);
      
      // Log the error with structured logging
      structuredLogger.logOrderStatusError({
        ...logContext,
        responseTime: totalResponseTime
      }, {
        message: error.message,
        errorType,
        originalError: error.message,
        stack: error.stack
      }, requestId);
      
      // Create enhanced error with additional context
      const enhancedError = new Error(error.message);
      (enhancedError as any).originalError = error.message;
      (enhancedError as any).errorType = errorType;
      (enhancedError as any).requestId = requestId;
      (enhancedError as any).responseTime = totalResponseTime;
      
      throw enhancedError;
    }
  }

  /**
   * Categorize API errors for better logging and error handling
   */
  private categorizeApiError(response: any): string {
    if (!response || !response.emsg) {
      return 'UNKNOWN_ERROR';
    }

    const errorMessage = response.emsg.toLowerCase();
    
    if (errorMessage.includes('session') || errorMessage.includes('token') || errorMessage.includes('login')) {
      return 'SESSION_EXPIRED';
    }
    if (errorMessage.includes('order not found') || errorMessage.includes('invalid order')) {
      return 'ORDER_NOT_FOUND';
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return 'RATE_LIMITED';
    }
    if (errorMessage.includes('invalid') || errorMessage.includes('validation')) {
      return 'VALIDATION_ERROR';
    }
    
    return 'BROKER_ERROR';
  }

  /**
   * Categorize network errors for better logging and error handling
   */
  private categorizeNetworkError(error: any): string {
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      return 'NETWORK_ERROR';
    }
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    if (error.response?.status >= 500) {
      return 'SERVER_ERROR';
    }
    if (error.response?.status === 429) {
      return 'RATE_LIMITED';
    }
    if (error.response?.status >= 400 && error.response?.status < 500) {
      return 'CLIENT_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }



  async searchScrip(exchange: string, searchText: string): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }

    try {
      console.log(`🔍 Shoonya searchScrip called:`, {
        exchange,
        searchText,
        hasSessionToken: !!this.sessionToken
      });

      const response = await this.makeRequest('SearchScrip', {
        uid: this.userId,
        exch: exchange,
        stext: searchText,
        token: this.sessionToken,
      });

      console.log(`📊 Shoonya searchScrip response:`, {
        responseType: typeof response,
        isArray: Array.isArray(response),
        length: Array.isArray(response) ? response.length : 'N/A',
        response: response
      });

      return response;
    } catch (error: any) {
      console.error('🚨 Shoonya search scrip error:', error.message);
      throw error;
    }
  }



  isLoggedIn(): boolean {
    return this.sessionToken !== null;
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  // Validate if the current session is still active
  async validateSession(userId: string): Promise<boolean> {
    if (!this.sessionToken || !userId) {
      return false;
    }

    try {
      // Use a lightweight API call to check if session is still valid
      // Limits is a simple endpoint that requires authentication
      const response = await this.makeAuthenticatedRequest('Limits', {
        uid: userId,
        actid: userId, // Account ID is usually same as user ID
      });

      // If the call succeeds and returns 'Ok', session is valid
      return response.stat === 'Ok';
    } catch (error: any) {
      console.log('⚠️ Session validation failed for Shoonya:', error.message);
      // If API call fails, session is likely expired
      this.sessionToken = null;
      this.userId = null;
      return false;
    }
  }

  /**
   * Get the current user ID (broker account ID)
   */
  getUserId(): string | null {
    return this.userId;
  }

  // Legacy error handling methods removed - now using comprehensive error handler

  /**
   * Cancel an existing order
   */
  async cancelOrder(userId: string, orderNumber: string): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }

    try {
      console.log(`🚫 Cancelling Shoonya order: ${orderNumber}`);

      const response = await this.makeAuthenticatedRequest('CancelOrder', {
        uid: userId,
        actid: userId,
        norenordno: orderNumber
      });

      if (response && response.stat === 'Ok') {
        console.log(`✅ Order ${orderNumber} cancelled successfully`);
        return response;
      } else {
        console.log(`⚠️ Failed to cancel order: ${response?.emsg || 'Unknown error'}`);
        throw new Error(response?.emsg || 'Order cancellation failed');
      }
    } catch (error: any) {
      console.error('🚨 Shoonya cancel order error:', error.message);
      throw error;
    }
  }

  /**
   * Modify an existing order
   */
  async modifyOrder(userId: string, orderNumber: string, modifications: any): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }

    try {
      console.log(`✏️ Modifying Shoonya order: ${orderNumber}`, modifications);

      const requestData = {
        uid: userId,
        actid: userId,
        norenordno: orderNumber,
        ...modifications
      };

      const response = await this.makeAuthenticatedRequest('ModifyOrder', requestData);

      if (response && response.stat === 'Ok') {
        console.log(`✅ Order ${orderNumber} modified successfully`);
        return response;
      } else {
        console.log(`⚠️ Failed to modify order: ${response?.emsg || 'Unknown error'}`);
        throw new Error(response?.emsg || 'Order modification failed');
      }
    } catch (error: any) {
      console.error('🚨 Shoonya modify order error:', error.message);
      throw error;
    }
  }

  /**
   * Get positions for a user
   */
  async getPositions(userId: string): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }

    try {
      const response = await this.makeAuthenticatedRequest('PositionBook', {
        uid: userId,
        actid: userId,
      });

      return response;
    } catch (error: any) {
      console.error('🚨 Shoonya get positions error:', error.message);
      throw error;
    }
  }

  /**
   * Get quotes for a symbol
   */
  async getQuotes(exchange: string, token: string): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }

    try {
      const response = await this.makeRequest('GetQuotes', {
        uid: '',
        exch: exchange,
        token: token,
        sessionToken: this.sessionToken,
      });

      return response;
    } catch (error: any) {
      console.error('🚨 Shoonya get quotes error:', error.message);
      throw error;
    }
  }
}
