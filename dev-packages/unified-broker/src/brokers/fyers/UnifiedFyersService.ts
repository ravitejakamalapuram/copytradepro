/**
 * Unified Fyers Service
 * Implements the new IUnifiedBrokerService interface with all business logic encapsulated
 * Handles OAuth flow, token refresh, profile fetching, expiry management, and provides standardized responses
 */

import { 
  IUnifiedBrokerService,
  UnifiedConnectionResponse,
  UnifiedOAuthResponse,
  UnifiedTokenRefreshResponse,
  UnifiedValidationResponse,
  UnifiedAccountInfo,
  UnifiedTokenInfo,
  UnifiedResponseHelper,
  AccountStatus,
  AuthenticationStep,
  BrokerErrorType
} from '../../interfaces/UnifiedBrokerResponse';

import { 
  DerivativesBrokerService,
  MarginInfo,
  TradingPermissions,
  DerivativeOrderRequest,
  OrderResponse
} from '../../interfaces/IBrokerService';

import {
  OptionChain,
  FuturesChain,
  OptionPosition,
  FuturesPosition,
  DerivativePosition,
  DerivativeOrder,
  OptionContract,
  FuturesContract,
  Greeks,
  OptionStrike
} from '@copytrade/shared-types';

import { FyersService, FyersCredentials } from '../../services/fyersService';

export class UnifiedFyersService implements IUnifiedBrokerService {
  public fyersService: FyersService; // Made public for derivatives access
  private isConnectedFlag: boolean = false;
  private accountInfo: UnifiedAccountInfo | null = null;
  private tokenInfo: UnifiedTokenInfo | null = null;
  private currentCredentials: FyersCredentials | null = null;

  constructor() {
    this.fyersService = new FyersService();
  }

  getBrokerName(): string {
    return 'fyers';
  }

  /**
   * Connect to Fyers broker - initiates OAuth flow
   * Returns OAuth URL for user authentication
   */
  async connect(credentials: any): Promise<UnifiedConnectionResponse> {
    try {
      const fyersCredentials = credentials as FyersCredentials;
      this.currentCredentials = fyersCredentials;

      console.log('🔄 Initiating Fyers OAuth flow...');
      
      // Validate required credentials
      if (!fyersCredentials.clientId || !fyersCredentials.secretKey) {
        return UnifiedResponseHelper.createErrorResponse(
          'Client ID and Secret Key are required for Fyers authentication',
          'VALIDATION_ERROR',
          'INACTIVE',
          'REAUTH_REQUIRED'
        );
      }

      // Set default redirect URI if not provided
      if (!fyersCredentials.redirectUri) {
        fyersCredentials.redirectUri = process.env.FYERS_REDIRECT_URI || 'http://localhost:3001/api/broker/oauth/callback';
      }
      
      // Generate OAuth URL for user authentication
      const authUrl = this.fyersService.generateAuthUrl(fyersCredentials);
      
      if (authUrl) {
        console.log('✅ Fyers OAuth URL generated successfully');
        console.log(`🔗 OAuth URL: ${authUrl}`);
        
        return UnifiedResponseHelper.createOAuthResponse(
          authUrl,
          'Please complete OAuth authentication. You will be redirected back after authorization.'
        );
      } else {
        console.error('❌ Failed to generate Fyers OAuth URL');
        
        return UnifiedResponseHelper.createErrorResponse(
          'Failed to generate OAuth URL for Fyers. Please check your credentials.',
          'BROKER_ERROR',
          'INACTIVE',
          'REAUTH_REQUIRED'
        );
      }
    } catch (error: any) {
      console.error('🚨 Fyers connection error:', error);
      
      return UnifiedResponseHelper.createErrorResponse(
        error.message || 'Failed to initiate Fyers OAuth flow',
        'BROKER_ERROR',
        'INACTIVE',
        'REAUTH_REQUIRED'
      );
    }
  }

