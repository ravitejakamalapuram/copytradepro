/**
 * Portfolio Risk Calculator Service
 * Implements comprehensive risk calculations for derivatives portfolios
 * Provides VaR, Greeks aggregation, and concentration risk analysis
 */

import { 
  DerivativePosition, 
  OptionPosition, 
  FuturesPosition, 
  Greeks 
} from '@copytrade/shared-types';

/**
 * Portfolio risk metrics interface
 */
export interface PortfolioRisk {
  /** Total portfolio value */
  totalValue: number;
  /** Total derivatives exposure */
  derivativesExposure: number;
  /** Margin used across all positions */
  marginUsed: number;
  /** Available margin */
  marginAvailable: number;
  /** Value at Risk (1-day, 95% confidence) */
  valueAtRisk: number;
  /** Portfolio-level Greeks */
  portfolioGreeks: Greeks;
  /** Concentration risk metrics */
  concentrationRisk: ConcentrationMetrics;
  /** Risk by underlying asset */
  underlyingRisk: { [underlying: string]: UnderlyingRisk };
  /** Last calculation timestamp */
  lastCalculated: Date;
}

/**
 * Concentration risk metrics
 */
export interface ConcentrationMetrics {
  /** Largest single position as % of portfolio */
  largestPositionPercent: number;
  /** Top 5 positions as % of portfolio */
  top5PositionsPercent: number;
  /** Number of different underlyings */
  underlyingCount: number;
  /** Herfindahl-Hirschman Index for concentration */
  herfindahlIndex: number;
  /** Risk concentration by underlying */
  underlyingConcentration: { [underlying: string]: number };
}

/**
 * Risk metrics for individual underlying assets
 */
export interface UnderlyingRisk {
  /** Underlying symbol */
  underlying: string;
  /** Total exposure value */
  totalExposure: number;
  /** Net delta exposure */
  netDelta: number;
  /** Gamma exposure */
  gamma: number;
  /** Theta exposure (daily decay) */
  theta: number;
  /** Vega exposure (volatility risk) */
  vega: number;
  /** Number of positions */
  positionCount: number;
  /** Percentage of total portfolio */
  portfolioPercent: number;
}

/**
 * Correlation matrix for risk calculations
 */
export interface CorrelationMatrix {
  /** Underlying symbols */
  underlyings: string[];
  /** Correlation coefficients matrix */
  correlations: number[][];
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * VaR calculation parameters
 */
export interface VaRParams {
  /** Confidence level (e.g., 0.95 for 95%) */
  confidenceLevel: number;
  /** Time horizon in days */
  timeHorizon: number;
  /** Historical lookback period in days */
  lookbackPeriod: number;
  /** Use Monte Carlo simulation */
  useMonteCarloSimulation: boolean;
}

/**
 * Portfolio Risk Calculator implementation
 */
export class PortfolioRiskCalculator {
  private correlationMatrix: CorrelationMatrix | null = null;
  private historicalVolatilities: Map<string, number> = new Map();
  
  // Default VaR parameters
  private readonly DEFAULT_VAR_PARAMS: VaRParams = {
    confidenceLevel: 0.95,
    timeHorizon: 1,
    lookbackPeriod: 252, // 1 year of trading days
    useMonteCarloSimulation: false
  };

  /**
   * Calculate comprehensive portfolio risk metrics
   */
  public calculatePortfolioRisk(
    positions: DerivativePosition[],
    totalPortfolioValue: number,
    availableMargin: number,
    varParams: Partial<VaRParams> = {}
  ): PortfolioRisk {
    const params = { ...this.DEFAULT_VAR_PARAMS, ...varParams };
    
    // Calculate basic portfolio metrics
    const totalValue = this.calculateTotalPortfolioValue(positions);
    const derivativesExposure = this.calculateDerivativesExposure(positions);
    const marginUsed = this.calculateTotalMarginUsed(positions);
    
    // Calculate portfolio Greeks
    const portfolioGreeks = this.calculatePortfolioGreeks(positions);
    
    // Calculate concentration risk
    const concentrationRisk = this.calculateConcentrationRisk(positions, totalValue);
    
    // Calculate risk by underlying
    const underlyingRisk = this.calculateUnderlyingRisk(positions, totalValue);
    
    // Calculate Value at Risk
    const valueAtRisk = this.calculateValueAtRisk(positions, params);

    return {
      totalValue,
      derivativesExposure,
      marginUsed,
      marginAvailable: availableMargin,
      valueAtRisk,
      portfolioGreeks,
      concentrationRisk,
      underlyingRisk,
      lastCalculated: new Date()
    };
  }

