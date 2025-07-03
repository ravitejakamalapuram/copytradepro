/**
 * Fyers Helper Module
 * 
 * Utility functions for Fyers broker integration including symbol formatting,
 * order type mapping, data transformation, and error handling.
 * 
 * This module is isolated to contain only Fyers-specific logic and should not
 * affect any Shoonya workflows or common application logic.
 */

// Fyers-specific interfaces for data transformation
export interface FyersSymbolInfo {
  symbol: string;
  exchange: string;
  token: string;
  lotSize: number;
  tickSize: number;
  instrumentType: string;
}

export interface FyersOrderData {
  symbol: string;
  qty: number;
  type: number; // 1=LIMIT, 2=MARKET, 3=SL, 4=SL-M
  side: number; // 1=BUY, -1=SELL
  productType: string;
  limitPrice: number;
  stopPrice: number;
  disclosedQty: number;
  validity: string;
  offlineOrder: boolean;
  stopLoss: number;
  takeProfit: number;
}

export interface FyersOrderResponse {
  s: string; // status: 'ok' or 'error'
  code: number;
  message: string;
  id?: string; // order ID
}

/**
 * Symbol Formatting Utilities
 */
export class FyersSymbolHelper {
  
  /**
   * Format symbol for Fyers API (e.g., "TCS" -> "NSE:TCS-EQ")
   */
  static formatSymbolForFyers(symbol: string, exchange: string): string {
    // Remove any existing exchange prefix
    const cleanSymbol = symbol.replace(/^(NSE|BSE):/i, '');
    
    // For equity symbols, add -EQ suffix if not present
    let formattedSymbol = cleanSymbol;
    if (exchange.toUpperCase() === 'NSE' && !cleanSymbol.includes('-')) {
      formattedSymbol = `${cleanSymbol}-EQ`;
    }
    
    return `${exchange.toUpperCase()}:${formattedSymbol}`;
  }

  /**
   * Extract symbol from Fyers format (e.g., "NSE:TCS-EQ" -> "TCS")
   */
  static extractSymbolFromFyers(fyersSymbol: string): { symbol: string; exchange: string } {
    const parts = fyersSymbol.split(':');
    if (parts.length !== 2) {
      throw new Error(`Invalid Fyers symbol format: ${fyersSymbol}`);
    }

    const exchange = parts[0];
    const symbolPart = parts[1];

    if (!exchange || !symbolPart) {
      throw new Error(`Invalid Fyers symbol format: ${fyersSymbol}`);
    }

    // Remove -EQ suffix for equity symbols
    const symbol = symbolPart.replace(/-EQ$/, '');

    return { symbol, exchange };
  }

  /**
   * Convert search results from Fyers to common format
   */
  static transformFyersSearchResults(fyersResults: any[]): any[] {
    return fyersResults.map(result => ({
      symbol: result.symbol_details?.symbol || result.symbol,
      token: result.symbol_details?.fyToken || result.fyToken,
      exchange: result.symbol_details?.exchange || result.exchange,
      description: result.symbol_details?.description || result.description,
      lotSize: result.symbol_details?.minimum_lot_size || result.minimum_lot_size || 1,
      tickSize: result.symbol_details?.tick_size || result.tick_size || 0.05,
      instrumentType: result.symbol_details?.instrument_type || result.instrument_type,
      // Add Fyers-specific identifier
      fyersSymbol: result.symbol_details?.symbol || result.symbol,
      source: 'fyers'
    }));
  }
}

/**
 * Order Type and Product Type Mapping
 */
export class FyersOrderHelper {
  
  // Order type mapping: Application format -> Fyers format
  private static readonly ORDER_TYPE_MAP = {
    'MARKET': 2,
    'MKT': 2,
    'LIMIT': 1,
    'LMT': 1,
    'SL': 3,
    'SL-LIMIT': 3,
    'SL-LMT': 3,
    'SL-MARKET': 4,
    'SL-MKT': 4
  };

