/**
 * Unified Shoonya Service
 * Implements the new IUnifiedBrokerService interface with all business logic encapsulated
 * Handles authentication, token management, and provides standardized responses
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

import { ShoonyaService, ShoonyaCredentials } from '../../services/shoonyaService';

export class UnifiedShoonyaService implements IUnifiedBrokerService {
  private shoonyaService: ShoonyaService;
  private isConnectedFlag: boolean = false;
  private accountInfo: UnifiedAccountInfo | null = null;
  private tokenInfo: UnifiedTokenInfo | null = null;
  private currentCredentials: ShoonyaCredentials | null = null;

  constructor() {
    this.shoonyaService = new ShoonyaService();
  }

  getBrokerName(): string {
    return 'shoonya';
  }

  /**
   * Connect to Shoonya broker with direct authentication
   * Handles all authentication logic internally and returns standardized response
   */
  async connect(credentials: any): Promise<UnifiedConnectionResponse> {
    try {
      const shoonyaCredentials = credentials as ShoonyaCredentials;
      this.currentCredentials = shoonyaCredentials;

      console.log('🔄 Attempting Shoonya authentication...');
      
      const response = await this.shoonyaService.login(shoonyaCredentials);
      
      if (response.stat === 'Ok') {
        // Authentication successful - populate account and token info
        this.accountInfo = {
          accountId: response.actid || shoonyaCredentials.userId,
          userName: response.uname || shoonyaCredentials.userId,
          email: response.email || '',
          brokerDisplayName: 'Shoonya (Finvasia)',
          exchanges: response.exarr || ['NSE', 'BSE'],
          products: response.prarr || ['C', 'M', 'I']
        };

        // Shoonya tokens don't expire (infinity)
        this.tokenInfo = {
          accessToken: response.susertoken,
          refreshToken: undefined, // Shoonya doesn't use refresh tokens
          expiryTime: null, // null indicates infinity
          isExpired: false,
          canRefresh: false // Shoonya doesn't need token refresh
        };

        this.isConnectedFlag = true;

        console.log('✅ Shoonya authentication successful');

        return UnifiedResponseHelper.createSuccessResponse(
          'Shoonya account connected successfully',
          'ACTIVE',
          'DIRECT_AUTH',
          this.accountInfo,
          this.tokenInfo
        );
      } else {
        // Authentication failed
        console.error('❌ Shoonya authentication failed:', response.emsg);
        
        return UnifiedResponseHelper.createErrorResponse(
          response.emsg || 'Shoonya authentication failed',
          'AUTH_FAILED',
          'INACTIVE',
          'REAUTH_REQUIRED'
        );
      }
    } catch (error: any) {
      console.error('🚨 Shoonya connection error:', error);
      
      // Determine error type based on error message
      let errorType: BrokerErrorType = 'BROKER_ERROR';
      if (error.message?.includes('network') || error.message?.includes('timeout')) {
        errorType = 'NETWORK_ERROR';
      } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
        errorType = 'VALIDATION_ERROR';
      }

      return UnifiedResponseHelper.createErrorResponse(
        error.message || 'Failed to connect to Shoonya',
        errorType,
        'INACTIVE',
        'REAUTH_REQUIRED'
      );
    }
  }

  /**
   * Shoonya doesn't use OAuth, so this method returns an error
   */
  async completeOAuth(authCode: string, credentials: any): Promise<UnifiedOAuthResponse> {
    return UnifiedResponseHelper.createErrorResponse(
      'Shoonya does not support OAuth authentication',
      'VALIDATION_ERROR',
      'INACTIVE',
      'DIRECT_AUTH'
    ) as UnifiedOAuthResponse;
  }

  /**
   * Shoonya tokens don't expire, so refresh is not needed
   */
  async refreshToken(credentials: any): Promise<UnifiedTokenRefreshResponse> {
    if (this.isConnectedFlag && this.tokenInfo) {
      return UnifiedResponseHelper.createSuccessResponse(
        'Shoonya tokens do not require refresh',
        'ACTIVE',
        'DIRECT_AUTH',
        this.accountInfo || undefined,
        this.tokenInfo || undefined
      ) as UnifiedTokenRefreshResponse;
    }

    return UnifiedResponseHelper.createErrorResponse(
      'No active Shoonya session to refresh',
      'AUTH_FAILED',
      'INACTIVE',
      'REAUTH_REQUIRED'
    ) as UnifiedTokenRefreshResponse;
  }

  /**
   * Validate current Shoonya session
   */
  async validateSession(credentials: any): Promise<UnifiedValidationResponse> {
    if (!this.isConnectedFlag || !this.tokenInfo) {
      return {
        isValid: false,
        accountStatus: 'INACTIVE',
        message: 'No active Shoonya session',
        errorType: 'AUTH_FAILED'
      };
    }

    try {
      // For Shoonya, we can validate by making a simple API call
      // Since tokens don't expire, if we have a connection, it should be valid
      const shoonyaCredentials = credentials as ShoonyaCredentials;
      const isValid = await this.shoonyaService.validateSession(shoonyaCredentials.userId);
      
      if (isValid) {
        return {
          isValid: true,
          accountStatus: 'ACTIVE',
          message: 'Shoonya session is valid',
          tokenInfo: this.tokenInfo
        };
      } else {
        // Session is no longer valid, reset state
        this.isConnectedFlag = false;
        this.accountInfo = null;
        this.tokenInfo = null;
        
        return {
          isValid: false,
          accountStatus: 'INACTIVE',
          message: 'Shoonya session has expired',
          errorType: 'TOKEN_EXPIRED'
        };
      }
    } catch (error: any) {
      console.error('🚨 Shoonya session validation error:', error);
      
      return {
        isValid: false,
        accountStatus: 'INACTIVE',
        message: 'Failed to validate Shoonya session',
        errorType: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Disconnect from Shoonya
   */
  async disconnect(): Promise<boolean> {
    try {
      if (this.isConnectedFlag) {
        await this.shoonyaService.logout();
      }
      
      // Reset all state
      this.isConnectedFlag = false;
      this.accountInfo = null;
      this.tokenInfo = null;
      this.currentCredentials = null;
      
      console.log('✅ Shoonya disconnected successfully');
      return true;
    } catch (error: any) {
      console.error('🚨 Shoonya disconnect error:', error);
      
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
    return this.isConnectedFlag;
  }

  /**
   * Get current account status
   */
  getAccountStatus(): AccountStatus {
    if (!this.isConnectedFlag) {
      return 'INACTIVE';
    }
    
    // Shoonya tokens don't expire, so if connected, always active
    return 'ACTIVE';
  }

  // Trading operations - delegate to existing service
  async placeOrder(orderRequest: any): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }

    // Transform unified order request to Shoonya format
    const shoonyaOrderRequest = {
      userId: this.accountInfo?.accountId || '',
      buyOrSell: orderRequest.action === 'BUY' ? 'B' as const : 'S' as const,
      productType: this.mapProductType(orderRequest.productType),
      exchange: orderRequest.exchange || 'NSE',
      tradingSymbol: orderRequest.symbol, // Map symbol to tradingSymbol
      quantity: orderRequest.quantity,
      discloseQty: 0,
      priceType: this.mapOrderType(orderRequest.orderType),
      price: orderRequest.price || 0,
      triggerPrice: orderRequest.triggerPrice || 0,
      retention: orderRequest.validity || 'DAY',
      amo: 'NO' as const,
      remarks: orderRequest.remarks || 'Order via CopyTrade Pro'
    };

    try {
      const shoonyaResponse = await this.shoonyaService.placeOrder(shoonyaOrderRequest);

      // Transform Shoonya response to unified format
      if (shoonyaResponse.stat === 'Ok') {
        return {
          success: true,
          message: 'Order placed successfully',
          data: {
            brokerOrderId: shoonyaResponse.norenordno,
            orderId: shoonyaResponse.norenordno,
            status: 'PLACED'
          }
        };
      } else {
        return {
          success: false,
          message: shoonyaResponse.emsg || 'Order placement failed',
          data: null
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Order placement failed',
        data: null
      };
    }
  }

  private mapProductType(productType: string): string {
    const mapping: { [key: string]: string } = {
      'CNC': 'C',
      'MIS': 'M',
      'NRML': 'M',
      'BO': 'B',
      'CO': 'H'
    };
    return mapping[productType] || 'C'; // Default to CNC
  }

  private mapOrderType(orderType: string): 'LMT' | 'MKT' | 'SL-LMT' | 'SL-MKT' {
    const mapping: { [key: string]: 'LMT' | 'MKT' | 'SL-LMT' | 'SL-MKT' } = {
      'MARKET': 'MKT',
      'LIMIT': 'LMT',
      'SL-LIMIT': 'SL-LMT',
      'SL-MARKET': 'SL-MKT'
    };
    return mapping[orderType] || 'MKT'; // Default to MARKET
  }

  async getOrderStatus(accountId: string, orderId: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    return this.shoonyaService.getOrderStatus(accountId, orderId);
  }

  async getOrderHistory(accountId: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    // Use getOrderBook as Shoonya doesn't have separate getOrderHistory
    return this.shoonyaService.getOrderBook(accountId);
  }

  async getPositions(accountId: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    return this.shoonyaService.getPositions(accountId);
  }

  async getQuote(symbol: string, exchange: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    // For Shoonya, we need token instead of symbol, this is a simplified implementation
    return this.shoonyaService.getQuotes(exchange, symbol);
  }

  async searchSymbols(query: string, exchange: string): Promise<any> {
    if (!this.isConnectedFlag) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }
    // Use searchScrip method from ShoonyaService
    return this.shoonyaService.searchScrip(exchange, query);
  }
}

/**
 * Derivatives-enabled Shoonya Service
 * Extends DerivativesBrokerService with Shoonya-specific derivatives trading capabilities
 */
export class ShoonyaDerivativesService extends DerivativesBrokerService {
  private unifiedService: UnifiedShoonyaService;

  constructor() {
    super('shoonya');
    this.unifiedService = new UnifiedShoonyaService();
  }

  // Delegate base broker methods to unified service
  async login(credentials: any): Promise<any> {
    const result = await this.unifiedService.connect(credentials);
    if (result.success) {
      this.setConnected(true, this.unifiedService.getAccountInfo()?.accountId);
    }
    return {
      success: result.success,
      message: result.message,
      data: result.data
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
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }

    try {
      console.log(`🔄 Fetching option chain for ${underlying} from Shoonya...`);
      
      // Search for option symbols using Shoonya's search API
      const searchQuery = underlying.toUpperCase();
      const symbols = await this.unifiedService.searchSymbols(searchQuery, 'NFO'); // NFO for derivatives
      
      // Filter option symbols (Shoonya format: NIFTY24DEC22000CE, NIFTY24DEC22000PE)
      const optionSymbols = symbols.filter((symbol: any) => 
        symbol.tsym && (symbol.tsym.includes('CE') || symbol.tsym.includes('PE'))
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
      for (const symbolData of optionSymbols.slice(0, 50)) { // Limit to 50 symbols
        try {
          const quote = await this.unifiedService.getQuote(symbolData.token, 'NFO');
          const contract = this.parseOptionContract(quote, symbolData, underlying);
          
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
        } catch (error) {
          console.warn(`Failed to get quote for ${symbolData.tsym}:`, error);
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
      console.error('🚨 Failed to fetch Shoonya option chain:', error);
      throw new Error(`Failed to fetch option chain: ${error.message}`);
    }
  }

  /**
   * Get futures chain for an underlying asset
   */
  async getFuturesChain(underlying: string): Promise<FuturesChain> {
    if (!this.isLoggedIn()) {
      throw new Error('Not connected to Shoonya. Please authenticate first.');
    }

    try {
      console.log(`🔄 Fetching futures chain for ${underlying} from Shoonya...`);
      
      // Search for futures symbols
      const searchQuery = underlying.toUpperCase();
      const symbols = await this.unifiedService.searchSymbols(searchQuery, 'NFO');
      
      // Filter futures symbols (typically contain FUT or month codes)
      const futuresSymbols = symbols.filter((symbol: any) => 
        symbol.tsym && (symbol.tsym.includes('FUT') || this.isFuturesSymbol(symbol.tsym))
      );

      if (futuresSymbols.length === 0) {
        throw new Error(`No futures contracts found for ${underlying}`);
      }

      const contracts: FuturesContract[] = [];

      // Get quotes for futures symbols
      for (const symbolData of futuresSymbols.slice(0, 10)) { // Limit to 10 contracts
        try {
          const quote = await this.unifiedService.getQuote(symbolData.token, 'NFO');
          const contract = this.parseFuturesContract(quote, symbolData, underlying);
          if (contract) {
            contracts.push(contract);
          }
        } catch (error) {
          console.warn(`Failed to get quote for ${symbolData.tsym}:`, error);
        }
      }

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
      console.error('🚨 Failed to fetch Shoonya futures chain:', error);
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
        exchange: orderRequest.exchange || 'NFO', // Default to NFO for derivatives
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
        exchange: orderRequest.exchange || 'NFO', // Default to NFO for derivatives
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
    // Simplified margin calculation for Shoonya
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
    // For Shoonya, assume derivatives are enabled by default
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

  private parseOptionContract(quote: any, symbolData: any, underlying: string): OptionContract | null {
    try {
      const symbol = symbolData.tsym;
      const price = quote.lp || quote.c || 0;
      const bid = quote.bp1 || price * 0.995;
      const ask = quote.sp1 || price * 1.005;
      
      // Extract option details from Shoonya symbol format
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
        volume: quote.v || 0,
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

  private parseFuturesContract(quote: any, symbolData: any, underlying: string): FuturesContract | null {
    try {
      const symbol = symbolData.tsym;
      const price = quote.lp || quote.c || 0;
      
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
        bid: quote.bp1 || price * 0.999,
        ask: quote.sp1 || price * 1.001,
        volume: quote.v || 0,
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
    // Parse Shoonya option symbols (e.g., NIFTY24DEC22000CE, NIFTY24DEC22000PE)
    const isCall = symbol.includes('CE');
    const isPut = symbol.includes('PE');
    
    if (!isCall && !isPut) return null;

    // Extract strike price
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
    // Simplified parsing for Shoonya futures symbols
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
      return quote?.lp || quote?.c || 0;
    } catch {
      return 0;
    }
  }

  private isFuturesSymbol(symbol: string): boolean {
    return symbol.includes('FUT') || /\d{2}[A-Z]{3}\d{2}/.test(symbol);
  }

  private isOptionPosition(position: any): boolean {
    return position.tsym && (position.tsym.includes('CE') || position.tsym.includes('PE'));
  }

  private isFuturesPosition(position: any): boolean {
    return position.tsym && (position.tsym.includes('FUT') || this.isFuturesSymbol(position.tsym));
  }

  private isDerivativeOrder(order: any): boolean {
    return this.isOptionPosition(order) || this.isFuturesPosition(order);
  }

  private convertToOptionPosition(position: any): OptionPosition {
    const optionDetails = this.extractOptionDetails(position.tsym);
    
    return {
      id: position.uid || `${position.tsym}_${Date.now()}`,
      brokerId: 'shoonya',
      symbol: position.tsym,
      underlying: position.underlying || 'NIFTY',
      positionType: position.netqty > 0 ? 'long' : 'short',
      quantity: Math.abs(position.netqty || position.quantity || 0),
      avgPrice: position.netavgprc || position.averagePrice || 0,
      currentPrice: position.lp || position.currentPrice || 0,
      unrealizedPnL: position.urmtom || 0,
      realizedPnL: position.rpnl || 0,
      totalPnL: (position.urmtom || 0) + (position.rpnl || 0),
      positionValue: Math.abs(position.netqty || 0) * (position.lp || 0),
      marginUsed: 0,
      entryDate: new Date(),
      lastUpdated: new Date(),
      optionType: optionDetails?.type || 'call',
      strike: optionDetails?.strike || 0,
      expiryDate: optionDetails?.expiry || new Date(),
      premium: position.netavgprc || 0,
      greeks: this.calculateGreeks(position.lp || 0, optionDetails?.strike || 0, ''),
      impliedVolatility: 0.2,
      timeValue: 0,
      intrinsicValue: 0,
      daysToExpiry: 30
    };
  }

  private convertToFuturesPosition(position: any): FuturesPosition {
    const futuresDetails = this.extractFuturesDetails(position.tsym);
    
    return {
      id: position.uid || `${position.tsym}_${Date.now()}`,
      brokerId: 'shoonya',
      symbol: position.tsym,
      underlying: position.underlying || 'NIFTY',
      positionType: position.netqty > 0 ? 'long' : 'short',
      quantity: Math.abs(position.netqty || position.quantity || 0),
      avgPrice: position.netavgprc || position.averagePrice || 0,
      currentPrice: position.lp || position.currentPrice || 0,
      unrealizedPnL: position.urmtom || 0,
      realizedPnL: position.rpnl || 0,
      totalPnL: (position.urmtom || 0) + (position.rpnl || 0),
      positionValue: Math.abs(position.netqty || 0) * (position.lp || 0),
      marginUsed: 0,
      entryDate: new Date(),
      lastUpdated: new Date(),
      expiryDate: futuresDetails?.expiry || new Date(),
      contractSize: futuresDetails?.lotSize || 50,
      initialMargin: 0,
      maintenanceMargin: 0,
      markToMarket: position.urmtom || 0,
      settlementPrice: position.lp || 0,
      multiplier: futuresDetails?.lotSize || 50
    };
  }

  private convertToDerivativeOrder(order: any): DerivativeOrder {
    return {
      id: order.norenordno || order.orderId,
      brokerId: 'shoonya',
      symbol: order.tsym,
      underlying: order.underlying || 'NIFTY',
      orderType: this.mapToDerivativeOrderType(order.prctyp || order.orderType),
      transactionType: order.trantype === 'B' || order.trantype === 'BUY' ? 'buy' : 'sell',
      quantity: Math.abs(order.qty || order.quantity || 0),
      price: order.prc || order.price,
      stopPrice: order.trgprc || order.triggerPrice,
      status: this.mapOrderStatus(order.status),
      filledQuantity: order.fillshares || order.filledQuantity || 0,
      avgFillPrice: order.avgprc || order.averagePrice || 0,
      timestamp: new Date(order.norentm || order.timestamp || Date.now())
    };
  }

  private mapToDerivativeOrderType(orderType: string): 'market' | 'limit' | 'stop_loss' | 'stop_limit' {
    const mapping: { [key: string]: 'market' | 'limit' | 'stop_loss' | 'stop_limit' } = {
      'MKT': 'market',
      'LMT': 'limit',
      'SL-LMT': 'stop_limit',
      'SL-MKT': 'stop_loss'
    };
    return mapping[orderType] || 'market';
  }

  private mapOrderStatus(status: string): 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial' {
    const mapping: { [key: string]: 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial' } = {
      'OPEN': 'pending',
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
