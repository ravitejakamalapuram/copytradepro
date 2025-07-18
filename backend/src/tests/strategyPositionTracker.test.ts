import { StrategyPositionTracker, StrategyPosition, StrategyLegPosition } from '../services/strategyPositionTracker';
import { DerivativeStrategy, StrategyLeg } from '../services/strategyBuilderService';
import { MultiLegExecutionResult, LegExecutionResult } from '../services/multiLegOrderManager';
import { Greeks } from '../../../dev-packages/shared-types/src/derivatives';
import { beforeEach } from 'node:test';
import { beforeEach } from 'node:test';
import { beforeEach } from 'node:test';
import { beforeEach } from 'node:test';
import { beforeEach } from 'node:test';
import { beforeEach } from 'node:test';
import { beforeEach } from 'node:test';
import { beforeEach } from 'node:test';

describe('StrategyPositionTracker', () => {
  let tracker: StrategyPositionTracker;
  let mockStrategy: DerivativeStrategy;
  let mockExecution: MultiLegExecutionResult;

  beforeEach(() => {
    tracker = new StrategyPositionTracker();
    
    // Mock strategy
    mockStrategy = {
      id: 'strategy_123',
      name: 'Bull Call Spread',
      type: 'bull_call_spread',
      description: 'Test bull call spread',
      underlying: 'NIFTY',
      legs: [
        {
          id: 'leg_1',
          instrumentType: 'option',
          symbol: 'NIFTY_CALL_18000',
          underlying: 'NIFTY',
          action: 'buy',
          quantity: 1,
          strike: 18000,
          optionType: 'call',
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          orderType: 'market',
          limitPrice: undefined,
          marketPrice: 150,
          ratio: 1
        },
        {
          id: 'leg_2',
          instrumentType: 'option',
          symbol: 'NIFTY_CALL_18100',
          underlying: 'NIFTY',
          action: 'sell',
          quantity: 1,
          strike: 18100,
          optionType: 'call',
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          orderType: 'market',
          limitPrice: undefined,
          marketPrice: 100,
          ratio: 1
        }
      ],
      netPremium: -50, // Net debit
      maxProfit: 50,
      maxLoss: -50,
      breakeven: [18050],
      greeks: { delta: 0.3, gamma: 0.02, theta: -0.05, vega: 0.15, rho: 0.05 },
      marginRequired: 5000,
      riskRewardRatio: 1,
      probabilityOfProfit: 60,
      daysToExpiry: 30,
      createdAt: new Date(),
      status: 'validated'
    };

    // Mock execution result
    mockExecution = {
      executionId: 'exec_123',
      strategyId: 'strategy_123',
      status: 'completed',
      legResults: [
        {
          legId: 'leg_1',
          orderId: 'order_1',
          brokerId: 'fyers',
          status: 'filled',
          requestedQuantity: 1,
          filledQuantity: 1,
          avgFillPrice: 150,
          fillValue: 150,
          executionTime: new Date(),
          partialFills: [{
            fillId: 'fill_1',
            quantity: 1,
            price: 150,
            timestamp: new Date(),
            value: 150
          }]
        },
        {
          legId: 'leg_2',
          orderId: 'order_2',
          brokerId: 'fyers',
          status: 'filled',
          requestedQuantity: 1,
          filledQuantity: 1,
          avgFillPrice: 100,
          fillValue: 100,
          executionTime: new Date(),
          partialFills: [{
            fillId: 'fill_2',
            quantity: 1,
            price: 100,
            timestamp: new Date(),
            value: 100
          }]
        }
      ],
      filledLegs: 2,
      totalLegs: 2,
      netPremium: -50,
      startTime: new Date(),
      endTime: new Date()
    };
  });

  describe('createStrategyPosition', () => {
    it('should create strategy position from completed execution', async () => {
      const position = await tracker.createStrategyPosition(mockStrategy, mockExecution);

      expect(position).toBeDefined();
      expect(position.strategyId).toBe(mockStrategy.id);
      expect(position.name).toBe(mockStrategy.name);
      expect(position.type).toBe(mockStrategy.type);
      expect(position.underlying).toBe(mockStrategy.underlying);
      expect(position.netPremium).toBe(mockExecution.netPremium);
      expect(position.status).toBe('active');
      expect(position.legs).toHaveLength(2);
    });

    it('should create correct leg positions', async () => {
      const position = await tracker.createStrategyPosition(mockStrategy, mockExecution);

      const buyLeg = position.legs.find(leg => leg.action === 'buy');
      const sellLeg = position.legs.find(leg => leg.action === 'sell');

      expect(buyLeg).toBeDefined();
      expect(buyLeg?.symbol).toBe('NIFTY_CALL_18000');
      expect(buyLeg?.entryPrice).toBe(150);
      expect(buyLeg?.quantity).toBe(1);

      expect(sellLeg).toBeDefined();
      expect(sellLeg?.symbol).toBe('NIFTY_CALL_18100');
      expect(sellLeg?.entryPrice).toBe(100);
      expect(sellLeg?.quantity).toBe(1);
    });

    it('should initialize strategy metrics', async () => {
      const position = await tracker.createStrategyPosition(mockStrategy, mockExecution);

      expect(position.greeks).toBeDefined();
      expect(position.performance).toBeDefined();
      expect(position.maxProfit).toBe(mockStrategy.maxProfit);
      expect(position.maxLoss).toBe(mockStrategy.maxLoss);
    });

    it('should reject incomplete executions', async () => {
      const incompleteExecution = { ...mockExecution, status: 'pending' as const };
      
      await expect(
        tracker.createStrategyPosition(mockStrategy, incompleteExecution)
      ).rejects.toThrow('Cannot create position from incomplete execution');
    });

    it('should handle partial executions', async () => {
      const partialExecution = { ...mockExecution, status: 'partial' as const };
      
      const position = await tracker.createStrategyPosition(mockStrategy, partialExecution);
      
      expect(position).toBeDefined();
      expect(position.status).toBe('active');
    });
  });

  describe('updateStrategyPosition', () => {
    let position: StrategyPosition;

    beforeEach(async () => {
      position = await tracker.createStrategyPosition(mockStrategy, mockExecution);
    });

    it('should update position with current market data', async () => {
      const updatedPosition = await tracker.updateStrategyPosition(position.id);

      expect(updatedPosition).toBeDefined();
      expect(updatedPosition?.lastUpdated).toBeInstanceOf(Date);
    });

    it('should calculate P&L correctly', async () => {
      const updatedPosition = await tracker.updateStrategyPosition(position.id);

      expect(updatedPosition).toBeDefined();
      expect(updatedPosition?.totalPnL).toBeDefined();
      expect(updatedPosition?.unrealizedPnL).toBeDefined();
    });

    it('should update strategy Greeks', async () => {
      const updatedPosition = await tracker.updateStrategyPosition(position.id);

      expect(updatedPosition).toBeDefined();
      expect(updatedPosition?.greeks).toBeDefined();
      expect(updatedPosition?.greeks.delta).toBeDefined();
      expect(updatedPosition?.greeks.gamma).toBeDefined();
      expect(updatedPosition?.greeks.theta).toBeDefined();
      expect(updatedPosition?.greeks.vega).toBeDefined();
      expect(updatedPosition?.greeks.rho).toBeDefined();
    });

    it('should return null for non-existent position', async () => {
      const result = await tracker.updateStrategyPosition('non_existent');
      expect(result).toBeNull();
    });
  });

  describe('calculateStrategyPnL', () => {
    let position: StrategyPosition;

    beforeEach(async () => {
      position = await tracker.createStrategyPosition(mockStrategy, mockExecution);
      
      // Set current prices for testing
      if (position.legs[0]) {
        position.legs[0].currentPrice = 160; // Buy leg gained 10
        position.legs[0].pnl = 10;
      }
      if (position.legs[1]) {
        position.legs[1].currentPrice = 90;  // Sell leg gained 10
        position.legs[1].pnl = 10;
      }
    });

    it('should calculate current strategy value', () => {
      const pnlCalc = tracker.calculateStrategyPnL(position);

      expect(pnlCalc.currentValue).toBeDefined();
      expect(pnlCalc.unrealizedPnL).toBeDefined();
      expect(pnlCalc.legPnL).toBeDefined();
    });

    it('should calculate Greeks contribution', () => {
      const pnlCalc = tracker.calculateStrategyPnL(position);

      expect(pnlCalc.greeksContribution).toBeDefined();
      expect(pnlCalc.greeksContribution.delta).toBeDefined();
      expect(pnlCalc.greeksContribution.gamma).toBeDefined();
      expect(pnlCalc.greeksContribution.theta).toBeDefined();
      expect(pnlCalc.greeksContribution.vega).toBeDefined();
      expect(pnlCalc.greeksContribution.rho).toBeDefined();
    });

    it('should calculate time decay and volatility impact', () => {
      const pnlCalc = tracker.calculateStrategyPnL(position);

      expect(pnlCalc.timeDecayImpact).toBeDefined();
      expect(pnlCalc.volatilityImpact).toBeDefined();
    });
  });

  describe('position management', () => {
    let position: StrategyPosition;

    beforeEach(async () => {
      position = await tracker.createStrategyPosition(mockStrategy, mockExecution);
    });

    it('should get strategy position by ID', () => {
      const retrieved = tracker.getStrategyPosition(position.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(position.id);
    });

    it('should get all strategy positions', () => {
      const positions = tracker.getAllStrategyPositions();
      expect(positions).toHaveLength(1);
      expect(positions[0]?.id).toBe(position.id);
    });

    it('should get positions by underlying', () => {
      const positions = tracker.getStrategyPositionsByUnderlying('NIFTY');
      expect(positions).toHaveLength(1);
      expect(positions[0]?.underlying).toBe('NIFTY');

      const emptyPositions = tracker.getStrategyPositionsByUnderlying('BANKNIFTY');
      expect(emptyPositions).toHaveLength(0);
    });

    it('should get active positions', () => {
      const activePositions = tracker.getActiveStrategyPositions();
      expect(activePositions).toHaveLength(1);
      expect(activePositions[0]?.status).toBe('active');
    });

    it('should close strategy position', async () => {
      // First update the position to get some unrealized P&L
      await tracker.updateStrategyPosition(position.id);
      const positionBeforeClose = tracker.getStrategyPosition(position.id);
      const unrealizedPnLBeforeClose = positionBeforeClose?.unrealizedPnL || 0;

      const success = await tracker.closeStrategyPosition(position.id);
      expect(success).toBe(true);

      const closedPosition = tracker.getStrategyPosition(position.id);
      expect(closedPosition?.status).toBe('closed');
      expect(closedPosition?.realizedPnL).toBe(unrealizedPnLBeforeClose);
      expect(closedPosition?.unrealizedPnL).toBe(0);
    });

    it('should return false when closing non-existent position', async () => {
      const success = await tracker.closeStrategyPosition('non_existent');
      expect(success).toBe(false);
    });
  });

  describe('position updates subscription', () => {
    let position: StrategyPosition;
    let callbackCalled = false;
    let callbackPosition: StrategyPosition | null = null;

    beforeEach(async () => {
      position = await tracker.createStrategyPosition(mockStrategy, mockExecution);
      callbackCalled = false;
      callbackPosition = null;
    });

    it('should trigger callback on position update', async () => {
      tracker.subscribeToPositionUpdates(position.id, (updatedPosition) => {
        callbackCalled = true;
        callbackPosition = updatedPosition;
      });

      await tracker.updateStrategyPosition(position.id);

      expect(callbackCalled).toBe(true);
      expect(callbackPosition).toBeDefined();
      expect(callbackPosition?.id).toBe(position.id);
    });

    it('should not trigger callback after unsubscribe', async () => {
      tracker.subscribeToPositionUpdates(position.id, () => {
        callbackCalled = true;
      });

      tracker.unsubscribeFromPositionUpdates(position.id);
      await tracker.updateStrategyPosition(position.id);

      expect(callbackCalled).toBe(false);
    });
  });

  describe('portfolio metrics', () => {
    beforeEach(async () => {
      // Create multiple positions
      await tracker.createStrategyPosition(mockStrategy, mockExecution);
      
      const strategy2 = { ...mockStrategy, id: 'strategy_456', underlying: 'BANKNIFTY' };
      const execution2 = { ...mockExecution, strategyId: 'strategy_456', executionId: 'exec_456' };
      await tracker.createStrategyPosition(strategy2, execution2);
    });

    it('should calculate portfolio-level metrics', () => {
      const metrics = tracker.getPortfolioStrategyMetrics();

      expect(metrics.totalPositions).toBe(2);
      expect(metrics.activeStrategies).toBe(2);
      expect(metrics.totalPnL).toBeDefined();
      expect(metrics.totalMarginUsed).toBeDefined();
      expect(metrics.portfolioGreeks).toBeDefined();
    });

    it('should aggregate portfolio Greeks', () => {
      const metrics = tracker.getPortfolioStrategyMetrics();

      expect(metrics.portfolioGreeks.delta).toBeDefined();
      expect(metrics.portfolioGreeks.gamma).toBeDefined();
      expect(metrics.portfolioGreeks.theta).toBeDefined();
      expect(metrics.portfolioGreeks.vega).toBeDefined();
      expect(metrics.portfolioGreeks.rho).toBeDefined();
    });
  });

  describe('performance metrics calculation', () => {
    let position: StrategyPosition;

    beforeEach(async () => {
      position = await tracker.createStrategyPosition(mockStrategy, mockExecution);
      
      // Simulate some time passing and P&L
      position.unrealizedPnL = 25;
      position.totalPnL = 25;
    });

    it('should calculate ROI correctly', async () => {
      await tracker.updateStrategyPosition(position.id);
      const updatedPosition = tracker.getStrategyPosition(position.id);

      expect(updatedPosition?.performance.roi).toBeDefined();
      expect(typeof updatedPosition?.performance.roi).toBe('number');
    });

    it('should calculate annualized return', async () => {
      await tracker.updateStrategyPosition(position.id);
      const updatedPosition = tracker.getStrategyPosition(position.id);

      expect(updatedPosition?.performance.annualizedReturn).toBeDefined();
      expect(typeof updatedPosition?.performance.annualizedReturn).toBe('number');
    });

    it('should track days held', async () => {
      await tracker.updateStrategyPosition(position.id);
      const updatedPosition = tracker.getStrategyPosition(position.id);

      expect(updatedPosition?.performance.daysHeld).toBeGreaterThan(0);
    });

    it('should calculate current return percentage', async () => {
      await tracker.updateStrategyPosition(position.id);
      const updatedPosition = tracker.getStrategyPosition(position.id);

      expect(updatedPosition?.performance.currentReturn).toBeDefined();
      expect(typeof updatedPosition?.performance.currentReturn).toBe('number');
    });
  });

  describe('bulk operations', () => {
    beforeEach(async () => {
      // Create multiple active positions
      await tracker.createStrategyPosition(mockStrategy, mockExecution);
      
      const strategy2 = { ...mockStrategy, id: 'strategy_456' };
      const execution2 = { ...mockExecution, strategyId: 'strategy_456', executionId: 'exec_456' };
      await tracker.createStrategyPosition(strategy2, execution2);
      
      // Close one position
      const positions = tracker.getAllStrategyPositions();
      if (positions[1]) {
        await tracker.closeStrategyPosition(positions[1].id);
      }
    });

    it('should update all active positions', async () => {
      await tracker.updateAllActivePositions();
      
      const activePositions = tracker.getActiveStrategyPositions();
      expect(activePositions).toHaveLength(1);
      
      // All active positions should have recent update timestamps
      activePositions.forEach(position => {
        const timeDiff = Date.now() - position.lastUpdated.getTime();
        expect(timeDiff).toBeLessThan(5000); // Updated within last 5 seconds
      });
    });
  });
});