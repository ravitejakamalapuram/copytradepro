/**
 * Generic Broker Service Interface
 * This interface defines the contract that all broker services must implement
 * to eliminate hardcoded broker-specific checks throughout the codebase
 *
 * NOTE: This interface is being deprecated in favor of IUnifiedBrokerService
 * which provides standardized responses and better business logic encapsulation
 */

export interface BrokerCredentials {
  [key: string]: any;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  data?: any;
  // Broker-specific fields can be added to data
}

export interface OrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  price?: number;
  triggerPrice?: number;
  exchange: string;
  productType: string;
  validity: 'DAY' | 'IOC' | 'GTD';
  remarks?: string;
  accountId?: string; // For broker-specific account identification
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  message?: string;
  data?: any;
}

export interface OrderStatus {
  orderId: string;
  status: string;
  quantity: number;
  filledQuantity: number;
  price: number;
  averagePrice: number;
  timestamp: Date;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  exchange: string;
  productType: string;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  exchange: string;
  timestamp: Date;
}

/**
 * Abstract base class for all broker services
 * Provides common functionality and enforces interface implementation
 */
export abstract class IBrokerService {
  protected brokerName: string;
  protected isConnected: boolean = false;
  protected accountId?: string;

  constructor(brokerName: string) {
    this.brokerName = brokerName;
  }

  // Abstract methods that must be implemented by each broker
  abstract login(credentials: BrokerCredentials): Promise<LoginResponse>;
  abstract logout(): Promise<boolean>;
  abstract validateSession(accountId?: string): Promise<boolean>;
  abstract placeOrder(orderRequest: OrderRequest): Promise<OrderResponse>;
  abstract getOrderStatus(accountId: string, orderId: string): Promise<OrderStatus>;
  abstract getOrderHistory(accountId: string): Promise<OrderStatus[]>;
  abstract getPositions(accountId: string): Promise<Position[]>;
  abstract getQuote(symbol: string, exchange: string): Promise<Quote>;
  abstract searchSymbols(query: string, exchange: string): Promise<any[]>;

  // Common methods with default implementations
  getBrokerName(): string {
    return this.brokerName;
  }

  isLoggedIn(): boolean {
    return this.isConnected;
  }

  getAccountId(): string | undefined {
    return this.accountId;
  }

  protected setConnected(connected: boolean, accountId?: string): void {
    this.isConnected = connected;
    if (accountId) {
      this.accountId = accountId;
    }
  }

  // Helper method to standardize error responses
  protected createErrorResponse(message: string, error?: any): LoginResponse | OrderResponse {
    return {
      success: false,
      message,
      data: error
    };
  }

  // Helper method to standardize success responses
  protected createSuccessResponse(message: string, data?: any): LoginResponse | OrderResponse {
    return {
      success: true,
      message,
      data
    };
  }
}

/**
 * Broker Factory Interface
 * Defines how broker instances should be created
 */
export interface IBrokerFactory {
  createBroker(brokerName: string): IBrokerService;
  getSupportedBrokers(): string[];
  isBrokerSupported(brokerName: string): boolean;
}
