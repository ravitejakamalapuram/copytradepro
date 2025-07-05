// Temporary types for standalone plugin build
// These will be replaced with imports from @copytradepro/unified-trading-api

export enum BrokerType {
  SHOONYA = 'shoonya',
  FYERS = 'fyers'
}

export enum Exchange {
  NSE = 'NSE',
  BSE = 'BSE',
  NFO = 'NFO',
  BFO = 'BFO'
}

export enum ProductType {
  DELIVERY = 'DELIVERY',
  INTRADAY = 'INTRADAY',
  MARGIN = 'MARGIN',
  COVER_ORDER = 'COVER_ORDER',
  BRACKET_ORDER = 'BRACKET_ORDER'
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

export enum OrderStatus {
  PENDING = 'PENDING',
  OPEN = 'OPEN',
  COMPLETE = 'COMPLETE',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'
}

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
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  message: string;
  authUrl?: string;
  requiresAuthCode?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  timestamp: Date;
}

export interface UserProfile {
  userId: string;
  userName: string;
  email: string;
  broker: BrokerType;
  exchanges: Exchange[];
  products: ProductType[];
  isActive: boolean;
}

export interface OrderRequest {
  symbol: string;
  exchange: Exchange;
  orderType: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  productType: ProductType;
  validity?: string;
}

export interface Order {
  orderId: string;
  symbol: string;
  exchange: Exchange;
  orderType: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  productType: ProductType;
  status: OrderStatus;
  filledQuantity: number;
  timestamp: Date;
  broker: BrokerType;
}

export interface Position {
  symbol: string;
  exchange: Exchange;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  productType: ProductType;
  broker: BrokerType;
}

export interface Holding {
  symbol: string;
  exchange: Exchange;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  broker: BrokerType;
}

export interface Quote {
  symbol: string;
  exchange: Exchange;
  lastPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

export interface MarketDepth {
  symbol: string;
  exchange: Exchange;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  timestamp: Date;
}

// Plugin interfaces
export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  brokerType: BrokerType;
  supportedFeatures: {
    authentication: string[];
    orderTypes: string[];
    exchanges: string[];
    products: string[];
    realTimeData: boolean;
    historicalData: boolean;
    optionsTrading: boolean;
    commoditiesTrading: boolean;
  };
  dependencies?: {
    [packageName: string]: string;
  };
  peerDependencies?: {
    [packageName: string]: string;
  };
}

export interface PluginStatus {
  isLoaded: boolean;
  isInitialized: boolean;
  isHealthy: boolean;
  lastHealthCheck: Date;
  errorCount: number;
  lastError?: Error;
  uptime: number;
}

export interface PluginConfig {
  enabled: boolean;
  autoStart: boolean;
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  customSettings?: {
    [key: string]: any;
  };
}

export interface IBrokerAdapter {
  // Broker identification
  getBrokerType(): BrokerType;
  getBrokerName(): string;
  isAuthenticated(): boolean;

  // Authentication
  authenticate(credentials: BrokerCredentials): Promise<AuthResult>;
  refreshAuth(): Promise<AuthResult>;
  logout(): Promise<ApiResponse>;
  getUserProfile(): Promise<ApiResponse<UserProfile>>;

  // Order management
  placeOrder(orderRequest: OrderRequest): Promise<ApiResponse<Order>>;
  modifyOrder(orderId: string, modifications: Partial<OrderRequest>): Promise<ApiResponse<Order>>;
  cancelOrder(orderId: string): Promise<ApiResponse>;
  getOrder(orderId: string): Promise<ApiResponse<Order>>;
  getOrders(filters?: any): Promise<ApiResponse<Order[]>>;

  // Portfolio management
  getPositions(): Promise<ApiResponse<Position[]>>;
  getHoldings(): Promise<ApiResponse<Holding[]>>;
  getAccountBalance(): Promise<ApiResponse<any>>;

  // Market data
  getQuote(symbol: string, exchange: string): Promise<ApiResponse<Quote>>;
  getQuotes(symbols: Array<{ symbol: string; exchange: string }>): Promise<ApiResponse<Quote[]>>;
  getMarketDepth(symbol: string, exchange: string): Promise<ApiResponse<MarketDepth>>;
  searchSymbols(query: string, exchange?: string): Promise<ApiResponse<any[]>>;

  // WebSocket / Real-time data
  subscribeToQuotes(symbols: Array<{ symbol: string; exchange: string }>): Promise<ApiResponse>;
  unsubscribeFromQuotes(symbols: Array<{ symbol: string; exchange: string }>): Promise<ApiResponse>;
  subscribeToOrderUpdates(): Promise<ApiResponse>;

  // Event handlers
  onQuoteUpdate(callback: (quote: Quote) => void): void;
  onOrderUpdate(callback: (order: Order) => void): void;
  onError(callback: (error: Error) => void): void;
  onConnectionStatusChange(callback: (status: 'connected' | 'disconnected' | 'reconnecting') => void): void;

  // Utility methods
  validateOrder(orderRequest: OrderRequest): Promise<ApiResponse<any>>;
  getConfiguration(): any;
  getStatus(): Promise<ApiResponse<any>>;
}

export interface IBrokerPlugin {
  getMetadata(): PluginMetadata;
  getConfig(): PluginConfig;
  updateConfig(config: Partial<PluginConfig>): void;
  initialize(brokerConfig: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;
  restart(): Promise<void>;
  getAdapter(): IBrokerAdapter;
  createAdapter(): IBrokerAdapter;
  isHealthy(): boolean;
  getStatus(): PluginStatus;
  performHealthCheck(): Promise<boolean>;
  getMetrics(): any;
  onError(callback: (error: Error) => void): void;
  onStatusChange(callback: (status: PluginStatus) => void): void;
  onMetricsUpdate(callback: (metrics: any) => void): void;
  validateConfig(config: any): { isValid: boolean; errors: string[]; warnings: string[] };
  validateDependencies(): { isValid: boolean; missing: string[]; incompatible: string[] };
  getCapabilities(): any;
  getVersionInfo(): any;
  exportConfig(): string;
  importConfig(configString: string): boolean;
  reset(): Promise<void>;
}

export interface IBrokerPluginFactory {
  createPlugin(config?: any): IBrokerPlugin;
  getSupportedBrokers(): BrokerType[];
  isCompatible(apiVersion: string): boolean;
}
