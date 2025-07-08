/**
 * Shoonya Service Adapter
 * Adapts the existing ShoonyaService to implement IBrokerService interface
 */

import { IBrokerService, BrokerCredentials, LoginResponse, OrderRequest, OrderResponse, OrderStatus, Position, Quote } from '../interfaces/IBrokerService';
import { ShoonyaService } from '../services/shoonyaService';
import { ShoonyaCredentials } from '../types/brokerTypes';

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
        return this.createErrorResponse(response.emsg || 'Order placement failed', response);
      }
    } catch (error: any) {
      // Handle session expiry with auto-retry logic
      if (error.message?.includes('Session Expired') || error.message?.includes('Invalid Session Key')) {
        return this.createErrorResponse('Session expired. Please reactivate your account.', {
          errorType: 'SESSION_EXPIRED',
          originalError: error.message
        });
      }
      return this.createErrorResponse(error.message || 'Order placement failed', error);
    }
  }

  async getOrderStatus(accountId: string, orderId: string): Promise<OrderStatus> {
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
      throw new Error(`Failed to get order status: ${error.message}`);
    }
  }

  async getOrderHistory(accountId: string): Promise<OrderStatus[]> {
    try {
      // Use getOrderBook for order history in Shoonya
      const response = await this.shoonyaService.getOrderBook(accountId);

      if (!Array.isArray(response)) {
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
      throw new Error(`Failed to get order history: ${error.message}`);
    }
  }

  async getPositions(accountId: string): Promise<Position[]> {
    try {
      const response = await this.shoonyaService.getPositions(accountId);
      
      if (!Array.isArray(response)) {
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
      throw new Error(`Failed to get positions: ${error.message}`);
    }
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
}
