const { fyersModel } = require('fyers-api-v3');
import {
  FyersSymbolHelper,
  FyersOrderHelper,
  FyersDataTransformer,
  FyersErrorHandler,
  FyersAuthHelper
} from '../helpers/fyers.helper';

export interface FyersCredentials {
  clientId: string;
  secretKey: string;
  redirectUri: string;
  totpKey?: string;
}

// Updated to match Shoonya service interface
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

export interface FyersLoginResponse {
  success: boolean;
  authUrl?: string;
  accessToken?: string;
  message: string;
  requiresAuthCode?: boolean;
  // Profile data after successful authentication
  clientId?: string;
  email?: string;
  userName?: string;
  exchanges?: string[];
  products?: string[];
}

export class FyersService {
  private fyers: any;
  private accessToken: string | null = null;
  private appId: string = '';
  private clientId: string = '';

  constructor() {
    // Initialize the official Fyers API client
    this.fyers = new fyersModel({
      path: process.cwd() + '/logs',
      enableLogging: true
    });
  }

  // Generate auth URL for user to visit
  generateAuthUrl(credentials: FyersCredentials): string {
    try {
      // Validate credentials first
      const validation = FyersAuthHelper.validateCredentials(credentials);
      if (!validation.valid) {
        throw new Error(`Invalid credentials: ${validation.errors.join(', ')}`);
      }

      this.appId = credentials.clientId;
      this.clientId = credentials.clientId;
      this.fyers.setAppId(credentials.clientId);
      this.fyers.setRedirectUrl(credentials.redirectUri);

      const authUrl = this.fyers.generateAuthCode();
      console.log('🔗 Fyers auth URL generated successfully');
      return authUrl;
    } catch (error: any) {
      console.error('🚨 Failed to generate Fyers auth URL:', error);
      throw FyersErrorHandler.transformError(error);
    }
  }

  // Generate access token from auth code
  async generateAccessToken(authCode: string, credentials: FyersCredentials): Promise<{ success: boolean; accessToken?: string; message: string; profile?: any }> {
    try {
      console.log('🔐 Generating Fyers access token...');

      const response = await this.fyers.generate_access_token({
        client_id: credentials.clientId,
        secret_key: credentials.secretKey,
        auth_code: authCode
      });

      if (response.s === 'ok' && response.access_token) {
        this.accessToken = response.access_token;
        this.clientId = credentials.clientId;
        this.fyers.setAccessToken(response.access_token);

        // Get user profile after successful authentication
        let profile = null;
        try {
          profile = await this.getProfile();
        } catch (profileError) {
          console.warn('⚠️ Could not fetch profile after authentication:', profileError);
        }

        console.log('✅ Fyers access token generated successfully');
        return {
          success: true,
          accessToken: response.access_token,
          message: 'Access token generated successfully',
          profile
        };
      } else {
        throw new Error(response.message || 'Failed to generate access token');
      }
    } catch (error: any) {
      console.error('🚨 Failed to generate access token:', error);
      return {
        success: false,
        message: FyersErrorHandler.transformError(error).message,
      };
    }
  }

  // Complete login flow - returns auth URL for user to visit
  async login(credentials: FyersCredentials): Promise<FyersLoginResponse> {
    try {
      console.log('🔐 Starting Fyers login flow...');
      const authUrl = this.generateAuthUrl(credentials);

      return {
        success: true,
        authUrl,
        message: 'Please visit the auth URL to complete authentication',
        requiresAuthCode: true
      };
    } catch (error: any) {
      console.error('🚨 Fyers login failed:', error);
      return {
        success: false,
        message: FyersErrorHandler.transformError(error).message,
      };
    }
  }