  /**
   * Complete Fyers OAuth flow with auth code
   * Generates access token, fetches profile, and sets up account
   */
  async completeOAuth(authCode: string, credentials: any): Promise<UnifiedOAuthResponse> {
    try {
      const fyersCredentials = credentials as FyersCredentials;
      
      console.log('🔄 Completing Fyers OAuth with auth code...');
      
      // Generate access token from auth code
      const tokenResponse = await this.fyersService.generateAccessToken(authCode, fyersCredentials);
      
      if (tokenResponse.success) {
        console.log('✅ Fyers access token generated successfully');
        
        // Fetch user profile to get real account information
        let realAccountId = tokenResponse.accountId || fyersCredentials.clientId;
        let realUserName = tokenResponse.accountId || fyersCredentials.clientId;
        
        try {
          const profileResponse = await this.fyersService.getProfile();
          if (profileResponse && profileResponse.data) {
            realAccountId = profileResponse.data.fy_id || profileResponse.data.id || profileResponse.data.user_id || realAccountId;
            realUserName = profileResponse.data.name || profileResponse.data.display_name || realAccountId;
            console.log(`✅ Fyers profile fetched - Account ID: ${realAccountId}, User Name: ${realUserName}`);
          }
        } catch (profileError: any) {
          console.warn('⚠️ Failed to fetch Fyers profile, using fallback values:', profileError.message);
        }

        // Set up account information
        this.accountInfo = {
          accountId: realAccountId,
          userName: realUserName,
          email: '', // Fyers doesn't provide email in profile
          brokerDisplayName: 'Fyers',
          exchanges: ['NSE', 'BSE', 'MCX'], // Fyers supported exchanges
          products: ['CNC', 'INTRADAY', 'MARGIN', 'CO', 'BO'] // Fyers product types
        };

        // Set up token information with expiry
        const expiryTime = tokenResponse.expiryTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        this.tokenInfo = {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          expiryTime: expiryTime,
          isExpired: false,
          canRefresh: !!tokenResponse.refreshToken
        };

        this.isConnectedFlag = true;

        console.log('✅ Fyers OAuth completion successful');

        return UnifiedResponseHelper.createSuccessResponse(
          'Fyers OAuth authentication completed successfully',
          'ACTIVE',
          'OAUTH_COMPLETION',
          this.accountInfo,
          this.tokenInfo
        ) as UnifiedOAuthResponse;
      } else {
        console.error('❌ Fyers OAuth completion failed:', tokenResponse.message);
        
        // Check if it's an auth code expiry issue
        const isAuthCodeExpired = tokenResponse.message && (
          tokenResponse.message.includes('expired') || 
          tokenResponse.message.includes('invalid auth code') ||
          tokenResponse.message.includes('code has expired')
        );

        if (isAuthCodeExpired) {
          return UnifiedResponseHelper.createErrorResponse(
            'Auth code has expired. Please try again.',
            'AUTH_CODE_EXPIRED',
            'PROCEED_TO_OAUTH',
            'OAUTH_REQUIRED'
          ) as UnifiedOAuthResponse;
        } else {
          return UnifiedResponseHelper.createErrorResponse(
            tokenResponse.message || 'Access token generation failed. Please try again.',
            'AUTH_FAILED',
            'PROCEED_TO_OAUTH',
            'OAUTH_REQUIRED'
          ) as UnifiedOAuthResponse;
        }
      }
    } catch (error: any) {
      console.error('🚨 Fyers OAuth completion error:', error);
      
      return UnifiedResponseHelper.createErrorResponse(
        error.message || 'OAuth completion failed. Please try again.',
        'BROKER_ERROR',
        'PROCEED_TO_OAUTH',
        'OAUTH_REQUIRED'
      ) as UnifiedOAuthResponse;
    }
  }

  /**
   * Refresh Fyers access token using refresh token
   */
  async refreshToken(credentials: any): Promise<UnifiedTokenRefreshResponse> {
    if (!this.tokenInfo || !this.tokenInfo.refreshToken) {
      return UnifiedResponseHelper.createErrorResponse(
        'No refresh token available for Fyers',
        'REFRESH_TOKEN_EXPIRED',
        'PROCEED_TO_OAUTH',
        'OAUTH_REQUIRED'
      ) as UnifiedTokenRefreshResponse;
    }

    try {
      console.log('🔄 Refreshing Fyers access token...');
      
      // TODO: Implement actual refresh token API call
      // For now, we'll simulate the refresh process
      console.warn('⚠️ Fyers token refresh not fully implemented - triggering re-auth');
      
      // If refresh fails, user needs to re-authenticate
      return UnifiedResponseHelper.createErrorResponse(
        'Token refresh failed. Please re-authenticate.',
        'REFRESH_TOKEN_EXPIRED',
        'PROCEED_TO_OAUTH',
        'OAUTH_REQUIRED'
      ) as UnifiedTokenRefreshResponse;
      
    } catch (error: any) {
      console.error('🚨 Fyers token refresh error:', error);
      
      return UnifiedResponseHelper.createErrorResponse(
        'Token refresh failed. Please re-authenticate.',
        'REFRESH_TOKEN_EXPIRED',
        'PROCEED_TO_OAUTH',
        'OAUTH_REQUIRED'
      ) as UnifiedTokenRefreshResponse;
    }
  }

