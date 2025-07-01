import crypto from 'crypto';
import axios from 'axios';
import { authenticator } from 'otplib';
import { IBrokerService } from '../../interfaces/IBrokerService';

/**
 * ShoonyaService implements IBrokerService for Shoonya broker integration.
 * Handles login, order placement, session management, and all Shoonya API interactions.
 */
export class ShoonyaService implements IBrokerService {
  /** Shoonya API base URL */
  private baseUrl = 'https://api.shoonya.com/NorenWClientTP';
  /** Current session token */
  private sessionToken: string | null = null;
  /** Current user/account ID */
  private userId: string | null = null;

  /**
   * Generate a SHA256 hash of the input string.
   * @param input - The string to hash.
   * @returns The SHA256 hash as a hex string.
   */
  private generateSHA256Hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Generate a TOTP code from the given secret.
   * @param secret - The TOTP secret key.
   * @returns The generated TOTP code.
   */
  private generateTOTP(secret: string): string {
    try {
      const token = authenticator.generate(secret);
      return token;
    } catch (error) {
      throw new Error('Failed to generate TOTP');
    }
  }

  /**
   * Make a Shoonya API request (unauthenticated).
   * @param endpoint - The API endpoint.
   * @param data - The request payload.
   * @returns The API response.
   */
  private async makeRequest(endpoint: string, data: any): Promise<any> {
    try {
      const jsonData = JSON.stringify(data);
      const formBody = `jData=${jsonData}`;
      const response = await axios.post(`${this.baseUrl}/${endpoint}`, formBody, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Shoonya API request failed: ${error.message}`);
    }
  }

  /**
   * Make a Shoonya API request (authenticated).
   * @param endpoint - The API endpoint.
   * @param data - The request payload.
   * @returns The API response.
   */
  private async makeAuthenticatedRequest(endpoint: string, data: any): Promise<any> {
    try {
      const jsonData = JSON.stringify(data);
      const formBody = `jData=${jsonData}&jKey=${this.sessionToken}`;
      const response = await axios.post(`${this.baseUrl}/${endpoint}`, formBody, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Shoonya API request failed: ${error.message}`);
    }
  }

  /**
   * Log in to Shoonya with the given credentials.
   * @param credentials - Shoonya login credentials.
   * @returns Login response with success status and session info.
   */
  async login(credentials: any): Promise<{ success: boolean; [key: string]: any }> {
    try {
      const hashedPassword = this.generateSHA256Hash(credentials.password);
      const currentTOTP = this.generateTOTP(credentials.totpKey);
      const loginData = {
        uid: credentials.userId,
        pwd: hashedPassword,
        factor2: currentTOTP,
        vc: credentials.vendorCode,
        appkey: this.generateSHA256Hash(`${credentials.userId}|${credentials.apiSecret}`),
        imei: credentials.imei,
        source: 'API',
        apkversion: '1.0.0',
      };
      const response = await this.makeRequest('QuickAuth', loginData);
      if (response.stat === 'Ok' && response.susertoken) {
        this.sessionToken = response.susertoken;
        this.userId = credentials.userId;
        return { success: true, ...response };
      } else {
        return { success: false, message: response.emsg || 'Login failed', ...response };
      }
    } catch (error: any) {
      return { success: false, message: error.message || 'Login failed' };
    }
  }

  /**
   * Log out from Shoonya.
   * @param userId - Optional user/account ID.
   * @returns Logout response.
   */
  async logout(userId?: string): Promise<any> {
    if (!this.sessionToken && !userId) {
      return { stat: 'Ok', message: 'No active session' };
    }
    try {
      const logoutData = {
        uid: userId || this.userId || '',
        jKey: this.sessionToken,
      };
      const response = await this.makeRequest('Logout', logoutData);
      this.sessionToken = null;
      this.userId = null;
      return response;
    } catch (error: any) {
      this.sessionToken = null;
      this.userId = null;
      return { stat: 'Ok', message: 'Logout completed with errors' };
    }
  }

  /**
   * Place an order with Shoonya.
   * @param orderData - The order details.
   * @returns Order placement response.
   */
  async placeOrder(orderData: any): Promise<{ success: boolean; [key: string]: any }> {
    if (!this.sessionToken) {
      return { success: false, message: 'Not logged in to Shoonya. Please login first.' };
    }
    try {
      let tradingSymbol = orderData.symbol || orderData.tradingSymbol;
      if (orderData.exchange === 'NSE' && tradingSymbol && !tradingSymbol.includes('-EQ')) {
        tradingSymbol = `${tradingSymbol}-EQ`;
      }
      let priceType: 'LMT' | 'MKT' | 'SL-LMT' | 'SL-MKT' = 'MKT';
      switch (orderData.orderType) {
        case 'LIMIT': priceType = 'LMT'; break;
        case 'MARKET': priceType = 'MKT'; break;
        case 'SL-LIMIT': priceType = 'SL-LMT'; break;
        case 'SL-MARKET': priceType = 'SL-MKT'; break;
      }
      const requestData = {
        uid: orderData.userId,
        actid: orderData.userId,
        exch: orderData.exchange,
        tsym: tradingSymbol,
        qty: orderData.quantity?.toString() || orderData.qty?.toString(),
        dscqty: '0',
        prc: priceType === 'MKT' ? '0' : (orderData.price?.toString() || '0'),
        prd: orderData.productType,
        trantype: orderData.action === 'BUY' ? 'B' : 'S',
        prctyp: priceType,
        ret: orderData.retention || 'DAY',
        remarks: orderData.remarks || '',
        ordersource: 'API',
      };
      if (orderData.triggerPrice && (priceType === 'SL-LMT' || priceType === 'SL-MKT')) {
        (requestData as any).trgprc = orderData.triggerPrice.toString();
      }
      const response = await this.makeAuthenticatedRequest('PlaceOrder', requestData);
      if (response.stat === 'Ok') {
        return { success: true, ...response };
      } else {
        return { success: false, message: response.emsg || 'Order placement failed', ...response };
      }
    } catch (error: any) {
      return { success: false, message: error.message || 'Order placement failed' };
    }
  }

