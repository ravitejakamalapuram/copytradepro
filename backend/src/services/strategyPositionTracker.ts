import { DerivativeStrategy, StrategyLeg } from './strategyBuilderService';
import { MultiLegExecutionResult } from './multiLegOrderManager';
import { Greeks } from '@copytrade/shared-types';

/**
 * Strategy position interface for tracking multi-leg strategy performance
 */
export interface StrategyPosition {
  /** Strategy position ID */
  id: string;
  /** Original strategy ID */
  strategyId: string;
  /** Strategy name */
  name: string;
  /** Strategy type */
  type: string;
  /** Underlying asset */
  underlying: string;
  /** Strategy legs with position details */
  legs: StrategyLegPosition[];
  /** Net premium paid/received */
  netPremium: number;
  /** Current strategy value */
  currentValue: number;
  /** Unrealized P&L */
  unrealizedPnL: number;
  /** Realized P&L */
  realizedPnL: number;
  /** Total P&L */
  totalPnL: number;
  /** Maximum profit potential */
  maxProfit: number;
  /** Maximum loss potential */
  maxLoss: number;
  /** Breakeven points */
  breakeven: number[];
  /** Strategy Greeks */
  greeks: Greeks;
  /** Days to expiry */
  daysToExpiry: number;
  /** Margin used */
  marginUsed: number;
  /** Position entry date */
  entryDate: Date;
  /** Last update timestamp */
  lastUpdated: Date;
  /** Strategy status */
  status: 'active' | 'closed' | 'expired' | 'assigned';
  /** Performance metrics */
  performance: StrategyPerformanceMetrics;
}

/**
 * Strategy leg position details
 */
export interface StrategyLegPosition {
  /** Leg ID */
  legId: string;
  /** Instrument type */
  instrumentType: 'option' | 'future' | 'stock';
  /** Symbol */
  symbol: string;
  /** Action */
  action: 'buy' | 'sell';
  /** Quantity */
  quantity: number;
  /** Entry price */
  entryPrice: number;
  /** Current price */
  currentPrice: number;
  /** Leg P&L */
  pnl: number;
  /** Leg Greeks (for options) */
  greeks?: Greeks;
  /** Strike price (for options) */
  strike?: number | undefined;
  /** Option type (for options) */
  optionType?: 'call' | 'put' | undefined;
  /** Expiry date */
  expiryDate?: Date | undefined;
  /** Broker ID */
  brokerId: string;
  /** Position ID in broker system */
  brokerPositionId: string;
}

/**
 * Strategy performance metrics
 */
export interface StrategyPerformanceMetrics {
  /** Return on investment percentage */
  roi: number;
  /** Annualized return */
  annualizedReturn: number;
  /** Days held */
  daysHeld: number;
  /** Maximum favorable excursion */
  maxFavorableExcursion: number;
  /** Maximum adverse excursion */
  maxAdverseExcursion: number;
  /** Current return percentage */
  currentReturn: number;
  /** Theta decay impact */
  thetaDecay: number;
  /** Volatility impact */
  volatilityImpact: number;
  /** Delta exposure */
  deltaExposure: number;
}

/**
 * Strategy P&L calculation result
 */
export interface StrategyPnLCalculation {
  /** Current strategy value */
  currentValue: number;
  /** Unrealized P&L */
  unrealizedPnL: number;
  /** P&L breakdown by leg */
  legPnL: { [legId: string]: number };
  /** Greeks contribution to P&L */
  greeksContribution: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  };
  /** Time decay impact */
  timeDecayImpact: number;
  /** Volatility impact */
  volatilityImpact: number;
}

/**
 * Strategy position tracker for managing multi-leg strategy positions
 */
export class StrategyPositionTracker {
  private strategyPositions: Map<string, StrategyPosition>;
  private positionUpdateCallbacks: Map<string, (position: StrategyPosition) => void>;

  constructor() {
    this.strategyPositions = new Map();
    this.positionUpdateCallbacks = new Map();
  }