  /**
   * Validate current Fyers session and check token expiry
   */
  async validateSession(credentials: any): Promise<UnifiedValidationResponse> {
    if (!this.isConnectedFlag || !this.tokenInfo) {
      return {
        isValid: false,
        accountStatus: 'INACTIVE',
        message: 'No active Fyers session',
        errorType: 'AUTH_FAILED'
      };
    }

    // Check if token is expired
    if (this.tokenInfo.expiryTime) {
      const now = new Date();
      const expiryTime = new Date(this.tokenInfo.expiryTime);
      
      if (now > expiryTime) {
        this.tokenInfo.isExpired = true;
        
        if (this.tokenInfo.canRefresh) {
          return {
            isValid: false,
            accountStatus: 'REFRESH_REQUIRED',
            message: 'Fyers token has expired but can be refreshed',
            errorType: 'TOKEN_EXPIRED',
            tokenInfo: this.tokenInfo
          };
        } else {
          return {
            isValid: false,
            accountStatus: 'PROCEED_TO_OAUTH',
            message: 'Fyers token has expired. Re-authentication required.',
            errorType: 'TOKEN_EXPIRED'
          };
        }
      }
    }

    try {
      // Validate session with Fyers API
      const isValid = await this.fyersService.validateSession();
      
      if (isValid) {
        return {
          isValid: true,
          accountStatus: 'ACTIVE',
          message: 'Fyers session is valid',
          tokenInfo: this.tokenInfo
        };
      } else {
        // Session is no longer valid
        this.isConnectedFlag = false;
        
        return {
          isValid: false,
          accountStatus: 'PROCEED_TO_OAUTH',
          message: 'Fyers session is no longer valid',
          errorType: 'TOKEN_EXPIRED'
        };
      }
    } catch (error: any) {
      console.error('🚨 Fyers session validation error:', error);
      
      return {
        isValid: false,
        accountStatus: 'INACTIVE',
        message: 'Failed to validate Fyers session',
        errorType: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Disconnect from Fyers
   */
  async disconnect(): Promise<boolean> {
    try {
      if (this.isConnectedFlag) {
        await this.fyersService.logout();
      }
      
      // Reset all state
      this.isConnectedFlag = false;
      this.accountInfo = null;
      this.tokenInfo = null;
      this.currentCredentials = null;
      
      console.log('✅ Fyers disconnected successfully');
      return true;
    } catch (error: any) {
      console.error('🚨 Fyers disconnect error:', error);
      
      // Reset state even if logout fails
      this.isConnectedFlag = false;
      this.accountInfo = null;
      this.tokenInfo = null;
      this.currentCredentials = null;
      
      return false;
    }
  }

  /**
   * Get current account information
   */
  getAccountInfo(): UnifiedAccountInfo | null {
    return this.accountInfo;
  }

  /**
   * Get current token information
   */
  getTokenInfo(): UnifiedTokenInfo | null {
    return this.tokenInfo;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.isConnectedFlag && !this.isTokenExpired();
  }

  /**
   * Get current account status
   */
  getAccountStatus(): AccountStatus {
    if (!this.isConnectedFlag) {
      return 'INACTIVE';
    }
    
    if (this.isTokenExpired()) {
      return this.tokenInfo?.canRefresh ? 'REFRESH_REQUIRED' : 'PROCEED_TO_OAUTH';
    }
    
    return 'ACTIVE';
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.tokenInfo || !this.tokenInfo.expiryTime) {
      return false;
    }
    
    const now = new Date();
    const expiryTime = new Date(this.tokenInfo.expiryTime);
    return now > expiryTime;
  }

  // Trading operations - delegate to existing service
  async placeOrder(orderRequest: any): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }

    // Transform unified order request to Fyers format
    const fyersOrderRequest = {
      symbol: this.formatSymbolForFyers(orderRequest.symbol, orderRequest.exchange),
      qty: Math.abs(orderRequest.quantity), // Ensure positive quantity
      type: this.mapOrderType(orderRequest.orderType),
      side: orderRequest.action as 'BUY' | 'SELL',
      productType: this.mapProductType(orderRequest.productType),
      limitPrice: orderRequest.price || 0,
      stopPrice: orderRequest.triggerPrice || 0,
      validity: orderRequest.validity || 'DAY',
      disclosedQty: 0,
      offlineOrder: false
    };

    try {
      console.log('🔄 Placing Fyers order with request:', JSON.stringify(fyersOrderRequest, null, 2));
      
      const fyersResponse = await this.fyersService.placeOrder(fyersOrderRequest);

      // Transform Fyers response to unified format
      if (fyersResponse.s === 'ok') {
        return {
          success: true,
          message: 'Order placed successfully',
          data: {
            brokerOrderId: fyersResponse.id,
            orderId: fyersResponse.id,
            status: 'PLACED'
          }
        };
      } else {
        return {
          success: false,
          message: fyersResponse.message || 'Order placement failed',
          data: null
        };
      }
    } catch (error: any) {
      console.error('🚨 Fyers order placement error:', error);
      return {
        success: false,
        message: error.message || 'Order placement failed',
        data: null
      };
    }
  }