  /**
   * Calculate portfolio-level Greeks aggregation
   */
  public calculatePortfolioGreeks(positions: DerivativePosition[]): Greeks {
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;
    let totalRho = 0;

    positions.forEach(position => {
      if (this.isOptionPosition(position)) {
        const optionPosition = position as OptionPosition;
        const { greeks, quantity } = optionPosition;
        
        // Weight Greeks by position size and direction
        const multiplier = position.positionType === 'long' ? 1 : -1;
        
        totalDelta += greeks.delta * quantity * multiplier;
        totalGamma += greeks.gamma * quantity * multiplier;
        totalTheta += greeks.theta * quantity * multiplier;
        totalVega += greeks.vega * quantity * multiplier;
        totalRho += greeks.rho * quantity * multiplier;
      }
    });

    return {
      delta: Number(totalDelta.toFixed(4)),
      gamma: Number(totalGamma.toFixed(4)),
      theta: Number(totalTheta.toFixed(4)),
      vega: Number(totalVega.toFixed(4)),
      rho: Number(totalRho.toFixed(4))
    };
  }

  /**
   * Calculate concentration risk metrics
   */
  public calculateConcentrationRisk(
    positions: DerivativePosition[],
    totalPortfolioValue: number
  ): ConcentrationMetrics {
    // Group positions by underlying
    const underlyingExposure: { [underlying: string]: number } = {};
    const positionValues: number[] = [];

    positions.forEach(position => {
      const exposure = Math.abs(position.positionValue);
      underlyingExposure[position.underlying] = 
        (underlyingExposure[position.underlying] || 0) + exposure;
      positionValues.push(exposure);
    });

    // Sort position values in descending order
    positionValues.sort((a, b) => b - a);

    // Calculate metrics
    const largestPositionPercent = totalPortfolioValue > 0 
      ? (positionValues[0] || 0) / totalPortfolioValue * 100 
      : 0;

    const top5PositionsPercent = totalPortfolioValue > 0
      ? positionValues.slice(0, 5).reduce((sum, val) => sum + val, 0) / totalPortfolioValue * 100
      : 0;

    const underlyingCount = Object.keys(underlyingExposure).length;

    // Calculate Herfindahl-Hirschman Index
    const herfindahlIndex = this.calculateHerfindahlIndex(underlyingExposure, totalPortfolioValue);

    // Calculate underlying concentration percentages
    const underlyingConcentration: { [underlying: string]: number } = {};
    Object.entries(underlyingExposure).forEach(([underlying, exposure]) => {
      underlyingConcentration[underlying] = totalPortfolioValue > 0 
        ? exposure / totalPortfolioValue * 100 
        : 0;
    });

    return {
      largestPositionPercent: Number(largestPositionPercent.toFixed(2)),
      top5PositionsPercent: Number(top5PositionsPercent.toFixed(2)),
      underlyingCount,
      herfindahlIndex: Number(herfindahlIndex.toFixed(4)),
      underlyingConcentration
    };
  }

  /**
   * Calculate correlation analysis between derivative positions
   */
  public calculateCorrelationRisk(
    positions: DerivativePosition[]
  ): { [pair: string]: number } {
    const correlationRisk: { [pair: string]: number } = {};
    
    // Group positions by underlying
    const underlyingPositions: { [underlying: string]: DerivativePosition[] } = {};
    positions.forEach(position => {
      if (!underlyingPositions[position.underlying]) {
        underlyingPositions[position.underlying] = [];
      }
      underlyingPositions[position.underlying]!.push(position);
    });

    const underlyings = Object.keys(underlyingPositions);
    
    // Calculate pairwise correlation risk
    for (let i = 0; i < underlyings.length; i++) {
      for (let j = i + 1; j < underlyings.length; j++) {
        const underlying1 = underlyings[i]!;
        const underlying2 = underlyings[j]!;
        const pairKey = `${underlying1}-${underlying2}`;
        
        const correlation = this.getCorrelation(underlying1, underlying2);
        const exposure1 = this.calculateUnderlyingExposure(underlyingPositions[underlying1]!);
        const exposure2 = this.calculateUnderlyingExposure(underlyingPositions[underlying2]!);
        
        // Correlation risk is the product of correlation and combined exposure
        correlationRisk[pairKey] = correlation * Math.sqrt(exposure1 * exposure2);
      }
    }

    return correlationRisk;
  }

