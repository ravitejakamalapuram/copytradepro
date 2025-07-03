/**
 * Unified Trading API - Main Entry Point
 * Provides a single interface to interact with multiple brokers
 */

import { EventEmitter } from 'events';
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
  ApiResponse,
  UnifiedTradingConfig,
  UnifiedTradingError
} from '../types';
import { IBrokerAdapter } from '../interfaces/IBrokerAdapter';
import { Logger } from '../utils/Logger';

export class UnifiedTradingAPI extends EventEmitter {
  private brokers: Map<BrokerType, IBrokerAdapter> = new Map();
  private activeBrokers: Set<BrokerType> = new Set();
  private config: UnifiedTradingConfig;
  private logger: Logger;

  constructor(config: UnifiedTradingConfig) {
    super();
    this.config = config;
    this.logger = new Logger(config.logLevel, config.enableLogging);
    this.logger.info('UnifiedTradingAPI initialized');
  }

  // ============================================================================
  // BROKER MANAGEMENT
  // ============================================================================

  /**
   * Register a broker adapter
   */
  registerBroker(adapter: IBrokerAdapter): void {
    const brokerType = adapter.getBrokerType();
    this.brokers.set(brokerType, adapter);
    
    // Set up event listeners
    adapter.onError((error) => {
      this.emit('brokerError', { broker: brokerType, error });
    });
    
    adapter.onConnectionStatusChange((status) => {
      this.emit('connectionStatusChange', { broker: brokerType, status });
    });
    
    adapter.onQuoteUpdate((quote) => {
      this.emit('quoteUpdate', { broker: brokerType, quote });
    });
    
    adapter.onOrderUpdate((order) => {
      this.emit('orderUpdate', { broker: brokerType, order });
    });

    this.logger.info(`Broker registered: ${adapter.getBrokerName()}`);
  }

  /**
   * Get all registered brokers
   */
  getRegisteredBrokers(): BrokerType[] {
    return Array.from(this.brokers.keys());
  }

  /**
   * Get all active (authenticated) brokers
   */
  getActiveBrokers(): BrokerType[] {
    return Array.from(this.activeBrokers);
  }

  /**
   * Check if a broker is registered
   */
  isBrokerRegistered(brokerType: BrokerType): boolean {
    return this.brokers.has(brokerType);
  }

