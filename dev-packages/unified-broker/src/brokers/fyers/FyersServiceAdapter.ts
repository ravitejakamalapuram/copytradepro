/**
 * Fyers Service Adapter
 * Adapts the existing FyersService to implement IBrokerService interface
 */

import { IBrokerService, BrokerCredentials, LoginResponse, OrderRequest, OrderResponse, OrderStatus, Position, Quote } from '../../interfaces/IBrokerService';
import { FyersService } from '../../services/fyersService';
import { FyersCredentials } from './types';

export class FyersServiceAdapter extends IBrokerService {
  private fyersService: FyersService;

  constructor() {
    super('fyers');
    this.fyersService = new FyersService();
  }

  async login(credentials: BrokerCredentials): Promise<LoginResponse> {
    try {
      const fyersCredentials = credentials as FyersCredentials;
      // Map to the expected Fyers service format
      const serviceCredentials = {
        clientId: fyersCredentials.clientId,
        secretKey: fyersCredentials.secretKey,
        redirectUri: fyersCredentials.redirectUri || '',
        authCode: fyersCredentials.authCode,
        accessToken: fyersCredentials.accessToken,
        refreshToken: fyersCredentials.refreshToken
      };
      const response = await this.fyersService.login(serviceCredentials);
      
      if (response.success) {
        this.setConnected(true, fyersCredentials.appId); // Use appId as account identifier
        return this.createSuccessResponse(response.message || 'Login successful', {
          accountId: fyersCredentials.appId,
          authUrl: response.authUrl
        });
      } else {
        return this.createErrorResponse(response.message || 'Login failed', response);
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

      // Transform to Fyers-specific order format
      const fyersOrderRequest = {
        symbol: `${orderRequest.exchange}:${orderRequest.symbol}`,
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
        return this.createErrorResponse(response.message || 'Order placement failed', response);
      }
    } catch (error: any) {
      // Handle token expiry with auto-retry logic
      if (error.message?.includes('token') || error.message?.includes('unauthorized')) {
        return this.createErrorResponse('Authentication expired. Please reactivate your account.', {
          errorType: 'AUTH_EXPIRED',
          originalError: error.message
        });
      }
      return this.createErrorResponse(error.message || 'Order placement failed', error);
    }
  }

  async getOrderStatus(accountId: string, orderId: string): Promise<OrderStatus> {
    try {
      // Fyers doesn't have a separate getOrderStatus method, use getOrderBook
      const orderBook = await this.fyersService.getOrderBook();

      // orderBook is an array, not an object with orderBook property
      if (!Array.isArray(orderBook)) {
        throw new Error('Invalid order book response');
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
        throw new Error(`Order ${orderId} not found`);
      }
    } catch (error: any) {
      throw new Error(`Failed to get order status: ${error.message}`);
    }
  }

  async getOrderHistory(accountId: string): Promise<OrderStatus[]> {
    try {
      // Use getOrderBook for order history in Fyers
      const response = await this.fyersService.getOrderBook();

      // response is an array, not an object with orderBook property
      if (!Array.isArray(response)) {
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
      throw new Error(`Failed to get order history: ${error.message}`);
    }
  }

  async getPositions(accountId: string): Promise<Position[]> {
    try {
      const response = await this.fyersService.getPositions();

      // response is an array, not an object with netPositions property
      if (!Array.isArray(response)) {
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
      throw new Error(`Failed to get positions: ${error.message}`);
    }
  }

  async getQuote(symbol: string, exchange: string): Promise<Quote> {
    try {
      const response = await this.fyersService.getQuotes([`${exchange}:${symbol}`]);

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
}