  // Place order using official API - Updated to match Shoonya interface
  async placeOrder(orderData: PlaceOrderRequest): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated to Fyers. Please login first.');
    }

    try {
      console.log('📝 Placing Fyers order:', {
        symbol: orderData.tradingSymbol,
        exchange: orderData.exchange,
        quantity: orderData.quantity,
        priceType: orderData.priceType,
        side: orderData.buyOrSell
      });

      // Transform order data using helper
      const fyersOrderData = FyersOrderHelper.transformOrderDataForFyers(orderData);

      console.log('🔍 Transformed Fyers order data:', fyersOrderData);

      const response = await this.fyers.place_order(fyersOrderData);

      if (response.s === 'ok') {
        console.log('✅ Fyers order placed successfully:', response.id);
        return {
          stat: 'Ok',
          norenordno: response.id,
          message: response.message || 'Order placed successfully'
        };
      } else {
        console.error('❌ Fyers order placement failed:', response.message);
        throw new Error(response.message || 'Order placement failed');
      }
    } catch (error: any) {
      console.error('🚨 Fyers place order error:', error);
      throw FyersErrorHandler.transformError(error);
    }
  }

  // Get order book using official API - Updated to match Shoonya interface
  async getOrderBook(userId?: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated to Fyers. Please login first.');
    }

    try {
      console.log('📊 Fetching Fyers order book...');
      const response = await this.fyers.orderbook();

      if (response.s === 'ok') {
        // Transform to match Shoonya format
        const transformedOrders = FyersDataTransformer.transformOrderBook(response);
        console.log(`✅ Retrieved ${transformedOrders.length} orders from Fyers`);
        return transformedOrders;
      } else {
        throw new Error(response.message || 'Failed to get order book');
      }
    } catch (error: any) {
      console.error('🚨 Fyers get order book error:', error);
      throw FyersErrorHandler.transformError(error);
    }
  }

  // Get positions using official API - Updated to match Shoonya interface
  async getPositions(userId?: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated to Fyers. Please login first.');
    }

    try {
      console.log('📊 Fetching Fyers positions...');
      const response = await this.fyers.get_positions();

      if (response.s === 'ok') {
        // Transform to match Shoonya format
        const transformedPositions = FyersDataTransformer.transformPositions(response);
        console.log(`✅ Retrieved ${transformedPositions.length} positions from Fyers`);
        return transformedPositions;
      } else {
        throw new Error(response.message || 'Failed to get positions');
      }
    } catch (error: any) {
      console.error('🚨 Fyers get positions error:', error);
      throw FyersErrorHandler.transformError(error);
    }
  }

  // Search symbols using official API - Updated to match Shoonya interface
  async searchScrip(exchange: string, searchText: string): Promise<any> {
    try {
      console.log(`🔍 Fyers searchScrip called:`, {
        exchange,
        searchText,
        hasAccessToken: !!this.accessToken
      });

      const searchSymbol = FyersSymbolHelper.formatSymbolForFyers(searchText, exchange);
      const response = await this.fyers.search_scrips({
        symbol: searchSymbol
      });

      if (response.s === 'ok') {
        // Transform to match Shoonya format
        const transformedResults = FyersSymbolHelper.transformFyersSearchResults(response.symbols || []);
        console.log(`📊 Fyers searchScrip response: ${transformedResults.length} results`);
        return transformedResults;
      } else {
        throw new Error(response.message || 'Symbol search failed');
      }
    } catch (error: any) {
      console.error('🚨 Fyers search scrip error:', error);
      throw FyersErrorHandler.transformError(error);
    }
  }

  // Get quotes using official API - Updated to match Shoonya interface
  async getQuotes(symbols: string[]): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated to Fyers. Please login first.');
    }

    try {
      console.log('📊 Fetching Fyers quotes for symbols:', symbols);
      const response = await this.fyers.getQuotes(symbols);

      if (response.s === 'ok') {
        // Transform to match Shoonya format
        const transformedQuotes = FyersDataTransformer.transformQuotes(response);
        console.log('✅ Fyers quotes retrieved successfully');
        return transformedQuotes;
      } else {
        throw new Error(response.message || 'Failed to get quotes');
      }
    } catch (error: any) {
      console.error('🚨 Fyers get quotes error:', error);
      throw FyersErrorHandler.transformError(error);
    }
  }

  // Get order status - New method to match Shoonya interface
  async getOrderStatus(userId: string, orderNumber: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated to Fyers. Please login first.');
    }

    try {
      console.log(`📊 Checking Fyers order status for order: ${orderNumber}`);

      // Fyers uses order history to get specific order status
      const response = await this.fyers.orderbook();

      if (response.s === 'ok' && response.orderBook) {
        const order = response.orderBook.find((o: any) => o.id === orderNumber);

        if (order) {
          // Transform to match Shoonya format
          const transformedOrder = {
            stat: 'Ok',
            norenordno: order.id,
            status: FyersDataTransformer.transformOrderBook({ orderBook: [order] })[0]?.status || 'UNKNOWN',
            ...order
          };

          console.log(`✅ Fyers order status retrieved for ${orderNumber}:`, transformedOrder.status);
          return transformedOrder;
        } else {
          throw new Error(`Order ${orderNumber} not found`);
        }
      } else {
        throw new Error(response.message || 'Failed to get order status');
      }
    } catch (error: any) {
      console.error('🚨 Fyers get order status error:', error);
      throw FyersErrorHandler.transformError(error);
    }
  }

  // Get profile using official API
  async getProfile(): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not authenticated to Fyers. Please login first.');
    }

    try {
      console.log('👤 Fetching Fyers profile...');
      const response = await this.fyers.get_profile();

      if (response.s === 'ok') {
        console.log('✅ Fyers profile retrieved successfully');
        return {
          stat: 'Ok',
          clientId: this.clientId,
          userName: response.data?.name || response.data?.client_id || this.clientId,
          email: response.data?.email_id || '',
          exchanges: response.data?.exchanges || ['NSE', 'BSE'],
          products: response.data?.products || ['CNC', 'INTRADAY', 'MARGIN'],
          // Keep original data
          originalData: response.data
        };
      } else {
        throw new Error(response.message || 'Failed to get profile');
      }
    } catch (error: any) {
      console.error('🚨 Fyers get profile error:', error);
      throw FyersErrorHandler.transformError(error);
    }
  }

  // Check if authenticated - Updated to match Shoonya interface
  isLoggedIn(): boolean {
    return !!this.accessToken;
  }

  // Check if authenticated (alias)
  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  // Get access token - Updated to match Shoonya interface
  getSessionToken(): string | null {
    return this.accessToken;
  }

  // Get access token (alias)
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Set access token (for existing sessions)
  setAccessToken(token: string): void {
    this.accessToken = token;
    this.fyers.setAccessToken(token);
  }

  // Validate if the current session is still active - Updated to match Shoonya interface
  async validateSession(): Promise<boolean> {
    if (!this.accessToken) {
      return false;
    }

    try {
      console.log('🔍 Validating Fyers session...');
      // Use a lightweight API call to check if session is still valid
      // getProfile is a simple endpoint that requires authentication
      const response = await this.fyers.get_profile();

      // If the call succeeds, session is valid
      const isValid = response.s === 'ok';
      console.log(`✅ Fyers session validation result: ${isValid ? 'valid' : 'invalid'}`);

      if (!isValid) {
        this.accessToken = null;
      }

      return isValid;
    } catch (error: any) {
      console.log('⚠️ Session validation failed for Fyers:', error.message);
      // If API call fails, session is likely expired
      this.accessToken = null;
      return false;
    }
  }

  // Logout - Updated to match Shoonya interface
  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔐 Logging out from Fyers...');

      // Clear session data
      this.accessToken = null;
      this.appId = '';
      this.clientId = '';

      console.log('✅ Fyers logout successful');
      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error: any) {
      console.error('🚨 Fyers logout failed:', error);
      return {
        success: false,
        message: FyersErrorHandler.transformError(error).message,
      };
    }
  }

  // Complete authentication with auth code - New method for OAuth flow
  async completeAuthentication(authCode: string, credentials: FyersCredentials): Promise<FyersLoginResponse> {
    try {
      console.log('🔐 Completing Fyers authentication with auth code...');

      const tokenResult = await this.generateAccessToken(authCode, credentials);

      if (tokenResult.success && tokenResult.accessToken) {
        // Get profile information
        const profile = tokenResult.profile || await this.getProfile();

        return {
          success: true,
          accessToken: tokenResult.accessToken,
          message: 'Authentication completed successfully',
          clientId: credentials.clientId,
          userName: profile?.userName || credentials.clientId,
          email: profile?.email || '',
          exchanges: profile?.exchanges || ['NSE', 'BSE'],
          products: profile?.products || ['CNC', 'INTRADAY', 'MARGIN']
        };
      } else {
        return {
          success: false,
          message: tokenResult.message || 'Authentication failed'
        };
      }
    } catch (error: any) {
      console.error('🚨 Fyers authentication completion failed:', error);
      return {
        success: false,
        message: FyersErrorHandler.transformError(error).message
      };
    }
  }
}
