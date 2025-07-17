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

  // Generate auth URL for user to visit - Fixed to use actual login page
  generateAuthUrl(credentials: FyersCredentials): string {
    this.appId = credentials.clientId;
    this.fyers.setAppId(credentials.clientId);
    this.fyers.setRedirectUrl(credentials.redirectUri);

    // Use the correct Fyers login URL instead of API endpoint
    const authUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${credentials.clientId}&redirect_uri=${encodeURIComponent(credentials.redirectUri)}&response_type=code&state=sample_state`;

    console.log('🔗 Fixed Auth URL generated:', authUrl);
    return authUrl;
  }

  // Generate access token from auth code
  async generateAccessToken(authCode: string, credentials: FyersCredentials): Promise<{ success: boolean; accessToken?: string; accountId?: string; message: string }> {
    try {
      // Set App ID before generating access token
      this.fyers.setAppId(credentials.clientId);

      const response = await this.fyers.generate_access_token({
        client_id: credentials.clientId,
        secret_key: credentials.secretKey,
        auth_code: authCode
      });

      if (response.s === 'ok') {
        this.accessToken = response.access_token;
        this.fyers.setAccessToken(response.access_token);

        console.log('✅ Fyers access token generated successfully');

        // Get user profile to extract actual account ID
        try {
          const profileResponse = await this.fyers.get_profile();
          if (profileResponse.s === 'ok' && profileResponse.data) {
            const accountId = profileResponse.data.fy_id || profileResponse.data.id || profileResponse.data.user_id;
            console.log(`✅ Fyers profile fetched, account ID: ${accountId}`);

            return {
              success: true,
              accessToken: response.access_token,
              accountId: accountId, // Return actual Fyers account ID
              message: 'Access token generated successfully',
            };
          } else {
            console.log('⚠️ Profile fetch failed, using client ID as fallback');
          }
        } catch (profileError: any) {
          console.log('⚠️ Profile fetch error:', profileError.message);
        }

        // Fallback: return without account ID
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

      // For OAuth flows, return success: false with authUrl
      // This indicates that authentication is required
      return {
        success: false,
        authUrl,
        message: 'OAuth authentication required',
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

  // Validate if the current session is still active
  async validateSession(): Promise<boolean> {
    if (!this.accessToken) {
      return false;
    }

    try {
      // Use a lightweight API call to check if session is still valid
      // getProfile is a simple endpoint that requires authentication
      const response = await this.fyers.get_profile();

      // If the call succeeds, session is valid
      return response.s === 'ok';
    } catch (error: any) {
      console.log('⚠️ Session validation failed for Fyers:', error.message);
      // If API call fails, session is likely expired
      this.accessToken = null;
      return false;
    }
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