  /**
   * Create strategy position from executed strategy
   */
  public async createStrategyPosition(
    strategy: DerivativeStrategy,
    execution: MultiLegExecutionResult
  ): Promise<StrategyPosition> {
    if (execution.status !== 'completed' && execution.status !== 'partial') {
      throw new Error('Cannot create position from incomplete execution');
    }

    const positionId = this.generatePositionId();
    
    // Create leg positions from execution results
    const legPositions: StrategyLegPosition[] = [];
    
    for (const legResult of execution.legResults) {
      if (legResult.filledQuantity > 0) {
        const strategyLeg = strategy.legs.find(leg => leg.id === legResult.legId);
        if (!strategyLeg) continue;

        const legPosition: StrategyLegPosition = {
          legId: legResult.legId,
          instrumentType: strategyLeg.instrumentType,
          symbol: strategyLeg.symbol,
          action: strategyLeg.action,
          quantity: legResult.filledQuantity,
          entryPrice: legResult.avgFillPrice,
          currentPrice: legResult.avgFillPrice, // Will be updated with real-time data
          pnl: 0, // Initial P&L is zero
          strike: strategyLeg.strike || undefined,
          optionType: strategyLeg.optionType || undefined,
          expiryDate: strategyLeg.expiryDate || undefined,
          brokerId: legResult.brokerId,
          brokerPositionId: legResult.orderId
        };

        legPositions.push(legPosition);
      }
    }

    const strategyPosition: StrategyPosition = {
      id: positionId,
      strategyId: strategy.id,
      name: strategy.name,
      type: strategy.type,
      underlying: strategy.underlying,
      legs: legPositions,
      netPremium: execution.netPremium,
      currentValue: execution.netPremium,
      unrealizedPnL: 0,
      realizedPnL: 0,
      totalPnL: 0,
      maxProfit: strategy.maxProfit,
      maxLoss: strategy.maxLoss,
      breakeven: strategy.breakeven,
      greeks: { ...strategy.greeks },
      daysToExpiry: strategy.daysToExpiry,
      marginUsed: strategy.marginRequired,
      entryDate: execution.startTime,
      lastUpdated: new Date(),
      status: 'active',
      performance: this.initializePerformanceMetrics()
    };

    this.strategyPositions.set(positionId, strategyPosition);
    
    // Calculate initial metrics
    await this.updateStrategyPosition(positionId);
    
    return strategyPosition;
  }

  /**
   * Update strategy position with current market data
   */
  public async updateStrategyPosition(positionId: string): Promise<StrategyPosition | null> {
    const position = this.strategyPositions.get(positionId);
    if (!position) {
      return null;
    }

    // Update leg prices and calculate P&L
    for (const leg of position.legs) {
      // Get current market price (would integrate with real market data service)
      leg.currentPrice = await this.getCurrentPrice(leg.symbol);
      
      // Calculate leg P&L
      const priceDiff = leg.currentPrice - leg.entryPrice;
      leg.pnl = leg.action === 'buy' 
        ? priceDiff * leg.quantity
        : -priceDiff * leg.quantity;

      // Update Greeks for options
      if (leg.instrumentType === 'option' && leg.strike && leg.optionType && leg.expiryDate) {
        leg.greeks = await this.calculateOptionGreeks(
          position.underlying,
          leg.strike,
          leg.optionType,
          leg.expiryDate,
          leg.currentPrice
        );
      }
    }

    // Calculate strategy-level metrics
    const pnlCalculation = this.calculateStrategyPnL(position);
    
    position.currentValue = pnlCalculation.currentValue;
    position.unrealizedPnL = pnlCalculation.unrealizedPnL;
    position.totalPnL = position.unrealizedPnL + position.realizedPnL;
    
    // Update strategy Greeks
    position.greeks = this.calculateStrategyGreeks(position);
    
    // Update days to expiry
    position.daysToExpiry = this.calculateDaysToExpiry(position);
    
    // Update performance metrics
    position.performance = this.calculatePerformanceMetrics(position);
    
    position.lastUpdated = new Date();

    // Check if strategy should be marked as expired
    if (position.daysToExpiry <= 0) {
      position.status = 'expired';
    }

    // Trigger callbacks
    const callback = this.positionUpdateCallbacks.get(positionId);
    if (callback) {
      callback(position);
    }

    return position;
  }

