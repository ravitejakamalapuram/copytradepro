/**
 * Margin Calculator Service Tests
 * Tests for margin calculations, monitoring, and validation
 */

import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { 
  MarginCalculatorService, 
  MarginInfo, 
  MarginRequirement,
  MarginImpact,
  MarginCall
} from '../services/marginCalculatorService';
import { 
  DerivativePosition, 
  OptionPosition, 
  FuturesPosition, 
  DerivativeOrder 
} from '@copytrade/shared-types';

describe('MarginCalculatorService', () => {
  let marginCalculator: MarginCalculatorService;

  beforeEach(() => {
    marginCalculator = new MarginCalculatorService();
  });

  afterEach(() => {
    marginCalculator.shutdown();
  });

  describe('Option Margin Calculations', () => {
    it('should calculate margin for short call option correctly', () => {
      const shortCallPosition: OptionPosition = {
        id: '1',
        brokerId: 'broker1',
        symbol: 'NIFTY24JAN20000CE',
        underlying: 'NIFTY',
        positionType: 'short',
        quantity: 50,
        avgPrice: 100,
        currentPrice: 120,
        unrealizedPnL: -1000,
        realizedPnL: 0,
        totalPnL: -1000,
        positionValue: -6000,
        marginUsed: 150000,
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
      };

      const marginReq = marginCalculator.calculatePositionMargin(shortCallPosition, 'initial');

      expect(marginReq.symbol).toBe('NIFTY24JAN20000CE');
      expect(marginReq.underlying).toBe('NIFTY');
      expect(marginReq.initialMargin).toBeGreaterThan(0);
      expect(marginReq.maintenanceMargin).toBeGreaterThan(0);
      expect(marginReq.marginType).toBe('span');
      expect(marginReq.calculationMethod).toBe('SPAN + Exposure');
      expect(marginReq.additionalFactors.length).toBeGreaterThan(0);
    });

    it('should calculate margin for long call option correctly', () => {
      const longCallPosition: OptionPosition = {
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
      };

      const marginReq = marginCalculator.calculatePositionMargin(longCallPosition, 'initial');

      expect(marginReq.initialMargin).toBe(5000); // Premium * quantity
      expect(marginReq.maintenanceMargin).toBe(0); // No maintenance margin for long options
      expect(marginReq.additionalFactors.length).toBe(1);
      expect(marginReq.additionalFactors[0]?.type).toBe('premium');
    });

    it('should apply volatility adjustment for high IV options', () => {
      const highVolPosition: OptionPosition = {
        id: '1',
        brokerId: 'broker1',
        symbol: 'NIFTY24JAN20000CE',
        underlying: 'NIFTY',
        positionType: 'short',
        quantity: 50,
        avgPrice: 100,
        currentPrice: 120,
        unrealizedPnL: -1000,
        realizedPnL: 0,
        totalPnL: -1000,
        positionValue: -6000,
        marginUsed: 150000,
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
        impliedVolatility: 0.5, // High volatility
        timeValue: 20,
        intrinsicValue: 100,
        daysToExpiry: 10
      };

      const marginReq = marginCalculator.calculatePositionMargin(highVolPosition, 'initial');
      const volatilityFactor = marginReq.additionalFactors.find(f => f.type === 'volatility' && f.description.includes('High volatility'));

      expect(volatilityFactor).toBeDefined();
      expect(volatilityFactor!.amount).toBeGreaterThan(0);
    });
  });

  describe('Futures Margin Calculations', () => {
    it('should calculate margin for futures position correctly', () => {
      const futuresPosition: FuturesPosition = {
        id: '1',
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
      };

      const marginReq = marginCalculator.calculatePositionMargin(futuresPosition, 'initial');

      expect(marginReq.symbol).toBe('NIFTY24JANFUT');
      expect(marginReq.underlying).toBe('NIFTY');
      expect(marginReq.initialMargin).toBeGreaterThan(0);
      expect(marginReq.maintenanceMargin).toBeGreaterThan(0);
      expect(marginReq.marginType).toBe('var');
      expect(marginReq.calculationMethod).toBe('Value at Risk');
      expect(marginReq.maintenanceMargin).toBeLessThan(marginReq.initialMargin);
    });
  });

  describe('Portfolio Margin Calculations', () => {
    it('should calculate total initial margin for multiple positions', () => {
      const positions: DerivativePosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'short',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: -1000,
          realizedPnL: 0,
          totalPnL: -1000,
          positionValue: -6000,
          marginUsed: 150000,
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
          avgPrice: 200,
          currentPrice: 250,
          unrealizedPnL: 1250,
          realizedPnL: 0,
          totalPnL: 1250,
          positionValue: 6250,
          marginUsed: 5000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const totalInitialMargin = marginCalculator.calculateInitialMargin(positions);
      const totalMaintenanceMargin = marginCalculator.calculateMaintenanceMargin(positions);

      expect(totalInitialMargin).toBeGreaterThan(0);
      expect(totalMaintenanceMargin).toBeGreaterThan(0);
      expect(totalMaintenanceMargin).toBeLessThanOrEqual(totalInitialMargin);
    });

    it('should calculate comprehensive margin information', () => {
      const positions: DerivativePosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'short',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: -1000,
          realizedPnL: 0,
          totalPnL: -1000,
          positionValue: -6000,
          marginUsed: 50000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const marginInfo = marginCalculator.calculateMarginInfo(positions, 100000, 50000);

      expect(marginInfo.totalEquity).toBe(100000);
      expect(marginInfo.usedMargin).toBe(50000);
      expect(marginInfo.availableMargin).toBe(50000);
      expect(marginInfo.marginUtilization).toBe(50);
      expect(marginInfo.marginCall).toBe(false);
      expect(marginInfo.lastCalculated).toBeInstanceOf(Date);
    });

    it('should detect margin call situation', () => {
      const positions: DerivativePosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'short',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: -1000,
          realizedPnL: 0,
          totalPnL: -1000,
          positionValue: -6000,
          marginUsed: 120000, // High margin usage
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const marginInfo = marginCalculator.calculateMarginInfo(positions, 100000, 20000);

      expect(marginInfo.marginCall).toBe(true);
      expect(marginInfo.marginUtilization).toBeGreaterThan(100);
    });
  });

  describe('Order Margin Validation', () => {
    it('should validate margin requirement for new order', () => {
      const order: DerivativeOrder = {
        id: 'order1',
        brokerId: 'broker1',
        symbol: 'NIFTY24JAN20000CE',
        underlying: 'NIFTY',
        orderType: 'limit',
        transactionType: 'sell',
        quantity: 25,
        price: 100,
        status: 'pending',
        filledQuantity: 0,
        avgFillPrice: 0,
        timestamp: new Date()
      };

      const currentPositions: DerivativePosition[] = [];
      const availableMargin = 50000;

      const isValid = marginCalculator.validateMarginRequirement(order, currentPositions, availableMargin);

      expect(typeof isValid).toBe('boolean');
    });

    it('should calculate margin impact of new order', () => {
      const order: DerivativeOrder = {
        id: 'order1',
        brokerId: 'broker1',
        symbol: 'NIFTY24JAN20000CE',
        underlying: 'NIFTY',
        orderType: 'limit',
        transactionType: 'sell',
        quantity: 25,
        price: 100,
        status: 'pending',
        filledQuantity: 0,
        avgFillPrice: 0,
        timestamp: new Date()
      };

      const currentPositions: DerivativePosition[] = [];
      const availableMargin = 50000;

      const marginImpact = marginCalculator.getMarginImpact(order, currentPositions, availableMargin);

      expect(marginImpact.additionalMargin).toBeGreaterThanOrEqual(0);
      expect(marginImpact.newTotalMargin).toBeGreaterThanOrEqual(0);
      expect(marginImpact.newMarginUtilization).toBeGreaterThanOrEqual(0);
      expect(typeof marginImpact.canPlaceOrder).toBe('boolean');
      expect(marginImpact.marginShortfall).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(marginImpact.suggestedActions)).toBe(true);
    });

    it('should suggest actions when margin is insufficient', () => {
      const order: DerivativeOrder = {
        id: 'order1',
        brokerId: 'broker1',
        symbol: 'NIFTY24JAN20000CE',
        underlying: 'NIFTY',
        orderType: 'limit',
        transactionType: 'sell',
        quantity: 1000, // Very large quantity requiring high margin
        price: 100,
        status: 'pending',
        filledQuantity: 0,
        avgFillPrice: 0,
        timestamp: new Date()
      };

      const currentPositions: DerivativePosition[] = [];
      const availableMargin = 100; // Very low available margin

      const marginImpact = marginCalculator.getMarginImpact(order, currentPositions, availableMargin);

      expect(marginImpact.canPlaceOrder).toBe(false);
      expect(marginImpact.marginShortfall).toBeGreaterThan(0);
      expect(marginImpact.suggestedActions.length).toBeGreaterThan(0);
    });
  });

  describe('Margin Monitoring', () => {
    it('should subscribe to margin monitoring', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      const marginThreshold = 85;

      marginCalculator.subscribeToMarginMonitoring(userId, brokerId, marginThreshold);

      const stats = marginCalculator.getStats();
      expect(stats.activeSubscriptions).toBe(1);
    });

    it('should unsubscribe from margin monitoring', () => {
      const userId = 'user1';
      const brokerId = 'broker1';

      marginCalculator.subscribeToMarginMonitoring(userId, brokerId);
      marginCalculator.unsubscribeFromMarginMonitoring(userId, brokerId);

      const stats = marginCalculator.getStats();
      expect(stats.activeSubscriptions).toBe(0);
    });

    it('should trigger margin call', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      const marginInfo: MarginInfo = {
        initialMargin: 100000,
        maintenanceMargin: 75000,
        availableMargin: 50000,
        marginUtilization: 120,
        marginCall: true,
        excessMargin: 0,
        usedMargin: 120000,
        totalEquity: 100000,
        lastCalculated: new Date()
      };
      const affectedPositions: DerivativePosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'short',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 120,
          unrealizedPnL: -1000,
          realizedPnL: 0,
          totalPnL: -1000,
          positionValue: -6000,
          marginUsed: 120000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const marginCall = marginCalculator.triggerMarginCall(userId, brokerId, marginInfo, affectedPositions);

      expect(marginCall.id).toBeDefined();
      expect(marginCall.userId).toBe(userId);
      expect(marginCall.brokerId).toBe(brokerId);
      expect(marginCall.status).toBe('active');
      expect(marginCall.marginDeficit).toBeGreaterThan(0);
      expect(marginCall.affectedPositions.length).toBe(1);
    });

    it('should resolve margin call', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      const marginInfo: MarginInfo = {
        initialMargin: 100000,
        maintenanceMargin: 75000,
        availableMargin: 50000,
        marginUtilization: 120,
        marginCall: true,
        excessMargin: 0,
        usedMargin: 120000,
        totalEquity: 100000,
        lastCalculated: new Date()
      };
      const affectedPositions: DerivativePosition[] = [];

      const marginCall = marginCalculator.triggerMarginCall(userId, brokerId, marginInfo, affectedPositions);
      
      const action = {
        type: 'add_funds' as const,
        description: 'Added funds to account',
        timestamp: new Date(),
        amount: 25000
      };

      const resolved = marginCalculator.resolveMarginCall(marginCall.id, action);

      expect(resolved).toBe(true);
    });

    it('should get active margin calls for user', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      const marginInfo: MarginInfo = {
        initialMargin: 100000,
        maintenanceMargin: 75000,
        availableMargin: 50000,
        marginUtilization: 120,
        marginCall: true,
        excessMargin: 0,
        usedMargin: 120000,
        totalEquity: 100000,
        lastCalculated: new Date()
      };
      const affectedPositions: DerivativePosition[] = [];

      marginCalculator.triggerMarginCall(userId, brokerId, marginInfo, affectedPositions);

      const activeMarginCalls = marginCalculator.getActiveMarginCalls(userId);

      expect(activeMarginCalls.length).toBe(1);
      expect(activeMarginCalls[0]?.userId).toBe(userId);
      expect(activeMarginCalls[0]?.status).toBe('active');
    });
  });

  describe('Service Statistics', () => {
    it('should return correct service statistics', () => {
      const stats = marginCalculator.getStats();

      expect(stats).toHaveProperty('activeSubscriptions');
      expect(stats).toHaveProperty('activeMarginCalls');
      expect(stats).toHaveProperty('monitoringFrequency');
      expect(stats).toHaveProperty('isMonitoring');
      
      expect(typeof stats.activeSubscriptions).toBe('number');
      expect(typeof stats.activeMarginCalls).toBe('number');
      expect(typeof stats.monitoringFrequency).toBe('number');
      expect(typeof stats.isMonitoring).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty positions array', () => {
      const totalInitialMargin = marginCalculator.calculateInitialMargin([]);
      const totalMaintenanceMargin = marginCalculator.calculateMaintenanceMargin([]);

      expect(totalInitialMargin).toBe(0);
      expect(totalMaintenanceMargin).toBe(0);
    });

    it('should handle zero equity in margin info calculation', () => {
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

      const marginInfo = marginCalculator.calculateMarginInfo(positions, 0, 0);

      expect(marginInfo.marginUtilization).toBe(0);
      expect(marginInfo.availableMargin).toBe(0);
    });

    it('should handle invalid margin call resolution', () => {
      const action = {
        type: 'add_funds' as const,
        description: 'Added funds to account',
        timestamp: new Date(),
        amount: 25000
      };

      const resolved = marginCalculator.resolveMarginCall('invalid-id', action);

      expect(resolved).toBe(false);
    });
  });
});