  private formatSymbolForFyers(symbol: string, exchange: string): string {
    // Fyers expects format: EXCHANGE:SYMBOL
    // e.g., NSE:RELIANCE-EQ, BSE:RELIANCE
    if (symbol.includes(':')) {
      // Already formatted
      return symbol;
    }
    
    // Format as EXCHANGE:SYMBOL
    return `${exchange}:${symbol}`;
  }

  private mapProductType(productType: string): 'CNC' | 'INTRADAY' | 'MARGIN' | 'CO' | 'BO' {
    const mapping: { [key: string]: 'CNC' | 'INTRADAY' | 'MARGIN' | 'CO' | 'BO' } = {
      'CNC': 'CNC',
      'MIS': 'INTRADAY',
      'NRML': 'MARGIN',
      'BO': 'BO',
      'CO': 'CO'
    };
    return mapping[productType] || 'CNC'; // Default to CNC
  }

  private mapOrderType(orderType: string): 'LIMIT' | 'MARKET' | 'SL' | 'SL-M' {
    const mapping: { [key: string]: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M' } = {
      'MARKET': 'MARKET',
      'LIMIT': 'LIMIT',
      'SL-LIMIT': 'SL',
      'SL-MARKET': 'SL-M'
    };
    return mapping[orderType] || 'MARKET'; // Default to MARKET
  }

  async getOrderStatus(accountId: string, orderId: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    // Use getOrderBook and filter by orderId
    const orderBook = await this.fyersService.getOrderBook();
    return orderBook.find((order: any) => order.id === orderId) || null;
  }

  async getOrderHistory(accountId: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    return this.fyersService.getOrderBook();
  }

  async getPositions(accountId: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    return this.fyersService.getPositions();
  }

  async getQuote(symbol: string, exchange: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    const fullSymbol = `${exchange}:${symbol}`;
    const quotes = await this.fyersService.getQuotes([fullSymbol]);
    return quotes.length > 0 ? quotes[0] : null;
  }

  async searchSymbols(query: string, exchange: string): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }
    return this.fyersService.searchScrip(exchange, query);
  }
}

/**
 * Derivatives-enabled Fyers Service
 * Extends UnifiedFyersService with derivatives trading capabilities
 */
export class FyersDerivativesService extends DerivativesBrokerService {
  private unifiedService: UnifiedFyersService;

  constructor() {
    super('fyers');
    this.unifiedService = new UnifiedFyersService();
  }

  // Delegate base broker methods to unified service
  async login(credentials: any): Promise<any> {
    const result = await this.unifiedService.connect(credentials);
    if (result.success || result.authUrl) {
      this.setConnected(true, this.unifiedService.getAccountInfo()?.accountId);
    }
    return {
      success: result.success,
      message: result.message,
      data: result.authUrl ? { authUrl: result.authUrl } : result.data
    };
  }

  async logout(): Promise<boolean> {
    const result = await this.unifiedService.disconnect();
    this.setConnected(false);
    return result;
  }

  async validateSession(accountId?: string): Promise<boolean> {
    const result = await this.unifiedService.validateSession({});
    return result.isValid;
  }

  async placeOrder(orderRequest: any): Promise<any> {
    return this.unifiedService.placeOrder(orderRequest);
  }

  async getOrderStatus(accountId: string, orderId: string): Promise<any> {
    return this.unifiedService.getOrderStatus(accountId, orderId);
  }

  async getOrderHistory(accountId: string): Promise<any> {
    return this.unifiedService.getOrderHistory(accountId);
  }

  async getPositions(accountId: string): Promise<any> {
    return this.unifiedService.getPositions(accountId);
  }

  async getQuote(symbol: string, exchange: string): Promise<any> {
    return this.unifiedService.getQuote(symbol, exchange);
  }

  async searchSymbols(query: string, exchange: string): Promise<any> {
    return this.unifiedService.searchSymbols(query, exchange);
  }

  // Derivatives-specific methods implementation