  /**
   * Get strategy position by ID
   */
  public getStrategyPosition(positionId: string): StrategyPosition | undefined {
    return this.strategyPositions.get(positionId);
  }

  /**
   * Get all strategy positions
   */
  public getAllStrategyPositions(): StrategyPosition[] {
    return Array.from(this.strategyPositions.values());
  }

  /**
   * Get strategy positions by underlying
   */
  public getStrategyPositionsByUnderlying(underlying: string): StrategyPosition[] {
    return Array.from(this.strategyPositions.values())
      .filter(position => position.underlying === underlying);
  }

  /**
   * Get active strategy positions
   */
  public getActiveStrategyPositions(): StrategyPosition[] {
    return Array.from(this.strategyPositions.values())
      .filter(position => position.status === 'active');
  }

  /**
   * Close strategy position
   */
  public async closeStrategyPosition(positionId: string): Promise<boolean> {
    const position = this.strategyPositions.get(positionId);
    if (!position) {
      return false;
    }

    // Mark position as closed
    position.status = 'closed';
    position.realizedPnL = position.unrealizedPnL;
    position.unrealizedPnL = 0;
    position.totalPnL = position.realizedPnL;
    position.lastUpdated = new Date();

    return true;
  }

  /**
   * Subscribe to position updates
   */
  public subscribeToPositionUpdates(
    positionId: string,
    callback: (position: StrategyPosition) => void
  ): void {
    this.positionUpdateCallbacks.set(positionId, callback);
  }

  /**
   * Unsubscribe from position updates
   */
  public unsubscribeFromPositionUpdates(positionId: string): void {
    this.positionUpdateCallbacks.delete(positionId);
  }

  /**
   * Calculate real-time P&L for strategy
   */
  public calculateStrategyPnL(position: StrategyPosition): StrategyPnLCalculation {
    let currentValue = 0;
    const legPnL: { [legId: string]: number } = {};
    
    // Calculate current value and leg P&L
    for (const leg of position.legs) {
      const legValue = leg.currentPrice * leg.quantity;
      const legPnLValue = leg.pnl;
      
      legPnL[leg.legId] = legPnLValue;
      
      // For strategy value, consider the direction of the position
      if (leg.action === 'buy') {
        currentValue += legValue;
      } else {
        currentValue -= legValue;
      }
    }

    const unrealizedPnL = currentValue - position.netPremium;

    // Calculate Greeks contribution to P&L (simplified)
    const greeksContribution = {
      delta: position.greeks.delta * 1, // $1 move in underlying
      gamma: position.greeks.gamma * 0.5, // Gamma effect
      theta: position.greeks.theta * 1, // 1 day time decay
      vega: position.greeks.vega * 0.01, // 1% volatility change
      rho: position.greeks.rho * 0.01 // 1% interest rate change
    };

    return {
      currentValue,
      unrealizedPnL,
      legPnL,
      greeksContribution,
      timeDecayImpact: position.greeks.theta,
      volatilityImpact: position.greeks.vega * 0.01 // Assume 1% vol change
    };
  }

  /**
   * Calculate strategy-level Greeks
   */
  private calculateStrategyGreeks(position: StrategyPosition): Greeks {
    const totalGreeks: Greeks = {
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0
    };

    for (const leg of position.legs) {
      if (leg.greeks) {
        const multiplier = leg.action === 'buy' ? 1 : -1;
        
        totalGreeks.delta += leg.greeks.delta * leg.quantity * multiplier;
        totalGreeks.gamma += leg.greeks.gamma * leg.quantity * multiplier;
        totalGreeks.theta += leg.greeks.theta * leg.quantity * multiplier;
        totalGreeks.vega += leg.greeks.vega * leg.quantity * multiplier;
        totalGreeks.rho += leg.greeks.rho * leg.quantity * multiplier;
      }
    }

    return totalGreeks;
  }

