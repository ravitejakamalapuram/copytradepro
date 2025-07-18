/**
 * Option Pricing Service
 * Implements Black-Scholes model for option pricing and Greeks calculations
 * Includes implied volatility calculation using Newton-Raphson method
 */

import { Greeks, OptionContract } from '@copytrade/shared-types';

/**
 * Parameters for Black-Scholes option pricing model
 */
export interface BlackScholesParams {
  /** Current price of underlying asset */
  spotPrice: number;
  /** Strike price of the option */
  strikePrice: number;
  /** Time to expiration in years */
  timeToExpiry: number;
  /** Risk-free interest rate (annual) */
  riskFreeRate: number;
  /** Volatility of underlying asset (annual) */
  volatility: number;
  /** Dividend yield (annual) */
  dividendYield?: number;
}

/**
 * Option pricing and Greeks calculation service
 */
export class OptionPricingService {
  private static readonly SQRT_2PI = Math.sqrt(2 * Math.PI);
  private static readonly MAX_ITERATIONS = 100;
  private static readonly TOLERANCE = 1e-6;

  /**
   * Calculate standard normal cumulative distribution function
   */
  private static normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Calculate standard normal probability density function
   */
  private static normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / this.SQRT_2PI;
  }

  /**
   * Calculate d1 parameter for Black-Scholes model
   */
  private static calculateD1(params: BlackScholesParams): number {
    const { spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield = 0 } = params;
    
    const numerator = Math.log(spotPrice / strikePrice) + 
                     (riskFreeRate - dividendYield + 0.5 * volatility * volatility) * timeToExpiry;
    const denominator = volatility * Math.sqrt(timeToExpiry);
    
    return numerator / denominator;
  }

  /**
   * Calculate d2 parameter for Black-Scholes model
   */
  private static calculateD2(params: BlackScholesParams): number {
    const d1 = this.calculateD1(params);
    return d1 - params.volatility * Math.sqrt(params.timeToExpiry);
  }

  /**
   * Calculate call option price using Black-Scholes model
   */
  public static calculateCallPrice(params: BlackScholesParams): number {
    const { spotPrice, strikePrice, timeToExpiry, riskFreeRate, dividendYield = 0 } = params;
    
    if (timeToExpiry <= 0) {
      return Math.max(spotPrice - strikePrice, 0);
    }

    const d1 = this.calculateD1(params);
    const d2 = this.calculateD2(params);
    
    const callPrice = spotPrice * Math.exp(-dividendYield * timeToExpiry) * this.normalCDF(d1) -
                     strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * this.normalCDF(d2);
    
    return Math.max(callPrice, 0);
  }

  /**
   * Calculate put option price using Black-Scholes model
   */
  public static calculatePutPrice(params: BlackScholesParams): number {
    const { spotPrice, strikePrice, timeToExpiry, riskFreeRate, dividendYield = 0 } = params;
    
    if (timeToExpiry <= 0) {
      return Math.max(strikePrice - spotPrice, 0);
    }

    const d1 = this.calculateD1(params);
    const d2 = this.calculateD2(params);
    
    const putPrice = strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * this.normalCDF(-d2) -
                    spotPrice * Math.exp(-dividendYield * timeToExpiry) * this.normalCDF(-d1);
    
    return Math.max(putPrice, 0);
  }

  /**
   * Calculate Greeks for an option
   */
  public static calculateGreeks(params: BlackScholesParams, optionType: 'call' | 'put'): Greeks {
    const { spotPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, dividendYield = 0 } = params;
    
    if (timeToExpiry <= 0) {
      return {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0
      };
    }

    const d1 = this.calculateD1(params);
    const d2 = this.calculateD2(params);
    const nd1 = this.normalCDF(d1);
    const nd2 = this.normalCDF(d2);
    const npd1 = this.normalPDF(d1);
    
    // Delta calculation
    let delta: number;
    if (optionType === 'call') {
      delta = Math.exp(-dividendYield * timeToExpiry) * nd1;
    } else {
      delta = Math.exp(-dividendYield * timeToExpiry) * (nd1 - 1);
    }

    // Gamma calculation (same for calls and puts)
    const gamma = Math.exp(-dividendYield * timeToExpiry) * npd1 / 
                  (spotPrice * volatility * Math.sqrt(timeToExpiry));

    // Theta calculation
    let theta: number;
    const term1 = -spotPrice * npd1 * volatility * Math.exp(-dividendYield * timeToExpiry) / 
                  (2 * Math.sqrt(timeToExpiry));
    const term2 = riskFreeRate * strikePrice * Math.exp(-riskFreeRate * timeToExpiry);
    const term3 = dividendYield * spotPrice * Math.exp(-dividendYield * timeToExpiry);
    
    if (optionType === 'call') {
      theta = term1 - term2 * nd2 + term3 * nd1;
    } else {
      theta = term1 + term2 * this.normalCDF(-d2) - term3 * this.normalCDF(-d1);
    }
    
    // Convert theta to per-day basis
    theta = theta / 365;

    // Vega calculation (same for calls and puts)
    const vega = spotPrice * Math.exp(-dividendYield * timeToExpiry) * npd1 * 
                Math.sqrt(timeToExpiry) / 100; // Divide by 100 for 1% volatility change

    // Rho calculation
    let rho: number;
    if (optionType === 'call') {
      rho = strikePrice * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * nd2 / 100;
    } else {
      rho = -strikePrice * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * 
            this.normalCDF(-d2) / 100;
    }

    return {
      delta: Number(delta.toFixed(4)),
      gamma: Number(gamma.toFixed(4)),
      theta: Number(theta.toFixed(4)),
      vega: Number(vega.toFixed(4)),
      rho: Number(rho.toFixed(4))
    };
  }

  /**
   * Calculate implied volatility using Newton-Raphson method
   */
  public static calculateImpliedVolatility(
    marketPrice: number,
    params: Omit<BlackScholesParams, 'volatility'>,
    optionType: 'call' | 'put'
  ): number {
    let volatility = 0.2; // Initial guess: 20%
    
    for (let i = 0; i < this.MAX_ITERATIONS; i++) {
      const fullParams = { ...params, volatility };
      
      // Calculate theoretical price and vega
      const theoreticalPrice = optionType === 'call' 
        ? this.calculateCallPrice(fullParams)
        : this.calculatePutPrice(fullParams);
      
      const priceDiff = theoreticalPrice - marketPrice;
      
      // Check for convergence
      if (Math.abs(priceDiff) < this.TOLERANCE) {
        return Number(volatility.toFixed(4));
      }
      
      // Calculate vega for Newton-Raphson iteration
      const greeks = this.calculateGreeks(fullParams, optionType);
      const vega = greeks.vega * 100; // Convert back to decimal form
      
      // Avoid division by zero
      if (Math.abs(vega) < this.TOLERANCE) {
        break;
      }
      
      // Newton-Raphson update
      volatility = volatility - priceDiff / vega;
      
      // Keep volatility within reasonable bounds
      volatility = Math.max(0.001, Math.min(5.0, volatility));
    }
    
    return Number(volatility.toFixed(4));
  }

  /**
   * Calculate intrinsic value of an option
   */
  public static calculateIntrinsicValue(
    spotPrice: number,
    strikePrice: number,
    optionType: 'call' | 'put'
  ): number {
    if (optionType === 'call') {
      return Math.max(spotPrice - strikePrice, 0);
    } else {
      return Math.max(strikePrice - spotPrice, 0);
    }
  }

  /**
   * Calculate time value of an option
   */
  public static calculateTimeValue(
    optionPrice: number,
    intrinsicValue: number
  ): number {
    return Math.max(optionPrice - intrinsicValue, 0);
  }

  /**
   * Calculate days to expiry from expiry date
   */
  public static calculateDaysToExpiry(expiryDate: Date): number {
    const now = new Date();
    const timeDiff = expiryDate.getTime() - now.getTime();
    return Math.max(Math.ceil(timeDiff / (1000 * 3600 * 24)), 0);
  }

  /**
   * Convert days to years for Black-Scholes calculations
   */
  public static daysToYears(days: number): number {
    return days / 365;
  }

  /**
   * Update option contract with calculated values
   */
  public static updateOptionWithCalculations(
    option: Partial<OptionContract>,
    spotPrice: number,
    riskFreeRate: number = 0.05,
    dividendYield: number = 0
  ): OptionContract {
    const daysToExpiry = this.calculateDaysToExpiry(option.expiryDate!);
    const timeToExpiry = this.daysToYears(daysToExpiry);
    
    const params: BlackScholesParams = {
      spotPrice,
      strikePrice: option.strike!,
      timeToExpiry,
      riskFreeRate,
      volatility: option.impliedVolatility || 0.2,
      dividendYield
    };

    const greeks = this.calculateGreeks(params, option.optionType!);
    const intrinsicValue = this.calculateIntrinsicValue(spotPrice, option.strike!, option.optionType!);
    const timeValue = this.calculateTimeValue(option.premium || option.lastPrice || 0, intrinsicValue);

    return {
      ...option,
      greeks,
      intrinsicValue,
      timeValue,
      daysToExpiry
    } as OptionContract;
  }
}