  /**
   * Calculate Value at Risk using historical simulation method
   */
  public calculateValueAtRisk(
    positions: DerivativePosition[],
    params: VaRParams
  ): number {
    if (positions.length === 0) return 0;

    try {
      if (params.useMonteCarloSimulation) {
        return this.calculateMonteCarloVaR(positions, params);
      } else {
        return this.calculateHistoricalVaR(positions, params);
      }
    } catch (error) {
      console.error('Error calculating VaR:', error);
      // Fallback to simple volatility-based VaR
      return this.calculateSimpleVaR(positions, params);
    }
  }

  /**
   * Calculate risk metrics for individual underlying assets
   */
  private calculateUnderlyingRisk(
    positions: DerivativePosition[],
    totalPortfolioValue: number
  ): { [underlying: string]: UnderlyingRisk } {
    const underlyingRisk: { [underlying: string]: UnderlyingRisk } = {};

    // Group positions by underlying
    const underlyingPositions: { [underlying: string]: DerivativePosition[] } = {};
    positions.forEach(position => {
      if (!underlyingPositions[position.underlying]) {
        underlyingPositions[position.underlying] = [];
      }
      underlyingPositions[position.underlying]!.push(position);
    });

    // Calculate risk metrics for each underlying
    Object.entries(underlyingPositions).forEach(([underlying, underlyingPos]) => {
      const totalExposure = this.calculateUnderlyingExposure(underlyingPos);
      const greeks = this.calculateUnderlyingGreeks(underlyingPos);
      
      underlyingRisk[underlying] = {
        underlying,
        totalExposure,
        netDelta: greeks.delta,
        gamma: greeks.gamma,
        theta: greeks.theta,
        vega: greeks.vega,
        positionCount: underlyingPos.length,
        portfolioPercent: totalPortfolioValue > 0 ? totalExposure / totalPortfolioValue * 100 : 0
      };
    });

    return underlyingRisk;
  }

  /**
   * Calculate total portfolio value from positions
   */
  private calculateTotalPortfolioValue(positions: DerivativePosition[]): number {
    return positions.reduce((total, position) => {
      return total + Math.abs(position.positionValue);
    }, 0);
  }

  /**
   * Calculate total derivatives exposure
   */
  private calculateDerivativesExposure(positions: DerivativePosition[]): number {
    return positions.reduce((total, position) => {
      // For derivatives, exposure is typically the notional value
      if (this.isOptionPosition(position)) {
        const optionPos = position as OptionPosition;
        return total + (optionPos.strike * optionPos.quantity);
      } else if (this.isFuturesPosition(position)) {
        const futuresPos = position as FuturesPosition;
        return total + (futuresPos.currentPrice * futuresPos.quantity * futuresPos.multiplier);
      }
      return total + Math.abs(position.positionValue);
    }, 0);
  }

  /**
   * Calculate total margin used
   */
  private calculateTotalMarginUsed(positions: DerivativePosition[]): number {
    return positions.reduce((total, position) => {
      return total + position.marginUsed;
    }, 0);
  }

  /**
   * Calculate Herfindahl-Hirschman Index for concentration
   */
  private calculateHerfindahlIndex(
    underlyingExposure: { [underlying: string]: number },
    totalValue: number
  ): number {
    if (totalValue === 0) return 0;

    let hhi = 0;
    Object.values(underlyingExposure).forEach(exposure => {
      const marketShare = exposure / totalValue;
      hhi += marketShare * marketShare;
    });

    return hhi;
  }

