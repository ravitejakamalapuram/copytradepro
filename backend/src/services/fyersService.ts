const { fyersModel } = require('fyers-api-v3');

export interface FyersCredentials {
  clientId: string;
  secretKey: string;
  redirectUri: string;
  totpKey?: string;
}

export interface PlaceOrderRequest {
  symbol: string;
  qty: number;
  type: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  side: 'BUY' | 'SELL';
  productType: 'CNC' | 'INTRADAY' | 'MARGIN' | 'CO' | 'BO';
  limitPrice: number;
  stopPrice: number;
  disclosedQty?: number;
  validity: 'DAY' | 'IOC';
  offlineOrder?: boolean;
  stopLoss?: number;
  takeProfit?: number;
}

export interface FyersOrderResponse {
  s: string;
  code: number;
  message: string;
  id?: string;
}

export interface FyersPosition {
  id: string;
  symbol: string;
  qty: number;
  side: string;
  product: string;
  avgPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface FyersQuote {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  chng: number;
  chngPercent: number;
}

export class FyersService {
  private fyers: any;
  private accessToken: string | null = null;
  private appId: string = '';

  constructor() {
    // Initialize the official Fyers API client
    this.fyers = new fyersModel({
      path: process.cwd() + '/logs',
      enableLogging: true
    });
  }

  // Generate auth URL for user to visit
  generateAuthUrl(credentials: FyersCredentials): string {
    this.appId = credentials.clientId;
    this.fyers.setAppId(credentials.clientId);
    this.fyers.setRedirectUrl(credentials.redirectUri);
    
    const authUrl = this.fyers.generateAuthCode();
    console.log('🔗 Auth URL generated:', authUrl);
    return authUrl;
  }

  // Generate access token from auth code
  async generateAccessToken(authCode: string, credentials: FyersCredentials): Promise<{ success: boolean; accessToken?: string; message: string }> {
    try {
      const response = await this.fyers.generate_access_token({
        client_id: credentials.clientId,
        secret_key: credentials.secretKey,
        auth_code: authCode
      });

      if (response.s === 'ok') {
        this.accessToken = response.access_token;
        this.fyers.setAccessToken(response.access_token);
        
        console.log('✅ Fyers access token generated successfully');
        return {
          success: true,
          accessToken: response.access_token,
          message: 'Access token generated successfully',
        };
      } else {
        throw new Error(response.message || 'Failed to generate access token');
      }
    } catch (error: any) {
      console.error('🚨 Failed to generate access token:', error);
      return {
        success: false,
        message: error.message || 'Access token generation failed',
      };
    }
  }

  // Complete login flow - returns auth URL for user to visit
  async login(credentials: FyersCredentials): Promise<{ success: boolean; authUrl?: string; message: string }> {
    try {
      const authUrl = this.generateAuthUrl(credentials);
      
      return {
        success: true,
        authUrl,
        message: 'Please visit the auth URL to complete authentication',
      };
    } catch (error: any) {
      console.error('🚨 Fyers login failed:', error);
      return {
        success: false,
        message: error.message || 'Login failed',
      };
    }
  }

  // Place order using official API
  async placeOrder(orderData: PlaceOrderRequest): Promise<FyersOrderResponse> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const payload = {
        symbol: orderData.symbol,
        qty: orderData.qty,
        type: orderData.type === 'MARKET' ? 2 : 1, // 1=LIMIT, 2=MARKET
        side: orderData.side === 'BUY' ? 1 : -1, // 1=BUY, -1=SELL
        productType: this.getProductTypeCode(orderData.productType),
        limitPrice: orderData.limitPrice || 0,
        stopPrice: orderData.stopPrice || 0,
        disclosedQty: orderData.disclosedQty || 0,
        validity: orderData.validity === 'DAY' ? 'DAY' : 'IOC',
        offlineOrder: orderData.offlineOrder || false,
        stopLoss: orderData.stopLoss || 0,
        takeProfit: orderData.takeProfit || 0,
      };

      const response = await this.fyers.place_order(payload);
      console.log('✅ Order placed successfully:', response);
      return response;
    } catch (error: any) {
      console.error('🚨 Failed to place order:', error);
      throw new Error(error.message || 'Order placement failed');
    }
  }

  // Get order book using official API
  async getOrderBook(): Promise<any[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await this.fyers.orderbook();
      return response.orderBook || [];
    } catch (error: any) {
      console.error('🚨 Failed to get order book:', error);
      throw new Error(error.message || 'Failed to get order book');
    }
  }

  // Get positions using official API
  async getPositions(): Promise<FyersPosition[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await this.fyers.get_positions();
      return response.netPositions || [];
    } catch (error: any) {
      console.error('🚨 Failed to get positions:', error);
      throw new Error(error.message || 'Failed to get positions');
    }
  }

  // Search symbols using official API
  async searchScrip(exchange: string, symbol: string): Promise<any[]> {
    try {
      const response = await this.fyers.search_scrips({
        symbol: `${exchange}:${symbol}`
      });
      return response.symbols || [];
    } catch (error: any) {
      console.error('🚨 Failed to search symbols:', error);
      throw new Error(error.message || 'Symbol search failed');
    }
  }

  // Get quotes using official API
  async getQuotes(symbols: string[]): Promise<FyersQuote[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await this.fyers.getQuotes(symbols);
      return response.d || [];
    } catch (error: any) {
      console.error('🚨 Failed to get quotes:', error);
      throw new Error(error.message || 'Failed to get quotes');
    }
  }

  // Get profile using official API
  async getProfile(): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await this.fyers.get_profile();
      return response;
    } catch (error: any) {
      console.error('🚨 Failed to get profile:', error);
      throw new Error(error.message || 'Failed to get profile');
    }
  }

  // Helper method to convert product type to code
  private getProductTypeCode(productType: string): string {
    const productMap: { [key: string]: string } = {
      'CNC': 'CNC',
      'INTRADAY': 'INTRADAY',
      'MARGIN': 'MARGIN',
      'CO': 'CO',
      'BO': 'BO',
    };
    return productMap[productType] || 'CNC';
  }

  // Check if authenticated
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // Get access token
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Set access token (for existing sessions)
  setAccessToken(token: string): void {
    this.accessToken = token;
    this.fyers.setAccessToken(token);
  }

  // Logout
  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      this.accessToken = null;
      this.appId = '';
      
      console.log('✅ Fyers logout successful');
      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error: any) {
      console.error('🚨 Fyers logout failed:', error);
      return {
        success: false,
        message: error.message || 'Logout failed',
      };
    }
  }
}
