import { Greeks } from '@copytrade/shared-types';

/**
 * Strategy leg interface for multi-leg strategies
 */
export interface StrategyLeg {
  /** Leg identifier */
  id: string;
  /** Instrument type */
  instrumentType: 'option' | 'future' | 'stock';
  /** Instrument symbol */
  symbol: string;
  /** Underlying asset */
  underlying: string;
  /** Action: buy or sell */
  action: 'buy' | 'sell';
  /** Quantity */
  quantity: number;
  /** Strike price (for options) */
  strike: number | undefined;
  /** Option type (for options) */
  optionType: 'call' | 'put' | undefined;
  /** Expiry date */
  expiryDate: Date | undefined;
  /** Order type */
  orderType: 'market' | 'limit';
  /** Limit price (if limit order) */
  limitPrice: number | undefined;
  /** Current market price */
  marketPrice: number;
  /** Leg ratio (for complex strategies) */
  ratio: number;
}

/**
 * Multi-leg derivative strategy interface
 */
export interface DerivativeStrategy {
  /** Strategy ID */
  id: string;
  /** Strategy name */
  name: string;
  /** Strategy type */
  type: StrategyType;
  /** Strategy description */
  description: string;
  /** Underlying asset */
  underlying: string;
  /** Strategy legs */
  legs: StrategyLeg[];
  /** Net debit/credit */
  netPremium: number;
  /** Maximum profit potential */
  maxProfit: number;
  /** Maximum loss potential */
  maxLoss: number;
  /** Breakeven points */
  breakeven: number[];
  /** Strategy Greeks */
  greeks: Greeks;
  /** Margin required */
  marginRequired: number;
  /** Risk/reward ratio */
  riskRewardRatio: number;
  /** Probability of profit */
  probabilityOfProfit: number;
  /** Days to expiry */
  daysToExpiry: number;
  /** Created timestamp */
  createdAt: Date;
  /** Strategy status */
  status: 'draft' | 'validated' | 'executed' | 'closed';
}

/**
 * Predefined strategy types
 */
export type StrategyType = 
  | 'long_call'
  | 'long_put' 
  | 'short_call'
  | 'short_put'
  | 'bull_call_spread'
  | 'bear_call_spread'
  | 'bull_put_spread'
  | 'bear_put_spread'
  | 'long_straddle'
  | 'short_straddle'
  | 'long_strangle'
  | 'short_strangle'
  | 'protective_collar'
  | 'covered_call'
  | 'iron_condor'
  | 'iron_butterfly'
  | 'custom';

/**
 * Strategy template interface for predefined strategies
 */
export interface StrategyTemplate {
  /** Template type */
  type: StrategyType;
  /** Template name */
  name: string;
  /** Description */
  description: string;
  /** Market outlook */
  marketOutlook: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  /** Required legs configuration */
  legTemplates: StrategyLegTemplate[];
  /** Risk profile */
  riskProfile: 'low' | 'medium' | 'high';
  /** Complexity level */
  complexity: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Strategy leg template for predefined strategies
 */
export interface StrategyLegTemplate {
  /** Instrument type */
  instrumentType: 'option' | 'future' | 'stock';
  /** Action */
  action: 'buy' | 'sell';
  /** Option type (for options) */
  optionType?: 'call' | 'put';
  /** Strike selection method */
  strikeSelection: 'atm' | 'itm' | 'otm' | 'custom';
  /** Strike offset from ATM */
  strikeOffset?: number;
  /** Quantity ratio */
  ratio: number;
  /** Expiry selection */
  expirySelection: 'near' | 'next' | 'custom';
}

/**
 * Strategy validation result
 */
export interface StrategyValidationResult {
  /** Is strategy valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Risk assessment */
  riskAssessment: RiskAssessment;
}

/**
 * Risk assessment for strategies
 */
export interface RiskAssessment {
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  /** Maximum loss amount */
  maxLossAmount: number;
  /** Maximum loss percentage */
  maxLossPercentage: number;
  /** Margin requirement */
  marginRequirement: number;
  /** Liquidity risk */
  liquidityRisk: 'low' | 'medium' | 'high';
  /** Time decay risk */
  timeDecayRisk: 'low' | 'medium' | 'high';
  /** Volatility risk */
  volatilityRisk: 'low' | 'medium' | 'high';
}

/**
 * Strategy Builder Service for creating and managing multi-leg options strategies
 */
export class StrategyBuilderService {
  private strategyTemplates: Map<StrategyType, StrategyTemplate>;

