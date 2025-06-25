import crypto from 'crypto';
import axios from 'axios';

export interface ShoonyaCredentials {
  userId: string;
  password: string;
  twoFA: string;
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

  private generateSHA256Hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/${endpoint}`, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      console.error(`🚨 Shoonya API Error [${endpoint}]:`, error.message);
      throw new Error(`Shoonya API request failed: ${error.message}`);
    }
  }

  async login(credentials: ShoonyaCredentials): Promise<ShoonyaLoginResponse> {
    try {
      // Hash the password with SHA256
      const hashedPassword = this.generateSHA256Hash(credentials.password);

      const loginData = {
        uid: credentials.userId,
        pwd: hashedPassword,
        factor2: credentials.twoFA,
        vc: credentials.vendorCode,
        appkey: this.generateSHA256Hash(`${credentials.userId}|${credentials.apiSecret}`),
        imei: credentials.imei,
        source: 'API',
      };

      console.log('🔐 Attempting Shoonya login for user:', credentials.userId);
      
      const response = await this.makeRequest('QuickAuth', loginData);
      
      if (response.stat === 'Ok' && response.susertoken) {
        this.sessionToken = response.susertoken;
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

  async logout(): Promise<void> {
    if (!this.sessionToken) {
      return;
    }

    try {
      await this.makeRequest('Logout', {
        uid: '',
        token: this.sessionToken,
      });
      
      this.sessionToken = null;
      console.log('✅ Shoonya logout successful');
    } catch (error: any) {
      console.error('🚨 Shoonya logout error:', error.message);
      this.sessionToken = null;
    }
  }

  async placeOrder(orderData: PlaceOrderRequest): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }

    try {
      const requestData = {
        uid: orderData.userId,
        actid: orderData.userId,
        exch: orderData.exchange,
        tsym: orderData.tradingSymbol,
        qty: orderData.quantity.toString(),
        dscqty: orderData.discloseQty.toString(),
        prc: orderData.price?.toString() || '0',
        prd: orderData.productType,
        trantype: orderData.buyOrSell,
        prctyp: orderData.priceType,
        ret: orderData.retention || 'DAY',
        remarks: orderData.remarks || '',
        token: this.sessionToken,
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

      const response = await this.makeRequest('PlaceOrder', requestData);
      
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
      const response = await this.makeRequest('OrderBook', {
        uid: userId,
        token: this.sessionToken,
      });

      return response;
    } catch (error: any) {
      console.error('🚨 Shoonya get order book error:', error.message);
      throw error;
    }
  }

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
      console.error('🚨 Shoonya get positions error:', error.message);
      throw error;
    }
  }

  async searchScrip(exchange: string, searchText: string): Promise<any> {
    if (!this.sessionToken) {
      throw new Error('Not logged in to Shoonya. Please login first.');
    }

    try {
      const response = await this.makeRequest('SearchScrip', {
        uid: '',
        exch: exchange,
        stext: searchText,
        token: this.sessionToken,
      });

      return response;
    } catch (error: any) {
      console.error('🚨 Shoonya search scrip error:', error.message);
      throw error;
    }
  }

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

  isLoggedIn(): boolean {
    return this.sessionToken !== null;
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }
}
