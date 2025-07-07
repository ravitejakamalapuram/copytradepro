/**
 * Unified Trading API Types
 * Standardized interfaces for all broker implementations
 */

// ============================================================================
// BROKER TYPES
// ============================================================================

export enum BrokerType {
  SHOONYA = 'shoonya',
  FYERS = 'fyers',
  ZERODHA = 'zerodha',
  ANGEL = 'angel',
  UPSTOX = 'upstox',
  IIFL = 'iifl'
}

export enum Exchange {
  NSE = 'NSE',
  BSE = 'BSE',
  NFO = 'NFO',
  BFO = 'BFO',
  MCX = 'MCX'
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_LOSS = 'STOP_LOSS',
  STOP_LOSS_MARKET = 'STOP_LOSS_MARKET'
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum ProductType {
  DELIVERY = 'DELIVERY',
  INTRADAY = 'INTRADAY',
  MARGIN = 'MARGIN',
  COVER_ORDER = 'COVER_ORDER',
  BRACKET_ORDER = 'BRACKET_ORDER'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  OPEN = 'OPEN',
  COMPLETE = 'COMPLETE',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  MODIFIED = 'MODIFIED'
}

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface BrokerCredentials {
  [key: string]: any;
}

export interface ShoonyaCredentials extends BrokerCredentials {
  userId: string;
  password: string;
  vendorCode: string;
  apiKey: string;
  imei: string;
  totpSecret?: string;
}

export interface FyersCredentials extends BrokerCredentials {
  clientId: string;
  secretKey: string;
  redirectUri: string;
  authCode?: string;
}

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  message: string;
  profile?: UserProfile;
  requiresAuth?: boolean;
  authUrl?: string;
}

// ============================================================================
// USER PROFILE
// ============================================================================

export interface UserProfile {
  userId: string;
  userName: string;
  email: string;
  broker: BrokerType;
  exchanges: Exchange[];
  products: ProductType[];
  isActive: boolean;
}

// ============================================================================
// TRADING TYPES
// ============================================================================

export interface OrderRequest {
  symbol: string;
  exchange: Exchange;
  orderType: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
  productType: ProductType;
  validity?: 'DAY' | 'IOC' | 'GTD';
  disclosedQuantity?: number;
  triggerPrice?: number;
  tag?: string;
}

export interface Order {
  orderId: string;
  symbol: string;
  exchange: Exchange;
  orderType: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
  productType: ProductType;
  status: OrderStatus;
  filledQuantity: number;
  averagePrice?: number;
  timestamp: Date;
  message?: string;
  tag?: string;
  broker: BrokerType;
}

export interface Position {
  symbol: string;
  exchange: Exchange;
  productType: ProductType;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  pnlPercentage: number;
  broker: BrokerType;
}

export interface Holding {
  symbol: string;
  exchange: Exchange;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  pnlPercentage: number;
  broker: BrokerType;
}

// ============================================================================
// MARKET DATA TYPES
// ============================================================================

export interface Quote {
  symbol: string;
  exchange: Exchange;
  lastPrice: number;
  change: number;
  changePercentage: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  timestamp: Date;
}

export interface DepthData {
  price: number;
  quantity: number;
  orders: number;
}

export interface MarketDepth {
  symbol: string;
  exchange: Exchange;
  bids: DepthData[];
  asks: DepthData[];
  timestamp: Date;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface BrokerConfig {
  type: BrokerType;
  name: string;
  credentials: BrokerCredentials;
  endpoints: {
    auth: string;
    orders: string;
    positions: string;
    holdings: string;
    quotes: string;
    websocket?: string;
  };
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
}

export interface UnifiedTradingConfig {
  brokers: BrokerConfig[];
  defaultBroker?: BrokerType;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  retryAttempts: number;
  timeout: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
  broker?: BrokerType;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class UnifiedTradingError extends Error {
  constructor(
    message: string,
    public broker: BrokerType,
    public code?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'UnifiedTradingError';
  }
}

export class AuthenticationError extends UnifiedTradingError {
  constructor(message: string, broker: BrokerType, originalError?: any) {
    super(message, broker, 'AUTH_ERROR', originalError);
    this.name = 'AuthenticationError';
  }
}

export class OrderError extends UnifiedTradingError {
  constructor(message: string, broker: BrokerType, originalError?: any) {
    super(message, broker, 'ORDER_ERROR', originalError);
    this.name = 'OrderError';
  }
}

export class RateLimitError extends UnifiedTradingError {
  constructor(message: string, broker: BrokerType, originalError?: any) {
    super(message, broker, 'RATE_LIMIT_ERROR', originalError);
    this.name = 'RateLimitError';
  }
}
