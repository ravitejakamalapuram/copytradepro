/**
 * Real-time Greeks Service
 * Handles real-time Greeks calculations and WebSocket updates for derivatives
 * Provides efficient Greeks recalculation when underlying prices change
 */

import { Greeks, OptionPosition, DerivativePosition } from '@copytrade/shared-types';
import { OptionPricingService, BlackScholesParams } from './optionPricingService';
import websocketService from './websocketService';

/**
 * Greeks update event data
 */
export interface GreeksUpdateEvent {
  symbol: string;
  underlying: string;
  greeks: Greeks;
  timestamp: Date;
  spotPrice: number;
  impliedVolatility: number;
}

/**
 * Portfolio Greeks aggregation
 */
export interface PortfolioGreeks {
  totalDelta: number;
  totalGamma: number;
  totalTheta: number;
  totalVega: number;
  totalRho: number;
  underlyingBreakdown: { [underlying: string]: Greeks };
  lastUpdated: Date;
}

/**
 * Greeks subscription data
 */
interface GreeksSubscription {
  userId: string;
  symbols: Set<string>;
  underlyings: Set<string>;
  lastUpdate: Date;
  updateFrequency: number; // milliseconds
}

/**
 * Cached Greeks data for efficient updates
 */
interface CachedGreeksData {
  symbol: string;
  underlying: string;
  greeks: Greeks;
  lastSpotPrice: number;
  lastVolatility: number;
  lastUpdate: Date;
  position?: OptionPosition | undefined;
}

/**
 * Real-time Greeks calculation and update service
 */
export class RealTimeGreeksService {
  private subscriptions: Map<string, GreeksSubscription> = new Map();
  private cachedGreeks: Map<string, CachedGreeksData> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private portfolioGreeks: Map<string, PortfolioGreeks> = new Map();
  
  // Configuration
  private readonly DEFAULT_UPDATE_FREQUENCY = 1000; // 1 second
  private readonly MIN_UPDATE_FREQUENCY = 500; // 0.5 seconds
  private readonly MAX_UPDATE_FREQUENCY = 5000; // 5 seconds
  private readonly GREEKS_SENSITIVITY_THRESHOLD = 0.001; // Minimum change to trigger update

  /**
   * Subscribe user to real-time Greeks updates
   */
  public subscribeToGreeks(
    userId: string, 
    symbols: string[], 
    updateFrequency: number = this.DEFAULT_UPDATE_FREQUENCY
  ): void {
    // Validate update frequency
    const validatedFrequency = Math.max(
      this.MIN_UPDATE_FREQUENCY,
      Math.min(this.MAX_UPDATE_FREQUENCY, updateFrequency)
    );

    const subscription: GreeksSubscription = {
      userId,
      symbols: new Set(symbols),
      underlyings: new Set(),
      lastUpdate: new Date(),
      updateFrequency: validatedFrequency
    };

    // Extract underlyings from symbols
    symbols.forEach(symbol => {
      const underlying = this.extractUnderlyingFromSymbol(symbol);
      if (underlying) {
        subscription.underlyings.add(underlying);
      }
    });

    this.subscriptions.set(userId, subscription);

    // Start update interval for this user
    this.startGreeksUpdateInterval(userId);

    console.log(`Greeks subscription created for user ${userId} with ${symbols.length} symbols`);
  }

  /**
   * Unsubscribe user from Greeks updates
   */
  public unsubscribeFromGreeks(userId: string): void {
    this.subscriptions.delete(userId);
    this.portfolioGreeks.delete(userId);
    
    // Clear update interval
    const interval = this.updateIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(userId);
    }

