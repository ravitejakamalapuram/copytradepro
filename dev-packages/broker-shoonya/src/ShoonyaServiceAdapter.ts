/**
 * Shoonya Service Adapter
 * Adapts the existing ShoonyaService to implement IBrokerService interface
 */

import { IBrokerService, BrokerCredentials, LoginResponse, OrderRequest, OrderResponse, OrderStatus, Position, Quote } from '@copytrade/unified-broker';
import { ShoonyaService } from './shoonyaService';
import { ShoonyaCredentials } from './types';

export class ShoonyaServiceAdapter extends IBrokerService {
  private shoonyaService: ShoonyaService;

  constructor() {
    super('shoonya');
    this.shoonyaService = new ShoonyaService();
  }

  async login(credentials: BrokerCredentials): Promise<LoginResponse> {
    try {
      const shoonyaCredentials = credentials as ShoonyaCredentials;
      const response = await this.shoonyaService.login(shoonyaCredentials);
      
      if (response.stat === 'Ok') {
        this.setConnected(true, response.actid);
        return this.createSuccessResponse('Login successful', {
          accountId: response.actid,
          userName: response.uname,
          email: response.email,
          exchanges: response.exarr,
          products: response.prarr
        });
      } else {
        return this.createErrorResponse(response.emsg || 'Login failed', response);
      }
    } catch (error: any) {
      return this.createErrorResponse(error.message || 'Login failed', error);
    }
  }

  async logout(): Promise<boolean> {
    try {
      const result = await this.shoonyaService.logout();
      this.setConnected(false);
      return result;
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  }

  async validateSession(accountId?: string): Promise<boolean> {
    try {
      return await this.shoonyaService.validateSession(accountId || this.accountId || '');
    } catch (error) {
      return false;
    }
  }

  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Map unified order type to Shoonya-specific format
        let shoonyaPriceType: 'LMT' | 'MKT' | 'SL-LMT' | 'SL-MKT';
        switch (orderRequest.orderType) {
          case 'LIMIT':
            shoonyaPriceType = 'LMT';
            break;
          case 'MARKET':
            shoonyaPriceType = 'MKT';
            break;
          case 'SL-LIMIT':
            shoonyaPriceType = 'SL-LMT';
            break;
          case 'SL-MARKET':
            shoonyaPriceType = 'SL-MKT';
            break;
          default:
            shoonyaPriceType = 'MKT';
        }

        // Map unified product type to Shoonya format
        const productTypeMap: { [key: string]: string } = {
          'CNC': 'C',
          'MIS': 'M',
          'NRML': 'H',
          'BO': 'B',
          'C': 'C',
          'M': 'M',
          'H': 'H',
          'B': 'B'
        };
        const shoonyaProductType = productTypeMap[orderRequest.productType] || orderRequest.productType;

        // Transform to Shoonya-specific order format
        const shoonyaOrderRequest = {
          userId: orderRequest.accountId || this.accountId || '',
          buyOrSell: orderRequest.action === 'BUY' ? 'B' as const : 'S' as const,
          productType: shoonyaProductType,
          exchange: orderRequest.exchange || 'NSE',
          tradingSymbol: orderRequest.symbol,
          quantity: orderRequest.quantity,
          discloseQty: 0,
          priceType: shoonyaPriceType,
          price: orderRequest.price || 0,
          triggerPrice: orderRequest.triggerPrice || 0,
          retention: 'DAY' as const,
          remarks: orderRequest.remarks || `Order placed via CopyTrade Pro for account ${orderRequest.accountId || this.accountId}`
        };

        const response = await this.shoonyaService.placeOrder(shoonyaOrderRequest);

        if (response.stat === 'Ok') {
          return this.createSuccessResponse('Order placed successfully', {
            orderId: response.norenordno,
            message: response.result,
            brokerOrderId: response.norenordno,
            status: 'PLACED'
          });
        } else {
          // Check if this is a retryable error
          const isRetryable = this.isRetryableError(response.emsg);
          
          if (isRetryable && attempt < maxRetries) {
            console.log(`⚠️ Shoonya order placement failed (attempt ${attempt}/${maxRetries}): ${response.emsg}. Retrying...`);
            lastError = new Error(response.emsg);
            await this.delay(1000 * attempt); // Exponential backoff
            continue;
          }
          
          return this.createErrorResponse(
            this.transformErrorMessage(response.emsg || 'Order placement failed'),
            {
              errorType: this.categorizeError(response.emsg),
              originalError: response.emsg,
              attempt: attempt
            }
          );
        }
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error.message);
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`⚠️ Shoonya order placement error (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
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
        const response = await this.shoonyaService.getOrderStatus(accountId, orderId);
        
        return {
          orderId: response.norenordno || orderId,
          status: response.status || 'UNKNOWN',
          quantity: parseInt(response.qty) || 0,
          filledQuantity: parseInt(response.fillshares) || 0,
          price: parseFloat(response.prc) || 0,
          averagePrice: parseFloat(response.avgprc) || 0,
          timestamp: new Date(response.norentm || Date.now())
        };
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error.message);
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`⚠️ Shoonya get order status failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
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
        // Use getOrderBook for order history in Shoonya
        const response = await this.shoonyaService.getOrderBook(accountId);

