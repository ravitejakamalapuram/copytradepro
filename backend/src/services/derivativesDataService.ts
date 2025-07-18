/**
 * Derivatives Data Service
 * Handles real-time options and futures data with intelligent caching
 * Provides unified interface for derivatives market data across brokers
 */

import { 
  OptionChain, 
  FuturesChain, 
  OptionContract, 
  FuturesContract,
  DerivativePosition,
  OptionPosition,
  FuturesPosition
} from '@copytrade/shared-types';

import { derivativesDataCacheService } from './derivativesDataCacheService';
import { realTimeGreeksService } from './realTimeGreeksService';
import websocketService from './websocketService';

/**
 * Market data subscription interface
 */
interface MarketDataSubscription {
  userId: string;
  symbols: Set<string>;
  underlyings: Set<string>;
  subscriptionType: 'quotes' | 'greeks' | 'both';
  lastUpdate: Date;
}

/**
 * Real-time quote data
 */
interface DerivativeQuote {
  symbol: string;
  underlying: string;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

/**
 * Data validation result
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Derivatives data service with caching and real-time updates
 */
export class DerivativesDataService {
  private subscriptions: Map<string, MarketDataSubscription> = new Map();
  private isInitialized = false;
  private updateInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly UPDATE_FREQUENCY = 1000; // 1 second
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  /**
   * Initialize the derivatives data service
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.warn('Derivatives data service already initialized');
      return;
    }

    // Initialize cache service
    derivativesDataCacheService.initialize();

    // Start real-time data updates
    this.startRealTimeUpdates();

    this.isInitialized = true;
    console.log('Derivatives data service initialized');
  }

  /**
   * Get option chain with caching
   */
  public async getOptionChain(
    underlying: string, 
    expiryDate: Date,
    forceRefresh: boolean = false
  ): Promise<OptionChain | null> {
    try {
      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        const cachedChain = derivativesDataCacheService.getCachedOptionChain(underlying, expiryDate);
        if (cachedChain) {
          console.debug(`Option chain cache hit for ${underlying} ${expiryDate.toISOString()}`);
          return cachedChain;
        }
      }

      // Fetch from broker APIs (this would be implemented with actual broker calls)
      const optionChain = await this.fetchOptionChainFromBrokers(underlying, expiryDate);
      
      if (optionChain) {
        // Validate data
        const validation = this.validateOptionChain(optionChain);
        if (!validation.isValid) {
          console.error(`Invalid option chain data for ${underlying}:`, validation.errors);
          return null;
        }

        // Cache the data
        derivativesDataCacheService.cacheOptionChain(underlying, expiryDate, optionChain);
        
        // Update Greeks service with new data
        this.updateGreeksServiceWithOptionChain(optionChain);

        console.debug(`Fetched and cached option chain for ${underlying} ${expiryDate.toISOString()}`);
        return optionChain;
      }

      return null;
    } catch (error) {
      console.error(`Error getting option chain for ${underlying}:`, error);
      return null;
    }
  }