  /**
   * Calculate exposure for positions in a specific underlying
   */
  private calculateUnderlyingExposure(positions: DerivativePosition[]): number {
    return positions.reduce((total, position) => {
      return total + Math.abs(position.positionValue);
    }, 0);
  }

  /**
   * Calculate Greeks for positions in a specific underlying
   */
  private calculateUnderlyingGreeks(positions: DerivativePosition[]): Greeks {
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;
    let totalRho = 0;

    positions.forEach(position => {
      if (this.isOptionPosition(position)) {
        const optionPosition = position as OptionPosition;
        const { greeks, quantity } = optionPosition;
        const multiplier = position.positionType === 'long' ? 1 : -1;
        
        totalDelta += greeks.delta * quantity * multiplier;
        totalGamma += greeks.gamma * quantity * multiplier;
        totalTheta += greeks.theta * quantity * multiplier;
        totalVega += greeks.vega * quantity * multiplier;
        totalRho += greeks.rho * quantity * multiplier;
      }
    });

    return {
      delta: totalDelta,
      gamma: totalGamma,
      theta: totalTheta,
      vega: totalVega,
      rho: totalRho
    };
  }

  /**
   * Get correlation between two underlyings
   */
  private getCorrelation(underlying1: string, underlying2: string): number {
    if (!this.correlationMatrix) {
      // Default correlation assumptions if no matrix available
      if (underlying1 === underlying2) return 1.0;
      
      // Assume moderate correlation between different indices/stocks
      const indexSymbols = ['NIFTY', 'BANKNIFTY', 'SENSEX'];
      const isIndex1 = indexSymbols.includes(underlying1);
      const isIndex2 = indexSymbols.includes(underlying2);
      
      if (isIndex1 && isIndex2) return 0.7; // High correlation between indices
      if (isIndex1 || isIndex2) return 0.4; // Moderate correlation between index and stock
      return 0.3; // Lower correlation between individual stocks
    }

    const index1 = this.correlationMatrix.underlyings.indexOf(underlying1);
    const index2 = this.correlationMatrix.underlyings.indexOf(underlying2);
    
    if (index1 === -1 || index2 === -1) {
      return 0.3; // Default correlation for unknown pairs
    }

    return this.correlationMatrix.correlations[index1]?.[index2] || 0.3;
  }

  /**
   * Calculate historical VaR using historical simulation
   */
  private calculateHistoricalVaR(
    positions: DerivativePosition[],
    params: VaRParams
  ): number {
    // This is a simplified implementation
    // In practice, this would use historical price data and simulate portfolio returns
    
    const totalExposure = this.calculateDerivativesExposure(positions);
    const portfolioGreeks = this.calculatePortfolioGreeks(positions);
    
    // Estimate portfolio volatility based on Greeks and underlying volatilities
    let portfolioVolatility = 0;
    
    // Delta-adjusted exposure volatility
    const deltaExposure = Math.abs(portfolioGreeks.delta) * totalExposure;
    const avgVolatility = this.getAverageVolatility(positions);
    portfolioVolatility += deltaExposure * avgVolatility;
    
    // Gamma risk (convexity)
    const gammaRisk = Math.abs(portfolioGreeks.gamma) * totalExposure * Math.pow(avgVolatility, 2);
    portfolioVolatility += gammaRisk * 0.5;
    
    // Vega risk (volatility risk)
    const vegaRisk = Math.abs(portfolioGreeks.vega) * 0.05; // Assume 5% vol change
    portfolioVolatility += vegaRisk;
    
    // Convert to VaR using normal distribution approximation
    const zScore = this.getZScore(params.confidenceLevel);
    const timeAdjustment = Math.sqrt(params.timeHorizon);
    
    return portfolioVolatility * zScore * timeAdjustment;
  }