  /**
   * Get option chain for an underlying asset
   */
  async getOptionChain(underlying: string, expiry?: Date): Promise<OptionChain> {
    if (!this.isLoggedIn()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }

    try {
      console.log(`🔄 Fetching option chain for ${underlying} from Fyers...`);
      
      // For Fyers, we need to search for option symbols
      // Format: NSE:NIFTY24DECCE22000 (underlying + expiry + CE/PE + strike)
      const searchQuery = underlying.toUpperCase();
      const symbols = await this.unifiedService.searchSymbols(searchQuery, 'NSE');
      
      // Filter option symbols
      const optionSymbols = symbols.filter((symbol: any) => 
        symbol.symbol && (symbol.symbol.includes('CE') || symbol.symbol.includes('PE'))
      );

      if (optionSymbols.length === 0) {
        throw new Error(`No option contracts found for ${underlying}`);
      }

      // Group by strike prices
      const strikeMap = new Map<number, { call?: OptionContract; put?: OptionContract }>();
      let expiryDate = expiry || new Date();
      let impliedVolatility = 0.2; // Default IV
      let historicalVolatility = 0.25; // Default HV

      // Get quotes for option symbols to build contracts
      const quotes = await this.unifiedService.fyersService.getQuotes(
        optionSymbols.slice(0, 50).map((s: any) => s.symbol) // Limit to 50 symbols
      );

      for (const quote of quotes) {
        const contract = this.parseOptionContract(quote, underlying);
        if (contract) {
          if (!strikeMap.has(contract.strike)) {
            strikeMap.set(contract.strike, {});
          }
          
          const strikeData = strikeMap.get(contract.strike)!;
          if (contract.optionType === 'call') {
            strikeData.call = contract;
          } else {
            strikeData.put = contract;
          }
        }
      }

      // Convert to OptionStrike array
      const strikes: OptionStrike[] = Array.from(strikeMap.entries())
        .filter(([_, data]) => data.call && data.put)
        .map(([strike, data]) => ({
          strike,
          call: data.call!,
          put: data.put!
        }))
        .sort((a, b) => a.strike - b.strike);

      // Find ATM strike
      const underlyingPrice = await this.getUnderlyingPrice(underlying);
      const atmStrike = strikes.reduce((prev, curr) => 
        Math.abs(curr.strike - underlyingPrice) < Math.abs(prev.strike - underlyingPrice) ? curr : prev
      ).strike;

      return {
        underlying,
        expiryDate,
        strikes,
        impliedVolatility,
        historicalVolatility,
        atmStrike,
        daysToExpiry: Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        interestRate: 0.06 // Default interest rate
      };

    } catch (error: any) {
      console.error('🚨 Failed to fetch Fyers option chain:', error);
      throw new Error(`Failed to fetch option chain: ${error.message}`);
    }
  }

  /**
   * Get futures chain for an underlying asset
   */
  async getFuturesChain(underlying: string): Promise<FuturesChain> {
    if (!this.isLoggedIn()) {
      throw new Error('Not connected to Fyers. Please authenticate first.');
    }

    try {
      console.log(`🔄 Fetching futures chain for ${underlying} from Fyers...`);
      
      // Search for futures symbols
      const searchQuery = underlying.toUpperCase();
      const symbols = await this.unifiedService.searchSymbols(searchQuery, 'NSE');
      
      // Filter futures symbols (typically end with FUT or have month codes)
      const futuresSymbols = symbols.filter((symbol: any) => 
        symbol.symbol && (symbol.symbol.includes('FUT') || this.isFuturesSymbol(symbol.symbol))
      );

      if (futuresSymbols.length === 0) {
        throw new Error(`No futures contracts found for ${underlying}`);
      }

      // Get quotes for futures symbols
      const quotes = await this.unifiedService.fyersService.getQuotes(
        futuresSymbols.slice(0, 10).map((s: any) => s.symbol) // Limit to 10 contracts
      );

      const contracts: FuturesContract[] = quotes.map(quote => 
        this.parseFuturesContract(quote, underlying)
      ).filter(Boolean) as FuturesContract[];

      // Sort by expiry date
      contracts.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

      const nearMonthContract = contracts[0];
      const rolloverDate = new Date(nearMonthContract.expiryDate);
      rolloverDate.setDate(rolloverDate.getDate() - 7); // Rollover 7 days before expiry

      return {
        underlying,
        contracts,
        nearMonthContract,
        rolloverDate,
        specifications: {
          contractSize: nearMonthContract.lotSize,
          tickValue: nearMonthContract.tickSize,
          tradingHours: {
            start: '09:15',
            end: '15:30'
          },
          settlementType: 'cash',
          marginPercentage: 10 // Default margin percentage
        }
      };

    } catch (error: any) {
      console.error('🚨 Failed to fetch Fyers futures chain:', error);
      throw new Error(`Failed to fetch futures chain: ${error.message}`);
    }
  }