  constructor() {
    this.strategyTemplates = new Map();
    this.initializeStrategyTemplates();
  }

  /**
   * Initialize predefined strategy templates
   */
  private initializeStrategyTemplates(): void {
    // Bull Call Spread
    this.strategyTemplates.set('bull_call_spread', {
      type: 'bull_call_spread',
      name: 'Bull Call Spread',
      description: 'Buy lower strike call, sell higher strike call. Bullish strategy with limited profit and loss.',
      marketOutlook: 'bullish',
      riskProfile: 'low',
      complexity: 'intermediate',
      legTemplates: [
        {
          instrumentType: 'option',
          action: 'buy',
          optionType: 'call',
          strikeSelection: 'itm',
          strikeOffset: -1,
          ratio: 1,
          expirySelection: 'near'
        },
        {
          instrumentType: 'option',
          action: 'sell',
          optionType: 'call',
          strikeSelection: 'otm',
          strikeOffset: 1,
          ratio: 1,
          expirySelection: 'near'
        }
      ]
    });

    // Bear Put Spread
    this.strategyTemplates.set('bear_put_spread', {
      type: 'bear_put_spread',
      name: 'Bear Put Spread',
      description: 'Buy higher strike put, sell lower strike put. Bearish strategy with limited profit and loss.',
      marketOutlook: 'bearish',
      riskProfile: 'low',
      complexity: 'intermediate',
      legTemplates: [
        {
          instrumentType: 'option',
          action: 'buy',
          optionType: 'put',
          strikeSelection: 'itm',
          strikeOffset: 1,
          ratio: 1,
          expirySelection: 'near'
        },
        {
          instrumentType: 'option',
          action: 'sell',
          optionType: 'put',
          strikeSelection: 'otm',
          strikeOffset: -1,
          ratio: 1,
          expirySelection: 'near'
        }
      ]
    });

    // Long Straddle
    this.strategyTemplates.set('long_straddle', {
      type: 'long_straddle',
      name: 'Long Straddle',
      description: 'Buy call and put at same strike. Profits from large price movements in either direction.',
      marketOutlook: 'volatile',
      riskProfile: 'medium',
      complexity: 'intermediate',
      legTemplates: [
        {
          instrumentType: 'option',
          action: 'buy',
          optionType: 'call',
          strikeSelection: 'atm',
          strikeOffset: 0,
          ratio: 1,
          expirySelection: 'near'
        },
        {
          instrumentType: 'option',
          action: 'buy',
          optionType: 'put',
          strikeSelection: 'atm',
          strikeOffset: 0,
          ratio: 1,
          expirySelection: 'near'
        }
      ]
    });

    // Long Strangle
    this.strategyTemplates.set('long_strangle', {
      type: 'long_strangle',
      name: 'Long Strangle',
      description: 'Buy OTM call and OTM put. Lower cost than straddle, requires larger price movement.',
      marketOutlook: 'volatile',
      riskProfile: 'medium',
      complexity: 'intermediate',
      legTemplates: [
        {
          instrumentType: 'option',
          action: 'buy',
          optionType: 'call',
          strikeSelection: 'otm',
          strikeOffset: 1,
          ratio: 1,
          expirySelection: 'near'
        },
        {
          instrumentType: 'option',
          action: 'buy',
          optionType: 'put',
          strikeSelection: 'otm',
          strikeOffset: -1,
          ratio: 1,
          expirySelection: 'near'
        }
      ]
    });

    // Iron Condor
    this.strategyTemplates.set('iron_condor', {
      type: 'iron_condor',
      name: 'Iron Condor',
      description: 'Sell call spread and put spread. Profits from low volatility and sideways movement.',
      marketOutlook: 'neutral',
      riskProfile: 'medium',
      complexity: 'advanced',
      legTemplates: [
        {
          instrumentType: 'option',
          action: 'buy',
          optionType: 'put',
          strikeSelection: 'otm',
          strikeOffset: -2,
          ratio: 1,
          expirySelection: 'near'
        },
        {
          instrumentType: 'option',
          action: 'sell',
          optionType: 'put',
          strikeSelection: 'otm',
          strikeOffset: -1,
          ratio: 1,
          expirySelection: 'near'
        },
        {
          instrumentType: 'option',
          action: 'sell',
          optionType: 'call',
          strikeSelection: 'otm',
          strikeOffset: 1,
          ratio: 1,
          expirySelection: 'near'
        },
        {
          instrumentType: 'option',
          action: 'buy',
          optionType: 'call',
          strikeSelection: 'otm',
          strikeOffset: 2,
          ratio: 1,
          expirySelection: 'near'
        }
      ]
    });

    // Protective Collar
    this.strategyTemplates.set('protective_collar', {
      type: 'protective_collar',
      name: 'Protective Collar',
      description: 'Own stock, buy protective put, sell covered call. Limits both upside and downside.',
      marketOutlook: 'neutral',
      riskProfile: 'low',
      complexity: 'intermediate',
      legTemplates: [
        {
          instrumentType: 'stock',
          action: 'buy',
          ratio: 1,
          strikeSelection: 'custom',
          expirySelection: 'custom'
        },
        {
          instrumentType: 'option',
          action: 'buy',
          optionType: 'put',
          strikeSelection: 'otm',
          strikeOffset: -1,
          ratio: 1,
          expirySelection: 'near'
        },
        {
          instrumentType: 'option',
          action: 'sell',
          optionType: 'call',
          strikeSelection: 'otm',
          strikeOffset: 1,
          ratio: 1,
          expirySelection: 'near'
        }
      ]
    });
  }

