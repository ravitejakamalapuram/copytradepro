// Import derivatives types
import {
  OptionChain,
  FuturesChain,
  DerivativeOrder,
  OptionPosition,
  FuturesPosition,
  DerivativePosition
} from '@copytrade/shared-types';

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
 * Margin information interface
 */
export interface MarginInfo {
  /** Initial margin required */
  initialMargin: number;
  /** Maintenance margin required */
  maintenanceMargin: number;
  /** Available margin */
  availableMargin: number;
  /** Margin utilization percentage */
  marginUtilization: number;
  /** Whether margin call is triggered */
  marginCall: boolean;
  /** Excess margin available */
  excessMargin: number;
}

/**
 * Trading permissions interface
 */
export interface TradingPermissions {
  /** Options trading enabled */
  optionsEnabled: boolean;
  /** Futures trading enabled */
  futuresEnabled: boolean;
  /** Commodity trading enabled */
  commodityEnabled: boolean;
  /** Currency trading enabled */
  currencyEnabled: boolean;
  /** Maximum position limits */
  positionLimits: {
    options: number;
    futures: number;
  };
}

/**
 * Derivatives order request interface
 */
export interface DerivativeOrderRequest {
  /** Instrument symbol */
  symbol: string;
  /** Transaction type */
  action: 'BUY' | 'SELL';
  /** Quantity */
  quantity: number;
  /** Order type */
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  /** Price for limit orders */
  price?: number;
  /** Trigger price for stop orders */
  triggerPrice?: number;
  /** Exchange */
  exchange: string;
  /** Product type */
  productType: string;
  /** Order validity */
  validity: 'DAY' | 'IOC' | 'GTD';
  /** Order remarks */
  remarks?: string;
  /** Account ID */
  accountId?: string;
  /** Underlying asset symbol */
  underlying?: string;
  /** Strike price for options */
  strike?: number;
  /** Expiry date */
  expiryDate?: Date;
  /** Option type for options */
  optionType?: 'call' | 'put';
}

/**
 * Extended broker service interface for derivatives trading
 * Extends the base IBrokerService with derivatives-specific methods
 */
export abstract class DerivativesBrokerService extends IBrokerService {
  
  // Options trading methods
  abstract getOptionChain(underlying: string, expiry?: Date): Promise<OptionChain>;
  abstract placeOptionOrder(orderRequest: DerivativeOrderRequest): Promise<OrderResponse>;
  abstract getOptionPositions(accountId: string): Promise<OptionPosition[]>;
  
  // Futures trading methods
  abstract getFuturesChain(underlying: string): Promise<FuturesChain>;
  abstract placeFuturesOrder(orderRequest: DerivativeOrderRequest): Promise<OrderResponse>;
  abstract getFuturesPositions(accountId: string): Promise<FuturesPosition[]>;
  
  // Margin and risk methods
  abstract calculateMargin(positions: DerivativePosition[]): Promise<MarginInfo>;
  abstract getDerivativesEligibility(accountId: string): Promise<TradingPermissions>;
  
  // Combined derivatives methods
  abstract getAllDerivativePositions(accountId: string): Promise<DerivativePosition[]>;
  abstract getDerivativeOrderHistory(accountId: string): Promise<DerivativeOrder[]>;
  
  // Utility methods for derivatives
  protected validateDerivativeOrder(orderRequest: DerivativeOrderRequest): boolean {
    // Basic validation
    if (!orderRequest.symbol || !orderRequest.action || !orderRequest.quantity) {
      return false;
    }
    
    // Validate quantity is positive
    if (orderRequest.quantity <= 0) {
      return false;
    }
    
    // Validate price for limit orders
    if (orderRequest.orderType === 'LIMIT' && (!orderRequest.price || orderRequest.price <= 0)) {
      return false;
    }
    
    // Validate trigger price for stop orders
    if ((orderRequest.orderType === 'SL-LIMIT' || orderRequest.orderType === 'SL-MARKET') && 
        (!orderRequest.triggerPrice || orderRequest.triggerPrice <= 0)) {
      return false;
    }
    
    return true;
  }
  
  protected createDerivativeErrorResponse(message: string, error?: any): OrderResponse {
    return {
      success: false,
      message: `Derivatives Error: ${message}`,
      data: error
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