  /**
   * Check if a broker is active
   */
  isBrokerActive(brokerType: BrokerType): boolean {
    return this.activeBrokers.has(brokerType);
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Authenticate with a specific broker
   */
  async authenticateBroker(
    brokerType: BrokerType, 
    credentials: BrokerCredentials
  ): Promise<AuthResult> {
    const adapter = this.getBrokerAdapter(brokerType);
    
    try {
      this.logger.info(`Authenticating with ${brokerType}`);
      const result = await adapter.authenticate(credentials);
      
      if (result.success) {
        this.activeBrokers.add(brokerType);
        this.emit('brokerAuthenticated', { broker: brokerType, profile: result.profile });
        this.logger.info(`Successfully authenticated with ${brokerType}`);
      } else {
        this.logger.warn(`Authentication failed for ${brokerType}: ${result.message}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Authentication error for ${brokerType}:`, error);
      throw new UnifiedTradingError(
        `Authentication failed for ${brokerType}`,
        brokerType,
        'AUTH_ERROR',
        error
      );
    }
  }

  /**
   * Authenticate with multiple brokers
   */
  async authenticateMultipleBrokers(
    credentials: Array<{ broker: BrokerType; credentials: BrokerCredentials }>
  ): Promise<Array<{ broker: BrokerType; result: AuthResult }>> {
    const results = await Promise.allSettled(
      credentials.map(({ broker, credentials }) =>
        this.authenticateBroker(broker, credentials).then(result => ({ broker, result }))
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const broker = credentials[index].broker;
        return {
          broker,
          result: {
            success: false,
            message: result.reason.message || 'Authentication failed'
          }
        };
      }
    });
  }

  /**
   * Logout from a specific broker
   */
  async logoutBroker(brokerType: BrokerType): Promise<ApiResponse> {
    const adapter = this.getBrokerAdapter(brokerType);
    
    try {
      const result = await adapter.logout();
      this.activeBrokers.delete(brokerType);
      this.emit('brokerLoggedOut', { broker: brokerType });
      this.logger.info(`Logged out from ${brokerType}`);
      return result;
    } catch (error) {
      this.logger.error(`Logout error for ${brokerType}:`, error);
      throw new UnifiedTradingError(
        `Logout failed for ${brokerType}`,
        brokerType,
        'LOGOUT_ERROR',
        error
      );
    }
  }

  /**
   * Logout from all active brokers
   */
  async logoutAll(): Promise<Array<{ broker: BrokerType; result: ApiResponse }>> {
    const logoutPromises = Array.from(this.activeBrokers).map(async (broker) => ({
      broker,
      result: await this.logoutBroker(broker)
    }));

    return Promise.allSettled(logoutPromises).then(results =>
      results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          const broker = Array.from(this.activeBrokers)[index];
          return {
            broker,
            result: {
              success: false,
              message: result.reason.message || 'Logout failed',
              timestamp: new Date()
            }
          };
        }
      })
    );
  }

  // ============================================================================
  // ORDER MANAGEMENT
  // ============================================================================

  /**
   * Place order with a specific broker
   */
  async placeOrder(
    brokerType: BrokerType, 
    orderRequest: OrderRequest
  ): Promise<ApiResponse<Order>> {
    const adapter = this.getActiveBrokerAdapter(brokerType);
    
    try {
      this.logger.info(`Placing order with ${brokerType}:`, orderRequest);
      const result = await adapter.placeOrder(orderRequest);
      
      if (result.success && result.data) {
        this.emit('orderPlaced', { broker: brokerType, order: result.data });
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Order placement error for ${brokerType}:`, error);
      throw new UnifiedTradingError(
        `Order placement failed for ${brokerType}`,
        brokerType,
        'ORDER_ERROR',
        error
      );
    }
  }

  /**
   * Place the same order across multiple brokers
   */
  async placeOrderMultipleBrokers(
    brokers: BrokerType[],
    orderRequest: OrderRequest
  ): Promise<Array<{ broker: BrokerType; result: ApiResponse<Order> }>> {
    const orderPromises = brokers.map(async (broker) => ({
      broker,
      result: await this.placeOrder(broker, orderRequest)
    }));

    return Promise.allSettled(orderPromises).then(results =>
      results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          const broker = brokers[index];
          return {
            broker,
            result: {
              success: false,
              message: result.reason.message || 'Order placement failed',
              broker,
              timestamp: new Date()
            }
          };
        }
      })
    );
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get broker adapter (throws if not registered)
   */
  private getBrokerAdapter(brokerType: BrokerType): IBrokerAdapter {
    const adapter = this.brokers.get(brokerType);
    if (!adapter) {
      throw new UnifiedTradingError(
        `Broker ${brokerType} is not registered`,
        brokerType,
        'BROKER_NOT_REGISTERED'
      );
    }
    return adapter;
  }

  /**
   * Get active broker adapter (throws if not authenticated)
   */
  private getActiveBrokerAdapter(brokerType: BrokerType): IBrokerAdapter {
    const adapter = this.getBrokerAdapter(brokerType);
    if (!this.activeBrokers.has(brokerType)) {
      throw new UnifiedTradingError(
        `Broker ${brokerType} is not authenticated`,
        brokerType,
        'BROKER_NOT_AUTHENTICATED'
      );
    }
    return adapter;
  }

  // ============================================================================
  // PORTFOLIO & MARKET DATA (Delegated to specific broker)
  // ============================================================================

  /**
   * Get positions from a specific broker
   */
  async getPositions(brokerType: BrokerType): Promise<ApiResponse<Position[]>> {
    const adapter = this.getActiveBrokerAdapter(brokerType);
    return adapter.getPositions();
  }

  /**
   * Get holdings from a specific broker
   */
  async getHoldings(brokerType: BrokerType): Promise<ApiResponse<Holding[]>> {
    const adapter = this.getActiveBrokerAdapter(brokerType);
    return adapter.getHoldings();
  }

  /**
   * Get quote from any active broker (uses first available)
   */
  async getQuote(symbol: string, exchange: string, preferredBroker?: BrokerType): Promise<ApiResponse<Quote>> {
    const brokerType = preferredBroker || this.activeBrokers.values().next().value;
    if (!brokerType) {
      throw new UnifiedTradingError('No active brokers available', BrokerType.SHOONYA, 'NO_ACTIVE_BROKERS');
    }

    const adapter = this.getActiveBrokerAdapter(brokerType);
    return adapter.getQuote(symbol, exchange);
  }

  /**
   * Get orders from a specific broker
   */
  async getOrders(brokerType: BrokerType, filters?: any): Promise<ApiResponse<Order[]>> {
    const adapter = this.getActiveBrokerAdapter(brokerType);
    return adapter.getOrders(filters);
  }

  /**
   * Cancel order from a specific broker
   */
  async cancelOrder(brokerType: BrokerType, orderId: string): Promise<ApiResponse> {
    const adapter = this.getActiveBrokerAdapter(brokerType);
    return adapter.cancelOrder(orderId);
  }

  /**
   * Get library version and info
   */
  getLibraryInfo(): {
    name: string;
    version: string;
    registeredBrokers: string[];
    activeBrokers: string[];
  } {
    return {
      name: '@copytradepro/unified-trading-api',
      version: '1.0.0',
      registeredBrokers: Array.from(this.brokers.keys()),
      activeBrokers: Array.from(this.activeBrokers)
    };
  }
}