  /**
   * Get all available strategy templates
   */
  public getStrategyTemplates(): StrategyTemplate[] {
    return Array.from(this.strategyTemplates.values());
  }

  /**
   * Get strategy template by type
   */
  public getStrategyTemplate(type: StrategyType): StrategyTemplate | undefined {
    return this.strategyTemplates.get(type);
  }

  /**
   * Create a new strategy from template
   */
  public createStrategyFromTemplate(
    templateType: StrategyType,
    underlying: string,
    atmPrice: number,
    strikeInterval: number = 50
  ): DerivativeStrategy {
    const template = this.strategyTemplates.get(templateType);
    if (!template) {
      throw new Error(`Strategy template not found: ${templateType}`);
    }

    const strategy: DerivativeStrategy = {
      id: this.generateStrategyId(),
      name: template.name,
      type: templateType,
      description: template.description,
      underlying,
      legs: [],
      netPremium: 0,
      maxProfit: 0,
      maxLoss: 0,
      breakeven: [],
      greeks: { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
      marginRequired: 0,
      riskRewardRatio: 0,
      probabilityOfProfit: 0,
      daysToExpiry: 30, // Default to 30 days
      createdAt: new Date(),
      status: 'draft'
    };

    // Create legs from template
    template.legTemplates.forEach((legTemplate, index) => {
      const leg = this.createLegFromTemplate(legTemplate, underlying, atmPrice, strikeInterval, index);
      strategy.legs.push(leg);
    });

    return strategy;
  }

  /**
   * Create a custom strategy
   */
  public createCustomStrategy(
    name: string,
    underlying: string,
    description?: string
  ): DerivativeStrategy {
    return {
      id: this.generateStrategyId(),
      name,
      type: 'custom',
      description: description || 'Custom multi-leg strategy',
      underlying,
      legs: [],
      netPremium: 0,
      maxProfit: 0,
      maxLoss: 0,
      breakeven: [],
      greeks: { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
      marginRequired: 0,
      riskRewardRatio: 0,
      probabilityOfProfit: 0,
      daysToExpiry: 30,
      createdAt: new Date(),
      status: 'draft'
    };
  }

  /**
   * Add leg to strategy
   */
  public addLegToStrategy(strategy: DerivativeStrategy, leg: StrategyLeg): DerivativeStrategy {
    const updatedStrategy = { ...strategy };
    updatedStrategy.legs.push(leg);
    
    // Recalculate strategy metrics
    this.calculateStrategyMetrics(updatedStrategy);
    
    return updatedStrategy;
  }

  /**
   * Remove leg from strategy
   */
  public removeLegFromStrategy(strategy: DerivativeStrategy, legId: string): DerivativeStrategy {
    const updatedStrategy = { ...strategy };
    updatedStrategy.legs = updatedStrategy.legs.filter(leg => leg.id !== legId);
    
    // Recalculate strategy metrics
    this.calculateStrategyMetrics(updatedStrategy);
    
    return updatedStrategy;
  }

  /**
   * Update leg in strategy
   */
  public updateLegInStrategy(strategy: DerivativeStrategy, legId: string, updatedLeg: Partial<StrategyLeg>): DerivativeStrategy {
    const updatedStrategy = { ...strategy };
    const legIndex = updatedStrategy.legs.findIndex(leg => leg.id === legId);
    
    if (legIndex === -1) {
      throw new Error(`Leg not found: ${legId}`);
    }
    
    const currentLeg = updatedStrategy.legs[legIndex];
    if (!currentLeg) {
      throw new Error(`Leg not found at index: ${legIndex}`);
    }
    
    updatedStrategy.legs[legIndex] = {
      id: updatedLeg.id ?? currentLeg.id,
      instrumentType: updatedLeg.instrumentType ?? currentLeg.instrumentType,
      symbol: updatedLeg.symbol ?? currentLeg.symbol,
      underlying: updatedLeg.underlying ?? currentLeg.underlying,
      action: updatedLeg.action ?? currentLeg.action,
      quantity: updatedLeg.quantity ?? currentLeg.quantity,
      strike: updatedLeg.strike ?? currentLeg.strike,
      optionType: updatedLeg.optionType ?? currentLeg.optionType,
      expiryDate: updatedLeg.expiryDate ?? currentLeg.expiryDate,
      orderType: updatedLeg.orderType ?? currentLeg.orderType,
      limitPrice: updatedLeg.limitPrice ?? currentLeg.limitPrice,
      marketPrice: updatedLeg.marketPrice ?? currentLeg.marketPrice,
      ratio: updatedLeg.ratio ?? currentLeg.ratio
    };
    
    // Recalculate strategy metrics
    this.calculateStrategyMetrics(updatedStrategy);
    
    return updatedStrategy;
  }

  /**
   * Validate strategy before execution
   */
  public validateStrategy(strategy: DerivativeStrategy): StrategyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!strategy.underlying) {
      errors.push('Underlying asset is required');
    }

    if (strategy.legs.length === 0) {
      errors.push('Strategy must have at least one leg');
    }

    // Validate each leg
    strategy.legs.forEach((leg, index) => {
      if (!leg.symbol) {
        errors.push(`Leg ${index + 1}: Symbol is required`);
      }

      if (leg.quantity <= 0) {
        errors.push(`Leg ${index + 1}: Quantity must be positive`);
      }

      if (leg.instrumentType === 'option') {
        if (!leg.strike || leg.strike <= 0) {
          errors.push(`Leg ${index + 1}: Valid strike price is required for options`);
        }

        if (!leg.optionType) {
          errors.push(`Leg ${index + 1}: Option type (call/put) is required`);
        }

        if (!leg.expiryDate) {
          errors.push(`Leg ${index + 1}: Expiry date is required for options`);
        }
      }
    });

    // Risk validation
    const riskAssessment = this.assessStrategyRisk(strategy);
    
    if (riskAssessment.maxLossAmount > 100000) { // Example threshold
      warnings.push('Strategy has high maximum loss potential');
    }

    if (riskAssessment.marginRequirement > 50000) { // Example threshold
      warnings.push('Strategy requires high margin');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      riskAssessment
    };
  }

