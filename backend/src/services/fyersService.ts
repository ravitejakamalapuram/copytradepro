import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

export interface FyersCredentials {
  clientId: string;
  secretKey: string;
  redirectUri: string;
  totpKey?: string; // For TOTP-based authentication
}

export interface FyersLoginRequest {
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
  s: string; // Status
  code: number;
  message: string;
  id?: string; // Order ID
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
  private baseUrl: string;
  private apiKey: string;
  private accessToken: string | null = null;
  private httpClient: AxiosInstance;

  constructor() {
    this.baseUrl = 'https://api-t1.fyers.in/api/v3';
    this.apiKey = '';
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('🚨 Fyers API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  // Generate TOTP code (simplified version - in production use a proper TOTP library)
  private generateTOTP(secret: string): string {
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const time = Math.floor(epoch / 30);
    const timeHex = time.toString(16).padStart(16, '0');
    const timeBytes = Buffer.from(timeHex, 'hex');

    // Use the secret as-is for HMAC (in production, decode base32 properly)
    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'utf8'));
    hmac.update(timeBytes);
    const hash = hmac.digest();

    if (!hash || hash.length === 0) {
      throw new Error('Failed to generate TOTP hash');
    }

    const offset = hash[hash.length - 1]! & 0xf;
    const code = ((hash[offset]! & 0x7f) << 24) |
                 ((hash[offset + 1]! & 0xff) << 16) |
                 ((hash[offset + 2]! & 0xff) << 8) |
                 (hash[offset + 3]! & 0xff);

    return (code % 1000000).toString().padStart(6, '0');
  }

  // Step 1: Generate auth code
  async generateAuthCode(credentials: FyersCredentials): Promise<string> {
    try {
      const response = await this.httpClient.post('/generate-authcode', {
        fyers_id: credentials.clientId,
        app_id: credentials.clientId.split('-')[0],
        redirect_uri: credentials.redirectUri,
        response_type: 'code',
        state: 'sample_state',
      });

      if (response.data.s === 'ok') {
        return response.data.auth_code;
      } else {
        throw new Error(response.data.message || 'Failed to generate auth code');
      }
    } catch (error: any) {
      console.error('🚨 Failed to generate auth code:', error);
      throw new Error(error.response?.data?.message || 'Auth code generation failed');
    }
  }

  // Step 2: Validate auth code and get access token
  async validateAuthCode(authCode: string, credentials: FyersCredentials): Promise<string> {
    try {
      const appIdHash = crypto
        .createHash('sha256')
        .update(`${credentials.clientId}:${credentials.secretKey}`)
        .digest('hex');

      const response = await this.httpClient.post('/validate-authcode', {
        grant_type: 'authorization_code',
        appIdHash: appIdHash,
        code: authCode,
      });

      if (response.data.s === 'ok') {
        this.accessToken = response.data.access_token;
        this.apiKey = credentials.clientId;
        return response.data.access_token;
      } else {
        throw new Error(response.data.message || 'Failed to validate auth code');
      }
    } catch (error: any) {
      console.error('🚨 Failed to validate auth code:', error);
      throw new Error(error.response?.data?.message || 'Auth code validation failed');
    }
  }

  // Complete login flow
  async login(credentials: FyersCredentials): Promise<{ success: boolean; accessToken?: string; message: string }> {
    try {
      // Step 1: Generate auth code
      const authCode = await this.generateAuthCode(credentials);
      
      // Step 2: Validate auth code and get access token
      const accessToken = await this.validateAuthCode(authCode, credentials);

      console.log('✅ Fyers login successful');
      return {
        success: true,
        accessToken,
        message: 'Login successful',
      };
    } catch (error: any) {
      console.error('🚨 Fyers login failed:', error);
      return {
        success: false,
        message: error.message || 'Login failed',
      };
    }
  }

  // Place order
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

      const response = await this.httpClient.post('/orders', payload);

      console.log('✅ Order placed successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Failed to place order:', error);
      throw new Error(error.response?.data?.message || 'Order placement failed');
    }
  }

  // Get order book
  async getOrderBook(): Promise<any[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await this.httpClient.get('/orders');
      return response.data.orderBook || [];
    } catch (error: any) {
      console.error('🚨 Failed to get order book:', error);
      throw new Error(error.response?.data?.message || 'Failed to get order book');
    }
  }

  // Get positions
  async getPositions(): Promise<FyersPosition[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await this.httpClient.get('/positions');
      return response.data.netPositions || [];
    } catch (error: any) {
      console.error('🚨 Failed to get positions:', error);
      throw new Error(error.response?.data?.message || 'Failed to get positions');
    }
  }

  // Search symbols
  async searchScrip(exchange: string, symbol: string): Promise<any[]> {
    try {
      const response = await this.httpClient.get('/search', {
        params: {
          symbol: `${exchange}:${symbol}`,
        },
      });
      return response.data.symbols || [];
    } catch (error: any) {
      console.error('🚨 Failed to search symbols:', error);
      throw new Error(error.response?.data?.message || 'Symbol search failed');
    }
  }

  // Get quotes
  async getQuotes(symbols: string[]): Promise<FyersQuote[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await this.httpClient.get('/quotes', {
        params: {
          symbols: symbols.join(','),
        },
      });
      return response.data.d || [];
    } catch (error: any) {
      console.error('🚨 Failed to get quotes:', error);
      throw new Error(error.response?.data?.message || 'Failed to get quotes');
    }
  }

  // Get profile
  async getProfile(): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await this.httpClient.get('/profile');
      return response.data.data;
    } catch (error: any) {
      console.error('🚨 Failed to get profile:', error);
      throw new Error(error.response?.data?.message || 'Failed to get profile');
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
  }

  // Logout
  logout(): void {
    this.accessToken = null;
    this.apiKey = '';
    console.log('✅ Fyers logout successful');
  }
}