  /**
   * Get the order book for a user/account.
   * @param userId - The user/account ID.
   * @returns The order book response.
   */
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
      throw error;
    }
  }

  /**
   * Get the status of a specific order.
   * @param userId - The user/account ID.
   * @param orderNumber - The broker's order number.
   * @returns The order status response.
   */
  async getOrderStatus(userId: string, orderNumber: string): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }
    try {
      const response = await this.makeAuthenticatedRequest('SingleOrdStatus', {
        uid: userId,
        actid: userId,
        norenordno: orderNumber,
        exch: 'NSE',
      });
      if (response && response.stat === 'Ok') {
        return {
          stat: 'Ok',
          orderNumber: response.norenordno,
          status: response.status,
          symbol: response.tsym,
          quantity: response.qty,
          price: response.prc,
          executedQuantity: response.fillshares || '0',
          averagePrice: response.avgprc || '0',
          rejectionReason: response.rejreason || '',
          orderTime: response.norentm,
          updateTime: response.exch_tm,
          rawOrder: response,
        };
      } else {
        return {
          stat: 'Not_Ok',
          emsg: response?.emsg || 'Failed to get order status',
        };
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get all open/current positions for a user/account.
   * @param userId - The user/account ID.
   * @returns The positions response.
   */
  async getPositions(userId: string): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }
    try {
      const response = await this.makeRequest('PositionBook', {
        uid: userId,
        actid: userId,
        token: this.sessionToken,
      });
      return response;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Search for a symbol or scrip on Shoonya.
   * @param exchange - The exchange (e.g., NSE, BSE).
   * @param searchText - The symbol or text to search for.
   * @returns The search results.
   */
  async searchScrip(exchange: string, searchText: string): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }
    try {
      const response = await this.makeRequest('SearchScrip', {
        uid: this.userId,
        exch: exchange,
        stext: searchText,
        token: this.sessionToken,
      });
      return response;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get live quotes for a symbol/token.
   * @param exchange - The exchange.
   * @param token - The symbol/token.
   * @returns The quotes response.
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
      throw error;
    }
  }

  /**
   * Check if the Shoonya session is currently logged in.
   * @returns True if logged in, false otherwise.
   */
  isLoggedIn(): boolean {
    return !!this.sessionToken;
  }

  /**
   * Get the current session token, if available.
   * @returns The session token or null.
   */
  getSessionToken(): string | null {
    return this.sessionToken;
  }

  /**
   * Validate if the current session is still active.
   * @param userId - The user/account ID.
   * @returns True if the session is valid, false otherwise.
   */
  async validateSession(userId: string): Promise<boolean> {
    if (!this.sessionToken || !userId) {
      return false;
    }
    try {
      const response = await this.makeAuthenticatedRequest('Limits', {
        uid: userId,
        actid: userId,
      });
      return response.stat === 'Ok';
    } catch (error: any) {
      this.sessionToken = null;
      this.userId = null;
      return false;
    }
  }

  /**
   * Get the current user ID (broker account ID).
   * @returns The user/account ID or null.
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Extract account info from a login response and credentials.
   * @param loginResponse - The Shoonya login response.
   * @param credentials - The credentials used for login.
   * @returns Standardized account info object.
   */
  extractAccountInfo(loginResponse: any, credentials: any) {
    return {
      accountId: loginResponse.actid,
      userName: loginResponse.uname,
      email: loginResponse.email,
      brokerDisplayName: loginResponse.brkname,
      exchanges: loginResponse.exarr || [],
      products: loginResponse.prarr || [],
    };
  }

  /**
   * Map Shoonya order status to a standard status.
   * @param shoonyaStatus - The Shoonya order status.
   * @returns The mapped standard status.
   */
  public mapOrderStatus(shoonyaStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'PENDING',
      'OPEN': 'PLACED',
      'COMPLETE': 'EXECUTED',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED',
      'TRIGGER_PENDING': 'PENDING',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
    };
    return statusMap[shoonyaStatus] || shoonyaStatus;
  }

  /**
   * Extract order info from Shoonya's order response and input.
   * @param orderResponse - The Shoonya order response.
   * @param orderInput - The order input data.
   * @returns Standardized order info object.
   */
  extractOrderInfo(orderResponse: any, orderInput: any) {
    return {
      brokerOrderId: orderResponse.norenordno,
    };
  }
} 