        if (!Array.isArray(response)) {
          console.warn('Shoonya order history response is not an array, returning empty array');
          return [];
        }

        return response.map((order: any) => ({
          orderId: order.norenordno || '',
          status: order.status || 'UNKNOWN',
          quantity: parseInt(order.qty) || 0,
          filledQuantity: parseInt(order.fillshares) || 0,
          price: parseFloat(order.prc) || 0,
          averagePrice: parseFloat(order.avgprc) || 0,
          timestamp: new Date(order.norentm || Date.now())
        }));
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error.message);
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`⚠️ Shoonya get order history failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
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
        const response = await this.shoonyaService.getPositions(accountId);
        
        if (!Array.isArray(response)) {
          console.warn('Shoonya positions response is not an array, returning empty array');
          return [];
        }

        return response.map(position => ({
          symbol: position.tsym || '',
          quantity: parseInt(position.netqty) || 0,
          averagePrice: parseFloat(position.netavgprc) || 0,
          currentPrice: parseFloat(position.lp) || 0,
          pnl: parseFloat(position.urmtom) || 0,
          exchange: position.exch || '',
          productType: position.prd || ''
        }));
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a retryable error
        const isRetryable = this.isRetryableError(error.message);
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`⚠️ Shoonya get positions failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
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
      const response = await this.shoonyaService.getQuotes(exchange, symbol);

      return {
        symbol: response.tsym || symbol,
        price: parseFloat(response.lp) || 0,
        change: parseFloat(response.c) || 0,
        changePercent: parseFloat(response.pc) || 0,
        volume: parseInt(response.v) || 0,
        exchange: response.exch || exchange,
        timestamp: new Date()
      };
    } catch (error: any) {
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  async searchSymbols(query: string, exchange: string): Promise<any[]> {
    try {
      // Shoonya doesn't have a searchSymbols method, return empty array for now
      console.warn('searchSymbols not implemented for Shoonya');
      return [];
    } catch (error: any) {
      throw new Error(`Failed to search symbols: ${error.message}`);
    }
  }

  // Shoonya-specific methods that can be accessed if needed
  getShoonyaService(): ShoonyaService {
    return this.shoonyaService;
  }

  getUserId(): string | undefined {
    const userId = this.shoonyaService.getUserId();
    return userId || undefined;
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
        message.includes('too many requests') ||
        message.includes('temporary') ||
        message.includes('try again')) {
      return true;
    }
    
    return false;
  }

  private categorizeError(errorMessage?: string): string {
    if (!errorMessage) return 'UNKNOWN_ERROR';
    
    const message = errorMessage.toLowerCase();
    
    if (message.includes('session expired') || message.includes('invalid session') || message.includes('authentication')) {
      return 'SESSION_EXPIRED';
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
    if (message.includes('session expired') || message.includes('invalid session')) {
      return 'Your session has expired. Please reconnect your Shoonya account.';
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
}
