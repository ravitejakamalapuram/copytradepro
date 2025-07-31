/**
 * Fyers Service Adapter
 * Adapts the existing FyersService to implement IBrokerService interface
 */

import { IBrokerService, BrokerCredentials, LoginResponse, OrderRequest, OrderResponse, OrderStatus, Position, Quote } from '@copytrade/unified-broker';
import { FyersService } from './fyersService';
import { FyersCredentials } from './types';
import { FyersSymbolFormatter } from './symbolFormatter';

// Import standardized symbol services
import { BrokerSymbolConverterFactory } from '../../../backend/src/services/brokerSymbolConverters/BrokerSymbolConverterFactory';
import { symbolDatabaseService } from '../../../backend/src/services/symbolDatabaseService';

export class FyersServiceAdapter extends IBrokerService {
  private fyersService: FyersService;

  constructor() {
    super('fyers');
    this.fyersService = new FyersService();
  }

  async login(credentials: BrokerCredentials): Promise<LoginResponse> {
    try {
      const fyersCredentials = credentials as FyersCredentials;

      // If we have an auth code, try to complete the OAuth flow
      if (fyersCredentials.authCode) {
        // Complete OAuth authentication
        const serviceCredentials = {
          clientId: fyersCredentials.clientId,
          secretKey: fyersCredentials.secretKey,
          redirectUri: fyersCredentials.redirectUri || '',
          authCode: fyersCredentials.authCode,
          accessToken: fyersCredentials.accessToken,
          refreshToken: fyersCredentials.refreshToken
        };

        const tokenResponse = await this.fyersService.generateAccessToken(fyersCredentials.authCode, serviceCredentials);

        if (tokenResponse.success) {
          this.setConnected(true, fyersCredentials.clientId);
          return this.createSuccessResponse('OAuth authentication completed', {
            accountId: fyersCredentials.clientId,
            accessToken: tokenResponse.accessToken
          });
        } else {
          // Auth code is invalid, fall back to generating new OAuth URL
          console.log('🔄 Auth code invalid, generating new OAuth URL...');
        }
      }

      // Generate OAuth URL (either no auth code or invalid auth code)
      {
        console.log('🔗 Generating OAuth URL for Fyers authentication...');

        // Generate OAuth URL for authentication
        const serviceCredentials = {
          clientId: fyersCredentials.clientId,
          secretKey: fyersCredentials.secretKey,
          redirectUri: fyersCredentials.redirectUri || '',
          authCode: fyersCredentials.authCode,
          accessToken: fyersCredentials.accessToken,
          refreshToken: fyersCredentials.refreshToken
        };

        const response = await this.fyersService.login(serviceCredentials);

        if (!response.success && response.authUrl) {
          // Return OAuth URL for frontend to handle
          console.log('✅ OAuth URL generated successfully');
          return {
            success: false,
            message: response.message || 'OAuth authentication required',
            data: {
              authUrl: response.authUrl
            }
          };
        } else {
          console.error('❌ Failed to generate OAuth URL:', response.message);
          return this.createErrorResponse(response.message || 'Failed to generate OAuth URL', response);
        }
      }
    } catch (error: any) {
      return this.createErrorResponse(error.message || 'Login failed', error);
    }
  }