  /**
   * Calculate strategy payoff at expiry
   */
  public calculatePayoffAtExpiry(strategy: DerivativeStrategy, underlyingPrices: number[]): { price: number; payoff: number }[] {
    return underlyingPrices.map(price => ({
      price,
      payoff: this.calculatePayoffAtPrice(strategy, price)
    }));
  }

  /**
   * Generate strategy ID
   */
  private generateStrategyId(): string {
    return `strategy_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Create leg from template
   */
  private createLegFromTemplate(
    template: StrategyLegTemplate,
    underlying: string,
    atmPrice: number,
    strikeInterval: number,
    index: number
  ): StrategyLeg {
    let strike: number | undefined;
    
    if (template.instrumentType === 'option') {
      switch (template.strikeSelection) {
        case 'atm':
          strike = Math.round(atmPrice / strikeInterval) * strikeInterval;
          break;
        case 'itm':
          strike = template.optionType === 'call' 
            ? Math.round((atmPrice + (template.strikeOffset || -1) * strikeInterval) / strikeInterval) * strikeInterval
            : Math.round((atmPrice + (template.strikeOffset || 1) * strikeInterval) / strikeInterval) * strikeInterval;
          break;
        case 'otm':
          strike = template.optionType === 'call'
            ? Math.round((atmPrice + (template.strikeOffset || 1) * strikeInterval) / strikeInterval) * strikeInterval
            : Math.round((atmPrice + (template.strikeOffset || -1) * strikeInterval) / strikeInterval) * strikeInterval;
          break;
      }
    }

    return {
      id: `leg_${index}_${Date.now()}`,
      instrumentType: template.instrumentType,
      symbol: this.generateSymbol(underlying, template.optionType, strike),
      underlying,
      action: template.action,
      quantity: 1, // Default quantity
      strike: strike,
      optionType: template.optionType || undefined,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      orderType: 'market' as const,
      limitPrice: undefined,
      marketPrice: 0, // To be filled with real market data
      ratio: template.ratio
    };
  }

  /**
   * Generate symbol for leg
   */
  private generateSymbol(underlying: string, optionType?: 'call' | 'put', strike?: number): string {
    if (optionType && strike) {
      return `${underlying}_${optionType.toUpperCase()}_${strike}`;
    }
    return underlying;
  }

  /**
   * Calculate strategy metrics
   */
  private calculateStrategyMetrics(strategy: DerivativeStrategy): void {
    // Calculate net premium
    strategy.netPremium = strategy.legs.reduce((total, leg) => {
      const premium = leg.marketPrice * leg.quantity;
      return total + (leg.action === 'buy' ? -premium : premium);
    }, 0);

    // Calculate max profit/loss (simplified)
    // This would need more sophisticated calculation based on strategy type
    if (strategy.type === 'bull_call_spread' && strategy.legs.length === 2) {
      const longLeg = strategy.legs.find(leg => leg.action === 'buy');
      const shortLeg = strategy.legs.find(leg => leg.action === 'sell');
      
      if (longLeg && shortLeg && longLeg.strike && shortLeg.strike) {
        strategy.maxProfit = (shortLeg.strike - longLeg.strike) * 100 + strategy.netPremium;
        strategy.maxLoss = -strategy.netPremium;
        strategy.breakeven = [longLeg.strike - strategy.netPremium / 100];
      }
    }

    // Calculate Greeks (simplified - would need real options pricing)
    strategy.greeks = strategy.legs.reduce((totalGreeks, leg) => {
      // This would use real Greeks from option pricing service
      return {
        delta: totalGreeks.delta + (leg.action === 'buy' ? 0.5 : -0.5),
        gamma: totalGreeks.gamma + (leg.action === 'buy' ? 0.1 : -0.1),
        theta: totalGreeks.theta + (leg.action === 'buy' ? -0.05 : 0.05),
        vega: totalGreeks.vega + (leg.action === 'buy' ? 0.2 : -0.2),
        rho: totalGreeks.rho + (leg.action === 'buy' ? 0.1 : -0.1)
      };
    }, { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 });
  }

  /**
   * Assess strategy risk
   */
  private assessStrategyRisk(strategy: DerivativeStrategy): RiskAssessment {
    // Ensure strategy metrics are calculated first
    this.calculateStrategyMetrics(strategy);
    
    const maxLossAmount = Math.abs(strategy.maxLoss) || 1000; // Default minimum risk
    const marginRequirement = maxLossAmount * 1.2; // Simplified margin calculation

    return {
      riskLevel: maxLossAmount > 50000 ? 'high' : maxLossAmount > 20000 ? 'medium' : 'low',
      maxLossAmount,
      maxLossPercentage: 0, // Would calculate based on account size
      marginRequirement,
      liquidityRisk: 'medium', // Would assess based on option volume/OI
      timeDecayRisk: Math.abs(strategy.greeks.theta) > 0.1 ? 'high' : 'medium',
      volatilityRisk: Math.abs(strategy.greeks.vega) > 0.5 ? 'high' : 'medium'
    };
  }

  /**
   * Calculate payoff at specific underlying price
   */
  private calculatePayoffAtPrice(strategy: DerivativeStrategy, underlyingPrice: number): number {
    return strategy.legs.reduce((totalPayoff, leg) => {
      let legPayoff = 0;

      if (leg.instrumentType === 'option' && leg.strike && leg.optionType) {
        // Calculate option intrinsic value at expiry
        if (leg.optionType === 'call') {
          legPayoff = Math.max(0, underlyingPrice - leg.strike);
        } else {
          legPayoff = Math.max(0, leg.strike - underlyingPrice);
        }

        // Adjust for premium paid/received
        legPayoff = leg.action === 'buy' ? legPayoff - leg.marketPrice : legPayoff + leg.marketPrice;
      }

      return totalPayoff + legPayoff * leg.quantity;
    }, 0);
  }
}