    console.log(`Greeks subscription removed for user ${userId}`);
  }

  /**
   * Update Greeks when underlying price changes
   */
  public async updateGreeksForPriceChange(
    underlying: string,
    newSpotPrice: number,
    impliedVolatility?: number
  ): Promise<void> {
    const affectedSymbols = this.getSymbolsForUnderlying(underlying);
    const updates: GreeksUpdateEvent[] = [];

    for (const symbol of affectedSymbols) {
      const cachedData = this.cachedGreeks.get(symbol);
      if (!cachedData) continue;

      // Check if price change is significant enough to recalculate
      const priceChangePercent = Math.abs(newSpotPrice - cachedData.lastSpotPrice) / cachedData.lastSpotPrice;
      if (priceChangePercent < 0.001) continue; // Skip if less than 0.1% change

      try {
        const updatedGreeks = await this.calculateGreeksForSymbol(
          symbol,
          newSpotPrice,
          impliedVolatility || cachedData.lastVolatility
        );

        if (updatedGreeks) {
          // Check if Greeks change is significant
          if (this.isSignificantGreeksChange(cachedData.greeks, updatedGreeks)) {
            // Update cache
            cachedData.greeks = updatedGreeks;
            cachedData.lastSpotPrice = newSpotPrice;
            cachedData.lastVolatility = impliedVolatility || cachedData.lastVolatility;
            cachedData.lastUpdate = new Date();
            this.cachedGreeks.set(symbol, cachedData);

            // Create update event
            updates.push({
              symbol,
              underlying,
              greeks: updatedGreeks,
              timestamp: new Date(),
              spotPrice: newSpotPrice,
              impliedVolatility: cachedData.lastVolatility
            });
          }
        }
      } catch (error) {
        console.error(`Error updating Greeks for ${symbol}:`, error);
      }
    }

    // Emit updates to subscribed users
    if (updates.length > 0) {
      await this.emitGreeksUpdates(updates);
    }
  }

  /**
   * Calculate portfolio-level Greeks for a user
   */
  public calculatePortfolioGreeks(
    userId: string,
    positions: OptionPosition[]
  ): PortfolioGreeks {
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;
    let totalRho = 0;
    
    const underlyingBreakdown: { [underlying: string]: Greeks } = {};

    positions.forEach(position => {
      const { greeks, quantity, underlying } = position;
      
      // Weight Greeks by position size
      const weightedDelta = greeks.delta * quantity;
      const weightedGamma = greeks.gamma * quantity;
      const weightedTheta = greeks.theta * quantity;
      const weightedVega = greeks.vega * quantity;
      const weightedRho = greeks.rho * quantity;

      // Add to totals
      totalDelta += weightedDelta;
      totalGamma += weightedGamma;
      totalTheta += weightedTheta;
      totalVega += weightedVega;
      totalRho += weightedRho;

      // Add to underlying breakdown
      if (!underlyingBreakdown[underlying]) {
        underlyingBreakdown[underlying] = {
          delta: 0,
          gamma: 0,
          theta: 0,
          vega: 0,
          rho: 0
        };
      }

      underlyingBreakdown[underlying].delta += weightedDelta;
      underlyingBreakdown[underlying].gamma += weightedGamma;
      underlyingBreakdown[underlying].theta += weightedTheta;
      underlyingBreakdown[underlying].vega += weightedVega;
      underlyingBreakdown[underlying].rho += weightedRho;
    });

    const portfolioGreeks: PortfolioGreeks = {
      totalDelta: Number(totalDelta.toFixed(4)),
      totalGamma: Number(totalGamma.toFixed(4)),
      totalTheta: Number(totalTheta.toFixed(4)),
      totalVega: Number(totalVega.toFixed(4)),
      totalRho: Number(totalRho.toFixed(4)),
      underlyingBreakdown,
      lastUpdated: new Date()
    };

    // Cache portfolio Greeks
    this.portfolioGreeks.set(userId, portfolioGreeks);

    return portfolioGreeks;
  }

  /**
   * Get cached portfolio Greeks for a user
   */
  public getPortfolioGreeks(userId: string): PortfolioGreeks | null {
    return this.portfolioGreeks.get(userId) || null;
  }

  /**
   * Start Greeks update interval for a user
   */
  private startGreeksUpdateInterval(userId: string): void {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) return;

    // Clear existing interval
    const existingInterval = this.updateIntervals.get(userId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Start new interval
    const interval = setInterval(async () => {
      await this.performScheduledGreeksUpdate(userId);
    }, subscription.updateFrequency);

    this.updateIntervals.set(userId, interval);
  }

  /**
   * Perform scheduled Greeks update for a user
   */
  private async performScheduledGreeksUpdate(userId: string): Promise<void> {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) return;

    try {
      // Get current market data for subscribed underlyings
      const updates: GreeksUpdateEvent[] = [];

      for (const symbol of subscription.symbols) {
        const cachedData = this.cachedGreeks.get(symbol);
        if (!cachedData) continue;

        // For scheduled updates, we might not have new price data
        // In a real implementation, this would fetch current market data
        const currentSpotPrice = cachedData.lastSpotPrice; // Placeholder
        const currentVolatility = cachedData.lastVolatility; // Placeholder

        const updatedGreeks = await this.calculateGreeksForSymbol(
          symbol,
          currentSpotPrice,
          currentVolatility
        );

        if (updatedGreeks && this.isSignificantGreeksChange(cachedData.greeks, updatedGreeks)) {
          cachedData.greeks = updatedGreeks;
          cachedData.lastUpdate = new Date();
          this.cachedGreeks.set(symbol, cachedData);

          updates.push({
            symbol,
            underlying: cachedData.underlying,
            greeks: updatedGreeks,
            timestamp: new Date(),
            spotPrice: currentSpotPrice,
            impliedVolatility: currentVolatility
          });
        }
      }

      if (updates.length > 0) {
        await this.emitGreeksUpdates(updates, userId);
      }

      subscription.lastUpdate = new Date();
    } catch (error) {
      console.error(`Error in scheduled Greeks update for user ${userId}:`, error);
    }
  }

  /**
   * Calculate Greeks for a specific symbol
   */
  private async calculateGreeksForSymbol(
    symbol: string,
    spotPrice: number,
    impliedVolatility: number
  ): Promise<Greeks | null> {
    try {
      // Parse option details from symbol
      const optionDetails = this.parseOptionSymbol(symbol);
      if (!optionDetails) return null;

      const daysToExpiry = OptionPricingService.calculateDaysToExpiry(optionDetails.expiryDate);
      const timeToExpiry = OptionPricingService.daysToYears(daysToExpiry);

      if (timeToExpiry <= 0) {
        // Option has expired
        return {
          delta: 0,
          gamma: 0,
          theta: 0,
          vega: 0,
          rho: 0
        };
      }

      const params: BlackScholesParams = {
        spotPrice,
        strikePrice: optionDetails.strike,
        timeToExpiry,
        riskFreeRate: 0.05, // Default risk-free rate
        volatility: impliedVolatility,
        dividendYield: 0 // Default dividend yield
      };

      return OptionPricingService.calculateGreeks(params, optionDetails.optionType);
    } catch (error) {
      console.error(`Error calculating Greeks for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Emit Greeks updates to subscribed users
   */
  private async emitGreeksUpdates(
    updates: GreeksUpdateEvent[],
    specificUserId?: string
  ): Promise<void> {
    const targetUsers = specificUserId 
      ? [specificUserId]
      : Array.from(this.subscriptions.keys());

    for (const userId of targetUsers) {
      const subscription = this.subscriptions.get(userId);
      if (!subscription) continue;

      // Filter updates relevant to this user's subscriptions
      const relevantUpdates = updates.filter(update => 
        subscription.symbols.has(update.symbol) || 
        subscription.underlyings.has(update.underlying)
      );

      if (relevantUpdates.length > 0) {
        websocketService.sendToUser(userId, 'greeks_update', {
          updates: relevantUpdates,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Check if Greeks change is significant enough to emit update
   */
  private isSignificantGreeksChange(oldGreeks: Greeks, newGreeks: Greeks): boolean {
    const deltaChange = Math.abs(newGreeks.delta - oldGreeks.delta);
    const gammaChange = Math.abs(newGreeks.gamma - oldGreeks.gamma);
    const thetaChange = Math.abs(newGreeks.theta - oldGreeks.theta);
    const vegaChange = Math.abs(newGreeks.vega - oldGreeks.vega);
    const rhoChange = Math.abs(newGreeks.rho - oldGreeks.rho);

    return deltaChange > this.GREEKS_SENSITIVITY_THRESHOLD ||
           gammaChange > this.GREEKS_SENSITIVITY_THRESHOLD ||
           thetaChange > this.GREEKS_SENSITIVITY_THRESHOLD ||
           vegaChange > this.GREEKS_SENSITIVITY_THRESHOLD ||
           rhoChange > this.GREEKS_SENSITIVITY_THRESHOLD;
  }

  /**
   * Get symbols that belong to a specific underlying
   */
  private getSymbolsForUnderlying(underlying: string): string[] {
    const symbols: string[] = [];
    
    for (const [symbol, cachedData] of this.cachedGreeks.entries()) {
      if (cachedData.underlying === underlying) {
        symbols.push(symbol);
      }
    }

    return symbols;
  }

  /**
   * Extract underlying symbol from option symbol
   */
  private extractUnderlyingFromSymbol(symbol: string): string | null {
    // Example: NIFTY24JAN20000CE -> NIFTY
    // This is a simplified implementation - real implementation would be more robust
    const match = symbol.match(/^([A-Z]+)/);
    return match && match[1] ? match[1] : null;
  }

  /**
   * Parse option symbol to extract details
   */
  private parseOptionSymbol(symbol: string): {
    underlying: string;
    expiryDate: Date;
    strike: number;
    optionType: 'call' | 'put';
  } | null {
    try {
      // Example parsing for Indian option symbols: NIFTY24JAN20000CE
      // This is a simplified implementation - real implementation would handle various formats
      const match = symbol.match(/^([A-Z]+)(\d{2})([A-Z]{3})(\d+)(CE|PE)$/);
      if (!match || match.length < 6) return null;

      const underlying = match[1];
      const year = match[2];
      const month = match[3];
      const strikeStr = match[4];
      const typeStr = match[5];
      
      if (!underlying || !year || !month || !strikeStr || !typeStr) return null;
      
      // Convert to full year
      const fullYear = 2000 + parseInt(year);
      
      // Convert month abbreviation to number
      const monthMap: { [key: string]: number } = {
        'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
        'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
      };
      
      const monthNum = monthMap[month];
      if (monthNum === undefined) return null;

      // Assume last Thursday of the month for expiry (simplified)
      const expiryDate = new Date(fullYear, monthNum + 1, 0); // Last day of month
      const lastThursday = new Date(expiryDate);
      lastThursday.setDate(expiryDate.getDate() - ((expiryDate.getDay() + 3) % 7));

      return {
        underlying,
        expiryDate: lastThursday,
        strike: parseInt(strikeStr),
        optionType: typeStr === 'CE' ? 'call' : 'put'
      };
    } catch (error) {
      console.error(`Error parsing option symbol ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Add symbol to cache for Greeks tracking
   */
  public addSymbolToCache(
    symbol: string,
    underlying: string,
    initialGreeks: Greeks,
    spotPrice: number,
    impliedVolatility: number,
    position?: OptionPosition
  ): void {
    this.cachedGreeks.set(symbol, {
      symbol,
      underlying,
      greeks: initialGreeks,
      lastSpotPrice: spotPrice,
      lastVolatility: impliedVolatility,
      lastUpdate: new Date(),
      position
    });
  }

  /**
   * Remove symbol from cache
   */
  public removeSymbolFromCache(symbol: string): void {
    this.cachedGreeks.delete(symbol);
  }

  /**
   * Get service statistics
   */
  public getStats() {
    return {
      activeSubscriptions: this.subscriptions.size,
      cachedSymbols: this.cachedGreeks.size,
      activeIntervals: this.updateIntervals.size,
      portfolioGreeksCache: this.portfolioGreeks.size,
      totalUnderlyings: new Set(
        Array.from(this.cachedGreeks.values()).map(data => data.underlying)
      ).size
    };
  }

  /**
   * Cleanup resources for a user
   */
  public cleanup(userId: string): void {
    this.unsubscribeFromGreeks(userId);
  }

  /**
   * Shutdown service and cleanup all resources
   */
  public shutdown(): void {
    // Clear all intervals
    for (const interval of this.updateIntervals.values()) {
      clearInterval(interval);
    }

    // Clear all data
    this.subscriptions.clear();
    this.cachedGreeks.clear();
    this.updateIntervals.clear();
    this.portfolioGreeks.clear();

    console.log('Real-time Greeks service shutdown complete');
  }
}

// Create singleton instance
export const realTimeGreeksService = new RealTimeGreeksService();