  async logout(): Promise<boolean> {
    try {
      const result = await this.fyersService.logout();
      this.setConnected(false);
      // logout returns an object, check if it indicates success
      return typeof result === 'object' ? result.success === true : Boolean(result);
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  }

  async validateSession(accountId?: string): Promise<boolean> {
    try {
      return await this.fyersService.validateSession();
    } catch (error) {
      return false;
    }
  }

  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Map unified order type to Fyers-specific format
        let fyersOrderType: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
        switch (orderRequest.orderType) {
          case 'LIMIT':
            fyersOrderType = 'LIMIT';
            break;
          case 'MARKET':
            fyersOrderType = 'MARKET';
            break;
          case 'SL-LIMIT':
            fyersOrderType = 'SL';
            break;
          case 'SL-MARKET':
            fyersOrderType = 'SL-M';
            break;
          default:
            fyersOrderType = 'MARKET';
        }

        // Map unified product type to Fyers format
        const productTypeMap: { [key: string]: string } = {
          'CNC': 'CNC',
          'MIS': 'INTRADAY',
          'NRML': 'MARGIN',
          'BO': 'BO',
          'C': 'CNC',
          'M': 'INTRADAY',
          'H': 'MARGIN',
          'B': 'BO'
        };
        const fyersProductType = productTypeMap[orderRequest.productType] || orderRequest.productType;

        // Convert symbol using standardized symbol system
        let formattedSymbol: string;
        try {
          // First, try to find the symbol in the standardized database
          const standardizedSymbol = await this.lookupStandardizedSymbol(orderRequest.symbol, orderRequest.exchange);
          
          if (standardizedSymbol) {
            // Use the symbol converter to get Fyers format
            const converter = BrokerSymbolConverterFactory.getConverter('fyers');
            const brokerFormat = converter.convertToBrokerFormat(standardizedSymbol);
            formattedSymbol = brokerFormat.tradingSymbol;
            
            console.log(`🔄 Fyers standardized symbol conversion: ${orderRequest.symbol} -> ${formattedSymbol}`);
          } else {
            // Fallback to legacy symbol formatter
            formattedSymbol = FyersSymbolFormatter.formatSymbol(
              orderRequest.symbol,
              orderRequest.exchange || 'NSE'
            );
            
            console.log(`🔄 Fyers legacy symbol formatting: ${orderRequest.symbol} -> ${formattedSymbol}`);
          }
        } catch (error: any) {
          console.warn(`⚠️ Symbol conversion failed for ${orderRequest.symbol}, using fallback:`, error.message);
          // Final fallback to original format
          formattedSymbol = `${orderRequest.exchange || 'NSE'}:${orderRequest.symbol}`;
        }

        // Transform to Fyers-specific order format
        const fyersOrderRequest = {
          symbol: formattedSymbol,
          qty: orderRequest.quantity,
          type: fyersOrderType,
          side: orderRequest.action, // Keep as 'BUY' | 'SELL' string
          productType: fyersProductType as 'CNC' | 'INTRADAY' | 'MARGIN' | 'CO' | 'BO',
          limitPrice: orderRequest.price || 0,
          stopPrice: orderRequest.triggerPrice || 0,
          validity: (orderRequest.validity === 'GTD' ? 'DAY' : orderRequest.validity) as 'DAY' | 'IOC',
          disclosedQty: 0,
          offlineOrder: false,
          stopLoss: 0,
          takeProfit: 0
        };

        const response = await this.fyersService.placeOrder(fyersOrderRequest);

        // Fyers response format: { s: 'ok'/'error', message: string, id?: string }
        if (response.s === 'ok') {
          return this.createSuccessResponse('Order placed successfully', {
            orderId: response.id,
            message: response.message,
            brokerOrderId: response.id,
            status: 'PLACED'
          });
        } else {
          // Check if this is a retryable error
          const isRetryable = this.isRetryableError(response.message);
          
          if (isRetryable && attempt < maxRetries) {
            console.log(`⚠️ Fyers order placement failed (attempt ${attempt}/${maxRetries}): ${response.message}. Retrying...`);
            lastError = new Error(response.message);
            await this.delay(1000 * attempt); // Exponential backoff
            continue;
          }
          
          return this.createErrorResponse(
            this.transformErrorMessage(response.message || 'Order placement failed'),
            {
              errorType: this.categorizeError(response.message),
              originalError: response.message,
              attempt: attempt
            }
          );
        }
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error.message);
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`⚠️ Fyers order placement error (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
          await this.delay(1000 * attempt); // Exponential backoff
          continue;
        }

        // Handle specific error types
        const errorType = this.categorizeError(error.message);
        const userFriendlyMessage = this.transformErrorMessage(error.message);

        return this.createErrorResponse(userFriendlyMessage, {
          errorType: errorType,
          originalError: error.message,
          attempt: attempt
        });
      }
    }

    // If we get here, all retries failed
    return this.createErrorResponse(
      this.transformErrorMessage(lastError?.message || 'Order placement failed after multiple attempts'),
      {
        errorType: this.categorizeError(lastError?.message),
        originalError: lastError?.message,
        maxRetriesExceeded: true
      }
    );
  }

  async getOrderStatus(accountId: string, orderId: string): Promise<OrderStatus> {
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Fyers doesn't have a separate getOrderStatus method, use getOrderBook
        const orderBook = await this.fyersService.getOrderBook();

        // orderBook is an array, not an object with orderBook property
        if (!Array.isArray(orderBook)) {
          throw new Error('Invalid order book response from Fyers');
        }

        const order = orderBook.find((o: any) => o.id === orderId);

        if (order) {
          return {
            orderId: order.id || orderId,
            status: order.status || 'UNKNOWN',
            quantity: order.qty || 0,
            filledQuantity: order.filledQty || 0,
            price: order.limitPrice || 0,
            averagePrice: order.avgPrice || 0,
            timestamp: new Date(order.orderDateTime || Date.now())
          };
        } else {
          throw new Error(`Order ${orderId} not found in Fyers order book`);
        }
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error.message);
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`⚠️ Fyers get order status failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
          await this.delay(1000 * attempt);
          continue;
        }

        // Transform error message for user
        const userFriendlyMessage = this.transformErrorMessage(error.message);
        throw new Error(userFriendlyMessage);
      }
    }

    // If we get here, all retries failed
    const userFriendlyMessage = this.transformErrorMessage(lastError?.message || 'Failed to get order status after multiple attempts');
    throw new Error(userFriendlyMessage);
  }

  async getOrderHistory(accountId: string): Promise<OrderStatus[]> {
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use getOrderBook for order history in Fyers
        const response = await this.fyersService.getOrderBook();

        // response is an array, not an object with orderBook property
        if (!Array.isArray(response)) {
          console.warn('Fyers order history response is not an array, returning empty array');
          return [];
        }

        return response.map((order: any) => ({
          orderId: order.id || '',
          status: order.status || 'UNKNOWN',
          quantity: order.qty || 0,
          filledQuantity: order.filledQty || 0,
          price: order.limitPrice || 0,
          averagePrice: order.avgPrice || 0,
          timestamp: new Date(order.orderDateTime || Date.now())
        }));
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error.message);
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`⚠️ Fyers get order history failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
          await this.delay(1000 * attempt);
          continue;
        }

        // Transform error message for user
        const userFriendlyMessage = this.transformErrorMessage(error.message);
        throw new Error(userFriendlyMessage);
      }
    }

    // If we get here, all retries failed
    const userFriendlyMessage = this.transformErrorMessage(lastError?.message || 'Failed to get order history after multiple attempts');
    throw new Error(userFriendlyMessage);
  }

  async getPositions(accountId: string): Promise<Position[]> {
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fyersService.getPositions();

        // response is an array, not an object with netPositions property
        if (!Array.isArray(response)) {
          console.warn('Fyers positions response is not an array, returning empty array');
          return [];
        }

        return response.map((position: any) => ({
          symbol: position.symbol || '',
          quantity: position.netQty || 0,
          averagePrice: position.avgPrice || 0,
          currentPrice: position.ltp || 0,
          pnl: position.pl || 0,
          exchange: position.exchange || '',
          productType: position.productType || ''
        }));
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error.message);
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`⚠️ Fyers get positions failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
          await this.delay(1000 * attempt);
          continue;
        }

        // Transform error message for user
        const userFriendlyMessage = this.transformErrorMessage(error.message);
        throw new Error(userFriendlyMessage);
      }
    }

    // If we get here, all retries failed
    const userFriendlyMessage = this.transformErrorMessage(lastError?.message || 'Failed to get positions after multiple attempts');
    throw new Error(userFriendlyMessage);
  }

  async getQuote(symbol: string, exchange: string): Promise<Quote> {
    try {
      // Convert symbol using standardized symbol system
      let formattedSymbol: string;
      try {
        // First, try to find the symbol in the standardized database
        const standardizedSymbol = await this.lookupStandardizedSymbol(symbol, exchange);
        
        if (standardizedSymbol) {
          // Use the symbol converter to get Fyers format
          const converter = BrokerSymbolConverterFactory.getConverter('fyers');
          const brokerFormat = converter.convertToBrokerFormat(standardizedSymbol);
          formattedSymbol = brokerFormat.tradingSymbol;
          
          console.log(`🔄 Fyers standardized quote symbol conversion: ${symbol} -> ${formattedSymbol}`);
        } else {
          // Fallback to legacy symbol formatter
          formattedSymbol = FyersSymbolFormatter.formatSymbol(symbol, exchange);
          console.log(`🔄 Fyers legacy quote symbol formatting: ${symbol} -> ${formattedSymbol}`);
        }
      } catch (error: any) {
        console.warn(`⚠️ Quote symbol conversion failed for ${symbol}, using fallback:`, error.message);
        formattedSymbol = `${exchange}:${symbol}`;
      }

      const response = await this.fyersService.getQuotes([formattedSymbol]);

      if (!response || response.length === 0) {
        throw new Error('No quote data received');
      }

      const quote = response[0];
      if (!quote) {
        throw new Error('No quote data in response');
      }

      return {
        symbol: quote.symbol || symbol,
        price: quote.ltp || 0,
        change: quote.chng || 0,
        changePercent: quote.chngPercent || 0,
        volume: quote.volume || 0,
        exchange: exchange,
        timestamp: new Date()
      };
    } catch (error: any) {
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  async searchSymbols(query: string, exchange: string): Promise<any[]> {
    try {
      // Fyers doesn't have a searchSymbols method, return empty array for now
      console.warn('searchSymbols not implemented for Fyers');
      return [];
    } catch (error: any) {
      throw new Error(`Failed to search symbols: ${error.message}`);
    }
  }

  // Fyers-specific methods that can be accessed if needed
  getFyersService(): FyersService {
    return this.fyersService;
  }

  async refreshToken(): Promise<boolean> {
    try {
      // Fyers refresh token functionality - simplified for now
      console.warn('refreshToken not fully implemented for Fyers');
      return false;
    } catch (error) {
      console.warn('refreshToken not available, using fallback');
      return false;
    }
  }

  async completeAuth(authCode: string): Promise<LoginResponse> {
    try {
      // Simplified auth completion - just store the auth code
      this.setConnected(true, this.accountId);
      return this.createSuccessResponse('Authentication completed', {
        accountId: this.accountId,
        authCode: authCode
      });
    } catch (error: any) {
      return this.createErrorResponse(error.message || 'Authentication failed', error);
    }
  }

  // Error handling helper methods
  private isRetryableError(errorMessage?: string): boolean {
    if (!errorMessage) return false;
    
    const message = errorMessage.toLowerCase();
    
    // Network-related errors that can be retried
    if (message.includes('network') || 
        message.includes('timeout') || 
        message.includes('connection') ||
        message.includes('server error') ||
        message.includes('service unavailable') ||
        message.includes('rate limit') ||
        message.includes('too many requests')) {
      return true;
    }
    
    return false;
  }

  private categorizeError(errorMessage?: string): string {
    if (!errorMessage) return 'UNKNOWN_ERROR';
    
    const message = errorMessage.toLowerCase();
    
    if (message.includes('token') || message.includes('unauthorized') || message.includes('authentication')) {
      return 'AUTH_ERROR';
    } else if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return 'NETWORK_ERROR';
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'RATE_LIMIT_ERROR';
    } else if (message.includes('insufficient') || message.includes('balance') || message.includes('margin')) {
      return 'INSUFFICIENT_FUNDS';
    } else if (message.includes('invalid symbol') || message.includes('symbol not found')) {
      return 'INVALID_SYMBOL';
    } else if (message.includes('market closed') || message.includes('trading hours')) {
      return 'MARKET_CLOSED';
    } else if (message.includes('order') && (message.includes('rejected') || message.includes('failed'))) {
      return 'ORDER_REJECTED';
    } else {
      return 'BROKER_ERROR';
    }
  }

  private transformErrorMessage(errorMessage?: string): string {
    if (!errorMessage) return 'An unknown error occurred';
    
    const message = errorMessage.toLowerCase();
    
    // Transform technical errors to user-friendly messages
    if (message.includes('token') || message.includes('unauthorized')) {
      return 'Your session has expired. Please reconnect your Fyers account.';
    } else if (message.includes('network') || message.includes('timeout')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'Too many requests. Please wait a moment and try again.';
    } else if (message.includes('insufficient') || message.includes('balance')) {
      return 'Insufficient funds in your account to place this order.';
    } else if (message.includes('invalid symbol') || message.includes('symbol not found')) {
      return 'Invalid trading symbol. Please check the symbol and try again.';
    } else if (message.includes('market closed') || message.includes('trading hours')) {
      return 'Market is currently closed. Orders can only be placed during trading hours.';
    } else if (message.includes('order') && message.includes('rejected')) {
      return 'Order was rejected by the broker. Please check order parameters and try again.';
    } else {
      // Return original message if no specific transformation is available
      return errorMessage;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Look up standardized symbol from database
   */
  private async lookupStandardizedSymbol(symbol: string, exchange?: string): Promise<any> {
    try {
      // Check if symbol database service is available and initialized
      if (!symbolDatabaseService || !symbolDatabaseService.isReady()) {
        console.warn('Symbol database service not available, using legacy formatting');
        return null;
      }

      // Try to find by trading symbol first
      let standardizedSymbol = await symbolDatabaseService.getSymbolByTradingSymbol(symbol, exchange);
      
      if (!standardizedSymbol) {
        // Try to find by ID if the symbol looks like an ID
        if (symbol.length === 24 && /^[0-9a-fA-F]{24}$/.test(symbol)) {
          standardizedSymbol = await symbolDatabaseService.getSymbolById(symbol);
        }
      }

      return standardizedSymbol;
    } catch (error) {
      console.warn('Failed to lookup standardized symbol:', error);
      return null;
    }
  }
}
