/**
 * Unified Broker Adapter Interface
 * All broker implementations must implement this interface
 */

import {
  BrokerType,
  BrokerCredentials,
  AuthResult,
  UserProfile,
  OrderRequest,
  Order,
  Position,
  Holding,
  Quote,
  MarketDepth,
  ApiResponse
} from '../types';

export interface IBrokerAdapter {
  // ============================================================================
  // BROKER IDENTIFICATION
  // ============================================================================
  
  /**
   * Get the broker type
   */
  getBrokerType(): BrokerType;
  
  /**
   * Get the broker display name
   */
  getBrokerName(): string;
  
  /**
   * Check if the broker is currently authenticated
   */
  isAuthenticated(): boolean;

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================
  
  /**
   * Authenticate with the broker using credentials
   */
  authenticate(credentials: BrokerCredentials): Promise<AuthResult>;
  
  /**
   * Refresh authentication tokens if supported
   */
  refreshAuth(): Promise<AuthResult>;
  
  /**
   * Logout and clear authentication
   */
  logout(): Promise<ApiResponse>;
  
  /**
   * Get user profile information
   */
  getUserProfile(): Promise<ApiResponse<UserProfile>>;

  // ============================================================================
  // ORDER MANAGEMENT
  // ============================================================================
  
  /**
   * Place a new order
   */
  placeOrder(orderRequest: OrderRequest): Promise<ApiResponse<Order>>;
  
  /**
   * Modify an existing order
   */
  modifyOrder(orderId: string, modifications: Partial<OrderRequest>): Promise<ApiResponse<Order>>;
  
  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): Promise<ApiResponse>;
  
  /**
   * Get order details by ID
   */
  getOrder(orderId: string): Promise<ApiResponse<Order>>;
  
  /**
   * Get all orders (with optional filtering)
   */
  getOrders(filters?: {
    symbol?: string;
    status?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<ApiResponse<Order[]>>;

  // ============================================================================
  // PORTFOLIO MANAGEMENT
  // ============================================================================
  
  /**
   * Get current positions
   */
  getPositions(): Promise<ApiResponse<Position[]>>;
  
  /**
   * Get holdings
   */
  getHoldings(): Promise<ApiResponse<Holding[]>>;
  
  /**
   * Get account balance and margins
   */
  getAccountBalance(): Promise<ApiResponse<{
    cash: number;
    margin: number;
    collateral: number;
    total: number;
  }>>;

  // ============================================================================
  // MARKET DATA
  // ============================================================================
  
  /**
   * Get quote for a symbol
   */
  getQuote(symbol: string, exchange: string): Promise<ApiResponse<Quote>>;
  
  /**
   * Get quotes for multiple symbols
   */
  getQuotes(symbols: Array<{ symbol: string; exchange: string }>): Promise<ApiResponse<Quote[]>>;
  
  /**
   * Get market depth for a symbol
   */
  getMarketDepth(symbol: string, exchange: string): Promise<ApiResponse<MarketDepth>>;
  
  /**
   * Search for symbols
   */
  searchSymbols(query: string, exchange?: string): Promise<ApiResponse<Array<{
    symbol: string;
    name: string;
    exchange: string;
    instrumentType: string;
  }>>>;

  // ============================================================================
  // WEBSOCKET / REAL-TIME DATA
  // ============================================================================
  
  /**
   * Subscribe to real-time quotes
   */
  subscribeToQuotes(symbols: Array<{ symbol: string; exchange: string }>): Promise<ApiResponse>;
  
  /**
   * Unsubscribe from real-time quotes
   */
  unsubscribeFromQuotes(symbols: Array<{ symbol: string; exchange: string }>): Promise<ApiResponse>;
  
  /**
   * Subscribe to order updates
   */
  subscribeToOrderUpdates(): Promise<ApiResponse>;
  
  /**
   * Set callback for real-time quote updates
   */
  onQuoteUpdate(callback: (quote: Quote) => void): void;
  
  /**
   * Set callback for order updates
   */
  onOrderUpdate(callback: (order: Order) => void): void;

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Validate order request before placing
   */
  validateOrder(orderRequest: OrderRequest): Promise<ApiResponse<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>>;
  
  /**
   * Get broker-specific configuration
   */
  getConfiguration(): {
    features: {
      supportsWebSocket: boolean;
      supportsMarketData: boolean;
      supportsOptions: boolean;
      supportsCommodities: boolean;
      supportsRefreshToken: boolean;
    };
    limits: {
      maxOrdersPerSecond: number;
      maxPositions: number;
      maxOrderValue: number;
    };
  };
  
  /**
   * Get broker status and health
   */
  getStatus(): Promise<ApiResponse<{
    isOnline: boolean;
    lastHeartbeat: Date;
    latency: number;
    marketStatus: 'OPEN' | 'CLOSED' | 'PRE_OPEN' | 'POST_CLOSE';
  }>>;

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================
  
  /**
   * Set error callback for handling broker-specific errors
   */
  onError(callback: (error: Error) => void): void;
  
  /**
   * Set callback for connection status changes
   */
  onConnectionStatusChange(callback: (status: 'connected' | 'disconnected' | 'reconnecting') => void): void;
}