  /**
   * Get futures chain with caching
   */
  public async getFuturesChain(
    underlying: string,
    forceRefresh: boolean = false
  ): Promise<FuturesChain | null> {
    try {
      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        const cachedChain = derivativesDataCacheService.getCachedFuturesChain(underlying);
        if (cachedChain) {
          console.debug(`Futures chain cache hit for ${underlying}`);
          return cachedChain;
        }
      }

      // Fetch from broker APIs
      const futuresChain = await this.fetchFuturesChainFromBrokers(underlying);
      
      if (futuresChain) {
        // Validate data
        const validation = this.validateFuturesChain(futuresChain);
        if (!validation.isValid) {
          console.error(`Invalid futures chain data for ${underlying}:`, validation.errors);
          return null;
        }

        // Cache the data
        derivativesDataCacheService.cacheFuturesChain(underlying, futuresChain);

        console.debug(`Fetched and cached futures chain for ${underlying}`);
        return futuresChain;
      }

      return null;
    } catch (error) {
      console.error(`Error getting futures chain for ${underlying}:`, error);
      return null;
    }
  }

  /**
   * Get real-time quote for a derivative instrument
   */
  public async getDerivativeQuote(symbol: string): Promise<DerivativeQuote | null> {
    try {
      // Check if it's an option or futures contract
      const isOption = symbol.includes('CE') || symbol.includes('PE');
      
      if (isOption) {
        const contract = derivativesDataCacheService.getCachedOptionContract(symbol);
        if (contract) {
          return this.convertOptionToQuote(contract);
        }
      } else {
        const contract = derivativesDataCacheService.getCachedFuturesContract(symbol);
        if (contract) {
          return this.convertFuturesToQuote(contract);
        }
      }

      // Fetch real-time data from broker APIs
      const quote = await this.fetchQuoteFromBrokers(symbol);
      return quote;
    } catch (error) {
      console.error(`Error getting quote for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Subscribe to real-time derivatives data
   */
  public subscribeToDerivativesData(
    userId: string,
    symbols: string[],
    underlyings: string[],
    subscriptionType: 'quotes' | 'greeks' | 'both' = 'both'
  ): void {
    const subscription: MarketDataSubscription = {
      userId,
      symbols: new Set(symbols),
      underlyings: new Set(underlyings),
      subscriptionType,
      lastUpdate: new Date()
    };

    this.subscriptions.set(userId, subscription);

    // Subscribe to Greeks updates if requested
    if (subscriptionType === 'greeks' || subscriptionType === 'both') {
      realTimeGreeksService.subscribeToGreeks(userId, symbols);
    }

    console.log(`Derivatives data subscription created for user ${userId}`);
  }

  /**
   * Unsubscribe from derivatives data
   */
  public unsubscribeFromDerivativesData(userId: string): void {
    this.subscriptions.delete(userId);
    realTimeGreeksService.unsubscribeFromGreeks(userId);
    
    console.log(`Derivatives data subscription removed for user ${userId}`);
  }

  /**
   * Update derivatives positions with real-time data
   */
  public async updatePositionsWithRealTimeData(
    positions: DerivativePosition[]
  ): Promise<DerivativePosition[]> {
    const updatedPositions: DerivativePosition[] = [];

    for (const position of positions) {
      try {
        const quote = await this.getDerivativeQuote(position.symbol);
        if (quote) {
          const updatedPosition = {
            ...position,
            currentPrice: quote.lastPrice,
            unrealizedPnL: this.calculateUnrealizedPnL(position, quote.lastPrice),
            lastUpdated: new Date()
          };

          // Update total P&L
          updatedPosition.totalPnL = updatedPosition.realizedPnL + updatedPosition.unrealizedPnL;

          updatedPositions.push(updatedPosition);
        } else {
          updatedPositions.push(position);
        }
      } catch (error) {
        console.error(`Error updating position for ${position.symbol}:`, error);
        updatedPositions.push(position);
      }
    }

    return updatedPositions;
  }

  /**
   * Invalidate cache for underlying when price changes significantly
   */
  public handleUnderlyingPriceChange(underlying: string, newPrice: number, oldPrice: number): void {
    const priceChangePercent = Math.abs(newPrice - oldPrice) / oldPrice;
    
    // Invalidate cache if price change is significant (> 1%)
    if (priceChangePercent > 0.01) {
      derivativesDataCacheService.invalidateUnderlying(underlying);
      console.log(`Cache invalidated for ${underlying} due to significant price change`);
    }

    // Update Greeks service with new underlying price
    realTimeGreeksService.updateGreeksForPriceChange(underlying, newPrice);
  }

  /**
   * Get service statistics
   */
  public getStats() {
    const cacheStats = derivativesDataCacheService.getStats();
    const greeksStats = realTimeGreeksService.getStats();

    return {
      isInitialized: this.isInitialized,
      activeSubscriptions: this.subscriptions.size,
      cache: cacheStats,
      greeksService: greeksStats,
      updateFrequency: this.UPDATE_FREQUENCY
    };
  }

  /**
   * Fetch option chain from broker APIs (placeholder implementation)
   */
  private async fetchOptionChainFromBrokers(
    underlying: string, 
    expiryDate: Date
  ): Promise<OptionChain | null> {
    // This would integrate with actual broker APIs
    // For now, return a mock structure
    console.log(`Fetching option chain for ${underlying} from brokers...`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock option chain data
    return {
      underlying,
      expiryDate,
      strikes: [],
      impliedVolatility: 0.2,
      historicalVolatility: 0.25,
      atmStrike: 20000,
      daysToExpiry: Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      interestRate: 0.05
    };
  }

  /**
   * Fetch futures chain from broker APIs (placeholder implementation)
   */
  private async fetchFuturesChainFromBrokers(underlying: string): Promise<FuturesChain | null> {
    // This would integrate with actual broker APIs
    console.log(`Fetching futures chain for ${underlying} from brokers...`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mock futures chain data
    return {
      underlying,
      contracts: [],
      nearMonthContract: {} as FuturesContract,
      rolloverDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      specifications: {
        contractSize: 50,
        tickValue: 0.05,
        tradingHours: { start: '09:15', end: '15:30' },
        settlementType: 'cash',
        marginPercentage: 10
      }
    };
  }

  /**
   * Fetch real-time quote from broker APIs (placeholder implementation)
   */
  private async fetchQuoteFromBrokers(symbol: string): Promise<DerivativeQuote | null> {
    // This would integrate with actual broker APIs
    console.log(`Fetching quote for ${symbol} from brokers...`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // Mock quote data
    const underlying = symbol.substring(0, 5); // Simplified extraction
    return {
      symbol,
      underlying,
      lastPrice: 100 + Math.random() * 50,
      bid: 95 + Math.random() * 50,
      ask: 105 + Math.random() * 50,
      volume: Math.floor(Math.random() * 10000),
      openInterest: Math.floor(Math.random() * 50000),
      change: (Math.random() - 0.5) * 10,
      changePercent: (Math.random() - 0.5) * 5,
      timestamp: new Date()
    };
  }

  /**
   * Validate option chain data
   */
  private validateOptionChain(optionChain: OptionChain): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!optionChain.underlying) {
      errors.push('Missing underlying symbol');
    }

    if (!optionChain.expiryDate) {
      errors.push('Missing expiry date');
    } else if (optionChain.expiryDate < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      // Allow expiry date to be up to 1 day in the past to handle timezone issues
      errors.push('Expiry date is too far in the past');
    }

    if (optionChain.impliedVolatility < 0 || optionChain.impliedVolatility > 5) {
      warnings.push('Implied volatility seems unusual');
    }

    if (optionChain.strikes.length === 0) {
      warnings.push('No strikes available in option chain');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate futures chain data
   */
  private validateFuturesChain(futuresChain: FuturesChain): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!futuresChain.underlying) {
      errors.push('Missing underlying symbol');
    }

    if (futuresChain.contracts.length === 0) {
      warnings.push('No contracts available in futures chain');
    }

    if (!futuresChain.nearMonthContract) {
      errors.push('Missing near month contract');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Convert option contract to quote format
   */
  private convertOptionToQuote(contract: OptionContract): DerivativeQuote {
    return {
      symbol: contract.symbol,
      underlying: contract.underlying,
      lastPrice: contract.lastPrice,
      bid: contract.bid,
      ask: contract.ask,
      volume: contract.volume,
      openInterest: contract.openInterest,
      change: 0, // Would be calculated from previous price
      changePercent: 0, // Would be calculated from previous price
      timestamp: contract.timestamp
    };
  }

  /**
   * Convert futures contract to quote format
   */
  private convertFuturesToQuote(contract: FuturesContract): DerivativeQuote {
    return {
      symbol: contract.symbol,
      underlying: contract.underlying,
      lastPrice: contract.lastPrice,
      bid: contract.bid,
      ask: contract.ask,
      volume: contract.volume,
      openInterest: contract.openInterest,
      change: 0, // Would be calculated from previous price
      changePercent: 0, // Would be calculated from previous price
      timestamp: contract.timestamp
    };
  }

  /**
   * Calculate unrealized P&L for a position
   */
  private calculateUnrealizedPnL(position: DerivativePosition, currentPrice: number): number {
    const priceDiff = currentPrice - position.avgPrice;
    const multiplier = position.positionType === 'long' ? 1 : -1;
    return priceDiff * position.quantity * multiplier;
  }

  /**
   * Update Greeks service with option chain data
   */
  private updateGreeksServiceWithOptionChain(optionChain: OptionChain): void {
    // Add option contracts to Greeks service cache
    optionChain.strikes.forEach(strike => {
      if (strike.call) {
        realTimeGreeksService.addSymbolToCache(
          strike.call.symbol,
          optionChain.underlying,
          strike.call.greeks,
          strike.call.lastPrice,
          strike.call.impliedVolatility
        );
      }
      
      if (strike.put) {
        realTimeGreeksService.addSymbolToCache(
          strike.put.symbol,
          optionChain.underlying,
          strike.put.greeks,
          strike.put.lastPrice,
          strike.put.impliedVolatility
        );
      }
    });
  }

  /**
   * Start real-time data updates
   */
  private startRealTimeUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      await this.performRealTimeUpdates();
    }, this.UPDATE_FREQUENCY);

    console.log(`Real-time derivatives data updates started with ${this.UPDATE_FREQUENCY}ms frequency`);
  }

  /**
   * Perform real-time data updates for all subscriptions
   */
  private async performRealTimeUpdates(): Promise<void> {
    for (const [userId, subscription] of this.subscriptions.entries()) {
      try {
        // Update quotes if requested
        if (subscription.subscriptionType === 'quotes' || subscription.subscriptionType === 'both') {
          await this.updateQuotesForSubscription(userId, subscription);
        }

        subscription.lastUpdate = new Date();
      } catch (error) {
        console.error(`Error in real-time update for user ${userId}:`, error);
      }
    }
  }

  /**
   * Update quotes for a specific subscription
   */
  private async updateQuotesForSubscription(
    userId: string, 
    subscription: MarketDataSubscription
  ): Promise<void> {
    const quotes: DerivativeQuote[] = [];

    // Get quotes for subscribed symbols
    for (const symbol of subscription.symbols) {
      const quote = await this.getDerivativeQuote(symbol);
      if (quote) {
        quotes.push(quote);
      }
    }

    // Send updates to user via WebSocket
    if (quotes.length > 0) {
      websocketService.sendToUser(userId, 'derivatives_quotes_update', {
        quotes,
        timestamp: new Date()
      });
    }
  }

  /**
   * Shutdown the service
   */
  public shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.subscriptions.clear();
    derivativesDataCacheService.shutdown();
    this.isInitialized = false;

    console.log('Derivatives data service shutdown complete');
  }
}

// Create singleton instance
export const derivativesDataService = new DerivativesDataService();