  /**
   * Place option order
   */
  async placeOptionOrder(orderRequest: DerivativeOrderRequest): Promise<OrderResponse> {
    if (!this.validateDerivativeOrder(orderRequest)) {
      return this.createDerivativeErrorResponse('Invalid option order request');
    }

    try {
      // Convert to standard order format
      const standardOrder = {
        symbol: orderRequest.symbol,
        action: orderRequest.action,
        quantity: orderRequest.quantity,
        orderType: orderRequest.orderType,
        price: orderRequest.price,
        triggerPrice: orderRequest.triggerPrice,
        exchange: orderRequest.exchange,
        productType: orderRequest.productType,
        validity: orderRequest.validity,
        remarks: orderRequest.remarks
      };

      return await this.unifiedService.placeOrder(standardOrder);
    } catch (error: any) {
      return this.createDerivativeErrorResponse(error.message);
    }
  }

  /**
   * Place futures order
   */
  async placeFuturesOrder(orderRequest: DerivativeOrderRequest): Promise<OrderResponse> {
    if (!this.validateDerivativeOrder(orderRequest)) {
      return this.createDerivativeErrorResponse('Invalid futures order request');
    }

    try {
      // Convert to standard order format
      const standardOrder = {
        symbol: orderRequest.symbol,
        action: orderRequest.action,
        quantity: orderRequest.quantity,
        orderType: orderRequest.orderType,
        price: orderRequest.price,
        triggerPrice: orderRequest.triggerPrice,
        exchange: orderRequest.exchange,
        productType: orderRequest.productType,
        validity: orderRequest.validity,
        remarks: orderRequest.remarks
      };

      return await this.unifiedService.placeOrder(standardOrder);
    } catch (error: any) {
      return this.createDerivativeErrorResponse(error.message);
    }
  }

  /**
   * Get option positions
   */
  async getOptionPositions(accountId: string): Promise<OptionPosition[]> {
    const allPositions = await this.unifiedService.getPositions(accountId);
    
    // Filter and convert to option positions
    return allPositions
      .filter((pos: any) => this.isOptionPosition(pos))
      .map((pos: any) => this.convertToOptionPosition(pos));
  }

  /**
   * Get futures positions
   */
  async getFuturesPositions(accountId: string): Promise<FuturesPosition[]> {
    const allPositions = await this.unifiedService.getPositions(accountId);
    
    // Filter and convert to futures positions
    return allPositions
      .filter((pos: any) => this.isFuturesPosition(pos))
      .map((pos: any) => this.convertToFuturesPosition(pos));
  }

  /**
   * Get all derivative positions
   */
  async getAllDerivativePositions(accountId: string): Promise<DerivativePosition[]> {
    const [optionPositions, futuresPositions] = await Promise.all([
      this.getOptionPositions(accountId),
      this.getFuturesPositions(accountId)
    ]);

    return [...optionPositions, ...futuresPositions];
  }

  /**
   * Calculate margin requirements
   */
  async calculateMargin(positions: DerivativePosition[]): Promise<MarginInfo> {
    // Simplified margin calculation for Fyers
    let totalInitialMargin = 0;
    let totalMaintenanceMargin = 0;

    for (const position of positions) {
      // Basic margin calculation based on position value
      const positionValue = Math.abs(position.quantity * position.currentPrice);
      const marginRate = this.getMarginRate(position);
      
      totalInitialMargin += positionValue * marginRate;
      totalMaintenanceMargin += positionValue * (marginRate * 0.75); // 75% of initial margin
    }

    // Mock available margin - in real implementation, fetch from broker
    const availableMargin = 100000; // Mock value
    const marginUtilization = (totalInitialMargin / availableMargin) * 100;

    return {
      initialMargin: totalInitialMargin,
      maintenanceMargin: totalMaintenanceMargin,
      availableMargin: Math.max(0, availableMargin - totalInitialMargin),
      marginUtilization,
      marginCall: marginUtilization > 80, // Margin call at 80% utilization
      excessMargin: Math.max(0, availableMargin - totalInitialMargin)
    };
  }

  /**
   * Get derivatives trading eligibility
   */
  async getDerivativesEligibility(accountId: string): Promise<TradingPermissions> {
    // For Fyers, assume derivatives are enabled by default
    // In real implementation, check with broker API
    return {
      optionsEnabled: true,
      futuresEnabled: true,
      commodityEnabled: true,
      currencyEnabled: true,
      positionLimits: {
        options: 500, // Max 500 option contracts
        futures: 100  // Max 100 futures contracts
      }
    };
  }

  /**
   * Get derivative order history
   */
  async getDerivativeOrderHistory(accountId: string): Promise<DerivativeOrder[]> {
    const allOrders = await this.unifiedService.getOrderHistory(accountId);
    
    // Filter and convert to derivative orders
    return allOrders
      .filter((order: any) => this.isDerivativeOrder(order))
      .map((order: any) => this.convertToDerivativeOrder(order));
  }

