/**
 * Portfolio Risk Calculator Tests
 * Tests for comprehensive risk calculations including VaR, Greeks, and concentration risk
 */

import { beforeEach } from 'node:test';
import { 
  PortfolioRiskCalculator, 
  PortfolioRisk, 
  ConcentrationMetrics,
  CorrelationMatrix 
} from '../services/portfolioRiskCalculator';
import { 
  DerivativePosition, 
  OptionPosition, 
  FuturesPosition, 
  Greeks 
} from '@copytrade/shared-types';

describe('PortfolioRiskCalculator', () => {
  let riskCalculator: PortfolioRiskCalculator;

  beforeEach(() => {
    riskCalculator = new PortfolioRiskCalculator();
  });

  describe('Portfolio Greeks Calculation', () => {
    it('should calculate portfolio Greeks correctly for option positions', () => {
      const positions: OptionPosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'long',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: 1000,
          realizedPnL: 0,
          totalPnL: 1000,
          positionValue: 6000,
          marginUsed: 5000,
          entryDate: new Date(),
          lastUpdated: new Date(),
          optionType: 'call',
          strike: 20000,
          expiryDate: new Date('2024-01-25'),
          premium: 100,
          greeks: {
            delta: 0.6,
            gamma: 0.02,
            theta: -5,
            vega: 15,
            rho: 8
          },
          impliedVolatility: 0.2,
          timeValue: 20,
          intrinsicValue: 100,
          daysToExpiry: 10
        },
        {
          id: '2',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN19500PE',
          underlying: 'NIFTY',
          positionType: 'short',
          quantity: 25,
          avgPrice: 80,
          currentPrice: 60,
          unrealizedPnL: 500,
          realizedPnL: 0,
          totalPnL: 500,
          positionValue: -1500,
          marginUsed: 3000,
          entryDate: new Date(),
          lastUpdated: new Date(),
          optionType: 'put',
          strike: 19500,
          expiryDate: new Date('2024-01-25'),
          premium: 80,
          greeks: {
            delta: -0.4,
            gamma: 0.015,
            theta: -3,
            vega: 12,
            rho: -6
          },
          impliedVolatility: 0.18,
          timeValue: 10,
          intrinsicValue: 50,
          daysToExpiry: 10
        }
      ];

      const portfolioGreeks = riskCalculator.calculatePortfolioGreeks(positions);

      // Long 50 calls: delta = 0.6 * 50 = 30
      // Short 25 puts: delta = -(-0.4) * 25 = 10
      // Total delta = 30 + 10 = 40
      expect(portfolioGreeks.delta).toBe(40);

      // Long 50 calls: gamma = 0.02 * 50 = 1
      // Short 25 puts: gamma = -(0.015) * 25 = -0.375
      // Total gamma = 1 - 0.375 = 0.625
      expect(portfolioGreeks.gamma).toBe(0.625);

      // Long 50 calls: theta = -5 * 50 = -250
      // Short 25 puts: theta = -(-3) * 25 = 75
      // Total theta = -250 + 75 = -175
      expect(portfolioGreeks.theta).toBe(-175);

      // Long 50 calls: vega = 15 * 50 = 750
      // Short 25 puts: vega = -(12) * 25 = -300
      // Total vega = 750 - 300 = 450
      expect(portfolioGreeks.vega).toBe(450);

      // Long 50 calls: rho = 8 * 50 = 400
      // Short 25 puts: rho = -(-6) * 25 = 150
      // Total rho = 400 + 150 = 550
      expect(portfolioGreeks.rho).toBe(550);
    });

    it('should handle empty positions array', () => {
      const portfolioGreeks = riskCalculator.calculatePortfolioGreeks([]);

      expect(portfolioGreeks.delta).toBe(0);
      expect(portfolioGreeks.gamma).toBe(0);
      expect(portfolioGreeks.theta).toBe(0);
      expect(portfolioGreeks.vega).toBe(0);
      expect(portfolioGreeks.rho).toBe(0);
    });
  });

  describe('Concentration Risk Calculation', () => {
    it('should calculate concentration risk metrics correctly', () => {
      const positions: DerivativePosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'long',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: 1000,
          realizedPnL: 0,
          totalPnL: 1000,
          positionValue: 6000, // 60% of total
          marginUsed: 5000,
          entryDate: new Date(),
          lastUpdated: new Date()
        },
        {
          id: '2',
          brokerId: 'broker1',
          symbol: 'BANKNIFTY24JAN45000CE',
          underlying: 'BANKNIFTY',
          positionType: 'long',
          quantity: 25,
          avgPrice: 80,
          currentPrice: 100,
          unrealizedPnL: 500,
          realizedPnL: 0,
          totalPnL: 500,
          positionValue: 2500, // 25% of total
          marginUsed: 3000,
          entryDate: new Date(),
          lastUpdated: new Date()
        },
        {
          id: '3',
          brokerId: 'broker1',
          symbol: 'RELIANCE24JAN2500CE',
          underlying: 'RELIANCE',
          positionType: 'long',
          quantity: 10,
          avgPrice: 150,
          currentPrice: 150,
          unrealizedPnL: 0,
          realizedPnL: 0,
          totalPnL: 0,
          positionValue: 1500, // 15% of total
          marginUsed: 2000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const totalValue = 10000;
      const concentrationRisk = riskCalculator.calculateConcentrationRisk(positions, totalValue);

      expect(concentrationRisk.largestPositionPercent).toBe(60); // NIFTY position
      expect(concentrationRisk.top5PositionsPercent).toBe(100); // All positions
      expect(concentrationRisk.underlyingCount).toBe(3);
      expect(concentrationRisk.underlyingConcentration['NIFTY']).toBe(60);
      expect(concentrationRisk.underlyingConcentration['BANKNIFTY']).toBe(25);
      expect(concentrationRisk.underlyingConcentration['RELIANCE']).toBe(15);

      // HHI = (0.6)² + (0.25)² + (0.15)² = 0.36 + 0.0625 + 0.0225 = 0.445
      expect(concentrationRisk.herfindahlIndex).toBeCloseTo(0.445, 3);
    });

    it('should handle zero portfolio value', () => {
      const positions: DerivativePosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'TEST',
          underlying: 'TEST',
          positionType: 'long',
          quantity: 1,
          avgPrice: 100,
          currentPrice: 100,
          unrealizedPnL: 0,
          realizedPnL: 0,
          totalPnL: 0,
          positionValue: 100,
          marginUsed: 50,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const concentrationRisk = riskCalculator.calculateConcentrationRisk(positions, 0);

      expect(concentrationRisk.largestPositionPercent).toBe(0);
      expect(concentrationRisk.top5PositionsPercent).toBe(0);
      expect(concentrationRisk.herfindahlIndex).toBe(0);
    });
  });

  describe('Portfolio Risk Calculation', () => {
    it('should calculate comprehensive portfolio risk metrics', () => {
      const positions: OptionPosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'long',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: 1000,
          realizedPnL: 0,
          totalPnL: 1000,
          positionValue: 6000,
          marginUsed: 5000,
          entryDate: new Date(),
          lastUpdated: new Date(),
          optionType: 'call',
          strike: 20000,
          expiryDate: new Date('2024-01-25'),
          premium: 100,
          greeks: {
            delta: 0.6,
            gamma: 0.02,
            theta: -5,
            vega: 15,
            rho: 8
          },
          impliedVolatility: 0.2,
          timeValue: 20,
          intrinsicValue: 100,
          daysToExpiry: 10
        }
      ];

      const portfolioRisk = riskCalculator.calculatePortfolioRisk(
        positions,
        10000, // total portfolio value
        5000   // available margin
      );

      expect(portfolioRisk.totalValue).toBe(6000);
      expect(portfolioRisk.marginUsed).toBe(5000);
      expect(portfolioRisk.marginAvailable).toBe(5000);
      expect(portfolioRisk.portfolioGreeks.delta).toBe(30); // 0.6 * 50
      expect(portfolioRisk.concentrationRisk.underlyingCount).toBe(1);
      expect(portfolioRisk.valueAtRisk).toBeGreaterThan(0);
      expect(portfolioRisk.underlyingRisk['NIFTY']).toBeDefined();
      expect(portfolioRisk.lastCalculated).toBeInstanceOf(Date);
    });
  });

  describe('Correlation Risk Calculation', () => {
    it('should calculate correlation risk between different underlyings', () => {
      const positions: DerivativePosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'long',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: 1000,
          realizedPnL: 0,
          totalPnL: 1000,
          positionValue: 6000,
          marginUsed: 5000,
          entryDate: new Date(),
          lastUpdated: new Date()
        },
        {
          id: '2',
          brokerId: 'broker1',
          symbol: 'BANKNIFTY24JAN45000CE',
          underlying: 'BANKNIFTY',
          positionType: 'long',
          quantity: 25,
          avgPrice: 80,
          currentPrice: 100,
          unrealizedPnL: 500,
          realizedPnL: 0,
          totalPnL: 500,
          positionValue: 2500,
          marginUsed: 3000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const correlationRisk = riskCalculator.calculateCorrelationRisk(positions);

      expect(correlationRisk['NIFTY-BANKNIFTY']).toBeDefined();
      expect(correlationRisk['NIFTY-BANKNIFTY']).toBeGreaterThan(0);
    });
  });

  describe('Value at Risk Calculation', () => {
    it('should calculate VaR using historical simulation method', () => {
      const positions: OptionPosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'long',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: 1000,
          realizedPnL: 0,
          totalPnL: 1000,
          positionValue: 6000,
          marginUsed: 5000,
          entryDate: new Date(),
          lastUpdated: new Date(),
          optionType: 'call',
          strike: 20000,
          expiryDate: new Date('2024-01-25'),
          premium: 100,
          greeks: {
            delta: 0.6,
            gamma: 0.02,
            theta: -5,
            vega: 15,
            rho: 8
          },
          impliedVolatility: 0.2,
          timeValue: 20,
          intrinsicValue: 100,
          daysToExpiry: 10
        }
      ];

      const varParams = {
        confidenceLevel: 0.95,
        timeHorizon: 1,
        lookbackPeriod: 252,
        useMonteCarloSimulation: false
      };

      const var95 = riskCalculator.calculateValueAtRisk(positions, varParams);

      expect(var95).toBeGreaterThan(0);
      expect(var95).toBeLessThan(50000000); // Reasonable upper bound for derivatives
    });

    it('should calculate VaR using Monte Carlo simulation', () => {
      const positions: OptionPosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'long',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: 1000,
          realizedPnL: 0,
          totalPnL: 1000,
          positionValue: 6000,
          marginUsed: 5000,
          entryDate: new Date(),
          lastUpdated: new Date(),
          optionType: 'call',
          strike: 20000,
          expiryDate: new Date('2024-01-25'),
          premium: 100,
          greeks: {
            delta: 0.6,
            gamma: 0.02,
            theta: -5,
            vega: 15,
            rho: 8
          },
          impliedVolatility: 0.2,
          timeValue: 20,
          intrinsicValue: 100,
          daysToExpiry: 10
        }
      ];

      const varParams = {
        confidenceLevel: 0.95,
        timeHorizon: 1,
        lookbackPeriod: 252,
        useMonteCarloSimulation: true
      };

      const var95 = riskCalculator.calculateValueAtRisk(positions, varParams);

      expect(var95).toBeGreaterThan(0);
      expect(var95).toBeLessThan(1000000); // Reasonable upper bound
    });

    it('should return 0 VaR for empty positions', () => {
      const varParams = {
        confidenceLevel: 0.95,
        timeHorizon: 1,
        lookbackPeriod: 252,
        useMonteCarloSimulation: false
      };

      const var95 = riskCalculator.calculateValueAtRisk([], varParams);

      expect(var95).toBe(0);
    });
  });

  describe('Correlation Matrix Updates', () => {
    it('should update correlation matrix correctly', () => {
      const correlationMatrix: CorrelationMatrix = {
        underlyings: ['NIFTY', 'BANKNIFTY', 'RELIANCE'],
        correlations: [
          [1.0, 0.7, 0.4],
          [0.7, 1.0, 0.3],
          [0.4, 0.3, 1.0]
        ],
        lastUpdated: new Date()
      };

      riskCalculator.updateCorrelationMatrix(correlationMatrix);

      const stats = riskCalculator.getStats();
      expect(stats.hasCorrelationMatrix).toBe(true);
      expect(stats.correlationMatrixSize).toBe(3);
    });

    it('should update historical volatilities correctly', () => {
      const volatilities = new Map([
        ['NIFTY', 0.25],
        ['BANKNIFTY', 0.30],
        ['RELIANCE', 0.35]
      ]);

      riskCalculator.updateHistoricalVolatilities(volatilities);

      const stats = riskCalculator.getStats();
      expect(stats.historicalVolatilitiesCount).toBe(3);
    });
  });

  describe('Service Statistics', () => {
    it('should return correct service statistics', () => {
      const stats = riskCalculator.getStats();

      expect(stats).toHaveProperty('hasCorrelationMatrix');
      expect(stats).toHaveProperty('correlationMatrixSize');
      expect(stats).toHaveProperty('historicalVolatilitiesCount');
      expect(stats).toHaveProperty('lastCorrelationUpdate');
      
      expect(typeof stats.hasCorrelationMatrix).toBe('boolean');
      expect(typeof stats.correlationMatrixSize).toBe('number');
      expect(typeof stats.historicalVolatilitiesCount).toBe('number');
    });
  });

  describe('Edge Cases', () => {
    it('should handle positions with zero values', () => {
      const positions: DerivativePosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'TEST',
          underlying: 'TEST',
          positionType: 'long',
          quantity: 0,
          avgPrice: 0,
          currentPrice: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
          totalPnL: 0,
          positionValue: 0,
          marginUsed: 0,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const portfolioRisk = riskCalculator.calculatePortfolioRisk(positions, 0, 0);

      expect(portfolioRisk.totalValue).toBe(0);
      expect(portfolioRisk.derivativesExposure).toBe(0);
      expect(portfolioRisk.marginUsed).toBe(0);
      expect(portfolioRisk.valueAtRisk).toBe(0);
    });

    it('should handle mixed option and futures positions', () => {
      const positions: (OptionPosition | FuturesPosition)[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'long',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: 1000,
          realizedPnL: 0,
          totalPnL: 1000,
          positionValue: 6000,
          marginUsed: 5000,
          entryDate: new Date(),
          lastUpdated: new Date(),
          optionType: 'call',
          strike: 20000,
          expiryDate: new Date('2024-01-25'),
          premium: 100,
          greeks: {
            delta: 0.6,
            gamma: 0.02,
            theta: -5,
            vega: 15,
            rho: 8
          },
          impliedVolatility: 0.2,
          timeValue: 20,
          intrinsicValue: 100,
          daysToExpiry: 10
        } as OptionPosition,
        {
          id: '2',
          brokerId: 'broker1',
          symbol: 'NIFTY24JANFUT',
          underlying: 'NIFTY',
          positionType: 'long',
          quantity: 25,
          avgPrice: 20000,
          currentPrice: 20100,
          unrealizedPnL: 2500,
          realizedPnL: 0,
          totalPnL: 2500,
          positionValue: 502500,
          marginUsed: 50000,
          entryDate: new Date(),
          lastUpdated: new Date(),
          expiryDate: new Date('2024-01-25'),
          contractSize: 50,
          initialMargin: 50000,
          maintenanceMargin: 40000,
          markToMarket: 502500,
          settlementPrice: 20100,
          multiplier: 50
        } as FuturesPosition
      ];

      const portfolioRisk = riskCalculator.calculatePortfolioRisk(positions, 600000, 100000);

      expect(portfolioRisk.totalValue).toBeGreaterThan(0);
      expect(portfolioRisk.underlyingRisk['NIFTY']).toBeDefined();
      expect(portfolioRisk.underlyingRisk['NIFTY']?.positionCount).toBe(2);
    });
  });
});