  /**
   * Calculate Monte Carlo VaR
   */
  private calculateMonteCarloVaR(
    positions: DerivativePosition[],
    params: VaRParams
  ): number {
    const numSimulations = 10000;
    const portfolioReturns: number[] = [];
    
    const portfolioGreeks = this.calculatePortfolioGreeks(positions);
    const totalExposure = this.calculateDerivativesExposure(positions);
    
    // Run Monte Carlo simulations
    for (let i = 0; i < numSimulations; i++) {
      // Generate random market moves
      const underlyingMove = this.generateRandomMove();
      const volatilityMove = this.generateRandomMove() * 0.1; // Smaller vol moves
      
      // Calculate portfolio P&L based on Greeks
      let portfolioPnL = 0;
      
      // Delta P&L
      portfolioPnL += portfolioGreeks.delta * underlyingMove * totalExposure * 0.01;
      
      // Gamma P&L (second-order effect)
      portfolioPnL += 0.5 * portfolioGreeks.gamma * Math.pow(underlyingMove * totalExposure * 0.01, 2);
      
      // Vega P&L
      portfolioPnL += portfolioGreeks.vega * volatilityMove;
      
      // Theta P&L (time decay)
      portfolioPnL += portfolioGreeks.theta * params.timeHorizon;
      
      portfolioReturns.push(portfolioPnL);
    }
    
    // Sort returns and find VaR percentile
    portfolioReturns.sort((a, b) => a - b);
    const varIndex = Math.floor((1 - params.confidenceLevel) * numSimulations);
    
    return Math.abs(portfolioReturns[varIndex] || 0);
  }

  /**
   * Calculate simple VaR as fallback
   */
  private calculateSimpleVaR(
    positions: DerivativePosition[],
    params: VaRParams
  ): number {
    const totalExposure = this.calculateDerivativesExposure(positions);
    const avgVolatility = this.getAverageVolatility(positions);
    
    const zScore = this.getZScore(params.confidenceLevel);
    const timeAdjustment = Math.sqrt(params.timeHorizon);
    
    return totalExposure * avgVolatility * zScore * timeAdjustment;
  }

  /**
   * Get average volatility across positions
   */
  private getAverageVolatility(positions: DerivativePosition[]): number {
    let totalVolatility = 0;
    let count = 0;

    positions.forEach(position => {
      if (this.isOptionPosition(position)) {
        const optionPos = position as OptionPosition;
        totalVolatility += optionPos.impliedVolatility;
        count++;
      } else {
        // Use historical volatility for futures or default
        const historicalVol = this.historicalVolatilities.get(position.underlying) || 0.25;
        totalVolatility += historicalVol;
        count++;
      }
    });

    return count > 0 ? totalVolatility / count : 0.25; // Default 25% volatility
  }

  /**
   * Get Z-score for confidence level
   */
  private getZScore(confidenceLevel: number): number {
    // Approximate Z-scores for common confidence levels
    const zScores: { [key: number]: number } = {
      0.90: 1.28,
      0.95: 1.65,
      0.99: 2.33
    };

    return zScores[confidenceLevel] || 1.65; // Default to 95%
  }

  /**
   * Generate random market move for Monte Carlo simulation
   */
  private generateRandomMove(): number {
    // Box-Muller transformation for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Type guard for option positions
   */
  private isOptionPosition(position: DerivativePosition): position is OptionPosition {
    return 'optionType' in position && 'strike' in position;
  }

  /**
   * Type guard for futures positions
   */
  private isFuturesPosition(position: DerivativePosition): position is FuturesPosition {
    return 'contractSize' in position && 'multiplier' in position;
  }

  /**
   * Update correlation matrix
   */
  public updateCorrelationMatrix(correlationMatrix: CorrelationMatrix): void {
    this.correlationMatrix = correlationMatrix;
  }

  /**
   * Update historical volatilities
   */
  public updateHistoricalVolatilities(volatilities: Map<string, number>): void {
    this.historicalVolatilities = new Map(volatilities);
  }

  /**
   * Get service statistics
   */
  public getStats() {
    return {
      hasCorrelationMatrix: this.correlationMatrix !== null,
      correlationMatrixSize: this.correlationMatrix?.underlyings.length || 0,
      historicalVolatilitiesCount: this.historicalVolatilities.size,
      lastCorrelationUpdate: this.correlationMatrix?.lastUpdated
    };
  }
}

// Create singleton instance
export const portfolioRiskCalculator = new PortfolioRiskCalculator();