  // Reverse mapping: Fyers format -> Application format
  private static readonly REVERSE_ORDER_TYPE_MAP = {
    1: 'LIMIT',
    2: 'MARKET',
    3: 'SL-LIMIT',
    4: 'SL-MARKET'
  };

  // Product type mapping: Application format -> Fyers format
  private static readonly PRODUCT_TYPE_MAP = {
    'CNC': 'CNC',
    'DELIVERY': 'CNC',
    'INTRADAY': 'INTRADAY',
    'MIS': 'INTRADAY',
    'MARGIN': 'MARGIN',
    'CO': 'CO',
    'BO': 'BO'
  };

  // Order side mapping: Application format -> Fyers format
  private static readonly ORDER_SIDE_MAP = {
    'BUY': 1,
    'B': 1,
    'SELL': -1,
    'S': -1
  };

  /**
   * Convert application order type to Fyers order type
   */
  static mapOrderType(orderType: string): number {
    const upperOrderType = orderType.toUpperCase() as keyof typeof this.ORDER_TYPE_MAP;
    const fyersType = this.ORDER_TYPE_MAP[upperOrderType];
    if (fyersType === undefined) {
      throw new Error(`Unsupported order type for Fyers: ${orderType}`);
    }
    return fyersType;
  }

  /**
   * Convert Fyers order type to application order type
   */
  static mapFyersOrderType(fyersType: number): string {
    const appType = this.REVERSE_ORDER_TYPE_MAP[fyersType as keyof typeof this.REVERSE_ORDER_TYPE_MAP];
    if (!appType) {
      throw new Error(`Unknown Fyers order type: ${fyersType}`);
    }
    return appType;
  }

  /**
   * Convert application product type to Fyers product type
   */
  static mapProductType(productType: string): string {
    const upperProductType = productType.toUpperCase() as keyof typeof this.PRODUCT_TYPE_MAP;
    const fyersProduct = this.PRODUCT_TYPE_MAP[upperProductType];
    if (!fyersProduct) {
      throw new Error(`Unsupported product type for Fyers: ${productType}`);
    }
    return fyersProduct;
  }

  /**
   * Convert application order side to Fyers order side
   */
  static mapOrderSide(side: string): number {
    const upperSide = side.toUpperCase() as keyof typeof this.ORDER_SIDE_MAP;
    const fyersSide = this.ORDER_SIDE_MAP[upperSide];
    if (fyersSide === undefined) {
      throw new Error(`Unsupported order side for Fyers: ${side}`);
    }
    return fyersSide;
  }

  /**
   * Transform application order data to Fyers order format
   */
  static transformOrderDataForFyers(orderData: any): FyersOrderData {
    return {
      symbol: FyersSymbolHelper.formatSymbolForFyers(orderData.tradingSymbol, orderData.exchange),
      qty: orderData.quantity,
      type: this.mapOrderType(orderData.priceType),
      side: this.mapOrderSide(orderData.buyOrSell),
      productType: this.mapProductType(orderData.productType),
      limitPrice: orderData.priceType === 'MARKET' ? 0 : orderData.price,
      stopPrice: orderData.triggerPrice || 0,
      disclosedQty: orderData.discloseQty || 0,
      validity: orderData.retention === 'IOC' ? 'IOC' : 'DAY',
      offlineOrder: orderData.amo === 'YES',
      stopLoss: 0,
      takeProfit: 0
    };
  }
}

/**
 * Data Transformation Utilities
 */
export class FyersDataTransformer {
  
  /**
   * Transform Fyers order book response to common format
   */
  static transformOrderBook(fyersOrderBook: any): any[] {
    if (!fyersOrderBook || !Array.isArray(fyersOrderBook.orderBook)) {
      return [];
    }

    return fyersOrderBook.orderBook.map((order: any) => ({
      orderId: order.id,
      symbol: order.symbol,
      quantity: order.qty,
      price: order.limitPrice || order.price,
      orderType: FyersOrderHelper.mapFyersOrderType(order.type),
      side: order.side === 1 ? 'BUY' : 'SELL',
      status: this.mapFyersOrderStatus(order.status),
      exchange: order.exchange,
      productType: order.productType,
      timestamp: order.orderDateTime,
      // Keep original Fyers data for reference
      originalData: order,
      source: 'fyers'
    }));
  }

