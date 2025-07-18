/**
 * Risk Limits Service Tests
 * Tests for risk limits configuration, monitoring, and alert system
 */

import { 
  RiskLimitsService, 
  RiskLimits, 
  RiskViolation,
  RiskAlertConfig,
  RiskAction,
  RiskViolationType
} from '../services/riskLimitsService';
import { PortfolioRisk } from '../services/portfolioRiskCalculator';
import { MarginInfo } from '../services/marginCalculatorService';
import { 
  DerivativePosition, 
  OptionPosition 
} from '@copytrade/shared-types';
import { beforeEach } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';

describe('RiskLimitsService', () => {
  let riskLimitsService: RiskLimitsService;

  beforeEach(() => {
    riskLimitsService = new RiskLimitsService();
  });

  afterEach(() => {
    riskLimitsService.shutdown();
  });

  describe('Risk Limits Configuration', () => {
    it('should set risk limits for a user', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      const limits = {
        maxPositionSize: 500000,
        maxDailyLoss: 25000,
        maxMarginUtilization: 75
      };

      const riskLimits = riskLimitsService.setRiskLimits(userId, brokerId, limits);

      expect(riskLimits.userId).toBe(userId);
      expect(riskLimits.brokerId).toBe(brokerId);
      expect(riskLimits.maxPositionSize).toBe(500000);
      expect(riskLimits.maxDailyLoss).toBe(25000);
      expect(riskLimits.maxMarginUtilization).toBe(75);
      expect(riskLimits.enabled).toBe(true);
      expect(riskLimits.lastUpdated).toBeInstanceOf(Date);
    });

    it('should get risk limits for a user', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      const limits = { maxPositionSize: 500000 };

      riskLimitsService.setRiskLimits(userId, brokerId, limits);
      const retrievedLimits = riskLimitsService.getRiskLimits(userId, brokerId);

      expect(retrievedLimits).not.toBeNull();
      expect(retrievedLimits!.maxPositionSize).toBe(500000);
    });

    it('should return null for non-existent risk limits', () => {
      const limits = riskLimitsService.getRiskLimits('nonexistent', 'broker1');
      expect(limits).toBeNull();
    });

    it('should use default values when partial limits are provided', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      const partialLimits = { maxPositionSize: 500000 };

      const riskLimits = riskLimitsService.setRiskLimits(userId, brokerId, partialLimits);

      expect(riskLimits.maxPositionSize).toBe(500000);
      expect(riskLimits.maxDailyLoss).toBeDefined();
      expect(riskLimits.maxMarginUtilization).toBeDefined();
      expect(riskLimits.enabled).toBe(true);
    });
  });

  describe('Risk Alert Configuration', () => {
    it('should configure risk alerts for a user', () => {
      const userId = 'user1';
      const alertConfig = {
        enabledAlerts: ['position_size', 'daily_loss'] as RiskViolationType[],
        warningThresholds: {
          position_size: 90,
          daily_loss: 85
        }
      };

      const config = riskLimitsService.configureRiskAlerts(userId, alertConfig);

      expect(config.userId).toBe(userId);
      expect(config.enabledAlerts).toContain('position_size');
      expect(config.enabledAlerts).toContain('daily_loss');
      expect(config.warningThresholds.position_size).toBe(90);
      expect(config.warningThresholds.daily_loss).toBe(85);
      expect(config.alertChannels.length).toBeGreaterThan(0);
    });

    it('should use default alert configuration when partial config is provided', () => {
      const userId = 'user1';
      const partialConfig = { enabledAlerts: ['position_size'] as RiskViolationType[] };

      const config = riskLimitsService.configureRiskAlerts(userId, partialConfig);

      expect(config.enabledAlerts).toContain('position_size');
      expect(config.alertChannels).toBeDefined();
      expect(config.warningThresholds).toBeDefined();
    });
  });

  describe('Risk Monitoring Subscription', () => {
    it('should subscribe to risk monitoring', () => {
      const userId = 'user1';
      const brokerId = 'broker1';

      riskLimitsService.subscribeToRiskMonitoring(userId, brokerId);

      const stats = riskLimitsService.getStats();
      expect(stats.monitoringSubscriptionsCount).toBe(1);
    });

    it('should unsubscribe from risk monitoring', () => {
      const userId = 'user1';
      const brokerId = 'broker1';

      riskLimitsService.subscribeToRiskMonitoring(userId, brokerId);
      riskLimitsService.unsubscribeFromRiskMonitoring(userId, brokerId);

      const stats = riskLimitsService.getStats();
      expect(stats.monitoringSubscriptionsCount).toBe(0);
    });

    it('should create default risk limits when subscribing without existing limits', () => {
      const userId = 'user1';
      const brokerId = 'broker1';

      riskLimitsService.subscribeToRiskMonitoring(userId, brokerId);

      const riskLimits = riskLimitsService.getRiskLimits(userId, brokerId);
      expect(riskLimits).not.toBeNull();
      expect(riskLimits!.enabled).toBe(true);
    });
  });

  describe('Risk Violation Detection', () => {
    let mockPortfolioRisk: PortfolioRisk;
    let mockMarginInfo: MarginInfo;
    let mockPositions: OptionPosition[];

    beforeEach(() => {
      mockPortfolioRisk = {
        totalValue: 1000000,
        derivativesExposure: 800000,
        marginUsed: 400000,
        marginAvailable: 600000,
        valueAtRisk: 50000,
        portfolioGreeks: {
          delta: 1000,
          gamma: 50,
          theta: -200,
          vega: 5000,
          rho: 300
        },
        concentrationRisk: {
          largestPositionPercent: 60,
          top5PositionsPercent: 85,
          underlyingCount: 3,
          herfindahlIndex: 0.4,
          underlyingConcentration: {
            'NIFTY': 60,
            'BANKNIFTY': 25,
            'RELIANCE': 15
          }
        },
        underlyingRisk: {},
        lastCalculated: new Date()
      };

      mockMarginInfo = {
        initialMargin: 400000,
        maintenanceMargin: 300000,
        availableMargin: 600000,
        marginUtilization: 40,
        marginCall: false,
        excessMargin: 200000,
        usedMargin: 400000,
        totalEquity: 1000000,
        lastCalculated: new Date()
      };

      mockPositions = [
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
          positionValue: 600000, // Large position
          marginUsed: 300000,
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
    });

    it('should detect position size violations', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      // Set low position size limit
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxPositionSize: 500000 // Lower than position value of 600000
      });

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, mockPositions, mockPortfolioRisk, mockMarginInfo, 0
      );

      const positionSizeViolations = violations.filter(v => v.type === 'position_size');
      expect(positionSizeViolations.length).toBe(1);
      expect(positionSizeViolations[0]?.currentValue).toBe(600000);
      expect(positionSizeViolations[0]?.limitValue).toBe(500000);
      expect(positionSizeViolations[0]?.violationPercent).toBeCloseTo(20, 1);
    });

    it('should detect daily loss violations', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxDailyLoss: 30000
      });

      const dailyPnL = -40000; // Loss exceeding limit

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, mockPositions, mockPortfolioRisk, mockMarginInfo, dailyPnL
      );

      const dailyLossViolations = violations.filter(v => v.type === 'daily_loss');
      expect(dailyLossViolations.length).toBe(1);
      expect(dailyLossViolations[0]?.currentValue).toBe(40000);
      expect(dailyLossViolations[0]?.limitValue).toBe(30000);
    });

    it('should detect margin utilization violations', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxMarginUtilization: 30 // Lower than current 40%
      });

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, mockPositions, mockPortfolioRisk, mockMarginInfo, 0
      );

      const marginViolations = violations.filter(v => v.type === 'margin_utilization');
      expect(marginViolations.length).toBe(1);
      expect(marginViolations[0]?.currentValue).toBe(40);
      expect(marginViolations[0]?.limitValue).toBe(30);
    });

    it('should detect Greeks exposure violations', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxVegaExposure: 3000, // Lower than current 5000
        maxDeltaExposure: 500   // Lower than current 1000
      });

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, mockPositions, mockPortfolioRisk, mockMarginInfo, 0
      );

      const vegaViolations = violations.filter(v => v.type === 'vega_exposure');
      const deltaViolations = violations.filter(v => v.type === 'delta_exposure');
      
      expect(vegaViolations.length).toBe(1);
      expect(deltaViolations.length).toBe(1);
      expect(vegaViolations[0]?.currentValue).toBe(5000);
      expect(deltaViolations[0]?.currentValue).toBe(1000);
    });

    it('should detect concentration violations', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxConcentrationPercent: 40 // Lower than current 60%
      });

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, mockPositions, mockPortfolioRisk, mockMarginInfo, 0
      );

      const concentrationViolations = violations.filter(v => v.type === 'concentration');
      expect(concentrationViolations.length).toBe(1);
      expect(concentrationViolations[0]?.currentValue).toBe(60);
      expect(concentrationViolations[0]?.limitValue).toBe(40);
    });

    it('should detect VaR violations', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxValueAtRisk: 30000 // Lower than current 50000
      });

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, mockPositions, mockPortfolioRisk, mockMarginInfo, 0
      );

      const varViolations = violations.filter(v => v.type === 'value_at_risk');
      expect(varViolations.length).toBe(1);
      expect(varViolations[0]?.currentValue).toBe(50000);
      expect(varViolations[0]?.limitValue).toBe(30000);
    });

    it('should not detect violations when limits are disabled', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxPositionSize: 100000, // Much lower than position value
        enabled: false // Disabled
      });

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, mockPositions, mockPortfolioRisk, mockMarginInfo, 0
      );

      expect(violations.length).toBe(0);
    });

    it('should assign appropriate severity levels', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxPositionSize: 300000 // Much lower than position value (600000)
      });

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, mockPositions, mockPortfolioRisk, mockMarginInfo, 0
      );

      const positionSizeViolation = violations.find(v => v.type === 'position_size');
      expect(positionSizeViolation).toBeDefined();
      expect(positionSizeViolation!.severity).toBe('critical'); // 100% violation should be critical
    });
  });

  describe('Risk Reduction Suggestions', () => {
    it('should generate position size reduction suggestions', () => {
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
          positionValue: 600000,
          marginUsed: 300000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const violation: RiskViolation = {
        id: 'test-violation',
        userId: 'user1',
        brokerId: 'broker1',
        type: 'position_size',
        severity: 'error',
        message: 'Position size exceeds limit',
        currentValue: 600000,
        limitValue: 500000,
        violationPercent: 20,
        affectedPositions: ['1'],
        suggestedActions: [],
        autoRemediation: false,
        timestamp: new Date(),
        status: 'active'
      };

      const suggestions = riskLimitsService.generateRiskReductionSuggestions(positions, [violation]);

      expect(suggestions.length).toBeGreaterThan(0);
      const positionReduction = suggestions.find(s => s.type === 'reduce_position');
      expect(positionReduction).toBeDefined();
      expect(positionReduction!.positionId).toBe('1');
      expect(positionReduction!.suggestedAmount).toBe(100000); // 600000 - 500000
    });

    it('should generate loss reduction suggestions', () => {
      const positions: DerivativePosition[] = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'long',
          quantity: 50,
          avgPrice: 100,
          currentPrice: 80,
          unrealizedPnL: -1000, // Losing position
          realizedPnL: 0,
          totalPnL: -1000,
          positionValue: 400000,
          marginUsed: 200000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const violation: RiskViolation = {
        id: 'test-violation',
        userId: 'user1',
        brokerId: 'broker1',
        type: 'daily_loss',
        severity: 'error',
        message: 'Daily loss exceeds limit',
        currentValue: 40000,
        limitValue: 30000,
        violationPercent: 33,
        affectedPositions: [],
        suggestedActions: [],
        autoRemediation: false,
        timestamp: new Date(),
        status: 'active'
      };

      const suggestions = riskLimitsService.generateRiskReductionSuggestions(positions, [violation]);

      expect(suggestions.length).toBeGreaterThan(0);
      const closePosition = suggestions.find(s => s.type === 'close_position');
      const stopTrading = suggestions.find(s => s.type === 'stop_trading');
      
      expect(closePosition).toBeDefined();
      expect(stopTrading).toBeDefined();
      expect(stopTrading!.autoExecutable).toBe(true);
    });

    it('should generate margin reduction suggestions', () => {
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
          positionValue: 600000,
          marginUsed: 400000, // High margin usage
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const violation: RiskViolation = {
        id: 'test-violation',
        userId: 'user1',
        brokerId: 'broker1',
        type: 'margin_utilization',
        severity: 'error',
        message: 'Margin utilization exceeds limit',
        currentValue: 90,
        limitValue: 80,
        violationPercent: 12.5,
        affectedPositions: [],
        suggestedActions: [],
        autoRemediation: false,
        timestamp: new Date(),
        status: 'active'
      };

      const suggestions = riskLimitsService.generateRiskReductionSuggestions(positions, [violation]);

      expect(suggestions.length).toBeGreaterThan(0);
      const addMargin = suggestions.find(s => s.type === 'add_margin');
      const reducePosition = suggestions.find(s => s.type === 'reduce_position');
      
      expect(addMargin).toBeDefined();
      expect(reducePosition).toBeDefined();
    });
  });

  describe('Violation Management', () => {
    it('should get active violations for a user', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxPositionSize: 100000
      });

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
          positionValue: 600000,
          marginUsed: 300000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const mockPortfolioRisk: PortfolioRisk = {
        totalValue: 600000,
        derivativesExposure: 600000,
        marginUsed: 300000,
        marginAvailable: 300000,
        valueAtRisk: 30000,
        portfolioGreeks: { delta: 30, gamma: 1, theta: -250, vega: 750, rho: 400 },
        concentrationRisk: {
          largestPositionPercent: 100,
          top5PositionsPercent: 100,
          underlyingCount: 1,
          herfindahlIndex: 1,
          underlyingConcentration: { 'NIFTY': 100 }
        },
        underlyingRisk: {},
        lastCalculated: new Date()
      };

      const mockMarginInfo: MarginInfo = {
        initialMargin: 300000,
        maintenanceMargin: 225000,
        availableMargin: 300000,
        marginUtilization: 50,
        marginCall: false,
        excessMargin: 0,
        usedMargin: 300000,
        totalEquity: 600000,
        lastCalculated: new Date()
      };

      riskLimitsService.checkRiskViolations(
        userId, brokerId, positions, mockPortfolioRisk, mockMarginInfo, 0
      );

      const activeViolations = riskLimitsService.getActiveViolations(userId, brokerId);
      expect(activeViolations.length).toBeGreaterThan(0);
      expect(activeViolations[0]?.status).toBe('active');
    });

    it('should acknowledge violations', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxPositionSize: 100000
      });

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
          positionValue: 600000,
          marginUsed: 300000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const mockPortfolioRisk: PortfolioRisk = {
        totalValue: 600000,
        derivativesExposure: 600000,
        marginUsed: 300000,
        marginAvailable: 300000,
        valueAtRisk: 30000,
        portfolioGreeks: { delta: 30, gamma: 1, theta: -250, vega: 750, rho: 400 },
        concentrationRisk: {
          largestPositionPercent: 100,
          top5PositionsPercent: 100,
          underlyingCount: 1,
          herfindahlIndex: 1,
          underlyingConcentration: { 'NIFTY': 100 }
        },
        underlyingRisk: {},
        lastCalculated: new Date()
      };

      const mockMarginInfo: MarginInfo = {
        initialMargin: 300000,
        maintenanceMargin: 225000,
        availableMargin: 300000,
        marginUtilization: 50,
        marginCall: false,
        excessMargin: 0,
        usedMargin: 300000,
        totalEquity: 600000,
        lastCalculated: new Date()
      };

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, positions, mockPortfolioRisk, mockMarginInfo, 0
      );

      expect(violations.length).toBeGreaterThan(0);
      const violationId = violations[0]!.id;

      const acknowledged = riskLimitsService.acknowledgeViolation(violationId);
      expect(acknowledged).toBe(true);

      const activeViolations = riskLimitsService.getActiveViolations(userId, brokerId);
      const acknowledgedViolation = activeViolations.find(v => v.id === violationId);
      expect(acknowledgedViolation?.status).toBe('acknowledged');
    });

    it('should resolve violations', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxPositionSize: 100000
      });

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
          positionValue: 600000,
          marginUsed: 300000,
          entryDate: new Date(),
          lastUpdated: new Date()
        }
      ];

      const mockPortfolioRisk: PortfolioRisk = {
        totalValue: 600000,
        derivativesExposure: 600000,
        marginUsed: 300000,
        marginAvailable: 300000,
        valueAtRisk: 30000,
        portfolioGreeks: { delta: 30, gamma: 1, theta: -250, vega: 750, rho: 400 },
        concentrationRisk: {
          largestPositionPercent: 100,
          top5PositionsPercent: 100,
          underlyingCount: 1,
          herfindahlIndex: 1,
          underlyingConcentration: { 'NIFTY': 100 }
        },
        underlyingRisk: {},
        lastCalculated: new Date()
      };

      const mockMarginInfo: MarginInfo = {
        initialMargin: 300000,
        maintenanceMargin: 225000,
        availableMargin: 300000,
        marginUtilization: 50,
        marginCall: false,
        excessMargin: 0,
        usedMargin: 300000,
        totalEquity: 600000,
        lastCalculated: new Date()
      };

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, positions, mockPortfolioRisk, mockMarginInfo, 0
      );

      expect(violations.length).toBeGreaterThan(0);
      const violationId = violations[0]!.id;

      const resolved = riskLimitsService.resolveViolation(violationId);
      expect(resolved).toBe(true);

      const activeViolations = riskLimitsService.getActiveViolations(userId, brokerId);
      const resolvedViolation = activeViolations.find(v => v.id === violationId);
      expect(resolvedViolation?.status).toBe('resolved');
      expect(resolvedViolation?.resolvedAt).toBeInstanceOf(Date);
    });

    it('should return false when acknowledging non-existent violation', () => {
      const acknowledged = riskLimitsService.acknowledgeViolation('non-existent-id');
      expect(acknowledged).toBe(false);
    });

    it('should return false when resolving non-existent violation', () => {
      const resolved = riskLimitsService.resolveViolation('non-existent-id');
      expect(resolved).toBe(false);
    });
  });

  describe('Auto Risk Reduction', () => {
    it('should execute auto risk reduction for critical violations', async () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      const criticalViolation: RiskViolation = {
        id: 'critical-violation',
        userId,
        brokerId,
        type: 'daily_loss',
        severity: 'critical',
        message: 'Critical daily loss violation',
        currentValue: 100000,
        limitValue: 50000,
        violationPercent: 100,
        affectedPositions: [],
        suggestedActions: [
          {
            type: 'stop_trading',
            description: 'Stop trading immediately',
            priority: 'critical',
            estimatedImpact: 0,
            autoExecutable: true
          }
        ],
        autoRemediation: true,
        timestamp: new Date(),
        status: 'active'
      };

      // Enable auto risk reduction
      riskLimitsService.setRiskLimits(userId, brokerId, {
        autoRiskReduction: true
      });

      const executed = await riskLimitsService.executeAutoRiskReduction(
        userId, brokerId, [criticalViolation]
      );

      expect(executed).toBe(true);
    });

    it('should not execute auto risk reduction when disabled', async () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      const criticalViolation: RiskViolation = {
        id: 'critical-violation',
        userId,
        brokerId,
        type: 'daily_loss',
        severity: 'critical',
        message: 'Critical daily loss violation',
        currentValue: 100000,
        limitValue: 50000,
        violationPercent: 100,
        affectedPositions: [],
        suggestedActions: [],
        autoRemediation: true,
        timestamp: new Date(),
        status: 'active'
      };

      // Disable auto risk reduction
      riskLimitsService.setRiskLimits(userId, brokerId, {
        autoRiskReduction: false
      });

      const executed = await riskLimitsService.executeAutoRiskReduction(
        userId, brokerId, [criticalViolation]
      );

      expect(executed).toBe(false);
    });

    it('should not execute auto risk reduction for non-critical violations', async () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      const warningViolation: RiskViolation = {
        id: 'warning-violation',
        userId,
        brokerId,
        type: 'position_size',
        severity: 'warning',
        message: 'Position size warning',
        currentValue: 110000,
        limitValue: 100000,
        violationPercent: 10,
        affectedPositions: [],
        suggestedActions: [],
        autoRemediation: false,
        timestamp: new Date(),
        status: 'active'
      };

      riskLimitsService.setRiskLimits(userId, brokerId, {
        autoRiskReduction: true
      });

      const executed = await riskLimitsService.executeAutoRiskReduction(
        userId, brokerId, [warningViolation]
      );

      expect(executed).toBe(false);
    });
  });

  describe('Service Statistics', () => {
    it('should return correct service statistics', () => {
      const stats = riskLimitsService.getStats();

      expect(stats).toHaveProperty('riskLimitsCount');
      expect(stats).toHaveProperty('alertConfigsCount');
      expect(stats).toHaveProperty('activeViolationsCount');
      expect(stats).toHaveProperty('monitoringSubscriptionsCount');
      expect(stats).toHaveProperty('isMonitoring');
      expect(stats).toHaveProperty('monitoringFrequency');
      
      expect(typeof stats.riskLimitsCount).toBe('number');
      expect(typeof stats.alertConfigsCount).toBe('number');
      expect(typeof stats.activeViolationsCount).toBe('number');
      expect(typeof stats.monitoringSubscriptionsCount).toBe('number');
      expect(typeof stats.isMonitoring).toBe('boolean');
      expect(typeof stats.monitoringFrequency).toBe('number');
    });

    it('should update statistics when limits and subscriptions are added', () => {
      const userId = 'user1';
      const brokerId = 'broker1';

      riskLimitsService.setRiskLimits(userId, brokerId, {});
      riskLimitsService.configureRiskAlerts(userId, {});
      riskLimitsService.subscribeToRiskMonitoring(userId, brokerId);

      const stats = riskLimitsService.getStats();

      expect(stats.riskLimitsCount).toBe(1);
      expect(stats.alertConfigsCount).toBe(1);
      expect(stats.monitoringSubscriptionsCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty positions array', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {});

      const mockPortfolioRisk: PortfolioRisk = {
        totalValue: 0,
        derivativesExposure: 0,
        marginUsed: 0,
        marginAvailable: 100000,
        valueAtRisk: 0,
        portfolioGreeks: { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
        concentrationRisk: {
          largestPositionPercent: 0,
          top5PositionsPercent: 0,
          underlyingCount: 0,
          herfindahlIndex: 0,
          underlyingConcentration: {}
        },
        underlyingRisk: {},
        lastCalculated: new Date()
      };

      const mockMarginInfo: MarginInfo = {
        initialMargin: 0,
        maintenanceMargin: 0,
        availableMargin: 100000,
        marginUtilization: 0,
        marginCall: false,
        excessMargin: 100000,
        usedMargin: 0,
        totalEquity: 100000,
        lastCalculated: new Date()
      };

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, [], mockPortfolioRisk, mockMarginInfo, 0
      );

      expect(violations.length).toBe(0);
    });

    it('should handle zero values in risk calculations', () => {
      const userId = 'user1';
      const brokerId = 'broker1';
      
      riskLimitsService.setRiskLimits(userId, brokerId, {
        maxPositionSize: 0,
        maxDailyLoss: 0,
        maxValueAtRisk: 0
      });

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

      const mockPortfolioRisk: PortfolioRisk = {
        totalValue: 0,
        derivativesExposure: 0,
        marginUsed: 0,
        marginAvailable: 0,
        valueAtRisk: 0,
        portfolioGreeks: { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
        concentrationRisk: {
          largestPositionPercent: 0,
          top5PositionsPercent: 0,
          underlyingCount: 0,
          herfindahlIndex: 0,
          underlyingConcentration: {}
        },
        underlyingRisk: {},
        lastCalculated: new Date()
      };

      const mockMarginInfo: MarginInfo = {
        initialMargin: 0,
        maintenanceMargin: 0,
        availableMargin: 0,
        marginUtilization: 0,
        marginCall: false,
        excessMargin: 0,
        usedMargin: 0,
        totalEquity: 0,
        lastCalculated: new Date()
      };

      const violations = riskLimitsService.checkRiskViolations(
        userId, brokerId, positions, mockPortfolioRisk, mockMarginInfo, 0
      );

      expect(violations.length).toBe(0);
    });
  });
});