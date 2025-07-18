/**
 * Unit tests for Option Pricing Service
 * Tests Black-Scholes calculations, Greeks, and implied volatility
 */

import { OptionPricingService, BlackScholesParams } from '../services/optionPricingService';

describe('OptionPricingService', () => {
  const baseParams: BlackScholesParams = {
    spotPrice: 100,
    strikePrice: 100,
    timeToExpiry: 0.25, // 3 months
    riskFreeRate: 0.05, // 5%
    volatility: 0.2, // 20%
    dividendYield: 0
  };

  describe('Black-Scholes Option Pricing', () => {
    test('should calculate call option price correctly', () => {
      const callPrice = OptionPricingService.calculateCallPrice(baseParams);
      
      // Expected value based on Black-Scholes formula
      // For S=100, K=100, T=0.25, r=0.05, σ=0.2
      expect(callPrice).toBeCloseTo(4.61, 1);
    });

    test('should calculate put option price correctly', () => {
      const putPrice = OptionPricingService.calculatePutPrice(baseParams);
      
      // Expected value based on Black-Scholes formula
      expect(putPrice).toBeCloseTo(3.37, 1);
    });

    test('should satisfy put-call parity', () => {
      const callPrice = OptionPricingService.calculateCallPrice(baseParams);
      const putPrice = OptionPricingService.calculatePutPrice(baseParams);
      
      // Put-Call Parity: C - P = S - K*e^(-r*T)
      const leftSide = callPrice - putPrice;
      const rightSide = baseParams.spotPrice - 
                       baseParams.strikePrice * Math.exp(-baseParams.riskFreeRate * baseParams.timeToExpiry);
      
      expect(leftSide).toBeCloseTo(rightSide, 2);
    });

    test('should handle zero time to expiry', () => {
      const expiredParams = { ...baseParams, timeToExpiry: 0 };
      
      const callPrice = OptionPricingService.calculateCallPrice(expiredParams);
      const putPrice = OptionPricingService.calculatePutPrice(expiredParams);
      
      // At expiry, options are worth their intrinsic value
      expect(callPrice).toBe(0); // ATM call has no intrinsic value
      expect(putPrice).toBe(0);  // ATM put has no intrinsic value
    });

    test('should handle deep ITM options', () => {
      const itmParams = { ...baseParams, strikePrice: 80 }; // Deep ITM call
      
      const callPrice = OptionPricingService.calculateCallPrice(itmParams);
      
      // Deep ITM call should be worth at least intrinsic value
      const intrinsicValue = Math.max(itmParams.spotPrice - itmParams.strikePrice, 0);
      expect(callPrice).toBeGreaterThan(intrinsicValue);
    });
  });

  describe('Greeks Calculations', () => {
    test('should calculate call option Greeks correctly', () => {
      const greeks = OptionPricingService.calculateGreeks(baseParams, 'call');
      
      // Verify Greeks are within expected ranges
      expect(greeks.delta).toBeGreaterThan(0);
      expect(greeks.delta).toBeLessThan(1);
      expect(greeks.gamma).toBeGreaterThan(0);
      expect(greeks.theta).toBeLessThan(0); // Time decay is negative
      expect(greeks.vega).toBeGreaterThan(0);
    });

    test('should calculate put option Greeks correctly', () => {
      const greeks = OptionPricingService.calculateGreeks(baseParams, 'put');
      
      // Put delta should be negative
      expect(greeks.delta).toBeLessThan(0);
      expect(greeks.delta).toBeGreaterThan(-1);
      expect(greeks.gamma).toBeGreaterThan(0); // Same as call
      expect(greeks.theta).toBeLessThan(0); // Time decay is negative
      expect(greeks.vega).toBeGreaterThan(0); // Same as call
    });

    test('should have gamma symmetry between calls and puts', () => {
      const callGreeks = OptionPricingService.calculateGreeks(baseParams, 'call');
      const putGreeks = OptionPricingService.calculateGreeks(baseParams, 'put');
      
      // Gamma should be the same for calls and puts with same parameters
      expect(callGreeks.gamma).toBeCloseTo(putGreeks.gamma, 4);
      expect(callGreeks.vega).toBeCloseTo(putGreeks.vega, 4);
    });

    test('should handle zero time to expiry Greeks', () => {
      const expiredParams = { ...baseParams, timeToExpiry: 0 };
      const greeks = OptionPricingService.calculateGreeks(expiredParams, 'call');
      
      // All Greeks should be zero at expiry
      expect(greeks.delta).toBe(0);
      expect(greeks.gamma).toBe(0);
      expect(greeks.theta).toBe(0);
      expect(greeks.vega).toBe(0);
      expect(greeks.rho).toBe(0);
    });
  });

  describe('Implied Volatility Calculation', () => {
    test('should calculate implied volatility correctly', () => {
      // First calculate a theoretical price with known volatility
      const knownVolatility = 0.25;
      const paramsWithKnownVol = { ...baseParams, volatility: knownVolatility };
      const theoreticalPrice = OptionPricingService.calculateCallPrice(paramsWithKnownVol);
      
      // Now calculate implied volatility from that price
      const paramsWithoutVol = { ...baseParams };
      delete (paramsWithoutVol as any).volatility;
      
      const impliedVol = OptionPricingService.calculateImpliedVolatility(
        theoreticalPrice,
        paramsWithoutVol,
        'call'
      );
      
      expect(impliedVol).toBeCloseTo(knownVolatility, 3);
    });

    test('should handle extreme market prices', () => {
      const paramsWithoutVol = { ...baseParams };
      delete (paramsWithoutVol as any).volatility;
      
      // Very high price should result in high implied volatility
      const highImpliedVol = OptionPricingService.calculateImpliedVolatility(
        20, // Very high price for ATM option
        paramsWithoutVol,
        'call'
      );
      
      expect(highImpliedVol).toBeGreaterThan(0.5);
      
      // Very low price should result in low implied volatility
      const lowImpliedVol = OptionPricingService.calculateImpliedVolatility(
        0.1, // Very low price
        paramsWithoutVol,
        'call'
      );
      
      expect(lowImpliedVol).toBeLessThan(0.1);
    });
  });

  describe('Utility Functions', () => {
    test('should calculate intrinsic value correctly', () => {
      // ITM call
      const itmCallIntrinsic = OptionPricingService.calculateIntrinsicValue(110, 100, 'call');
      expect(itmCallIntrinsic).toBe(10);
      
      // OTM call
      const otmCallIntrinsic = OptionPricingService.calculateIntrinsicValue(90, 100, 'call');
      expect(otmCallIntrinsic).toBe(0);
      
      // ITM put
      const itmPutIntrinsic = OptionPricingService.calculateIntrinsicValue(90, 100, 'put');
      expect(itmPutIntrinsic).toBe(10);
      
      // OTM put
      const otmPutIntrinsic = OptionPricingService.calculateIntrinsicValue(110, 100, 'put');
      expect(otmPutIntrinsic).toBe(0);
    });

    test('should calculate time value correctly', () => {
      const optionPrice = 8;
      const intrinsicValue = 5;
      const timeValue = OptionPricingService.calculateTimeValue(optionPrice, intrinsicValue);
      
      expect(timeValue).toBe(3);
    });

    test('should calculate days to expiry correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      const days = OptionPricingService.calculateDaysToExpiry(futureDate);
      expect(days).toBe(30);
      
      // Past date should return 0
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      
      const pastDays = OptionPricingService.calculateDaysToExpiry(pastDate);
      expect(pastDays).toBe(0);
    });

    test('should convert days to years correctly', () => {
      expect(OptionPricingService.daysToYears(365)).toBe(1);
      expect(OptionPricingService.daysToYears(182.5)).toBeCloseTo(0.5, 3);
    });
  });

  describe('Option Contract Updates', () => {
    test('should update option contract with calculations', () => {
      // Create a future expiry date (30 days from now)
      const futureExpiryDate = new Date();
      futureExpiryDate.setDate(futureExpiryDate.getDate() + 30);
      
      const partialOption = {
        symbol: 'NIFTY25JAN11000CE',
        underlying: 'NIFTY',
        optionType: 'call' as const,
        strike: 11000,
        premium: 150,
        lastPrice: 150,
        expiryDate: futureExpiryDate,
        impliedVolatility: 0.18,
        lotSize: 50,
        tickSize: 0.05,
        bid: 149,
        ask: 151,
        volume: 1000,
        openInterest: 5000,
        timestamp: new Date()
      };
      
      const spotPrice = 11100;
      const updatedOption = OptionPricingService.updateOptionWithCalculations(
        partialOption,
        spotPrice
      );
      
      expect(updatedOption.greeks).toBeDefined();
      expect(updatedOption.intrinsicValue).toBe(100); // 11100 - 11000
      expect(updatedOption.timeValue).toBe(50); // 150 - 100
      expect(updatedOption.daysToExpiry).toBe(30);
    });
  });
});