  /**
   * Calculate days to expiry for strategy
   */
  private calculateDaysToExpiry(position: StrategyPosition): number {
    // Find the nearest expiry date among all legs
    let nearestExpiry: Date | null = null;
    
    for (const leg of position.legs) {
      if (leg.expiryDate) {
        if (!nearestExpiry || leg.expiryDate < nearestExpiry) {
          nearestExpiry = leg.expiryDate;
        }
      }
    }

    if (!nearestExpiry) {
      return 0;
    }

    const now = new Date();
    const timeDiff = nearestExpiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(position: StrategyPosition): StrategyPerformanceMetrics {
    const daysHeld = Math.max(1, Math.ceil(
      (new Date().getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24)
    ));

    const roi = position.netPremium !== 0 
      ? (position.totalPnL / Math.abs(position.netPremium)) * 100
      : 0;

    const annualizedReturn = roi * (365 / daysHeld);
    const currentReturn = position.netPremium !== 0
      ? (position.unrealizedPnL / Math.abs(position.netPremium)) * 100
      : 0;

    return {
      roi,
      annualizedReturn,
      daysHeld,
      maxFavorableExcursion: Math.max(0, position.totalPnL),
      maxAdverseExcursion: Math.min(0, position.totalPnL),
      currentReturn,
      thetaDecay: position.greeks.theta * daysHeld,
      volatilityImpact: position.greeks.vega * 0.01, // Assume 1% vol change
      deltaExposure: position.greeks.delta
    };
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): StrategyPerformanceMetrics {
    return {
      roi: 0,
      annualizedReturn: 0,
      daysHeld: 0,
      maxFavorableExcursion: 0,
      maxAdverseExcursion: 0,
      currentReturn: 0,
      thetaDecay: 0,
      volatilityImpact: 0,
      deltaExposure: 0
    };
  }

  /**
   * Get current market price (mock implementation)
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    // Mock implementation - would integrate with real market data service
    // For now, simulate small price movements
    const basePrice = 100; // Mock base price
    const randomChange = (Math.random() - 0.5) * 10; // ±5 price movement
    return basePrice + randomChange;
  }

  /**
   * Calculate option Greeks (mock implementation)
   */
  private async calculateOptionGreeks(
    underlying: string,
    strike: number,
    optionType: 'call' | 'put',
    expiryDate: Date,
    currentPrice: number
  ): Promise<Greeks> {
    // Mock implementation - would use real options pricing model
    // This would integrate with the OptionPricingService
    return {
      delta: optionType === 'call' ? 0.5 : -0.5,
      gamma: 0.1,
      theta: -0.05,
      vega: 0.2,
      rho: 0.1
    };
  }

  /**
   * Generate position ID
   */
  private generatePositionId(): string {
    return `pos_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Update all active positions
   */
  public async updateAllActivePositions(): Promise<void> {
    const activePositions = this.getActiveStrategyPositions();
    
    const updatePromises = activePositions.map(position => 
      this.updateStrategyPosition(position.id)
    );

    await Promise.allSettled(updatePromises);
  }

  /**
   * Get portfolio-level strategy metrics
   */
  public getPortfolioStrategyMetrics(): {
    totalPositions: number;
    totalPnL: number;
    totalMarginUsed: number;
    portfolioGreeks: Greeks;
    activeStrategies: number;
  } {
    const positions = this.getAllStrategyPositions();
    
    const portfolioGreeks: Greeks = {
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0
    };

    let totalPnL = 0;
    let totalMarginUsed = 0;
    let activeStrategies = 0;

    for (const position of positions) {
      totalPnL += position.totalPnL;
      totalMarginUsed += position.marginUsed;
      
      if (position.status === 'active') {
        activeStrategies++;
      }

      portfolioGreeks.delta += position.greeks.delta;
      portfolioGreeks.gamma += position.greeks.gamma;
      portfolioGreeks.theta += position.greeks.theta;
      portfolioGreeks.vega += position.greeks.vega;
      portfolioGreeks.rho += position.greeks.rho;
    }

    return {
      totalPositions: positions.length,
      totalPnL,
      totalMarginUsed,
      portfolioGreeks,
      activeStrategies
    };
  }
}