  // Helper methods

  private parseOptionContract(quote: any, underlying: string): OptionContract | null {
    try {
      // Parse Fyers option symbol format
      const symbol = quote.symbol || quote.n;
      const price = quote.ltp || quote.c || 0;
      const bid = quote.bid || price * 0.995;
      const ask = quote.ask || price * 1.005;
      
      // Extract option details from symbol
      const optionDetails = this.extractOptionDetails(symbol);
      if (!optionDetails) return null;

      // Calculate Greeks (simplified)
      const greeks = this.calculateGreeks(price, optionDetails.strike, underlying);

      return {
        symbol,
        underlying,
        expiryDate: optionDetails.expiry,
        lotSize: optionDetails.lotSize || 50, // Default lot size
        tickSize: 0.05,
        lastPrice: price,
        bid,
        ask,
        volume: quote.volume || quote.v || 0,
        openInterest: quote.oi || 0,
        timestamp: new Date(),
        optionType: optionDetails.type,
        strike: optionDetails.strike,
        premium: price,
        greeks,
        impliedVolatility: 0.2, // Default IV
        timeValue: Math.max(0, price - Math.max(0, optionDetails.type === 'call' ? price - optionDetails.strike : optionDetails.strike - price)),
        intrinsicValue: Math.max(0, optionDetails.type === 'call' ? price - optionDetails.strike : optionDetails.strike - price),
        daysToExpiry: Math.ceil((optionDetails.expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      };
    } catch (error) {
      console.warn('Failed to parse option contract:', error);
      return null;
    }
  }

  private parseFuturesContract(quote: any, underlying: string): FuturesContract | null {
    try {
      const symbol = quote.symbol || quote.n;
      const price = quote.ltp || quote.c || 0;
      
      // Extract futures details from symbol
      const futuresDetails = this.extractFuturesDetails(symbol);
      if (!futuresDetails) return null;

      const lotSize = futuresDetails.lotSize || 50;
      const contractValue = price * lotSize;

      return {
        symbol,
        underlying,
        expiryDate: futuresDetails.expiry,
        lotSize,
        tickSize: 0.05,
        lastPrice: price,
        bid: quote.bid || price * 0.999,
        ask: quote.ask || price * 1.001,
        volume: quote.volume || quote.v || 0,
        openInterest: quote.oi || 0,
        timestamp: new Date(),
        contractValue,
        initialMargin: contractValue * 0.1, // 10% margin
        maintenanceMargin: contractValue * 0.075, // 7.5% maintenance margin
        settlementPrice: price,
        multiplier: lotSize
      };
    } catch (error) {
      console.warn('Failed to parse futures contract:', error);
      return null;
    }
  }

  private extractOptionDetails(symbol: string): { type: 'call' | 'put'; strike: number; expiry: Date; lotSize?: number } | null {
    // Simplified parsing for Fyers option symbols
    // Real implementation would need proper regex parsing
    const isCall = symbol.includes('CE');
    const isPut = symbol.includes('PE');
    
    if (!isCall && !isPut) return null;

    // Extract strike price (simplified)
    const strikeMatch = symbol.match(/(\d+)(?:CE|PE)/);
    const strike = strikeMatch ? parseInt(strikeMatch[1]) : 0;

    // Extract expiry (simplified - use next month end)
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    expiry.setDate(0); // Last day of month

    return {
      type: isCall ? 'call' : 'put',
      strike,
      expiry,
      lotSize: 50 // Default lot size
    };
  }

  private extractFuturesDetails(symbol: string): { expiry: Date; lotSize?: number } | null {
    // Simplified parsing for Fyers futures symbols
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    expiry.setDate(0); // Last day of month

    return {
      expiry,
      lotSize: 50 // Default lot size
    };
  }

  private calculateGreeks(price: number, strike: number, underlying: string): Greeks {
    // Simplified Greeks calculation
    // Real implementation would use Black-Scholes model
    return {
      delta: 0.5,
      gamma: 0.01,
      theta: -0.05,
      vega: 0.1,
      rho: 0.01
    };
  }

  private async getUnderlyingPrice(underlying: string): Promise<number> {
    try {
      const quote = await this.unifiedService.getQuote(underlying, 'NSE');
      return quote?.ltp || quote?.c || 0;
    } catch {
      return 0;
    }
  }

  private isFuturesSymbol(symbol: string): boolean {
    return symbol.includes('FUT') || /\d{2}[A-Z]{3}\d{2}/.test(symbol);
  }

  private isOptionPosition(position: any): boolean {
    return position.symbol && (position.symbol.includes('CE') || position.symbol.includes('PE'));
  }

  private isFuturesPosition(position: any): boolean {
    return position.symbol && (position.symbol.includes('FUT') || this.isFuturesSymbol(position.symbol));
  }

  private isDerivativeOrder(order: any): boolean {
    return this.isOptionPosition(order) || this.isFuturesPosition(order);
  }

  private convertToOptionPosition(position: any): OptionPosition {
    const optionDetails = this.extractOptionDetails(position.symbol);
    
    return {
      id: position.id || `${position.symbol}_${Date.now()}`,
      brokerId: 'fyers',
      symbol: position.symbol,
      underlying: position.underlying || 'NIFTY',
      positionType: position.qty > 0 ? 'long' : 'short',
      quantity: Math.abs(position.qty || position.quantity || 0),
      avgPrice: position.avgPrice || position.averagePrice || 0,
      currentPrice: position.ltp || position.currentPrice || 0,
      unrealizedPnL: position.pnl || 0,
      realizedPnL: 0,
      totalPnL: position.pnl || 0,
      positionValue: Math.abs(position.qty || 0) * (position.ltp || 0),
      marginUsed: 0,
      entryDate: new Date(),
      lastUpdated: new Date(),
      optionType: optionDetails?.type || 'call',
      strike: optionDetails?.strike || 0,
      expiryDate: optionDetails?.expiry || new Date(),
      premium: position.avgPrice || 0,
      greeks: this.calculateGreeks(position.ltp || 0, optionDetails?.strike || 0, ''),
      impliedVolatility: 0.2,
      timeValue: 0,
      intrinsicValue: 0,
      daysToExpiry: 30
    };
  }

  private convertToFuturesPosition(position: any): FuturesPosition {
    const futuresDetails = this.extractFuturesDetails(position.symbol);
    
    return {
      id: position.id || `${position.symbol}_${Date.now()}`,
      brokerId: 'fyers',
      symbol: position.symbol,
      underlying: position.underlying || 'NIFTY',
      positionType: position.qty > 0 ? 'long' : 'short',
      quantity: Math.abs(position.qty || position.quantity || 0),
      avgPrice: position.avgPrice || position.averagePrice || 0,
      currentPrice: position.ltp || position.currentPrice || 0,
      unrealizedPnL: position.pnl || 0,
      realizedPnL: 0,
      totalPnL: position.pnl || 0,
      positionValue: Math.abs(position.qty || 0) * (position.ltp || 0),
      marginUsed: 0,
      entryDate: new Date(),
      lastUpdated: new Date(),
      expiryDate: futuresDetails?.expiry || new Date(),
      contractSize: futuresDetails?.lotSize || 50,
      initialMargin: 0,
      maintenanceMargin: 0,
      markToMarket: position.pnl || 0,
      settlementPrice: position.ltp || 0,
      multiplier: futuresDetails?.lotSize || 50
    };
  }

  private convertToDerivativeOrder(order: any): DerivativeOrder {
    return {
      id: order.id || order.orderId,
      brokerId: 'fyers',
      symbol: order.symbol,
      underlying: order.underlying || 'NIFTY',
      orderType: this.mapToDerivativeOrderType(order.type || order.orderType),
      transactionType: order.side === 1 || order.side === 'BUY' ? 'buy' : 'sell',
      quantity: Math.abs(order.qty || order.quantity || 0),
      price: order.limitPrice || order.price,
      stopPrice: order.stopPrice || order.triggerPrice,
      status: this.mapOrderStatus(order.status),
      filledQuantity: order.filledQty || order.filledQuantity || 0,
      avgFillPrice: order.avgPrice || order.averagePrice || 0,
      timestamp: new Date(order.orderDateTime || order.timestamp || Date.now())
    };
  }

  private mapToDerivativeOrderType(orderType: string): 'market' | 'limit' | 'stop_loss' | 'stop_limit' {
    const mapping: { [key: string]: 'market' | 'limit' | 'stop_loss' | 'stop_limit' } = {
      'MARKET': 'market',
      'LIMIT': 'limit',
      'SL': 'stop_loss',
      'SL-M': 'stop_loss'
    };
    return mapping[orderType] || 'market';
  }

  private mapOrderStatus(status: string): 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial' {
    const mapping: { [key: string]: 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial' } = {
      'PENDING': 'pending',
      'COMPLETE': 'executed',
      'CANCELLED': 'cancelled',
      'REJECTED': 'rejected',
      'PARTIAL': 'partial'
    };
    return mapping[status] || 'pending';
  }

  private getMarginRate(position: DerivativePosition): number {
    // Simplified margin rate calculation
    if (position.symbol.includes('CE') || position.symbol.includes('PE')) {
      return 0.2; // 20% for options
    } else {
      return 0.1; // 10% for futures
    }
  }
}