  /**
   * Transform Fyers positions response to common format
   */
  static transformPositions(fyersPositions: any): any[] {
    if (!fyersPositions || !Array.isArray(fyersPositions.netPositions)) {
      return [];
    }

    return fyersPositions.netPositions.map((position: any) => ({
      symbol: position.symbol,
      quantity: position.qty,
      averagePrice: position.avgPrice,
      currentPrice: position.ltp || position.marketPrice,
      pnl: position.pnl,
      pnlPercent: position.pnlPercent,
      side: position.side,
      productType: position.productType,
      exchange: position.exchange,
      // Keep original Fyers data for reference
      originalData: position,
      source: 'fyers'
    }));
  }

  /**
   * Transform Fyers quotes response to common format
   */
  static transformQuotes(fyersQuotes: any): any {
    if (!fyersQuotes || !fyersQuotes.d) {
      return null;
    }

    const quote = Array.isArray(fyersQuotes.d) ? fyersQuotes.d[0] : fyersQuotes.d;
    
    return {
      symbol: quote.n,
      ltp: quote.v?.lp || quote.lp,
      open: quote.v?.o || quote.o,
      high: quote.v?.h || quote.h,
      low: quote.v?.l || quote.l,
      close: quote.v?.c || quote.c,
      volume: quote.v?.v || quote.v,
      change: quote.v?.ch || quote.ch,
      changePercent: quote.v?.chp || quote.chp,
      // Keep original Fyers data for reference
      originalData: quote,
      source: 'fyers'
    };
  }

  /**
   * Map Fyers order status to common format
   */
  private static mapFyersOrderStatus(fyersStatus: number): string {
    const statusMap: { [key: number]: string } = {
      1: 'PENDING',
      2: 'PLACED',
      3: 'PARTIALLY_FILLED',
      4: 'EXECUTED',
      5: 'CANCELLED',
      6: 'REJECTED'
    };
    
    return statusMap[fyersStatus] || 'UNKNOWN';
  }
}

/**
 * Error Handling Utilities
 */
export class FyersErrorHandler {
  
  /**
   * Transform Fyers API error to common error format
   */
  static transformError(error: any): Error {
    if (error.response && error.response.data) {
      const fyersError = error.response.data;
      return new Error(`Fyers API Error: ${fyersError.message || fyersError.error || 'Unknown error'}`);
    }
    
    if (error.message) {
      return new Error(`Fyers Error: ${error.message}`);
    }
    
    return new Error('Unknown Fyers API error');
  }

  /**
   * Check if error is authentication related
   */
  static isAuthError(error: any): boolean {
    const authErrorCodes = [401, 403];
    const authErrorMessages = ['unauthorized', 'invalid token', 'token expired', 'authentication failed'];
    
    if (error.response && authErrorCodes.includes(error.response.status)) {
      return true;
    }
    
    const errorMessage = error.message?.toLowerCase() || '';
    return authErrorMessages.some(msg => errorMessage.includes(msg));
  }
}

/**
 * Authentication Utilities
 */
export class FyersAuthHelper {
  
  /**
   * Validate Fyers credentials format
   */
  static validateCredentials(credentials: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!credentials.clientId || typeof credentials.clientId !== 'string') {
      errors.push('Client ID is required and must be a string');
    }
    
    if (!credentials.secretKey || typeof credentials.secretKey !== 'string') {
      errors.push('Secret Key is required and must be a string');
    }
    
    if (!credentials.redirectUri || typeof credentials.redirectUri !== 'string') {
      errors.push('Redirect URI is required and must be a string');
    }
    
    // Validate Client ID format (should be like "ABC12345-100")
    if (credentials.clientId && !/^[A-Z0-9]+-\d+$/.test(credentials.clientId)) {
      errors.push('Client ID format is invalid (expected format: ABC12345-100)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate state parameter for OAuth flow
   */
  static generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
